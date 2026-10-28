// Hinged doors: opened by moving units, swing away from the opener and
// stay open. Slab geometry feeds LOS/bullets through World.updateDoorSegments.
// Entries (sim/entries.js) also crack a door ajar (still closed for bodies:
// only sight gets through), kick it open, or blow it off its hinges.
// A barricaded door (sim/barricades.js) does none of that: whoever tries
// to open it starts breaking the barricade instead.
import { DOORS } from '../config/balance.js';
import { EV } from '../core/events.js';
import { startBash } from './barricades.js';

/**
 * open: bodies pass (the slab is pushed flat against the wall); cracked: ajar
 * at DOORS.crackAngle, still blocking movement; destroyed: no slab at all;
 * barricaded: shut for good until the barricade is broken.
 */
export function createDoorState(def) {
  return { def, angle: 0, target: 0, speed: DOORS.swingSpeed, open: false, cracked: false, destroyed: false, barricaded: false, wired: false };
}

export function updateDoors(sim, dt) {
  let changed = false;
  for (const d of sim.doors) {
    if (d.angle === d.target) continue;
    const step = d.speed * dt;
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
 * Stops at a GO hold or a "?" point: an operator stacked on a door waits with it CLOSED
 * (and one doing an entry leaves the door to it).
 */
function routeCrossesDoor(unit, def) {
  if (unit.waitingGo || unit.entry) return false; // stacked, or working the door through his entry
  let ax = unit.x;
  let ay = unit.y;
  const n = Math.min(unit.route.length, DOORS.routeLookahead);
  for (let i = 0; i < n; i++) {
    const p = unit.route[i];
    if (segmentCrossesDoorway(ax, ay, p.x, p.y, def) >= 0) return true;
    if (p.hold || p.ask || p.entry) return false; // he stops there first (the entry decides how the door opens)
    ax = p.x;
    ay = p.y;
  }
  return false;
}

/** After movement: whoever walked through a doorway this tick is marked (unit.doorwayAt; sim/perception.js). */
export function markDoorwayCrossings(sim) {
  const ds = sim.world.doorways;
  for (const u of sim.units) {
    if (!u.alive || (u.x === u.prevX && u.y === u.prevY)) continue;
    for (let k = 0; k < ds.length; k++) {
      if (segmentCrossesDoorway(u.prevX, u.prevY, u.x, u.y, ds[k]) >= 0) {
        u.doorwayAt = sim.time;
        break;
      }
    }
  }
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

/** Sign of the swing that takes the free end away from the opener's side of the wall. */
function swingAway(def, unit) {
  const side = Math.sign((unit.x - def.cx) * def.normalX + (unit.y - def.cy) * def.normalY) || 1;
  const tangentDotN = -Math.sin(def.closedAngle) * def.normalX + Math.cos(def.closedAngle) * def.normalY;
  return -side * Math.sign(tangentDotN);
}

/**
 * Opens a closed (or cracked) door away from the unit. mode: 'push' (he
 * stops DOORS.kickPause to push it) | 'kick' (it bursts open, no pause).
 */
export function openDoor(sim, door, unit, mode = 'push') {
  const { def } = door;
  if (door.open) return;
  if (door.barricaded) return startBash(sim, door, unit);
  // A cracked door keeps the swing it started; otherwise it swings away from the opener.
  const sign = door.cracked ? Math.sign(door.target) || 1 : swingAway(def, unit);
  door.target = sign * DOORS.openAngle;
  door.speed = DOORS.swingSpeed;
  door.open = true;
  door.cracked = false;
  if (mode === 'push') unit.stun = Math.max(unit.stun, DOORS.kickPause);
  sim.emit(EV.DOOR_OPEN, { doorId: def.id, unitId: unit.id, x: def.cx, y: def.cy, mode });
}

/** Cracks a closed door ajar (DOORS.crackAngle), slowly: light gets through, bodies do not. */
export function crackDoor(sim, door, unit) {
  if (door.open || door.cracked || door.barricaded) return;
  door.target = swingAway(door.def, unit) * DOORS.crackAngle;
  door.speed = DOORS.crackSpeed;
  door.cracked = true;
  sim.emit(EV.DOOR_OPEN, { doorId: door.def.id, unitId: unit.id, x: door.def.cx, y: door.def.cy, mode: 'crack' });
}

/** Blown off its hinges (breach charge): nothing blocks the doorway any more. */
export function destroyDoor(sim, door) {
  door.open = true;
  door.cracked = false;
  door.destroyed = true;
  door.angle = door.target = 0;
  sim.world.updateDoorSegments(sim.doors);
}

/** Closed doors block movement (open ones are pushed flat against the wall). */
export function closedDoorBoxes(sim, out) {
  out.length = 0;
  for (const d of sim.doors) if (!d.open) out.push(d.def.closedBox);
  return out;
}
