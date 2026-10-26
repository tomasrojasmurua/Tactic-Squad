// Generative score, conducted by the tactical situation. One scene per round (audio/music/scenes.js:
// own key, tempo and timbres; rotated without repeating the last one), played by a ScenePlayer into
// live voices (audio/music/Synth.js). Intensity = phase base + decaying impulses from tactical events
// (contact, doors, GO, gunfire, an operator down, planting) + a "last stand" when one operator is left.
// Planning (most of the session) is mostly silence / ambience: the music enters now and then for a
// short, quiet cue and leaves again. Victory / defeat get a stinger in the scene's key, then silence.
// Easy to switch off (persisted). `sink` can be swapped for a recorder (tests/audio-lab.cjs). Owner: audio.
import { Rng } from '../core/rng.js';
import { clamp } from '../core/math.js';
import { MUSIC as M, BAKE } from '../config/audio.js';
import { SCENES, SCENE_IDS } from './music/scenes.js';
import { ScenePlayer } from './music/ScenePlayer.js';
import { Synth } from './music/Synth.js';

export class Music {
  /** @param {{sink?: object, enabled?: boolean}} [opts] */
  constructor(engine, opts = {}) {
    this.e = engine;
    this.sink = opts.sink || new Synth(engine);
    this.rng = new Rng(BAKE.seed ^ 0x6d75);
    this.phase = 'title';
    this.intensity = 0;
    this.impulse = 0;
    this.lastStand = false;
    this.presence = 0; // 0..1 gain of the whole score (planning cues fade in / out)
    this.cue = { on: false, timer: 0 };
    this.order = [];
    this.sceneId = null;
    this.player = null;
    this.step = 0;
    this.nextTime = 0;
    this.stopped = false;
    this.padBuilt = null;
    this.enabled = opts.enabled ?? loadEnabled();
    engine.setMusicEnabled?.(this.enabled);
  }

  toggle() {
    this.enabled = !this.enabled;
    this.e.setMusicEnabled(this.enabled);
    try {
      localStorage.setItem(M.storageKey, this.enabled ? '1' : '0');
    } catch {
      // Private mode: the choice just isn't remembered.
    }
    return this.enabled;
  }

  get scene() {
    return this.sceneId ? SCENES[this.sceneId] : null;
  }

  /** Next scene of a shuffled rotation (never the same one twice in a row). */
  nextScene() {
    if (!this.order.length) {
      const ids = [...SCENE_IDS];
      for (let i = ids.length - 1; i > 0; i--) {
        const j = this.rng.int(0, i);
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      if (ids[0] === this.sceneId) ids.push(ids.shift());
      this.order = ids;
    }
    this.sceneId = this.order.shift();
    this.player = new ScenePlayer(this.scene, this.rng, this.sink);
    this.step = 0;
    this.nextTime = 0;
  }

  setPhase(phase) {
    if (phase === this.phase) return;
    const prev = this.phase;
    this.phase = phase;
    if (phase === 'planning') {
      this.stopped = false;
      if (prev !== 'paused') this.startPlanning();
    }
  }

  startPlanning() {
    this.cue.on = false;
    this.cue.timer = this.rng.range(...M.planning.firstRest);
  }

  /** New round (EV.ROUND_RESET): next scene, calm again. */
  reset() {
    this.impulse = 0;
    this.lastStand = false;
    this.stopped = false;
    this.nextScene();
    this.startPlanning();
  }

  /** A tactical event raises the tension for a while: kind is a key of MUSIC.impulses. */
  onEvent(kind, amount = 1) {
    this.impulse = Math.min(M.impulseMax, this.impulse + (M.impulses[kind] ?? 0) * clamp(amount, 0, 1));
  }

  /** Attackers still alive: one left switches the arrangement to the last stand. */
  setAllies(alive) {
    this.lastStand = alive > 0 && alive <= M.lastStand.allies;
  }

  /** Presence target: planning plays short, quiet cues between long rests; execution always plays. */
  presenceTarget(dt) {
    const ph = this.phase;
    if (this.stopped || ph === 'title' || ph === 'ended') return 0;
    if (ph !== 'planning') return 1;
    this.cue.timer -= dt;
    if (this.cue.timer <= 0) {
      this.cue.on = !this.cue.on;
      this.cue.timer = this.rng.range(...(this.cue.on ? M.planning.cue : M.planning.rest));
    }
    return this.cue.on ? M.planning.cueGain : 0;
  }

  update(dt) {
    const e = this.e;
    if (!e.ready || !e.bank.has(M.readyProbe)) return;
    if (!this.player) this.nextScene();
    if (this.padBuilt !== this.sceneId && this.sink.buildPad) {
      this.sink.buildPad(this.scene.pad);
      this.padBuilt = this.sceneId;
    }
    this.impulse = Math.max(0, this.impulse - dt / M.impulseDecaySeconds);
    const running = this.phase === 'running' || this.phase === 'paused';
    const base = M.phaseIntensity[this.phase] ?? 0;
    const target = clamp(base + (running ? this.impulse + (this.lastStand ? M.lastStand.intensity : 0) : 0), 0, 1);
    this.intensity += (target - this.intensity) * (1 - Math.exp(-dt / M.intensitySmoothing));
    const want = this.presenceTarget(dt);
    const tau = want > this.presence ? M.presenceFadeIn : M.presenceFadeOut;
    this.presence += (want - this.presence) * (1 - Math.exp(-dt / tau));
    const t = e.now;
    this.sink.padLevel?.(this.presence * clamp(this.intensity * 2.5, 0.35, 1), this.intensity, t);
    const stepDur = this.player.stepSeconds;
    if (this.nextTime < t) this.nextTime = t + 0.05;
    while (this.nextTime < t + M.lookahead) {
      if (this.presence > M.silentBelow) this.player.schedule(this.step, this.nextTime, this.intensity, this.presence, this.lastStand);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  /** Round result: a short musical full stop in the scene's key, then the score rests. */
  stinger(win) {
    const e = this.e;
    if (!e.ready || !this.player) return;
    this.stopped = true;
    this.presence = 0;
    this.sink.padLevel?.(0, 0, e.now);
    const t = e.now + 0.05;
    const g = M.stingerGain;
    const p = this.player;
    const sc = this.scene;
    this.sink.hit('mus.boom', t, g * (win ? 0.7 : 1));
    // Victory climbs to the major third (Picardy); defeat sinks through the scene's own scale.
    const top = p.midi(0, sc.lead.octave);
    const notes = win ? [0, 4, 7, 12, 16].map((n) => top + n) : [7, 5, 3, 2, 0].map((d) => p.midi(d, sc.lead.octave - 1));
    notes.forEach((m, i) => this.sink.note(sc.lead, m, t + i * (win ? 0.11 : 0.2), g * 0.6));
    this.sink.note(sc.bass, p.midi(0, sc.bass.octave), t, g);
  }
}

function loadEnabled() {
  try {
    return localStorage.getItem(M.storageKey) !== '0';
  } catch {
    return true;
  }
}
