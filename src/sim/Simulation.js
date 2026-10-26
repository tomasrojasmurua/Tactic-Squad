// The authoritative, deterministic game state. No DOM, no WebGL, no audio,
// no wall-clock time: it only advances through step(dt) with a fixed dt and
// a seeded RNG, and reports what happened as queued events.
import { Rng } from '../core/rng.js';
import { SIM, ROUND } from '../config/balance.js';
import { SQUAD, DEFENDER_NAME, DEFENDER_COLOR, TEAMS, CONTROLLERS } from '../config/squad.js';
import { DEFAULT_DEFENDER_ROLE } from '../config/operators.js';
import { initAbilities, updateAbilities } from './abilities/index.js';
import { compileMap } from './mapCompiler.js';
import { World } from './World.js';
import { createUnit } from './units.js';
import { createDoorState, updateDoors } from './doors.js';
import { updateEntries } from './entries.js';
import { applyCommand } from './orders.js';
import { updatePerception } from './perception.js';
import { updateAiUnit } from './ai.js';
import { updateFacing, updateMovement } from './movement.js';
import { resolveCollisions } from './collisions.js';
import { updateCombat } from './combat.js';
import { createBomb, updateObjectives } from './objectives.js';

export class Simulation {
  /**
   * @param opts.controllers {team: 'human'|'ai'} who commands each side (config/squad.js CONTROLLERS).
   * @param opts.site  bomb site id ('A' | 'B'); omitted, the defending side picks it from the seed.
   * @param opts.entry attacker entry id (map `entries`); omitted, the map's default entry.
   */
  constructor(mapDef, { seed = SIM.seed, controllers = CONTROLLERS, site = null, entry = null } = {}) {
    this.seed = seed;
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
    this.world = new World(this.compiled);
    this.doors = this.compiled.doors.map(createDoorState);
    this.world.updateDoorSegments(this.doors);

    this.tick = 0;
    this.time = 0;
    this.dt = 1 / SIM.tickRate;
    this.timeLeft = ROUND.timeLimit;
    this.goCount = 0;
    this.grenades = []; // thrown, not yet detonated (sim/entries.js)
    this.grenadeSeq = 0;
    this.outcome = null;
    this.commands = [];
    this.events = [];

    this.units = []; // indexed by unit id; fixed for the whole round
    this.spawnUnits();
    /** Units per team in spawn order (read through sim/queries.js teamUnits). */
    this.teams = {};
    for (const t of TEAMS) this.teams[t] = this.units.filter((u) => u.team === t);
    this.bomb = createBomb(this.site);
    initAbilities(this);
  }

  spawnUnits() {
    const attackers = this.entry.spawns;
    const defenders = this.compiled.defense[this.site.id];
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

  /** Queue a player command; applied in order at the next flush/step. */
  enqueue(cmd) {
    this.commands.push(cmd);
  }

  /** Applies queued commands immediately (used while paused / planning). */
  flushCommands() {
    if (!this.commands.length) return;
    const list = this.commands;
    this.commands = [];
    for (const c of list) applyCommand(this, c);
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
    this.dt = dt;
    this.flushCommands();
    for (const u of this.units) {
      u.prevX = u.x;
      u.prevY = u.y;
      u.prevFacing = u.facing;
    }

    updateDoors(this, dt);
    updateEntries(this, dt);
    updatePerception(this);
    for (const u of this.units) {
      if (!u.alive) continue;
      if (this.controllers[u.team] === 'ai') updateAiUnit(this, u, dt);
      updateFacing(this, u, dt);
      updateMovement(this, u, dt);
    }
    resolveCollisions(this);
    for (const u of this.units) if (u.alive) updateCombat(this, u, dt);
    updateAbilities(this, dt);
    updateObjectives(this, dt);

    this.tick++;
    this.time += dt;
  }
}
