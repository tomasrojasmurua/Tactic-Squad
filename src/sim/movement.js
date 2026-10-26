// Facing + route following + collision for every unit.
//
// Facing while walking ("slicing the pie"): an operator without an explicit
// look order aims at a point MOVE.lookAhead meters ahead along his route, so
// he turns into a corner or a doorway before he reaches it and the hidden
// side is revealed inside his cone, not behind his back. A doorway coming up
// on the route is aimed THROUGH (MOVE.doorPeek past it). When the route ends
// he keeps facing the way he arrived (or the look the player set there).
import { MOVE } from '../config/balance.js';
import { EV } from '../core/events.js';
import { angleDiff, angleTo, approachAngle } from '../core/math.js';
import { tryOpenDoors, segmentCrossesDoorway } from './doors.js';
import { isAiControlled } from './queries.js';

const carrot = { x: 0, y: 0 };

/** Where the unit wants to look this tick, by priority. */
function desiredFacing(sim, u) {
  if (u.target >= 0) {
    const t = sim.units[u.target];
    return angleTo(u.x, u.y, t.x, t.y);
  }
  if (u.alertTimer > 0) return angleTo(u.x, u.y, u.alertX, u.alertY);
  if (u.lastKnown && u.lastKnown.until > sim.time) return angleTo(u.x, u.y, u.lastKnown.x, u.lastKnown.y);
  if (u.route.length && !u.waitingGo) {
    if (u.lookOverride !== null) return u.lookOverride;
    if (!isAiControlled(sim, u) && lookAheadPoint(sim, u, carrot)) return angleTo(u.x, u.y, carrot.x, carrot.y);
    const p = u.route[0];
    if ((p.x - u.x) ** 2 + (p.y - u.y) ** 2 > 1e-6) return angleTo(u.x, u.y, p.x, p.y);
  }
  if (u.waitingGo && u.lookOverride !== null) return u.lookOverride;
  if (u.idleLook !== null) return u.idleLook;
  if (isAiControlled(sim, u)) return u.ai.baseFacing;
  return u.facing;
}

/**
 * Point to aim at while walking: MOVE.lookAhead along the route (never past
 * a GO hold), or further when a doorway is coming up so the operator looks
 * through it. Returns false when the route is too short to matter.
 */
function lookAheadPoint(sim, u, out) {
  const route = u.route;
  let want = MOVE.lookAhead;
  let travelled = 0;
  let ax = u.x;
  let ay = u.y;
  const doorways = sim.world.doorways;
  for (let i = 0; i < route.length; i++) {
    const p = route[i];
    const len = Math.hypot(p.x - ax, p.y - ay);
    // A doorway crossed by this leg, close enough: look through it.
    if (travelled < MOVE.doorPeekRange) {
      for (let k = 0; k < doorways.length; k++) {
        const t = segmentCrossesDoorway(ax, ay, p.x, p.y, doorways[k]);
        if (t >= 0 && travelled + t * len <= MOVE.doorPeekRange) want = Math.max(want, travelled + t * len + MOVE.doorPeek);
      }
    }
    if (travelled + len >= want) {
      const k = len > 1e-6 ? (want - travelled) / len : 0;
      out.x = ax + (p.x - ax) * k;
      out.y = ay + (p.y - ay) * k;
      return true;
    }
    travelled += len;
    ax = p.x;
    ay = p.y;
    if (p.hold || (p.user && p.look !== null)) break; // he stops / turns there: don't look past it
  }
  if (travelled < MOVE.lookAhead * 0.25) return false;
  out.x = ax;
  out.y = ay;
  return true;
}

export function updateFacing(sim, u, dt) {
  const rate = (u.target >= 0 ? MOVE.combatTurnRate : MOVE.turnRate) * u.mods.turnRate;
  const before = u.facing;
  u.facing = approachAngle(u.facing, desiredFacing(sim, u), rate * dt);
  // Aim is "set" after standing still without turning for a moment.
  const turned = Math.abs(angleDiff(before, u.facing)) > rate * dt * 0.5;
  if (u.moving || turned) u.stillTime = 0;
  else u.stillTime += dt;
}

export function updateMovement(sim, u, dt) {
  u.wasMoving = u.moving;
  u.moving = false;
  if (u.stun > 0) {
    u.stun -= dt;
    return;
  }
  if (u.waitingGo || !u.route.length) return;

  let speed = (u.behavior && u.behavior.type === 'patrol' ? MOVE.patrolSpeed : MOVE.speed) * u.mods.speed;
  if (u.target >= 0) speed *= MOVE.engageFactor;
  const p0 = u.route[0];
  const moveDir = angleTo(u.x, u.y, p0.x, p0.y);
  if (Math.abs(angleDiff(u.facing, moveDir)) > MOVE.strafeAngle) speed *= MOVE.strafeFactor;
  speed *= followFactor(sim, u, Math.cos(moveDir), Math.sin(moveDir));
  if (speed > 0 && doorwayBusy(sim, u)) speed = 0; // queue: an ally is still in the doorway ahead

  u.speedFraction = speed / MOVE.speed;
  let budget = speed * dt;
  let moved = 0;
  while (budget > 0 && u.route.length && !u.waitingGo) {
    const p = u.route[0];
    const dx = p.x - u.x;
    const dy = p.y - u.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-6) u.heading = Math.atan2(dy, dx);
    if (d <= budget) {
      u.x = p.x;
      u.y = p.y;
      budget -= d;
      moved += d;
      arriveAt(sim, u, u.route.shift());
    } else {
      u.x += (dx / d) * budget;
      u.y += (dy / d) * budget;
      moved += budget;
      budget = 0;
    }
  }

  if (moved > 0) {
    u.moving = true;
    u.distanceWalked += moved;
    u.stepAccum += moved;
    if (u.stepAccum >= MOVE.footstepStride) {
      u.stepAccum -= MOVE.footstepStride;
      sim.emit(EV.FOOTSTEP, { unitId: u.id, team: u.team, x: u.x, y: u.y, speed: u.speedFraction * MOVE.speed });
    }
    tryOpenDoors(sim, u);
  }
}

/**
 * Narrow passages: slow down behind an ally ahead going the same way —
 * walking, or stopped mid-route (kicking a door, queued) — instead of
 * walking into him. Allies coming the other way, resting (no route) or
 * waiting for GO never block: they are pushed aside (separateUnits), so two
 * operators can never deadlock.
 */
function followFactor(sim, u, dirX, dirY) {
  let factor = 1;
  const reach = MOVE.followGap + MOVE.followSlowRange;
  for (const a of sim.teams[u.team]) {
    if (a === u || !a.alive || !(a.wasMoving || (a.route.length && !a.waitingGo))) continue;
    const rx = a.x - u.x;
    const ry = a.y - u.y;
    const along = rx * dirX + ry * dirY;
    if (along <= 0 || along > reach) continue;
    if (Math.abs(rx * dirY - ry * dirX) > u.radius * 2) continue;
    if (Math.cos(a.heading) * dirX + Math.sin(a.heading) * dirY < 0.2) continue;
    const f = (Math.hypot(rx, ry) - MOVE.followGap) / MOVE.followSlowRange;
    factor = Math.min(factor, f < 0 ? 0 : f > 1 ? 1 : f);
  }
  return factor;
}

/** Is a unit inside a doorway's vano (MOVE.doorwayDepth either side of the wall plane)? */
function inDoorway(x, y, d, margin) {
  const across = (x - d.cx) * d.normalX + (y - d.cy) * d.normalY;
  const along = (x - d.cx) * d.normalY - (y - d.cy) * d.normalX;
  return Math.abs(across) < MOVE.doorwayDepth && Math.abs(along) < d.length / 2 + margin;
}

/**
 * Door queue: the next single-file doorway on the route (within
 * MOVE.doorQueueRange) is occupied by an ally passing through it, so this
 * unit waits outside until the first one has cleared the vano.
 */
function doorwayBusy(sim, u) {
  const doorways = sim.world.doorways;
  let ax = u.x;
  let ay = u.y;
  let travelled = 0;
  for (let i = 0; i < u.route.length && travelled < MOVE.doorQueueRange; i++) {
    const p = u.route[i];
    const len = Math.hypot(p.x - ax, p.y - ay);
    for (let k = 0; k < doorways.length; k++) {
      const d = doorways[k];
      if (d.length > MOVE.queueDoorMaxWidth) continue;
      const t = segmentCrossesDoorway(ax, ay, p.x, p.y, d);
      if (t < 0 || travelled + t * len > MOVE.doorQueueRange) continue;
      if (inDoorway(u.x, u.y, d, u.radius)) return false; // already in it: keep going
      for (const a of sim.teams[u.team]) {
        if (a !== u && a.alive && a.route.length && !a.waitingGo && inDoorway(a.x, a.y, d, a.radius)) return true;
      }
      return false;
    }
    if (p.hold) break;
    travelled += len;
    ax = p.x;
    ay = p.y;
  }
  return false;
}

function arriveAt(sim, u, p) {
  if (!p.user) return;
  u.lookOverride = p.look;
  if (p.hold) {
    u.waitingGo = true;
    sim.emit(EV.HOLD_REACHED, { unitId: u.id });
  }
  if (!u.route.length) {
    // End of the plan: hold the angle set there, or keep facing the way he came.
    u.idleLook = p.look !== null ? p.look : isAiControlled(sim, u) ? null : u.heading;
    u.lookOverride = null;
  }
}
