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
//   {type:'setHold', unitId, code, index?}     that waypoint (default: last) waits for `code` ('A'|'B'|'C'; null: no hold)
//   {type:'setEntry', unitId, mode, index?}    how he goes through the doorway next to that waypoint (default: last):
//                                              ENTRY.modes ('kick'|'slow'|'flash'|'frag'|'breach') or null (just walk through)
//   {type:'undoWaypoint', unitId}              removes the last user waypoint (and its leg)
//   {type:'clearRoute', unitId}                also cancels an entry he is preparing
//   {type:'go', code?, at?}                    planning: schedules that GO code at `at` s into the turn
//                                              (default 0); it fires once everyone holding for it is in
//                                              position (sim/round.js). Without phases: releases the units
//                                              waiting for it now (none given: the first code someone waits for)
//   {type:'cancelGo', code}                    planning: unschedules that GO code
//   {type:'defuseNow', unitId?}                an attacker next to the found bomb stops and defuses
//                                              (that unit, else the closest one in range)
//   {type:'chooseEntry', entry}                preparation: the attackers start from another entry (map `entries`)
//
// Each round phase takes only some orders (PHASE_ORDERS; sim/round.js):
// nothing during buy or the execution — a turn runs untouched — and the
// rest are rejected with REJECT.notNow. A sim without phases takes all.
//
// Every command may carry `team` (the side giving it; the session stamps it):
// a unit only obeys its own side, and only a side whose controller is
// 'human' (sim.controllers) takes orders. Without `team` (scripts, old
// replays) the unit's side must be human-controlled.
// Rejections are reported as EV.ORDER_REJECTED with a REJECT code; the UI
// turns codes into text (ui/texts.js T.rejectReason), the sim never does.
import { NAV, ENTRY } from '../config/balance.js';
import { EV } from '../core/events.js';
import { routeTail, lastUserIndex, doorwayNear, defuseCandidate, nextGoCode, entryDoorwayAt, entryModeFits, gearLeft, ENTRY_GEAR, holdCode, codeInUse, humanTeam } from './queries.js';
import { startDefuse } from './objectives.js';
import { cancelEntry, releaseDelay } from './entries.js';
import { scheduleGo } from './round.js';

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
  noCode: 'noCode', // a GO scheduled for a code nobody of the side holds for
  badEntry: 'badEntry', // chooseEntry with an entry the map does not have
});

const ROUTE_ORDERS = ['addWaypoint', 'beginStroke', 'endStroke', 'cancelStroke', 'promoteLast', 'setLook', 'toggleHold', 'setHold', 'setEntry', 'undoWaypoint', 'clearRoute'];

/** Orders each round phase takes (sim/round.js PHASE; literal keys: round.js imports this module). */
const PHASE_ORDERS = Object.freeze({
  buy: [],
  prep: [...ROUTE_ORDERS, 'go', 'cancelGo', 'chooseEntry'],
  plan: [...ROUTE_ORDERS, 'go', 'cancelGo', 'defuseNow'],
  exec: [],
  end: [],
});

/** May the side that sent `cmd` command this unit? */
function obeys(sim, unit, cmd) {
  if (cmd.team && unit.team !== cmd.team) return false;
  return sim.controllers[unit.team] === 'human';
}

export function applyCommand(sim, cmd) {
  const r = sim.round;
  if (r.enabled && !PHASE_ORDERS[r.phase].includes(cmd.type)) {
    sim.emit(EV.ORDER_REJECTED, { unitId: cmd.unitId ?? -1, reason: REJECT.notNow });
    return;
  }
  if (cmd.type === 'go') return r.enabled ? planGo(sim, cmd) : issueGo(sim, cmd);
  if (cmd.type === 'cancelGo') return planGo(sim, { ...cmd, at: null });
  if (cmd.type === 'defuseNow') return defuseNow(sim, cmd);
  if (cmd.type === 'chooseEntry') return chooseEntry(sim, cmd);
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
    case 'setHold':
      return setHold(sim, unit, cmd.code ?? null, cmd.index);
    case 'setEntry':
      return setEntry(sim, unit, cmd.mode ?? null, cmd.index);
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
      cancelEntry(unit);
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
    unit.route.push({ x: q.x, y: q.y, user: user && i === path.length - 1, look: null, hold: false, code: null, entry: null, entryDoor: -1 });
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

/** Cycles the last user waypoint's hold through the GO codes: none -> A -> B -> C -> none. */
function toggleHold(sim, unit) {
  const last = lastUserIndex(unit);
  if (last < 0) return reject(sim, unit, REJECT.noWaypoint);
  const p = unit.route[last];
  const codes = ENTRY.goCodes;
  const next = p.hold ? codes.indexOf(holdCode(p)) + 1 : 0;
  applyHold(p, next < codes.length ? codes[next] : null);
  changed(sim, unit, 'hold');
}

function setHold(sim, unit, code, index) {
  const i = userIndex(unit, index);
  if (i < 0) return reject(sim, unit, REJECT.noWaypoint);
  applyHold(unit.route[i], ENTRY.goCodes.includes(code) ? code : null);
  changed(sim, unit, 'hold');
}

function applyHold(p, code) {
  p.hold = code !== null;
  p.code = code;
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
    return changed(sim, unit, 'entry');
  }
  const k = entryDoorwayAt(sim.world, p.x, p.y);
  if (!entryModeFits(sim, k, mode)) return reject(sim, unit, REJECT.noDoor);
  const item = ENTRY_GEAR[mode];
  if (item && gearLeft(unit, item, i) <= 0) return reject(sim, unit, REJECT.noGear);
  p.entry = mode;
  p.entryDoor = k;
  changed(sim, unit, 'entry');
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

/** Schedules (or with at: null, cancels) a GO code for the next execution (sim/round.js). */
function planGo(sim, cmd) {
  const team = sideOf(sim, cmd);
  if (!team || sim.controllers[team] !== 'human') return;
  const code = ENTRY.goCodes.includes(cmd.code) ? cmd.code : ENTRY.goCodes.find((c) => codeInUse(sim, team, c));
  if (cmd.at !== null && (!code || !codeInUse(sim, team, code))) {
    sim.emit(EV.ORDER_REJECTED, { unitId: -1, reason: REJECT.noCode });
    return;
  }
  if (!code) return;
  scheduleGo(sim, team, code, cmd.at === null ? null : cmd.at ?? 0);
  sim.emit(EV.GO_SCHEDULED, { team, code, at: cmd.at === null ? null : (scheduledAt(sim, team, code) ?? null) });
}

function scheduledAt(sim, team, code) {
  const g = sim.round.gos.find((q) => q.team === team && q.code === code);
  return g ? g.at : null;
}

function chooseEntry(sim, cmd) {
  const team = sideOf(sim, cmd);
  if (team !== 'attackers' || sim.controllers.attackers !== 'human') return;
  if (!sim.compiled.entries.some((e) => e.id === cmd.entry)) {
    sim.emit(EV.ORDER_REJECTED, { unitId: -1, reason: REJECT.badEntry });
    return;
  }
  if (!sim.setEntry(cmd.entry)) return;
  // Scheduled GO codes were about the old routes.
  sim.round.gos = sim.round.gos.filter((g) => g.team !== 'attackers');
  sim.emit(EV.ENTRY_CHOSEN, { entry: cmd.entry });
  for (const u of sim.teams.attackers) changed(sim, u, 'clear');
}

/**
 * Releases everyone of the side waiting for one GO code. If one of them
 * throws a grenade or fires a charge, the others hold until it goes off
 * (unit.goDelay), so they enter right after the bang.
 */
export function issueGo(sim, cmd) {
  const team = cmd.team || null;
  const code = ENTRY.goCodes.includes(cmd.code) ? cmd.code : firstCode(sim, cmd, team);
  const released = [];
  const own = []; // per released unit: its own bang delay (0 = it follows the others)
  let delay = 0;
  for (const u of sim.units) {
    if (u.alive && u.waitingGo && u.waitCode === code && obeys(sim, u, cmd)) {
      const d = releaseDelay(sim, u);
      released.push(u);
      own.push(d);
      delay = Math.max(delay, d);
    }
  }
  if (!released.length) {
    sim.emit(EV.ORDER_REJECTED, { unitId: -1, reason: REJECT.nobodyWaiting });
    return;
  }
  released.forEach((u, i) => {
    u.waitingGo = false;
    u.waitCode = null;
    u.goDelay = own[i] > 0 ? 0 : delay;
  });
  sim.goCount++;
  sim.emit(EV.GO_CODE, { released: released.length, code });
}

/** The code a plain GO releases: the first one someone the order may command waits for. */
function firstCode(sim, cmd, team) {
  if (team) return nextGoCode(sim, team);
  for (const c of ENTRY.goCodes) for (const u of sim.units) if (u.alive && u.waitingGo && u.waitCode === c && obeys(sim, u, cmd)) return c;
  return null;
}

function defuseNow(sim, cmd) {
  const u = defuseCandidate(sim, cmd.unitId);
  if (!u || !obeys(sim, u, cmd)) {
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
