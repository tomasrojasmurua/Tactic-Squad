// What one side knows: the per-player view. Everything a side may be shown
// about the other comes through teamView — the filter an online server will
// apply before sending a frame (it never sends what that player cannot see).
// New information (noise pulses, last known positions) is read only here;
// the renderer still reads the whole sim for the rest (to migrate later).
import { TEAMS } from '../config/squad.js';
import { enemyTeam } from './queries.js';

export function createMemory() {
  const m = {};
  for (const t of TEAMS) m[t] = new Map(); // enemy id -> {id, x, y, tick, alive}
  return m;
}

/** After perception: every enemy a side sees now is remembered where it is. */
export function updateMemory(sim) {
  for (const team of TEAMS) {
    const mem = sim.memory[team];
    for (const u of sim.teams[team]) {
      if (!u.alive) continue;
      for (const id of u.visibleEnemies) {
        const e = sim.units[id];
        let k = mem.get(id);
        if (!k) mem.set(id, (k = { id, x: 0, y: 0, tick: 0, alive: true }));
        k.x = e.x;
        k.y = e.y;
        k.tick = sim.tick;
        k.alive = e.alive;
      }
    }
  }
}

/** Barricades a side knows of: the defenders all theirs; the attackers those they have seen (sim/barricades.js). */
export function knownBarricades(sim, team) {
  const out = [];
  for (const d of sim.doors) {
    if (!d.barricaded) continue;
    if (team === 'attackers' && !sim.intel.barricades.has(d.def.index)) continue;
    out.push({ door: d.def.id, index: d.def.index, x: d.def.cx, y: d.def.cy });
  }
  return out;
}

/**
 * The view of the round for `team`: its own units in full; of the enemy only
 * who is in sight now, where the rest were last seen, the noise heard, the
 * barricades it knows of, its own drone and the bomb if this side knows
 * where it is.
 */
export function teamView(sim, team) {
  const seen = new Set();
  for (const u of sim.teams[team]) if (u.alive) for (const id of u.visibleEnemies) seen.add(id);
  const enemies = [];
  for (const e of sim.teams[enemyTeam(team)]) {
    if (seen.has(e.id)) enemies.push({ id: e.id, x: e.x, y: e.y, facing: e.facing, alive: e.alive, name: e.name });
  }
  const b = sim.bomb;
  const bombKnown = team === 'defenders' || b.spotted;
  return {
    team,
    phase: sim.round.phase,
    turn: sim.round.turn,
    timeLeft: sim.timeLeft,
    own: sim.teams[team],
    enemies,
    lastKnown: [...sim.memory[team].values()].filter((k) => !seen.has(k.id)).map((k) => ({ ...k })),
    pulses: sim.noise.pulses[team],
    barricades: knownBarricades(sim, team),
    drone: team === 'attackers' && sim.drone ? { x: sim.drone.x, y: sim.drone.y, facing: sim.drone.facing, active: sim.drone.active, left: sim.drone.left } : null,
    bomb: bombKnown ? { site: b.site, x: b.x, y: b.y, progress: b.progress, defused: b.defused } : null,
  };
}
