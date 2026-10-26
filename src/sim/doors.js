// Hinged doors: opened by moving units, swing away from the opener and
// stay open. Slab geometry feeds LOS/bullets through World.updateDoorSegments.
import { DOORS } from '../config/balance.js';
import { EV } from '../core/events.js';

export function createDoorState(def) {
  return { def, angle: 0, target: 0, open: false };
}

export function updateDoors(sim, dt) {
  let changed = false;
  for (const d of sim.doors) {
    if (d.angle === d.target) continue;
    const step = DOORS.swingSpeed * dt;
    const diff = d.target - d.angle;
    d.angle = Math.abs(diff) <= step ? d.target : d.angle + Math.sign(diff) * step;
    changed = true;
  }
  if (changed) sim.world.updateDoorSegments(sim.doors);
}

/** Opens any closed door a moving unit is about to walk through. */
export function tryOpenDoors(sim, unit) {
  const r2 = DOORS.triggerDistance * DOORS.triggerDistance;
  for (const d of sim.doors) {
    if (d.open) continue;
    const dx = unit.x - d.def.cx;
    const dy = unit.y - d.def.cy;
    if (dx * dx + dy * dy > r2) continue;
    if (routeCrossesDoor(unit, d.def)) openDoor(sim, d, unit);
  }
}

/**
 * Does the next stretch of the unit's route pass through this doorway?
 * Stops at a GO hold: an operator stacked on a door waits with it CLOSED.
 */
function routeCrossesDoor(unit, def) {
  if (unit.waitingGo) return false;
  let ax = unit.x;
  let ay = unit.y;
  const n = Math.min(unit.route.length, DOORS.routeLookahead);
  for (let i = 0; i < n; i++) {
    const p = unit.route[i];
    if (segmentCrossesDoorway(ax, ay, p.x, p.y, def) >= 0) return true;
    if (p.hold) return false;
    ax = p.x;
    ay = p.y;
  }
  return false;
}

/**
 * Where segment a->b crosses a doorway ({cx, cy, normalX, normalY, length}:
 * door defs and world.doorways), as a fraction 0..1 of the segment, or -1.
 */
export function segmentCrossesDoorway(ax, ay, bx, by, def) {
  const sa = (ax - def.cx) * def.normalX + (ay - def.cy) * def.normalY;
  const sb = (bx - def.cx) * def.normalX + (by - def.cy) * def.normalY;
  if (sa * sb > 0) return -1; // same side of the wall plane
  if (sa === 0 && sb === 0) return -1; // walking along the wall line, not through it
  const t = Math.abs(sa) / (Math.abs(sa) + Math.abs(sb));
  const px = ax + (bx - ax) * t;
  const py = ay + (by - ay) * t;
  // Lateral distance from the doorway center, measured along the wall.
  const lateral = Math.abs((px - def.cx) * def.normalY - (py - def.cy) * def.normalX);
  return lateral <= def.length / 2 + DOORS.crossingSlack ? t : -1;
}

function openDoor(sim, door, unit) {
  const { def } = door;
  // Side of the opener relative to the wall plane; the free end swings to the other side.
  const side = Math.sign((unit.x - def.cx) * def.normalX + (unit.y - def.cy) * def.normalY) || 1;
  const tangentDotN = -Math.sin(def.closedAngle) * def.normalX + Math.cos(def.closedAngle) * def.normalY;
  door.target = -side * Math.sign(tangentDotN) * DOORS.openAngle;
  door.open = true;
  unit.stun = Math.max(unit.stun, DOORS.kickPause);
  sim.emit(EV.DOOR_OPEN, { doorId: def.id, unitId: unit.id, x: def.cx, y: def.cy, mode: DOORS.openMode[unit.team] });
}

/** Closed doors block movement (open ones are pushed flat against the wall). */
export function closedDoorBoxes(sim, out) {
  out.length = 0;
  for (const d of sim.doors) if (!d.open) out.push(d.def.closedBox);
  return out;
}
