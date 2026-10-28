// Facing + route following + collision for every unit.
//
// Facing while walking ("slicing the pie"): an operator without an explicit
// look order aims at a point MOVE.lookAhead meters ahead along his route, so
// he turns into a corner or a doorway before he reaches it and the hidden
// side is revealed inside his cone, not behind his back. A doorway coming up
// on the route is aimed THROUGH (MOVE.doorPeek past it). When the route ends
// he keeps facing the way he arrived (or the look the player set there).
import { MOVE, NAV, ENTRY, PREP } from '../config/balance.js';
import { EV } from '../core/events.js';
import { angleDiff, angleTo, approachAngle, TAU } from '../core/math.js';
import { tryOpenDoors, segmentCrossesDoorway } from './doors.js';
import { armEntry, armToss } from './entries.js';
import { isAiControlled, holdCode, ASK_CODE, doorClaimed } from './queries.js';
import { routePoint } from './routePoint.js';
import { wireFactor } from './wires.js';
import { inFire } from './fire.js';

const carrot = { x: 0, y: 0 };

/** Where the unit wants to look this tick, by priority. */
function desiredFacing(sim, u) {
  if (u.target >= 0) {
    const t = sim.units[u.target];
    return angleTo(u.x, u.y, t.x, t.y);
  }
  if (u.alertTimer > 0) return angleTo(u.x, u.y, u.alertX, u.alertY);
  if (u.lastKnown && u.lastKnown.until > sim.time) return angleTo(u.x, u.y, u.lastKnown.x, u.lastKnown.y);
  if (u.entry) return u.entry.look; // stacked on a door: aim through it
  if (u.route.length && !u.waitingGo) {
    if (u.lookOverride !== null) return u.lookOverride;
    if (!isAiControlled(sim, u) && lookAheadPoint(sim, u, carrot)) return angleTo(u.x, u.y, carrot.x, carrot.y);
    const p = u.route[0];
    if ((p.x - u.x) ** 2 + (p.y - u.y) ** 2 > 1e-6) return angleTo(u.x, u.y, p.x, p.y);
  }
  if (u.waitingGo && u.lookOverride !== null) return u.lookOverride;
  if (isAiControlled(sim, u) && u.behavior && u.behavior.type === 'scan') return u.ai.baseFacing; // sweeps around his idle look (sim/ai.js)
  if (u.cover && u.idleLook !== null && !u.route.length && !u.waitingGo) {
    // Cubrir zona (sim/orders.js setCover): the same sweep as a defender's "barrer".
    const k = 0.5 - 0.5 * Math.cos((sim.time / PREP.sweepPeriod) * TAU + u.id);
    return u.idleLook + (k - 0.5) * PREP.sweepArc;
  }
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
    if (p.hold || p.pause > 0 || (p.user && p.look !== null)) break; // he stops / turns there: don't look past it
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
  if (u.pause > 0) {
    u.pause = Math.max(0, u.pause - dt); // peeking: he holds the look of the point, then walks on
    return resetStuck(u);
  }
  if (u.waitingGo || u.entry || u.bash || u.goDelay > 0 || !u.route.length) return resetStuck(u);
  if (u.waitDoor >= 0) {
    if (doorClaimed(sim, u, u.waitDoor)) return resetStuck(u); // a teammate is still to go through it: after him
    u.waitDoor = -1;
  }

  let speed = (u.behavior && u.behavior.type === 'patrol' ? MOVE.patrolSpeed : MOVE.speed) * u.mods.speed;
  if (u.target >= 0) speed *= MOVE.engageFactor;
  const p0 = u.route[0];
  const moveDir = angleTo(u.x, u.y, p0.x, p0.y);
  if (Math.abs(angleDiff(u.facing, moveDir)) > MOVE.strafeAngle) speed *= MOVE.strafeFactor;
  const sneaking = p0.pace === 'sneak';
  if (sneaking) speed *= MOVE.sneakFactor; // the leg he walks is a quiet one
  speed *= followFactor(sim, u, Math.cos(moveDir), Math.sin(moveDir));
  speed *= wireFactor(sim, u); // barbed wire in the doorway (sim/wires.js)
  if (speed > 0 && doorwayBusy(sim, u)) speed = 0; // queue: an ally is still in the doorway ahead
  if (speed > 0 && fireAhead(sim, u, moveDir)) speed = 0; // an AI attacker waits for the fire to burn down

  u.speedFraction = speed / MOVE.speed;
  let budget = speed * dt;
  let moved = 0;
  while (budget > 0 && u.route.length && !u.waitingGo && !u.entry) {
    const p = u.route[0];
    const dx = p.x - u.x;
    const dy = p.y - u.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-6) u.heading = Math.atan2(dy, dx);
    // An ally already stands on the point (two routes to the same spot): close enough counts,
    // or the two would push each other around it forever (collisions.js).
    const crowded = d > budget && d <= MOVE.friendlySpacing && allyOn(sim, u, p);
    if (d <= budget || crowded) {
      if (!crowded) {
        u.x = p.x;
        u.y = p.y;
        budget -= d;
        moved += d;
      } else budget = 0;
      if (p.ask && ENTRY.undecided === 'stop') {
        // Strict mode: a door nobody decided stops him on the "?" point (kept: the decision is made on it).
        stopAtAsk(sim, u, p);
        break;
      }
      // Default: an undecided door is just opened on the way (tryOpenDoors), as in Door Kickers.
      arriveAt(sim, u, u.route.shift());
    } else {
      u.x += (dx / d) * budget;
      u.y += (dy / d) * budget;
      moved += budget;
      budget = 0;
    }
  }

  unstick(sim, u, dt, moved);
  u.sneaking = moved > 0 && sneaking;
  if (moved > 0) {
    u.moving = true;
    u.distanceWalked += moved;
    u.stepAccum += moved;
    if (u.stepAccum >= MOVE.footstepStride) {
      u.stepAccum -= MOVE.footstepStride;
      sim.emit(EV.FOOTSTEP, { unitId: u.id, team: u.team, x: u.x, y: u.y, speed: u.speedFraction * MOVE.speed, sneak: sneaking });
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

/**
 * Pushed off his line (an ally in a doorway, a blast) an operator can end up
 * walking straight into a wall toward his next point. When he has been
 * trying to walk for MOVE.stuckTime without getting anywhere, the way to
 * that point is found again (the new corners are inserted before it).
 */
function unstick(sim, u, dt, moved) {
  const s = u.stuck;
  if (!u.route.length) return resetStuck(u);
  s.t += dt;
  s.want += moved;
  if (s.t < MOVE.stuckTime) return;
  const went = Math.hypot(u.x - s.x, u.y - s.y);
  const want = s.want;
  resetStuck(u);
  if (want <= 0 || went >= want * MOVE.stuckFraction) return;
  const p = u.route[0];
  const path = sim.world.nav.findPath(u.x, u.y, p.x, p.y, NAV.snapRadius);
  if (!path || path.length < 2) return;
  path.pop(); // the point itself stays as it is (user, hold, entry...)
  const corners = path.map((q) => routePoint(q.x, q.y, { pace: p.pace || null }));
  u.route.unshift(...corners);
}

function resetStuck(u) {
  const s = u.stuck;
  s.t = 0;
  s.want = 0;
  s.x = u.x;
  s.y = u.y;
}

/** Is an ally of u standing (or arriving) on point p? */
function allyOn(sim, u, p) {
  const r2 = MOVE.friendlySpacing * MOVE.friendlySpacing;
  for (const a of sim.teams[u.team]) {
    if (a !== u && a.alive && (a.x - p.x) ** 2 + (a.y - p.y) ** 2 < r2) return true;
  }
  return false;
}

function stopAtAsk(sim, u, p) {
  u.waitingGo = true;
  u.waitCode = ASK_CODE;
  u.lookOverride = p.look;
  sim.emit(EV.HOLD_REACHED, { unitId: u.id, code: ASK_CODE });
}

function arriveAt(sim, u, p) {
  if (!p.user) return;
  u.lookOverride = p.look;
  if (p.pause > 0) u.pause = p.pause;
  if (p.waitDoor >= 0) {
    u.waitDoor = p.waitDoor;
    const d = sim.world.doorways[p.waitDoor];
    if (p.look === null) u.lookOverride = angleTo(u.x, u.y, d.cx, d.cy); // covering the doorway
  }
  if (p.hold) {
    u.waitingGo = true;
    u.waitCode = holdCode(p);
    sim.emit(EV.HOLD_REACHED, { unitId: u.id, code: u.waitCode });
  }
  if (p.entry) armEntry(sim, u, p);
  else if (p.toss) armToss(sim, u, p);
  if (!u.route.length) {
    // End of the plan: hold the angle set there, or keep facing the way he came.
    // (A defender on patrol goes back to his watch's facing: sim/ai.js.)
    u.idleLook = p.look !== null ? p.look : isAiControlled(sim, u) && u.behavior && u.behavior.type === 'patrol' ? null : u.heading;
    u.cover = !!p.cover;
    u.lookOverride = null;
  }
}

/** An attacker of an AI-commanded side about to step into a fire (sim/fire.js) holds; already in one, he gets out. */
function fireAhead(sim, u, dir) {
  if (u.team !== 'attackers' || sim.controllers.attackers !== 'ai' || !sim.fires.length) return false;
  if (inFire(sim, u.x, u.y)) return false;
  return inFire(sim, u.x + Math.cos(dir) * FIRE_LOOK, u.y + Math.sin(dir) * FIRE_LOOK);
}

const FIRE_LOOK = 0.6; // m ahead
