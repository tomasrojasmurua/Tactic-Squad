// Suppression (stress): what being shot at does to a soldier, the same for both sides and for the
// AI. Each unit carries `stress` 0-1:
//   + a bullet passing close (STRESS.nearMissRadius of its line, aimed by an enemy), more the closer
//   + a wound, an explosion near him (STRESS.blastReach × its radius), a teammate falling in sight
//   - it eases off by itself once he has gone STRESS.calmDelay s without any of that
// Effects (read where they apply): aim (sim/combat.js fire: spread × (1 + spread · stress)), the time
// to react (sim/perception.js: × (1 + reaction · stress)), and, past `pinAt`, he hugs the floor:
// `pinned` s without walking his route (sim/movement.js), then a while before it can happen again.
import { STRESS } from '../config/balance.js';
import { EV } from '../core/events.js';
import { solidLineOfSight } from './vision.js';
import { dhypot, sq } from '../core/dmath.js';

function add(u, amount) {
  if (!u.alive || amount <= 0) return;
  u.stress = Math.min(1, u.stress + amount);
  u.stressCalm = 0;
}

/** A shot from (ox, oy) along (dx, dy) that ended at distance `endT`: whom it whizzed past. */
export function stressShot(sim, shooter, ox, oy, dx, dy, endT, victim) {
  const r = STRESS.nearMissRadius;
  for (const o of sim.units) {
    if (!o.alive || o.team === shooter.team || o === victim) continue;
    const t = (o.x - ox) * dx + (o.y - oy) * dy;
    if (t <= 0 || t > endT + r) continue; // behind the shooter, or past where the bullet stopped
    const d = Math.abs((o.x - ox) * dy - (o.y - oy) * dx);
    if (d < r) add(o, STRESS.nearMiss * (1 - (0.5 * d) / r));
  }
  if (victim) add(victim, STRESS.wound);
}

/** An explosion at (x, y) of `radius`: everyone near it in sight of it is shaken. */
export function stressBlast(sim, x, y, radius) {
  const reach = radius * STRESS.blastReach;
  for (const o of sim.units) {
    if (!o.alive) continue;
    const d = dhypot(o.x - x, o.y - y);
    if (d > reach || !solidLineOfSight(sim.world, x, y, o.x, o.y)) continue;
    add(o, STRESS.blast * (1 - d / reach));
  }
}

/** `victim` fell: his teammates who see him (STRESS.allyRange) feel it. */
export function stressAllyDown(sim, victim) {
  for (const o of sim.units) {
    if (!o.alive || o.team !== victim.team || o === victim) continue;
    if (sq(o.x - victim.x) + sq(o.y - victim.y) > sq(STRESS.allyRange)) continue;
    if (solidLineOfSight(sim.world, o.x, o.y, victim.x, victim.y)) add(o, STRESS.allyDown);
  }
}

/** Every step: stress eases off after a calm moment; a soldier past `pinAt` hugs the floor a moment. */
export function updateStress(sim, dt) {
  for (const u of sim.units) {
    if (!u.alive) continue;
    if (u.pinned > 0) u.pinned = Math.max(0, u.pinned - dt);
    if (u.pinCooldown > 0) u.pinCooldown = Math.max(0, u.pinCooldown - dt);
    if (u.stress <= 0) continue;
    u.stressCalm += dt;
    if (u.stressCalm > STRESS.calmDelay) u.stress = Math.max(0, u.stress - STRESS.decay * dt);
    if (u.stress >= STRESS.pinAt && u.pinCooldown <= 0) {
      u.pinned = STRESS.pinSeconds;
      u.pinCooldown = STRESS.pinCooldown;
      sim.emit(EV.PINNED, { unitId: u.id, team: u.team, x: u.x, y: u.y });
    }
  }
}

/** Aim and reaction multipliers of a unit's stress. */
export const stressSpread = (u) => 1 + STRESS.spread * u.stress;
export const stressReaction = (u) => 1 + STRESS.reaction * u.stress;
