// Fire (a thrown "incendiaria", sim/entries.js): a pool of flames ENTRY.molotov.radius
// wide that burns ENTRY.molotov.seconds where it lands. Whoever stands in it,
// either side, takes ENTRY.molotov.dps (applied once per ENTRY.molotov.tick).
// Smoke puts it out: a cloud (sim/smoke.js) reaching the pool's center
// smothers it at once. A unit of an AI-commanded attacking side holds before
// walking into it (sim/movement.js fireAhead); a player's operators walk in
// if their route says so. Deterministic: no randomness.
//
//   sim.fires = [{id, x, y, age, ownerId, tick}]
import { ENTRY } from '../config/balance.js';
import { EV } from '../core/events.js';
import { applyBlast } from './combat.js';
import { sq } from '../core/dmath.js';

/** A new pool of fire at (x, y) (already smothered if smoke stands there). */
export function spawnFire(sim, x, y, owner) {
  const f = { id: sim.fireSeq++, x, y, age: 0, ownerId: owner ? owner.id : -1, tick: 0 };
  sim.fires.push(f);
  sim.emit(EV.FIRE_START, { id: f.id, x, y, unitId: f.ownerId });
  if (smothered(sim, f)) out(sim, f, 'smoke');
}

const smothered = (sim, f) => sim.smokes.some((s) => s.r > 0 && sq(s.x - f.x) + sq(s.y - f.y) < sq(s.r + ENTRY.molotov.radius * 0.5));

function out(sim, f, why) {
  f.age = Infinity;
  sim.emit(EV.FIRE_OUT, { id: f.id, x: f.x, y: f.y, why });
}

/** Is (x, y) in a burning pool? */
export function inFire(sim, x, y) {
  const r2 = sq(ENTRY.molotov.radius);
  for (const f of sim.fires) if (f.age < ENTRY.molotov.seconds && sq(x - f.x) + sq(y - f.y) < r2) return true;
  return false;
}

/** Once per tick: fires burn whoever stands in them, go out under smoke or when they burn down. */
export function updateFires(sim, dt) {
  const M = ENTRY.molotov;
  const list = sim.fires;
  let n = 0;
  for (const f of list) {
    if (f.age >= M.seconds) continue;
    if (smothered(sim, f)) {
      out(sim, f, 'smoke');
      continue;
    }
    f.age += dt;
    f.tick -= dt;
    if (f.tick <= 0) {
      f.tick += M.tick;
      const owner = f.ownerId >= 0 ? sim.units[f.ownerId] : null;
      const r2 = M.radius * M.radius;
      for (const u of sim.units) {
        if (u.alive && sq(u.x - f.x) + sq(u.y - f.y) < r2) applyBlast(sim, owner, u, M.dps * M.tick, f.x, f.y);
      }
    }
    if (f.age >= M.seconds) out(sim, f, 'burnt');
    else list[n++] = f;
  }
  list.length = n;
}
