// Maps simulation / session events to sounds: picks the variation, the floor
// surface, the acoustic space and the hit material, positions everything in
// stereo relative to the camera (`spatialize`, injected) and drives the
// ambience and the music. Knows nothing about rendering. Owner: audio.
// Levels per event: config/audio.js EVENT_SOUNDS.
import { EV } from '../core/events.js';
import { clamp, lerp, invLerp } from '../core/math.js';
import {
  MIX, SPATIAL, ZONES, EVENT_SOUNDS as L, STEP, NEAR_MISS, PLANT_BEEP, BOMB_BEEP, RELOADS, MUSIC, UI_SOUNDS, DOOR_SWING_SECONDS, DISTANCE_LOWPASS,
  HELMET_HEADGEAR, GUN_MIX,
} from '../config/audio.js';
import { WEAPONS } from '../config/weapons.js';
import { ROLE_GEAR, TEAM_GEAR } from '../config/render.js';
import { TEAMS, PLAYER_TEAM } from '../config/squad.js';
import { unitById, defuseProgress, teamUnits, enemyTeam } from '../sim/queries.js';
import { weaponSoundNames, gunLayerNames, GUN_LAYERS } from './recipes/index.js';
import { acousticsAt, impactSoundFor, nearMiss } from './surfaces.js';
import { Ambience } from './Ambience.js';
import { Music } from './Music.js';

/** Route edit kind (EV.ROUTE_CHANGED) -> UI cue. */
const ROUTE_CUES = Object.freeze({ add: 'waypoint', look: 'look', undo: 'undo', clear: 'undo', hold: 'hold' });

export class AudioDirector {
  /** `viewer.team` (the session): the side this device plays — 'own' cues (hurt, ally down, near misses) follow it. */
  constructor(engine, bus, spatialize, viewer = { team: PLAYER_TEAM }) {
    this.e = engine;
    this.viewer = viewer;
    this.spatialize = spatialize;
    this.sim = null;
    this.ambience = new Ambience(engine, (x, y) => acousticsAt(this.sim, x, y));
    this.music = new Music(engine);
    this.lastPlantBeep = 0;
    this.lastBombBeep = 0;
    this.paused = false;
    this.reloads = []; // per unit: voices of an ongoing reload (cut if the unit dies)
    this.waypointRun = 0;
    this.lastWaypoint = -Infinity;
    this.miss = { x: 0, y: 0, d: 0 };
    this.gunNames = {}; // weaponId -> layer group names
    this.layerPool = [0, 1, 2, 3].map(() => ({ name: '', at: 0, gain: 1 })); // reused per shot
    this.layers = [];

    const on = (type, fn) => bus.on(type, fn);
    on(EV.ROUND_RESET, ({ sim }) => this.onRoundReset(sim));
    on(EV.SHOT, (ev) => this.shot(ev));
    on(EV.HIT, (ev) => this.hit(ev));
    on(EV.DEATH, (ev) => this.death(ev));
    on(EV.FOOTSTEP, (ev) => this.footstep(ev));
    on(EV.DOOR_OPEN, (ev) => this.door(ev));
    // Breaking a barricade: each blow is a kick that does not open it (the slam is the last one).
    on(EV.BARRICADE_HIT, (ev) => this.at('door.kick', ev.x, ev.y, L.doorKick, 'door'));
    on(EV.BARRICADE_BROKEN, (ev) => ev.how === 'bash' && this.at('door.slam', ev.x, ev.y, L.doorSlam, 'door'));
    on(EV.DRONE_DESTROYED, () => this.ui('undo'));
    on(EV.GRENADE_THROWN, (ev) => this.at('grenade.pin', ev.x, ev.y, L.grenadePin, 'foley'));
    on(EV.GRENADE_DETONATE, (ev) => (ev.kind === 'smoke' || ev.kind === 'molotov' || ev.kind === 'gas' ? this.at('smoke', ev.x, ev.y, L.smoke, 'door') : this.bang(ev.kind === 'flash' ? 'flashbang' : 'blast', ev.x, ev.y)));
    on(EV.CHARGE_BLAST, (ev) => this.bang('blast', ev.x, ev.y));
    on(EV.CHARGE_READY, () => this.ui('hold', 0.7));
    on(EV.CHARGE_FIRE, () => this.ui('plant', 1));
    on(EV.RELOAD, (ev) => this.reload(ev));
    on(EV.SPOTTED, (ev) => {
      if (ev.team !== enemyTeam(this.viewer.team)) return;
      this.ui('contact');
      this.music.onEvent('contact');
    });
    on(EV.GO_CODE, () => {
      this.ui('go');
      this.music.onEvent('go');
    });
    on(EV.HOLD_REACHED, () => this.ui('hold', 0.6));
    on(EV.DEFUSE_START, () => {
      this.ui('plant');
      this.music.onEvent('plant');
    });
    on(EV.BOMB_DEFUSED, () => this.ui('planted'));
    on(EV.BOMB_EXPLODED, (ev) => this.bang('blast', ev.x, ev.y));
    on(EV.ORDER_REJECTED, () => this.ui('error'));
    on(EV.ROUND_END, (ev) => !ev.replay && this.music.stinger(ev.winner === this.viewer.team)); // not again in the kill cam
    on(EV.UI_SOUND, (ev) => this.ui(ev.name));
    on(EV.SELECT, (ev) => this.select(ev.unitId));
    on(EV.ROUTE_CHANGED, (ev) => this.route(ev.kind));
    on(EV.PHASE, (ev) => {
      // The music follows the round, not every turn: from the first execution on,
      // the plannings between turns keep the assault's music (no calm cue every turn).
      if (ev.phase === 'running') this.assault = true;
      else if (ev.phase === 'title' || ev.phase === 'buy') this.assault = false;
      const turnPause = this.assault && (ev.phase === 'planning' || ev.phase === 'paused');
      const calm = ev.phase === 'buy' || ev.phase === 'prep' || ev.phase === 'drone' || (ev.phase === 'paused' && !this.assault);
      this.music.setPhase(turnPause ? 'running' : calm ? 'planning' : ev.phase);
      if (ev.phase === 'running') this.e.bank.startCombat(); // combat sounds now, if not baked yet
    });
  }

  unlock() {
    this.e.unlock();
  }

  /** Session controls (session/SessionController.js): return the new state. */
  toggleMute() {
    return this.e.toggleMute();
  }

  toggleMusic() {
    return this.music.toggle();
  }

  get muted() {
    return this.e.muted;
  }

  get musicOn() {
    return this.music.enabled;
  }

  /** The simulation whose places and units the sounds refer to (the kill cam's copy while it plays). */
  watch(sim) {
    this.sim = sim;
  }

  onRoundReset(sim) {
    this.sim = sim;
    // Weapon sounds are baked lazily: only what this round's units carry.
    const names = [];
    for (const team of TEAMS) for (const u of teamUnits(sim, team)) names.push(...weaponSoundNames(u.weaponId));
    this.e.bank.require(names);
    this.music.reset();
    this.music.setAllies(this.aliveAllies());
    this.reloads.length = 0;
  }

  aliveAllies() {
    let n = 0;
    if (this.sim) for (const u of teamUnits(this.sim, this.viewer.team)) if (u.alive) n++;
    return n;
  }

  /**
   * Plays a positional sound at (x, y). `lvl` is an EVENT_SOUNDS entry.
   * Returns the voice or null (inaudible, not ready, or no voice free).
   */
  at(name, x, y, lvl, category, extra = {}) {
    if (!this.e.ready) return null;
    const s = this.spatialize(x, y);
    const gain = (extra.gain ?? 1) * lvl.gain * s.gain;
    if (gain <= SPATIAL.minAudibleGain && !extra.always) return null;
    const zone = ZONES[acousticsAt(this.sim, x, y).zone];
    const opts = {
      when: this.e.now + (extra.delay || 0),
      gain: Math.max(gain, extra.minGain || 0) * this.e.jitterGain(lvl.db || 0),
      pan: s.pan * MIX.panWidth,
      cents: extra.cents,
      rate: extra.rate,
      reverb: zone.reverb,
      send: zone.send * (lvl.send ?? 1) * (extra.sendMul || 1),
      lowpass: extra.lowpass,
      category,
    };
    return extra.layers ? this.e.playLayers(extra.layers, opts) : this.e.play(name, opts);
  }

  /** A gunshot = a random body + mech + tail (+ a reflection timed by the space), each with its own gain/offset jitter. */
  gunLayers(weaponId, zone) {
    const names = (this.gunNames[weaponId] ??= gunLayerNames(weaponId));
    const rng = this.e.rng;
    this.layers.length = 0;
    for (let i = 0; i < names.length; i++) {
      const m = GUN_MIX[GUN_LAYERS[i]];
      if (m.chance !== undefined && !rng.chance(m.chance)) continue;
      const [a, b] = Array.isArray(m.at) ? m.at : m.at[zone] || m.at.room;
      const l = this.layerPool[i];
      this.layers.push(l);
      l.name = names[i];
      l.at = a + (b - a) * rng.next();
      l.gain = m.gain * this.e.jitterGain(m.db);
    }
    return this.layers;
  }

  shot(ev) {
    if (!this.e.ready) return;
    const g = L.gunshot;
    const s = this.spatialize(ev.x, ev.y);
    const far = s.far;
    const near = s.gain;
    const layers = this.gunLayers(ev.weaponId, acousticsAt(this.sim, ev.x, ev.y).zone);
    const sup = ev.suppressed; // a suppressor (the Merodeador): a muffled, dull crack that does not carry
    const lp = far > 0.1 ? DISTANCE_LOWPASS[0] * Math.pow(DISTANCE_LOWPASS[1] / DISTANCE_LOWPASS[0], far) : 0;
    this.at(layers[0].name, ev.x, ev.y, g, 'gun', {
      layers,
      gain: (GUN_MIX.level[ev.weaponId] ?? 1) * (sup ? GUN_MIX.suppressed.gain : 1),
      always: true,
      minGain: sup ? 0 : g.minGain, // gunfire carries further than anything else
      // Air absorption + walls: only distant shots get a filter (one node fewer for close ones).
      lowpass: sup ? Math.min(lp || Infinity, GUN_MIX.suppressed.lowpass) : lp,
      sendMul: lerp(1, g.farSendMul, far) * (sup ? GUN_MIX.suppressed.send : 1),
    });
    if (near > 0.25 && !sup) this.e.duckMusic(MUSIC.duckDb * clamp(near, 0, 1), MUSIC.duckRelease);
    this.music.onEvent('shot', clamp(0.4 + near, 0, 1));

    if (ev.hit === 'wall') {
      // Walls, door slabs and low cover alike: the sim says what was struck (EV.SHOT.material).
      const mat = impactSoundFor(ev.material);
      this.at(`impact.${mat}`, ev.toX, ev.toY, L.impact, 'impact');
      if (mat !== 'wood' && this.e.rng.chance(L.ricochet.chance)) this.at('ricochet', ev.toX, ev.toY, L.ricochet, 'impact', { delay: 0.01 });
    }
    if (near > L.casing.minShotGain) {
      const surf = acousticsAt(this.sim, ev.x, ev.y).surface;
      const [d0, d1] = L.casing.delay;
      this.at(`casing.${surf}`, ev.x, ev.y, L.casing, 'casing', { delay: lerp(d0, d1, this.e.rng.next()) });
    }
    if (ev.team !== this.viewer.team) {
      const m = nearMiss(this.sim, ev, this.viewer.team, NEAR_MISS.radius, NEAR_MISS.minTravel, this.miss);
      if (m) this.at('whiz', m.x, m.y, L.whiz, 'whiz', { gain: 1 - m.d / NEAR_MISS.radius, always: true, minGain: 0.08 });
    }
    if (ev.mag === 0) this.at('dryFire', ev.x, ev.y, L.dryFire, 'foley', { delay: WEAPONS[ev.weaponId].fireInterval });
    else if (ev.weaponId === 'sniper') this.at('reload.bolt', ev.x, ev.y, L.boltCycle, 'foley', { delay: L.boltCycle.delay });
  }

  hit(ev) {
    if (ev.part === 'head') {
      // Helmets clank; bare heads (caps, beanies) get their own dry knock.
      const gear = ROLE_GEAR[ev.role] || TEAM_GEAR[ev.team];
      const helmet = !!gear && HELMET_HEADGEAR.includes(gear.head);
      this.at(helmet ? 'impact.helmet' : 'impact.head', ev.x, ev.y, L.head, 'impact');
    } else {
      this.at('impact.flesh', ev.x, ev.y, L.flesh, 'impact', { gain: ev.part === 'limb' ? L.flesh.limbGain : 1 });
    }
    if (ev.team === this.viewer.team) this.ui('hurt', 0.9);
  }

  death(ev) {
    if (ev.team === this.viewer.team) {
      this.music.onEvent('allyDown');
      this.music.setAllies(this.aliveAllies());
    }
    const surf = acousticsAt(this.sim, ev.x, ev.y).surface;
    this.at('bodyFall', ev.x, ev.y, L.bodyFall, 'body', { delay: L.bodyFall.delay });
    this.at(surf === 'carpet' ? 'gunDrop.soft' : 'gunDrop.hard', ev.x, ev.y, L.gunDrop, 'body', { delay: L.gunDrop.delay });
    const pending = this.reloads[ev.unitId];
    if (pending) for (const v of pending) if (v.start > this.e.now) v.src.stop();
    this.reloads[ev.unitId] = null;
  }

  footstep(ev) {
    const k = invLerp(STEP.walkSpeed, STEP.runSpeed, ev.speed);
    const { surface } = acousticsAt(this.sim, ev.x, ev.y);
    const gain = STEP.teamGain[ev.team] * lerp(STEP.softGain, 1, k);
    this.at(`step.${surface}`, ev.x, ev.y, L.footstep, 'step', { gain });
    if (ev.team === this.viewer.team && this.e.rng.chance(L.gear.chance * (0.5 + k))) this.at('gear', ev.x, ev.y, L.gear, 'step', { delay: L.gear.delay, gain });
  }

  /** Grenade / charge going off: loud everywhere, ducks the music like close gunfire. */
  bang(name, x, y) {
    const lvl = name === 'flashbang' ? L.flashbang : L.blast;
    this.at(name, x, y, lvl, 'gun', { always: true, minGain: lvl.minGain, sendMul: L.blast.farSendMul });
    this.e.duckMusic(MUSIC.duckDb, MUSIC.duckRelease);
    this.music.onEvent('shot', 1);
  }

  door(ev) {
    if (ev.mode === 'crack') {
      this.at('door.crack', ev.x, ev.y, L.doorCrack, 'door');
      return;
    }
    this.music.onEvent(ev.mode === 'push' ? 'door' : 'kick');
    if (ev.mode === 'push') {
      // Pushed open: no boot, the hinge always speaks, the stop is softer.
      this.at('door.creak', ev.x, ev.y, L.doorCreak, 'door', { gain: L.doorPush.creakGain });
      this.at('door.slam', ev.x, ev.y, L.doorSlam, 'door', { delay: DOOR_SWING_SECONDS, gain: L.doorPush.slamGain });
      return;
    }
    this.at('door.kick', ev.x, ev.y, L.doorKick, 'door');
    this.at('door.slam', ev.x, ev.y, L.doorSlam, 'door', { delay: DOOR_SWING_SECONDS });
    if (this.e.rng.chance(L.doorCreak.chance)) this.at('door.creak', ev.x, ev.y, L.doorCreak, 'door', { delay: L.doorCreak.delay });
  }

  reload(ev) {
    const plan = RELOADS[ev.weaponId] || RELOADS.rifle;
    const surf = acousticsAt(this.sim, ev.x, ev.y).surface;
    const voices = [];
    for (const [part, delay] of plan.parts) {
      const name = part === 'magDrop' ? `magDrop.${surf}` : `reload.${part}`;
      const v = this.at(name, ev.x, ev.y, L.reload, 'foley', { delay, rate: plan.rate });
      if (v) voices.push(v);
    }
    this.reloads[ev.unitId] = voices;
  }

  select(unitId) {
    if (unitId < 0) return;
    const u = unitById(this.sim, unitId);
    this.ui('select', 1, u ? u.slot * UI_SOUNDS.selectSlotCents : 0);
  }

  route(kind) {
    const cue = ROUTE_CUES[kind];
    if (!cue) return;
    if (cue !== 'waypoint') {
      this.ui(cue, kind === 'clear' ? 1 : 0.85, kind === 'clear' ? -500 : 0);
      return;
    }
    // Consecutive waypoints climb a pentatonic scale: building a route feels musical.
    const now = this.e.now;
    this.waypointRun = now - this.lastWaypoint < UI_SOUNDS.waypointResetSeconds ? this.waypointRun + 1 : 0;
    this.lastWaypoint = now;
    const steps = UI_SOUNDS.waypointSteps;
    this.ui('waypoint', 1, steps[Math.min(this.waypointRun, steps.length - 1)] * 100);
  }

  ui(name, gain = 1, cents = 0) {
    this.e.play(`ui.${name}`, { bus: 'ui', category: 'ui', gain: gain * UI_SOUNDS.gain * (UI_SOUNDS.levels[name] ?? 0.5), cents });
  }

  update(dt, paused) {
    if (paused !== this.paused) {
      this.paused = paused;
      this.e.setPaused(paused);
    }
    this.ambience.update(dt, this.spatialize.listener ? this.spatialize.listener() : { x: 0, y: 0 });
    this.music.update(dt);
    // Bomb beeps speed up with the defuse progress.
    const progress = this.sim ? defuseProgress(this.sim) : -1;
    if (progress >= 0 && !paused) {
      this.lastPlantBeep += dt;
      const interval = PLANT_BEEP.startInterval - progress * PLANT_BEEP.speedup;
      if (this.lastPlantBeep >= interval) {
        this.lastPlantBeep = 0;
        this.ui('plant');
      }
    }
    // The bomb's timer: beeps in its last seconds, faster as it runs out (only while a turn runs).
    const left = this.sim && this.sim.phase === 'exec' && !this.sim.bomb.defused ? this.sim.timeLeft : Infinity;
    if (left <= BOMB_BEEP.window && !paused) {
      this.lastBombBeep += dt;
      const k = left / BOMB_BEEP.window;
      if (this.lastBombBeep >= BOMB_BEEP.fastest + k * (BOMB_BEEP.slowest - BOMB_BEEP.fastest)) {
        this.lastBombBeep = 0;
        this.ui('bombTick');
      }
    }
  }
}
