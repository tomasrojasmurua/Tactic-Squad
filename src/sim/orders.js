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
//   {type:'toggleHold', unitId}                last user waypoint waits for a GO code: none -> A -> B -> C -> none
//   {type:'setHold', unitId, code, index?}     that waypoint (default: last) waits for `code` ('A'|'B'|'C'; null: no hold;
//                                              index 'here' as for setToss)
//   {type:'setEntry', unitId, mode, index?}    how he goes through the doorway next to that waypoint (default: last):
//                                              ENTRY.modes ('kick'|'slow'|'flash'|'frag'|'breach') or null (just walk through)
//
// A route drawn through a closed door gets a "?" point just before it
// (waypoint.ask, .door = the doorway): the operator stops there until the
// player says how (setEntry) and when (setHold) — nothing happens at a door
// that was not decided. Either order on that point settles it.
//   {type:'moveWaypoint', unitId, index, x, y} a user waypoint dragged elsewhere: the legs to the user points
//                                              before and after it are found again (its look / hold / entry kept)
//   {type:'insertWaypoint', unitId, index, x, y}  a new user waypoint on the leg ending at route[index]
//   {type:'setPace', unitId, pace, index?}     the leg ending at that user waypoint (default: last) is walked
//                                              'sneak' (MOVE.sneakFactor, quiet) or normally (null)
//   {type:'setToss', unitId, item, x, y, index?}  from that user waypoint (default: last) he throws a flash /
//                                              grenade / smoke (ENTRY.tossItems) to (x, y); item null: no throw.
//                                              index 'here': from where he stands now (a user point is put
//                                              there, first on his route: he throws, then walks on)
//   {type:'setPeek', unitId, on, index?}       "asomarse y volver" on the last user waypoint: he stands there
//                                              MOVE.peekTime s looking at its look (the way he walked in, if
//                                              none) and goes back to the point before it (or where he
//                                              stood) facing as he did there. on false: removes both
//   {type:'follow', unitId, leaderId, rank}    squad route (sim/follow.js): he walks the leader's route in file
//                                              (rank 1 right behind) and stacks behind him at his GO holds
//   {type:'unfollow', unitId}                  back to his own orders (the route he had stays)
//   {type:'undoWaypoint', unitId}              removes the last user waypoint (and its leg)
//   {type:'clearRoute', unitId}                also cancels an entry he is preparing
//   {type:'go', code?, atTick?}                during a turn ("now!"): releases the units waiting for that code
//                                              (none given: the first code someone waits for); whoever is still
//                                              on the way to a hold of it goes straight through when he gets
//                                              there. atTick: the step of the turn it was given at (replays)
//   {type:'defuseNow', unitId?}                an attacker next to the found bomb stops and defuses
//                                              (that unit, else the closest one in range)
//   {type:'chooseEntry', entry}                preparation (and the first planning, before any turn ran):
//                                              the attackers start from another entry (map `entries`)
//
// Buy and set-up (sim/prep.js):
//   {type:'setRole', unitId, role}             buy: an attacker changes class (config/operators.js PICK_ROLES)
//   {type:'buy', unitId, item, count}          buy (attackers) / preparation (defenders): buys (count 1) or
//                                              gives back (-1) one BUY.items item for his utility points
//   {type:'chooseSite', site}                  preparation, defenders: the bomb goes to that site and their
//                                              set-up restarts from the map's layout for it
//   {type:'placeUnit', unitId, x, y, facing?}  preparation: a defender stands there (their half, walkable)
//   {type:'setWatch', unitId, watch}           preparation: a defender's watch order
//                                              ({facing, sweep?: [from, to], react?, fallback?: {to: [x, y], look}})
//   {type:'barricade', door, on}               preparation, defenders: puts up / takes down a barricade
//   {type:'wire', door, on}                    preparation, defenders: lays / takes up barbed wire (sim/wires.js)
//   {type:'setDefenderRole', unitId, role}     preparation: a defender's class (config/operators.js DEF_PICK_ROLES)
//   {type:'placeTrap', unitId, x, y}           preparation: the Trampero lays a trap there (or picks his own up)
// Recon drone (sim/drone.js), during the drone phase, stamped like a GO:
//   {type:'drone', dir, atTick}                the stick: one of DRONE.directions headings, -1 = stop
//   {type:'droneRecall', atTick}               the drone is done (the first planning starts)
//
// Each round phase takes only some orders (PHASE_ORDERS; sim/round.js):
// nothing during buy, only GO codes during the execution, routes while
// deciding; the rest are rejected with REJECT.notNow. A sim without phases
// takes all.
//
// Every command may carry `team` (the side giving it; the session stamps it):
// a unit only obeys its own side, and only a side whose controller is
// 'human' (sim.controllers) takes orders. Without `team` (scripts, old
// replays) the unit's side must be human-controlled. The attacking AI
// (sim/aiAttack.js) gives the same orders from inside the sim, with
// applyCommand's `by` = 'ai': they only reach a side whose controller is 'ai'.
// Rejections are reported as EV.ORDER_REJECTED with a REJECT code; the UI
// turns codes into text (ui/texts.js T.rejectReason), the sim never does.
import { NAV, ENTRY, MOVE } from '../config/balance.js';
import { EV } from '../core/events.js';
import { routeTail, lastUserIndex, doorwayNear, defuseCandidate, nextGoCode, entryDoorwayAt, entryModeFits, gearLeft, ENTRY_GEAR, holdCode, codeInUse, humanTeam, ASK_CODE, HERE } from './queries.js';
import { segmentCrossesDoorway } from './doors.js';
import { startDefuse } from './objectives.js';
import { cancelEntry, releaseDelay } from './entries.js';
import { setWire } from './wires.js';
import { buyItem, setRole, chooseSite, placeDefender, setWatch, setBarricade, setDefenderRole, placeTrap } from './prep.js';
import { steerDrone, endDrone } from './drone.js';
import { routePoint } from './routePoint.js';
import { startFollow, rebuildFollowers } from './follow.js';

export const REJECT = Object.freeze({
  routeTooLong: 'routeTooLong',
  unreachable: 'unreachable',
  noWaypoint: 'noWaypoint',
  notAtBomb: 'notAtBomb',
  nobodyWaiting: 'nobodyWaiting',
  noDoor: 'noDoor', // an entry on a waypoint with no (suitable) doorway next to it
  noGear: 'noGear', // an entry needing a flash / grenade / charge he no longer has
  goBeforeStart: 'goBeforeStart', // emitted by the session: GO pressed while still planning
  notNow: 'notNow', // this order is not taken in the current round phase (e.g. during an execution turn)
  badEntry: 'badEntry', // chooseEntry with an entry the map does not have
  entryLocked: 'entryLocked', // chooseEntry after the first turn ran (the squad already left)
  // Buy and set-up (sim/prep.js)
  noPoints: 'noPoints',
  gearFull: 'gearFull', // he already carries BUY.max of it
  badItem: 'badItem',
  badRole: 'badRole', // not a class to pick
  roleTaken: 'roleTaken', // another operator already has that one-per-squad class
  badSite: 'badSite',
  outsideHalf: 'outsideHalf', // a defender placed (or falling back) outside the defenders' half
  tooClose: 'tooClose', // on top of a teammate
  badWatch: 'badWatch',
  badDoor: 'badDoor', // a barricade where the map allows none
  tooManyBarricades: 'tooManyBarricades', // PREP.barricades already up
  tooManyWires: 'tooManyWires', // PREP.wires already laid
  doorTaken: 'doorTaken', // barricade and wire never share a doorway
  notTrapper: 'notTrapper', // placeTrap for a defender who is not the Trampero
  tooManyTraps: 'tooManyTraps', // TRAP.perTrapper already laid
  badFollow: 'badFollow', // follow: no such leader, himself, another side, or a leader who follows someone
});

const ROUTE_ORDERS = ['addWaypoint', 'beginStroke', 'endStroke', 'cancelStroke', 'promoteLast', 'setLook', 'toggleHold', 'setHold', 'setEntry', 'undoWaypoint', 'clearRoute', 'moveWaypoint', 'insertWaypoint', 'setPace', 'setToss', 'setPeek', 'follow', 'unfollow'];

/** Orders on a follower's own route: he leaves the file and keeps the route he had (now his). */
const OWN_ROUTE_ORDERS = ['addWaypoint', 'beginStroke', 'promoteLast', 'setLook', 'toggleHold', 'setHold', 'setEntry', 'undoWaypoint', 'clearRoute', 'moveWaypoint', 'insertWaypoint', 'setPace', 'setToss', 'setPeek'];

/** Orders each round phase takes (sim/round.js PHASE; literal keys: round.js imports this module). */
const PHASE_ORDERS = Object.freeze({
  buy: ['buy', 'setRole'],
  prep: [...ROUTE_ORDERS, 'chooseEntry', 'chooseSite', 'placeUnit', 'setWatch', 'barricade', 'wire', 'setDefenderRole', 'placeTrap', 'buy'],
  drone: ['drone', 'droneRecall'],
  plan: [...ROUTE_ORDERS, 'defuseNow', 'chooseEntry'],
  exec: ['go'],
  end: [],
});

/** Orders a side gives as a whole (no unit): which side must be human to give them. */
const SIDE_ORDERS = Object.freeze({ chooseSite: 'defenders', barricade: 'defenders', wire: 'defenders', drone: 'attackers', droneRecall: 'attackers' });

/** May the side that sent `cmd` command this unit? (`by`: who gives it, 'human' | 'ai') */
function obeys(sim, unit, cmd, by) {
  if (cmd.team && unit.team !== cmd.team) return false;
  return sim.controllers[unit.team] === by;
}

/** Applies one order. `by` = 'ai' only from the sim's own AI commander (sim/aiAttack.js). */
export function applyCommand(sim, cmd, by = 'human') {
  const r = sim.round;
  if (r.enabled && !PHASE_ORDERS[r.phase].includes(cmd.type)) {
    sim.emit(EV.ORDER_REJECTED, { unitId: cmd.unitId ?? -1, reason: REJECT.notNow });
    return;
  }
  if (cmd.type === 'go') return issueGo(sim, cmd, by);
  if (cmd.type === 'defuseNow') return defuseNow(sim, cmd, by);
  if (cmd.type === 'chooseEntry') return chooseEntry(sim, cmd, by);
  const side = SIDE_ORDERS[cmd.type];
  if (side) {
    if (sideOf(sim, cmd) !== side || sim.controllers[side] !== by) return;
    if (cmd.type === 'chooseSite') return refuse(sim, -1, chooseSite(sim, cmd.site));
    if (cmd.type === 'barricade') return refuse(sim, -1, setBarricade(sim, cmd.door, cmd.on !== false));
    if (cmd.type === 'wire') return refuse(sim, -1, setWire(sim, cmd.door, cmd.on !== false));
    if (cmd.type === 'drone') return steerDrone(sim, cmd.dir);
    return endDrone(sim, 'recalled');
  }
  const unit = sim.units[cmd.unitId];
  if (!unit || !unit.alive || !obeys(sim, unit, cmd, by)) return;
  if (unit.follow && OWN_ROUTE_ORDERS.includes(cmd.type)) unit.follow = null;
  switch (cmd.type) {
    case 'buy':
      return refuse(sim, unit.id, buyItem(sim, unit, cmd.item, cmd.count ?? 1));
    case 'setRole':
      return refuse(sim, unit.id, setRole(sim, unit, cmd.role));
    case 'placeUnit':
      if (unit.team !== 'defenders') return;
      return refuse(sim, unit.id, placeDefender(sim, unit, cmd.x, cmd.y, cmd.facing ?? unit.facing));
    case 'setWatch':
      if (unit.team !== 'defenders') return;
      return refuse(sim, unit.id, setWatch(sim, unit, cmd.watch));
    case 'setDefenderRole':
      return refuse(sim, unit.id, setDefenderRole(sim, unit, cmd.role));
    case 'placeTrap':
      if (unit.team !== 'defenders') return;
      return refuse(sim, unit.id, placeTrap(sim, unit, cmd.x, cmd.y));
    case 'addWaypoint':
      return addWaypoint(sim, unit, cmd);
    case 'promoteLast':
      if (unit.route.length) unit.route[unit.route.length - 1].user = true;
      return changed(sim, unit, 'promote');
    case 'setLook':
      return setLook(sim, unit, cmd.angle, cmd.index);
    case 'toggleHold':
      return toggleHold(sim, unit);
    case 'setHold': {
      const i = pointIndex(sim, unit, cmd.index);
      return i === FULL ? reject(sim, unit, REJECT.routeTooLong) : setHold(sim, unit, cmd.code ?? null, i);
    }
    case 'setEntry':
      return setEntry(sim, unit, cmd.mode ?? null, cmd.index);
    case 'undoWaypoint':
      return undoWaypoint(sim, unit);
    case 'moveWaypoint':
      return moveWaypoint(sim, unit, cmd.index, cmd.x, cmd.y);
    case 'insertWaypoint':
      return insertWaypoint(sim, unit, cmd.index, cmd.x, cmd.y);
    case 'setPace':
      return setPace(sim, unit, cmd.pace === 'sneak' ? 'sneak' : null, cmd.index);
    case 'setToss': {
      const i = pointIndex(sim, unit, cmd.index);
      return i === FULL ? reject(sim, unit, REJECT.routeTooLong) : setToss(sim, unit, cmd.item ?? null, cmd.x, cmd.y, i);
    }
    case 'setPeek':
      return setPeek(sim, unit, cmd.on !== false, cmd.index);
    case 'follow': {
      const leader = sim.units[cmd.leaderId];
      if (!leader || !obeys(sim, leader, cmd, by) || !startFollow(sim, unit, leader, cmd.rank)) return reject(sim, unit, REJECT.badFollow);
      return;
    }
    case 'unfollow':
      unit.follow = null;
      return changed(sim, unit, 'unfollow');
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
      cancelEntry(unit);
      return changed(sim, unit, 'clear');
    default:
      break;
  }
}

function changed(sim, unit, kind) {
  // Waiting on a "?" point that is gone (undone, cleared): nothing to wait for.
  if (unit.waitingGo && unit.waitCode === ASK_CODE && !(unit.route.length && unit.route[0].ask)) {
    unit.waitingGo = false;
    unit.waitCode = null;
  }
  sim.emit(EV.ROUTE_CHANGED, { unitId: unit.id, kind });
  // A leader's plan changed: his file follows it (sim/follow.js). Only while deciding: during a
  // turn (a late GO drops a hold) the followers keep walking what they have.
  if (!sim.round.enabled || sim.round.phase !== 'exec') rebuildFollowers(sim, unit);
}

function addWaypoint(sim, unit, { x, y, user = true, quiet = false }, kind = 'add') {
  if (unit.route.length >= NAV.maxRoutePoints) return quiet ? undefined : reject(sim, unit, REJECT.routeTooLong);
  if (unit.team === 'defenders') holdOnArrival(unit);
  const from = routeTail(unit);
  const p = snapToDoorway(sim.world, x, y);
  const path = sim.world.nav.findPath(from.x, from.y, p.x, p.y, NAV.snapRadius);
  if (!path || !path.length) return quiet ? undefined : reject(sim, unit, REJECT.unreachable);
  const start = unit.route.length;
  const pace = unit.route.length ? from.pace : null; // a new leg keeps the pace of the one before
  path.forEach((q, i) => {
    unit.route.push(routePoint(q.x, q.y, { user: user && i === path.length - 1, pace }));
  });
  markDoors(sim, unit, start);
  if (kind) changed(sim, unit, kind);
}

/**
 * A defender sent somewhere by his player gives up his watch order's
 * movement (patrol, sweep, fallback): from then on he holds where he ends
 * up, facing the look set there, and still turns to noise if he did.
 */
function holdOnArrival(unit) {
  const b = unit.behavior;
  if (!b || (b.type === 'hold' && !b.rotate)) return;
  unit.behavior = { type: 'hold', reactsToNoise: b.reactsToNoise !== false };
  unit.ai.rotating = null;
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

/** Cycles the last user waypoint's hold through the GO codes: none -> A -> B -> C -> none. */
function toggleHold(sim, unit) {
  const last = lastUserIndex(unit);
  if (last < 0) return reject(sim, unit, REJECT.noWaypoint);
  const p = unit.route[last];
  const codes = ENTRY.goCodes;
  const next = p.hold ? codes.indexOf(holdCode(p)) + 1 : 0;
  applyHold(p, next < codes.length ? codes[next] : null);
  settleAsk(unit, last);
  changed(sim, unit, 'hold');
}

function setHold(sim, unit, code, index) {
  const i = userIndex(unit, index);
  if (i < 0) return reject(sim, unit, REJECT.noWaypoint);
  applyHold(unit.route[i], ENTRY.goCodes.includes(code) ? code : null);
  settleAsk(unit, i);
  changed(sim, unit, 'hold');
}

/**
 * Puts a "?" point before every closed door the route crosses from leg
 * `from` on (legs already decided keep their stack points). It is a user
 * waypoint ASK_DISTANCE before the door, on the leg itself (so it stays
 * walkable); the operator waits there until the player decides.
 */
function markDoors(sim, unit, from) {
  const r = unit.route;
  for (let i = Math.max(0, from); i < r.length; i++) {
    const a = i > 0 ? r[i - 1] : unit;
    const b = r[i];
    for (let k = 0; k < sim.doors.length; k++) {
      const door = sim.doors[k];
      if (door.open || door.destroyed) continue;
      if (unit.entry && unit.entry.doorway === k) continue; // already working on it
      const d = sim.world.doorways[k];
      if (segmentCrossesDoorway(a.x, a.y, b.x, b.y, d) < 0) continue;
      const sa = (a.x - d.cx) * d.normalX + (a.y - d.cy) * d.normalY;
      const sb = (b.x - d.cx) * d.normalX + (b.y - d.cy) * d.normalY;
      if (Math.abs(sa) < 1e-6) continue; // the leg starts in the doorway: it was decided before
      if (stackedOn(sim, r, i, k)) continue; // the player already said what to do at this door
      const ask = routePoint(a.x, a.y, { user: true, ask: true, door: k, pace: b.pace || null });
      const side = Math.sign(sa);
      if (Math.abs(sa) > ENTRY.askDistance) {
        const t = (sa - side * ENTRY.askDistance) / (sa - sb);
        ask.x = a.x + (b.x - a.x) * t;
        ask.y = a.y + (b.y - a.y) * t;
      } else {
        // The leg starts too close to the door (a path corner by the frame): stack on its center line.
        ask.x = d.cx + d.normalX * side * ENTRY.askDistance;
        ask.y = d.cy + d.normalY * side * ENTRY.askDistance;
        if (i > 0 && !a.user) {
          r[i - 1] = ask; // that corner is replaced by the stack point
          continue;
        }
      }
      r.splice(i, 0, ask);
      break; // the leg after the new point is checked next
    }
  }
}

/** Is the last user point before leg i a hold / entry / "?" on doorway k? */
function stackedOn(sim, r, i, k) {
  for (let j = i - 1; j >= 0; j--) {
    const q = r[j];
    if (!q.user) continue;
    if (!(q.ask || q.entry || q.hold)) return false;
    return (q.door >= 0 ? q.door : entryDoorwayAt(sim.world, q.x, q.y)) === k;
  }
  return false;
}

/** A decision (how or when) on a "?" point settles it; an operator waiting on it goes on. */
function settleAsk(unit, i) {
  const p = unit.route[i];
  if (!p.ask) return;
  p.ask = false;
  if (i === 0 && unit.waitingGo && unit.waitCode === ASK_CODE) {
    unit.waitingGo = false;
    unit.waitCode = null;
  }
}

function applyHold(p, code) {
  p.hold = code !== null;
  p.code = code;
}

const FULL = -2;

/**
 * The index an order names; HERE: a user point where the unit stands, first
 * on his route (put there if there is none) — a throw or a hold "from here",
 * before what he walks next. FULL when there is no room for it.
 */
function pointIndex(sim, unit, index) {
  if (index !== HERE) return index;
  const r = unit.route;
  if (r.length && r[0].user && Math.hypot(r[0].x - unit.x, r[0].y - unit.y) < 0.05) return 0;
  if (r.length >= NAV.maxRoutePoints) return FULL;
  r.unshift(routePoint(unit.x, unit.y, { user: true }));
  return 0;
}

/** A valid user waypoint index (given, else the last one), or -1. */
function userIndex(unit, index) {
  if (index !== undefined && index !== null && index >= 0) return index < unit.route.length && unit.route[index].user ? index : -1;
  return lastUserIndex(unit);
}

/** Sets (or clears, mode null) the entry of a user waypoint next to a doorway. */
function setEntry(sim, unit, mode, index) {
  const i = userIndex(unit, index);
  if (i < 0) return reject(sim, unit, REJECT.noWaypoint);
  const p = unit.route[i];
  if (mode === null) {
    p.entry = null;
    p.entryDoor = -1;
    p.toss = null; // "just open it" also replaces a throw from here
    settleAsk(unit, i); // "just open it and go" is a decision too
    return changed(sim, unit, 'entry');
  }
  const k = p.door >= 0 ? p.door : entryDoorwayAt(sim.world, p.x, p.y);
  if (!entryModeFits(sim, k, mode)) return reject(sim, unit, REJECT.noDoor);
  const item = ENTRY_GEAR[mode];
  if (item && gearLeft(unit, item, i) <= 0) return reject(sim, unit, REJECT.noGear);
  p.entry = mode;
  p.entryDoor = k;
  p.toss = null; // one action per point: the door entry replaces a throw
  settleAsk(unit, i);
  changed(sim, unit, 'entry');
}

/** Index of the user point (not a "?") before / after route index i, or -1. */
function anchorBefore(r, i) {
  for (let j = i - 1; j >= 0; j--) if (r[j].user && !r[j].ask) return j;
  return -1;
}
function anchorAfter(r, i) {
  for (let j = i + 1; j < r.length; j++) if (r[j].user && !r[j].ask) return j;
  return -1;
}

/**
 * Puts user point `i` at (x, y): the legs from the user point before it and
 * to the one after it are path-found again (the "?" doors between them are
 * marked again). Its look, hold and pace stay; an entry stays only if a
 * doorway it fits is still next to it.
 */
function moveWaypoint(sim, unit, i, x, y) {
  const r = unit.route;
  if (!(i >= 0 && i < r.length && r[i].user && !r[i].ask)) return reject(sim, unit, REJECT.noWaypoint);
  const pa = anchorBefore(r, i);
  const na = anchorAfter(r, i);
  const from = pa >= 0 ? r[pa] : unit;
  const target = snapToDoorway(sim.world, x, y);
  const nav = sim.world.nav;
  const toPoint = nav.findPath(from.x, from.y, target.x, target.y, NAV.snapRadius);
  if (!toPoint || !toPoint.length) return reject(sim, unit, REJECT.unreachable);
  const end = toPoint[toPoint.length - 1];
  const next = na >= 0 ? r[na] : null;
  const onward = next ? nav.findPath(end.x, end.y, next.x, next.y, NAV.snapRadius) : [];
  if (!onward) return reject(sim, unit, REJECT.unreachable);
  const moved = r[i];
  moved.x = end.x;
  moved.y = end.y;
  if (moved.entry) {
    const k = entryDoorwayAt(sim.world, moved.x, moved.y);
    if (k < 0 || !entryModeFits(sim, k, moved.entry)) {
      moved.entry = null;
      moved.entryDoor = -1;
    } else moved.entryDoor = k;
  }
  const out = r.slice(0, pa + 1);
  for (let j = 0; j < toPoint.length - 1; j++) out.push(routePoint(toPoint[j].x, toPoint[j].y, { pace: moved.pace }));
  out.push(moved);
  if (next) {
    for (let j = 0; j < onward.length - 1; j++) out.push(routePoint(onward[j].x, onward[j].y, { pace: next.pace }));
    for (let j = na; j < r.length; j++) out.push(r[j]);
  }
  if (out.length > NAV.maxRoutePoints) return reject(sim, unit, REJECT.routeTooLong);
  r.length = 0;
  for (const p of out) r.push(p);
  markDoors(sim, unit, pa + 1);
  changed(sim, unit, 'move');
}

/** A new user point on the leg that ends at route[index] (dragging a stretch of the route). */
function insertWaypoint(sim, unit, index, x, y) {
  const r = unit.route;
  if (!(index >= 0 && index < r.length)) return reject(sim, unit, REJECT.noWaypoint);
  r.splice(index, 0, routePoint(x, y, { user: true, pace: r[index].pace }));
  moveWaypoint(sim, unit, index, x, y);
}

/** A throw from user point `index` (default: the last one) to (x, y); null item: none. A door entry there gives way. */
function setToss(sim, unit, item, x, y, index) {
  const i = userIndex(unit, index);
  if (i < 0) return reject(sim, unit, REJECT.noWaypoint);
  const p = unit.route[i];
  if (item === null) {
    p.toss = null;
    return changed(sim, unit, 'toss');
  }
  if (!ENTRY.tossItems.includes(item) || !Number.isFinite(x) || !Number.isFinite(y)) return reject(sim, unit, REJECT.badItem);
  if (gearLeft(unit, item, i) <= 0 && !(p.toss && p.toss.item === item)) return reject(sim, unit, REJECT.noGear);
  p.toss = { item, x, y };
  p.entry = null; // one action per point: the throw replaces a door entry
  p.entryDoor = -1;
  settleAsk(unit, i);
  changed(sim, unit, 'toss');
}

/** Pace of the leg ending at user point `index` (default: the last one): every point since the user point before. */
function setPace(sim, unit, pace, index) {
  const i = userIndex(unit, index);
  if (i < 0) return reject(sim, unit, REJECT.noWaypoint);
  const r = unit.route;
  const from = anchorBefore(r, i);
  for (let j = from + 1; j <= i; j++) r[j].pace = pace;
  changed(sim, unit, 'pace');
}

/**
 * "Asomarse y volver": user point i (the last one, or the one a return
 * point follows) gets a pause and a way back to the point before it.
 */
function setPeek(sim, unit, on, index) {
  const r = unit.route;
  let i = userIndex(unit, index);
  if (i >= 0 && r[i].back) i = anchorBefore(r, i); // the way back stands for its peek
  if (i < 0) return reject(sim, unit, REJECT.noWaypoint);
  const back = anchorAfter(r, i);
  const peeking = r[i].pause > 0;
  if (!on) {
    if (!peeking) return;
    r[i].pause = 0;
    if (back >= 0 && r[back].back && back === lastUserIndex(unit)) r.length = i + 1;
    return changed(sim, unit, 'peek');
  }
  if (peeking) return;
  if (back >= 0) return reject(sim, unit, REJECT.noWaypoint); // only the end of the route
  const a = anchorBefore(r, i);
  const from = a >= 0 ? r[a] : unit;
  const look = a >= 0 ? r[a].look : unit.idleLook ?? unit.facing;
  const p = r[i];
  if (p.look === null) {
    const prev = i > 0 ? r[i - 1] : unit;
    p.look = Math.atan2(p.y - prev.y, p.x - prev.x);
  }
  p.pause = MOVE.peekTime;
  const n = r.length;
  addWaypoint(sim, unit, { x: from.x, y: from.y }, null); // one change, 'peek', below
  if (r.length === n) {
    p.pause = 0; // no way back (refused: route too long)
    return;
  }
  const end = r[r.length - 1];
  end.back = true;
  end.look = look;
  for (let j = n; j < r.length; j++) r[j].pace = p.pace; // back as quietly as he went
  changed(sim, unit, 'peek');
}

function undoWaypoint(sim, unit) {
  const r = unit.route;
  if (!r.length) return;
  r.pop();
  while (r.length && !r[r.length - 1].user) r.pop();
  changed(sim, unit, 'undo');
}

/** The side an order speaks for: its `team`, else the (only) human side. */
const sideOf = (sim, cmd) => cmd.team || humanTeam(sim);

/** A set-up function's REJECT code (or null: done) -> the rejection event. */
function refuse(sim, unitId, reason) {
  if (reason) sim.emit(EV.ORDER_REJECTED, { unitId, reason });
}

function chooseEntry(sim, cmd, by) {
  const team = sideOf(sim, cmd);
  if (team !== 'attackers' || sim.controllers.attackers !== by) return;
  // In the planning only before the first turn ran (the squad has not moved yet).
  if (sim.round.enabled && sim.round.phase === 'plan' && (sim.round.turn !== 1 || sim.round.execTotal > 0)) {
    sim.emit(EV.ORDER_REJECTED, { unitId: -1, reason: REJECT.entryLocked });
    return;
  }
  if (!sim.compiled.entries.some((e) => e.id === cmd.entry)) {
    sim.emit(EV.ORDER_REJECTED, { unitId: -1, reason: REJECT.badEntry });
    return;
  }
  if (!sim.setEntry(cmd.entry)) return;
  sim.emit(EV.ENTRY_CHOSEN, { entry: cmd.entry });
  for (const u of sim.teams.attackers) changed(sim, u, 'clear');
}

/**
 * Releases everyone of the side waiting for one GO code. If one of them
 * throws a grenade or fires a charge, the others hold until it goes off
 * (unit.goDelay), so they enter right after the bang. Whoever has not
 * reached his hold of that code yet loses it: he goes straight through
 * (and does his entry) when he gets there — the GO was already given.
 */
export function issueGo(sim, cmd, by = 'human') {
  const team = cmd.team || null;
  const code = ENTRY.goCodes.includes(cmd.code) ? cmd.code : firstCode(sim, cmd, team, by);
  const released = [];
  const own = []; // per released unit: its own bang delay (0 = it follows the others)
  const late = []; // still on the way to a hold of the code
  let delay = 0;
  for (const u of sim.units) {
    if (!u.alive || !obeys(sim, u, cmd, by)) continue;
    if (u.waitingGo && u.waitCode === code) {
      const d = releaseDelay(sim, u);
      released.push(u);
      own.push(d);
      delay = Math.max(delay, d);
    } else if (!u.waitingGo) {
      const p = u.route.find((q) => q.hold && holdCode(q) === code);
      if (p) late.push([u, p]);
    }
  }
  if (!released.length && !late.length) {
    sim.emit(EV.ORDER_REJECTED, { unitId: -1, reason: REJECT.nobodyWaiting });
    return;
  }
  released.forEach((u, i) => {
    u.waitingGo = false;
    u.waitCode = null;
    u.goDelay = own[i] > 0 ? 0 : delay;
  });
  for (const [u, p] of late) {
    p.hold = false;
    changed(sim, u, 'hold');
  }
  sim.goCount++;
  sim.emit(EV.GO_CODE, { released: released.length, late: late.length, code });
}

/** The code a plain GO releases: the first one someone the order may command waits for. */
function firstCode(sim, cmd, team, by) {
  if (team) return nextGoCode(sim, team) || ENTRY.goCodes.find((c) => codeInUse(sim, team, c)) || null;
  for (const c of ENTRY.goCodes) for (const u of sim.units) if (u.alive && u.waitingGo && u.waitCode === c && obeys(sim, u, cmd, by)) return c;
  return null;
}

function defuseNow(sim, cmd, by) {
  const u = defuseCandidate(sim, cmd.unitId);
  if (!u || !obeys(sim, u, cmd, by)) {
    sim.emit(EV.ORDER_REJECTED, { unitId: cmd.unitId ?? -1, reason: REJECT.notAtBomb });
    return;
  }
  u.route.length = 0;
  u.waitingGo = false;
  cancelEntry(u);
  changed(sim, u, 'clear');
  if (sim.bomb.defuserId !== u.id) startDefuse(sim, u);
}

function reject(sim, unit, reason) {
  sim.emit(EV.ORDER_REJECTED, { unitId: unit.id, reason });
}
