// The Ancla's prepared position (role ability 'prepared'): as the assault
// begins he sets up a portable ballistic barrier PARAPET.ahead m in front of
// his post, square to the angle he watches. While he stays within
// PARAPET.reach of it, a bullet coming from within PARAPET.arc of its facing
// meets low cover (sim/combat.js: COVER.exposure, head or torso only) and
// what gets through does PARAPET.damage × the harm. He can leave it; it then
// stays there, useless to him. Deterministic, no randomness here.
//
//   sim.parapets = [{unitId, x, y, facing}]
import { PARAPET } from '../config/balance.js';
import { angleDiff } from '../core/math.js';
import { EV } from '../core/events.js';

/** As the preparation ends (sim/round.js), or at once in a round without phases. */
export function placeParapets(sim) {
  sim.parapets = [];
  for (const u of sim.teams.defenders) {
    if (!u.alive || u.ability !== 'prepared') continue;
    const facing = u.facing;
    const p = { unitId: u.id, x: u.x + Math.cos(facing) * PARAPET.ahead, y: u.y + Math.sin(facing) * PARAPET.ahead, facing };
    sim.parapets.push(p);
    sim.emit(EV.PARAPET_SET, { unitId: u.id, x: p.x, y: p.y, facing });
  }
}

/**
 * The barrier covering `victim` from a bullet flying along (dx, dy), or null:
 * his own, he within reach of it, the shot coming from the side it faces.
 */
export function parapetCovering(sim, victim, dx, dy) {
  for (const p of sim.parapets) {
    if (p.unitId !== victim.id) continue;
    if ((victim.x - p.x) ** 2 + (victim.y - p.y) ** 2 > (PARAPET.reach + PARAPET.ahead) ** 2) return null;
    const from = Math.atan2(-dy, -dx); // where the bullet comes from
    return Math.abs(angleDiff(p.facing, from)) <= PARAPET.arc ? p : null;
  }
  return null;
}
