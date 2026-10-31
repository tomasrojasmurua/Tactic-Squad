// Wounds that last and the blood they leave (config/balance.js WOUNDS). A limb hit is a leg or an
// arm (sim/combat.js applyHit): leg -> slower (sim/movement.js) and louder steps (sim/noise.js);
// arm -> worse aim and slower reloads (sim/combat.js). Nobody heals in a round.
// A badly hurt soldier (below WOUNDS.bleedBelow of his health) leaves drops as he walks: sim.blood,
// each {x, y, team, known} — `known` once a soldier of the other side has seen it (his own side
// always sees it). Information on the floor, never a reveal of where he is now.
import { WOUNDS, VISION } from '../config/balance.js';
import { solidLineOfSight } from './vision.js';
import { angleTo, angleDiff } from '../core/math.js';
import { sq } from '../core/dmath.js';

/** A limb hit: which one, from the round's dice (only on a limb hit, so the stream stays put otherwise). */
export function woundLimb(sim, victim) {
  const which = sim.rng.chance(WOUNDS.legShare) ? 'leg' : 'arm';
  victim.wounds[which] = true;
  return which;
}

export const woundSpeed = (u) => (u.wounds.leg ? WOUNDS.legSpeed : 1);
export const woundStepNoise = (u) => (u.wounds.leg ? WOUNDS.legStepNoise : 1);
export const woundSpread = (u) => (u.wounds.arm ? WOUNDS.armSpread : 1);
export const woundReload = (u) => (u.wounds.arm ? WOUNDS.armReload : 1);

/** He walked `moved` m: a badly hurt soldier drops blood on the way. */
export function bleed(sim, u, moved) {
  if (moved <= 0 || u.hp >= u.maxHp * WOUNDS.bleedBelow) return;
  u.bleed += moved;
  if (u.bleed < WOUNDS.bleedEvery) return;
  u.bleed = 0;
  sim.blood.push({ x: u.x, y: u.y, team: u.team, known: false });
  if (sim.blood.length > WOUNDS.maxDrops) sim.blood.shift();
}

/** Every few steps: the drops the other side has now seen with its own eyes. */
export function spotBlood(sim) {
  if (!sim.blood.length || sim.tick % WOUNDS.spotEvery !== 0) return;
  for (const d of sim.blood) {
    if (d.known) continue;
    for (const o of sim.units) {
      if (!o.alive || o.team === d.team || o.blind > 0) continue;
      const v = VISION[o.team];
      if (sq(d.x - o.x) + sq(d.y - o.y) > sq(Math.min(v.range, o.vision.range || v.range))) continue;
      if (Math.abs(angleDiff(o.facing, angleTo(o.x, o.y, d.x, d.y))) > v.fov / 2) continue;
      if (!solidLineOfSight(sim.world, o.x, o.y, d.x, d.y)) continue;
      d.known = true;
      break;
    }
  }
}
