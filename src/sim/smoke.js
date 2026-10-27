// Smoke clouds (a thrown "humo", sim/entries.js): a circle that grows to
// ENTRY.smoke.radius, stays, and thins out at the end. While it stands it is
// a polygon in the world's segment list after the solid ones (World
// updateSmokeSegments), so it blocks every line of sight — the operators'
// and the AI's eyes, the fog of war, the drone — but not bullets or blasts
// (they test world.solidCount). Deterministic: no randomness.
import { ENTRY } from '../config/balance.js';

/** A new cloud at (x, y); the oldest clears when there are already ENTRY.smoke.max. */
export function spawnSmoke(sim, x, y) {
  if (sim.smokes.length >= ENTRY.smoke.max) sim.smokes.shift();
  sim.smokes.push({ x, y, r: 0, age: 0 });
}

/** Radius of a cloud `age` s after it went off. */
export function smokeRadius(age) {
  const S = ENTRY.smoke;
  if (age >= S.seconds) return 0;
  const grow = Math.min(1, age / S.grow);
  const fade = Math.min(1, (S.seconds - age) / S.fade);
  return S.radius * Math.sqrt(grow) * fade;
}

/** Once per tick: clouds grow, thin out and clear; the sight segments follow. */
export function updateSmokes(sim, dt) {
  const list = sim.smokes;
  if (!list.length && !sim.smokeDirty) return;
  let n = 0;
  for (const c of list) {
    c.age += dt;
    c.r = smokeRadius(c.age);
    if (c.age < ENTRY.smoke.seconds) list[n++] = c;
  }
  list.length = n;
  sim.smokeDirty = n > 0; // one more pass after the last one clears (removes its segments)
  sim.world.updateSmokeSegments(list);
}
