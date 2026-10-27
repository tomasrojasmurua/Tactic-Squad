// The authoritative, deterministic game state. No DOM, no WebGL, no audio,
// no wall-clock time: it only advances through step(dt) with a fixed dt and
// a seeded RNG, and reports what happened as queued events.
import { Rng } from '../core/rng.js';
import { EV } from '../core/events.js';
import { SIM, ROUND } from '../config/balance.js';
import { SQUAD, DEFENDER_NAME, DEFENDER_COLOR, TEAMS, CONTROLLERS } from '../config/squad.js';
import { DEFAULT_DEFENDER_ROLE } from '../config/operators.js';
import { initAbilities, updateAbilities } from './abilities/index.js';
import { compileMap } from './mapCompiler.js';
import { World } from './World.js';
import { createUnit } from './units.js';
import { createDoorState, updateDoors } from './doors.js';
import { updateEntries } from './entries.js';
import { updateSmokes } from './smoke.js';
import { placeCameras, updateCameras } from './cameras.js';
import { applyCommand } from './orders.js';
import { updatePerception } from './perception.js';
import { updateAiUnit } from './ai.js';
import { createAttackAi, attackAiDecide, attackAiTick } from './aiAttack.js';
import { isAiControlled } from './queries.js';
import { updateFacing, updateMovement } from './movement.js';
import { resolveCollisions } from './collisions.js';
import { updateCombat } from './combat.js';
import { createBomb, updateObjectives, endRound } from './objectives.js';
import { createRound, advancePhase, canStep, afterTick, phaseTick, isLive, PHASE } from './round.js';
import { createNoise, collectNoise } from './noise.js';
import { createMemory, updateMemory } from './view.js';
import { initMoney } from './prep.js';
import { updateDrone } from './drone.js';
import { createIntel, updateBash, spotBarricades } from './barricades.js';

export class Simulation {
  /**
   * @param opts.controllers {team: 'human'|'ai'} who commands each side (config/squad.js CONTROLLERS).
   * @param opts.site  bomb site id ('A' | 'B'); omitted, the defending side picks it from the seed.
   *                    A human defender may move it in the preparation (sim/prep.js chooseSite).
   * @param opts.entry attacker entry id (map `entries`); omitted, the map's default entry.
   *                    The attackers may change it during the preparation (chooseEntry order).
   * @param opts.defenders which slots of the site's `defense` layout get a defender (indices; omitted: all).
   *                    Fewer defenders = an easier round (the guided tutorial: config/ui.js TUTORIAL).
   * @param opts.phases true: the round goes through its phases (sim/round.js, starts at 'buy');
   *                    false: no phases, it always runs and takes orders (mechanics tests).
   * @param opts.stopOnContact the execution turn ends early (ROUND.minContactSeconds at the earliest)
   *                    when the attackers see a new enemy: the player gets to react (against the AI).
   * @param opts.loadout per attacker slot {money, gear?, role?} carried over from the last round of a
   *                    match (session/Match.js); omitted: BUY.startMoney and the role's gear.
   */
  constructor(mapDef, { seed = SIM.seed, controllers = CONTROLLERS, site = null, entry = null, defenders = null, phases = true, stopOnContact = false, loadout = null } = {}) {
    this.seed = seed;
    this.stopOnContact = stopOnContact;
    this.loadout = loadout;
    this.controllers = controllers;
    this.rng = new Rng(seed);
    this.compiled = compileMap(mapDef);
    const sites = this.compiled.sites;
    // Hidden from the attackers: until the preparation phase the defender's
    // choice is a roll of the round's seed (a retry keeps the seed, so the site).
    // Rolled even when forced, so the rest of the RNG stream does not depend on it.
    const rolled = this.rng.pick(sites);
    this.site = site ? sites.find((s) => s.id === site) : rolled;
    if (!this.site) throw new Error(`Sitio desconocido: ${site}`);
    this.entry = this.compiled.entries.find((e) => e.id === (entry || this.compiled.defaultEntry));
    if (!this.entry) throw new Error(`Entrada desconocida: ${entry}`);
    this.defenderSlots = defenders;
    this.world = new World(this.compiled);
    this.doors = this.compiled.doors.map(createDoorState);
    this.world.updateDoorSegments(this.doors);

    this.tick = 0;
    this.time = 0;
    this.dt = 1 / SIM.tickRate;
    this.timeLeft = ROUND.timeLimit;
    this.goCount = 0;
    this.grenades = []; // thrown, not yet detonated (sim/entries.js)
    this.smokes = []; // smoke clouds standing (sim/smoke.js)
    this.smokeDirty = false;
    this.grenadeSeq = 0;
    this.outcome = null;
    this.commands = [];
    this.events = [];
    this.round = createRound(phases);
    this.noise = createNoise(); // sim/noise.js: heard this turn, pulses per listening side
    this.memory = createMemory(); // sim/view.js: last known enemy positions per side
    this.intel = createIntel(); // sim/barricades.js: barricades the attackers know of
    this.drone = null; // sim/drone.js: the attackers' recon drone (drone phase)

    this.units = []; // indexed by unit id; fixed for the whole round
    this.spawnUnits();
    /** Units per team in spawn order (read through sim/queries.js teamUnits). */
    this.teams = {};
    for (const t of TEAMS) this.teams[t] = this.units.filter((u) => u.team === t);
    this.bomb = createBomb(this.site);
    this.cameras = [];
    placeCameras(this); // sim/cameras.js: the defenders' cameras on this site
    if (phases) initMoney(this); // the buy phase: each attacker's money after his role's gear
    initAbilities(this);
    this.attackAi = createAttackAi(this); // sim/aiAttack.js: the commander of an AI attacking side
  }

  spawnUnits() {
    const attackers = this.entry.spawns;
    const layout = this.compiled.defense[this.site.id];
    const defenders = this.defenderSlots ? this.defenderSlots.map((i) => layout[i]).filter(Boolean) : layout;
    attackers.forEach((s, i) => {
      const op = SQUAD[i % SQUAD.length];
      this.units.push(
        createUnit({
          id: this.units.length,
          team: 'attackers',
          slot: i,
          name: op.callsign,
          color: op.color,
          x: s.at[0],
          y: s.at[1],
          facing: s.facing,
          role: op.role,
          weaponId: op.weapon, // optional override of the role's weapon
        }),
      );
    });
    defenders.forEach((s, i) => {
      this.units.push(
        createUnit({
          id: this.units.length,
          team: 'defenders',
          slot: i,
          name: `${DEFENDER_NAME} ${i + 1}`,
          color: DEFENDER_COLOR,
          x: s.at[0],
          y: s.at[1],
          facing: s.facing,
          role: s.role || DEFAULT_DEFENDER_ROLE,
          weaponId: s.weapon,
          behavior: s.behavior,
        }),
      );
    });
  }

  /** Current round phase (sim/round.js PHASE). */
  get phase() {
    return this.round.phase;
  }

  /** Current assault turn (1, 2 ...; 0 before the assault). */
  get turn() {
    return this.round.turn;
  }

  /** Ends the current decision phase (buy -> prep -> plan -> exec); applies pending orders first. */
  advancePhase() {
    this.flushCommands();
    attackAiDecide(this); // an AI side decides when the phase ends, like a player pressing LISTO
    advancePhase(this);
  }

  /** Buy, preparation and drone skipped: straight to planning the first turn (scripts, tests). */
  skipToAssault() {
    while (this.round.enabled && this.round.phase !== PHASE.plan) this.advancePhase();
  }

  /** Moves the attackers to another entry's start positions (preparation phase; their routes are lost). */
  setEntry(id) {
    const entry = this.compiled.entries.find((e) => e.id === id);
    if (!entry || entry === this.entry) return false;
    this.entry = entry;
    for (const u of this.teams.attackers) {
      const s = entry.spawns[u.slot % entry.spawns.length];
      u.x = u.prevX = s.at[0];
      u.y = u.prevY = s.at[1];
      u.facing = u.prevFacing = u.heading = u.ai.baseFacing = s.facing;
      u.route.length = 0;
      u.idleLook = null;
      u.waitingGo = false;
      u.waitCode = null;
    }
    return true;
  }

  /**
   * Queue a player command; applied in order at the next flush/step. One
   * stamped with `atTick` (a GO given during a turn) waits for that step of
   * the turn (a replay queues the whole turn's GOs at its start).
   */
  enqueue(cmd) {
    this.commands.push(cmd);
  }

  /** Applies queued commands immediately (used while paused / planning). */
  flushCommands() {
    if (!this.commands.length) return;
    const list = this.commands;
    this.commands = [];
    for (const c of list) {
      if (c.atTick !== undefined && isLive(this) && phaseTick(this) < c.atTick) this.commands.push(c);
      else applyCommand(this, c);
    }
  }

  /** Drops the stamped GOs still waiting for their step (the player took over a replayed turn). */
  dropStamped() {
    this.commands = this.commands.filter((c) => c.atTick === undefined);
  }

  emit(type, data) {
    this.events.push({ type, tick: this.tick, ...data });
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  step(dt = this.dt) {
    if (!canStep(this)) return; // decision phases: time does not run
    this.dt = dt;
    if (this.round.phase === PHASE.drone) return this.stepDrone(dt);
    const firstEvent = this.events.length;
    this.flushCommands();
    attackAiTick(this);
    for (const u of this.units) {
      u.prevX = u.x;
      u.prevY = u.y;
      u.prevFacing = u.facing;
    }

    updateDoors(this, dt);
    for (const u of this.units) if (u.alive && u.bash) updateBash(this, u, dt);
    updateEntries(this, dt);
    updateSmokes(this, dt);
    updatePerception(this);
    updateCameras(this, dt);
    if (this.stopOnContact) for (let i = firstEvent; i < this.events.length; i++) {
      const e = this.events[i];
      if (e.type === EV.SPOTTED && e.team === 'defenders' && !e.byDrone) this.round.contact = true;
    }
    updateMemory(this);
    for (const u of this.teams.attackers) if (u.alive && u.blind <= 0) spotBarricades(this, u, u.vision.fov);
    for (const u of this.units) {
      if (!u.alive) continue;
      if (isAiControlled(this, u)) updateAiUnit(this, u, dt);
      updateFacing(this, u, dt);
      updateMovement(this, u, dt);
    }
    resolveCollisions(this);
    for (const u of this.units) if (u.alive) updateCombat(this, u, dt);
    updateAbilities(this, dt);
    updateObjectives(this, dt);
    if (this.round.enabled) collectNoise(this, firstEvent);
    afterTick(this, endRound);

    this.tick++;
    this.time += dt;
  }

  /** A step of the drone phase: only the drone moves; the defenders hold their set-up and only turn. */
  stepDrone(dt) {
    this.flushCommands();
    attackAiTick(this);
    updateDrone(this, dt);
    for (const u of this.teams.defenders) {
      if (!u.alive) continue;
      if (isAiControlled(this, u)) updateAiUnit(this, u, dt);
      updateFacing(this, u, dt);
    }
    afterTick(this, endRound);
    this.tick++;
    this.time += dt;
  }
}
