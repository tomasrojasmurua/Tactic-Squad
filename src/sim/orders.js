// Player commands -> unit route state. Commands are plain serializable
// objects (the unit of exchange for We-Go turns / networking later).
//
//   {type:'addWaypoint', unitId, x, y, user, quiet?}  path-found leg appended to the route
//                                              (points near a doorway snap to its center line;
//                                               quiet: no rejection event — freehand samples)
//   {type:'beginStroke', unitId}               marks where a freehand stroke starts
//   {type:'endStroke', unitId}                 straightens the stroke drawn since the mark
//   {type:'cancelStroke', unitId}              removes the stroke drawn since the mark
//   {type:'promoteLast', unitId}               last point becomes a user waypoint
//   {type:'setLook', unitId, angle, index?}    facing at a user waypoint (default: last; none: idle facing)
//   {type:'toggleHold', unitId}                last user waypoint waits for the GO code
//   {type:'undoWaypoint', unitId}              removes the last user waypoint (and its leg)
//   {type:'clearRoute', unitId}
//   {type:'go'}                                releases every unit of the side waiting for GO (rejected if none)
//   {type:'plantNow'}                          bomb carrier inside site A stops and plants
//
// Every command may carry `team` (the side giving it; the session stamps it):
// a unit only obeys its own side, and only a side whose controller is
// 'human' (sim.controllers) takes orders. Without `team` (scripts, old
// replays) the unit's side must be human-controlled.
// Rejections are reported as EV.ORDER_REJECTED with a REJECT code; the UI
// turns codes into text (ui/texts.js T.rejectReason), the sim never does.
import { NAV } from '../config/balance.js';
import { EV } from '../core/events.js';
import { routeTail, lastUserIndex, inSiteA, doorwayNear } from './queries.js';

export const REJECT = Object.freeze({
  routeTooLong: 'routeTooLong',
  unreachable: 'unreachable',
  noWaypoint: 'noWaypoint',
  carrierNotInSite: 'carrierNotInSite',
  nobodyWaiting: 'nobodyWaiting',
  goBeforeStart: 'goBeforeStart', // emitted by the session: GO pressed while still planning
});

/** May the side that sent `cmd` command this unit? */
function obeys(sim, unit, cmd) {
  if (cmd.team && unit.team !== cmd.team) return false;
  return sim.controllers[unit.team] === 'human';
}

export function applyCommand(sim, cmd) {
  if (cmd.type === 'go') return issueGo(sim, cmd);
  if (cmd.type === 'plantNow') return plantNow(sim, cmd);
  const unit = sim.units[cmd.unitId];
  if (!unit || !unit.alive || !obeys(sim, unit, cmd)) return;
  switch (cmd.type) {
    case 'addWaypoint':
      return addWaypoint(sim, unit, cmd);
    case 'promoteLast':
      if (unit.route.length) unit.route[unit.route.length - 1].user = true;
      return changed(sim, unit, 'promote');
    case 'setLook':
      return setLook(sim, unit, cmd.angle, cmd.index);
    case 'toggleHold':
      return toggleHold(sim, unit);
    case 'undoWaypoint':
      return undoWaypoint(sim, unit);
    case 'beginStroke':
      unit.strokeStart = unit.route.length;
      return;
    case 'endStroke':
      return simplifyRoute(sim, unit, Math.min(unit.strokeStart, unit.route.length));
    case 'cancelStroke':
      if (unit.strokeStart < unit.route.length) unit.route.length = unit.strokeStart;
      return changed(sim, unit, 'undo');
    case 'clearRoute':
      unit.route.length = 0;
      unit.waitingGo = false;
      return changed(sim, unit, 'clear');
    default:
      break;
  }
}

function changed(sim, unit, kind) {
  sim.emit(EV.ROUTE_CHANGED, { unitId: unit.id, kind });
}

function addWaypoint(sim, unit, { x, y, user = true, quiet = false }) {
  if (unit.route.length >= NAV.maxRoutePoints) return quiet ? undefined : reject(sim, unit, REJECT.routeTooLong);
  const from = routeTail(unit);
  const p = snapToDoorway(sim.world, x, y);
  const path = sim.world.nav.findPath(from.x, from.y, p.x, p.y, NAV.snapRadius);
  if (!path || !path.length) return quiet ? undefined : reject(sim, unit, REJECT.unreachable);
  path.forEach((q, i) => {
    unit.route.push({ x: q.x, y: q.y, user: user && i === path.length - 1, look: null, hold: false });
  });
  changed(sim, unit, 'add');
}

/**
 * A point dropped close to a doorway is slid sideways onto the doorway's
 * center line (its distance from the wall is kept): fingers are imprecise,
 * and a route that clips a door frame looks and plays badly.
 */
const snapped = { x: 0, y: 0 };
function snapToDoorway(world, x, y) {
  snapped.x = x;
  snapped.y = y;
  const d = doorwayNear(world, x, y, NAV.doorSnap + NAV.doorSnapSide + 1);
  if (!d) return snapped;
  const along = (x - d.cx) * d.normalY - (y - d.cy) * d.normalX; // offset along the wall
  const across = (x - d.cx) * d.normalX + (y - d.cy) * d.normalY; // distance from the wall plane
  if (Math.abs(along) > d.length / 2 + NAV.doorSnapSide || Math.abs(across) > NAV.doorSnap) return snapped;
  snapped.x = d.cx + d.normalX * across;
  snapped.y = d.cy + d.normalY * across;
  return snapped;
}

/**
 * Straightens route[from..]: keeps user waypoints (with their look/hold) as
 * anchors and, between them, drops every point a straight walkable line can
 * skip while staying within NAV.simplifyTolerance of the drawn stroke.
 */
function simplifyRoute(sim, unit, from) {
  const r = unit.route;
  if (from < 0 || from >= r.length - 1) return;
  const nav = sim.world.nav;
  const out = r.slice(0, from);
  let anchor = from > 0 ? r[from - 1] : unit;
  let i = from;
  while (i < r.length) {
    // Farthest j (not past the next user point) reachable in a straight line.
    let j = i;
    for (let k = i; k < r.length; k++) {
      if (!nav.lineWalkable(anchor.x, anchor.y, r[k].x, r[k].y) || !withinTolerance(r, i, k, anchor)) break;
      j = k;
      if (r[k].user) break;
    }
    out.push(r[j]);
    anchor = r[j];
    i = j + 1;
  }
  if (out.length === r.length) return;
  r.length = 0;
  for (const p of out) r.push(p);
  changed(sim, unit, 'simplify');
}

/** Do the points between i and k stay close to the straight line anchor -> r[k]? */
function withinTolerance(r, i, k, anchor) {
  const ax = anchor.x;
  const ay = anchor.y;
  const bx = r[k].x - ax;
  const by = r[k].y - ay;
  const len = Math.hypot(bx, by);
  if (len < 1e-6) return true;
  for (let m = i; m < k; m++) {
    const dist = Math.abs((r[m].x - ax) * by - (r[m].y - ay) * bx) / len;
    if (dist > NAV.simplifyTolerance) return false;
  }
  return true;
}

function setLook(sim, unit, angle, index = -1) {
  const valid = index >= 0 && index < unit.route.length && unit.route[index].user;
  const last = valid ? index : lastUserIndex(unit);
  if (last >= 0) unit.route[last].look = angle;
  else unit.idleLook = angle;
  changed(sim, unit, 'look');
}

function toggleHold(sim, unit) {
  const last = lastUserIndex(unit);
  if (last < 0) return reject(sim, unit, REJECT.noWaypoint);
  unit.route[last].hold = !unit.route[last].hold;
  changed(sim, unit, 'hold');
}

function undoWaypoint(sim, unit) {
  const r = unit.route;
  if (!r.length) return;
  r.pop();
  while (r.length && !r[r.length - 1].user) r.pop();
  changed(sim, unit, 'undo');
}

function issueGo(sim, cmd) {
  let released = 0;
  for (const u of sim.units) {
    if (u.waitingGo && obeys(sim, u, cmd)) {
      u.waitingGo = false;
      released++;
    }
  }
  if (!released) {
    sim.emit(EV.ORDER_REJECTED, { unitId: -1, reason: REJECT.nobodyWaiting });
    return;
  }
  sim.goCount++;
  sim.emit(EV.GO_CODE, { released });
}

function plantNow(sim, cmd) {
  const carrier = sim.units[sim.bomb.carrierId];
  if (!carrier || !carrier.alive || !obeys(sim, carrier, cmd) || !inSiteA(sim, carrier.x, carrier.y)) {
    sim.emit(EV.ORDER_REJECTED, { unitId: carrier ? carrier.id : -1, reason: REJECT.carrierNotInSite });
    return;
  }
  carrier.route.length = 0;
  carrier.waitingGo = false;
  changed(sim, carrier, 'clear');
}

function reject(sim, unit, reason) {
  sim.emit(EV.ORDER_REJECTED, { unitId: unit.id, reason });
}
