// The attacking side played by the AI (sim.controllers.attackers === 'ai').
// It is a commander, not a set of unit reflexes: it gives its squad the same
// orders a player gives (sim/orders.js), at the same moments, and knows only
// what the attackers' side knows (the drone's and the squad's sightings in
// sim.memory, known barricades in sim.intel, the bomb once spotted). Its
// operators then walk, open doors, enter and shoot exactly like the player's.
//
//   buy    each operator spends his utility points (AI_ATTACK.buy)
//   prep   keeps the default entry: the drone goes in through the middle
//   drone  drives it along the nav path to each site in turn (nearest
//          first) until it sees the bomb or a site's bomb spot comes up
//          empty; then recalls it
//   plan   turn 1: picks the target site (the bomb if found; else what the
//          drone ruled out; else the nearest), the entry closest to it, and
//          draws every route to the bomb spot. Each closed door on a route
//          gets a stack: the lead flashes it (or blows it with a charge when
//          the door is a known barricade), the rest just follow; all of them
//          hold for one GO code per door (A, B, C in route order)
//          later turns: re-targets when the bomb is found elsewhere or the
//          site turns out empty, and gives a new route to whoever has none
//   exec   gives a group's GO once everyone holding for it is in position
//          (AI_ATTACK.goPause later), or after AI_ATTACK.goTimeout anyway
//
// Decisions are taken when a decision phase ends (Simulation.advancePhase)
// and on every live step; they use no sim.rng (choices that need variety
// hash the seed), so an AI round replays exactly like any other.
import { AI_ATTACK, BUY, DRONE, ENTRY, NAV } from '../config/balance.js';
import { TAU } from '../core/math.js';
import { canSee } from './vision.js';
import { applyCommand } from './orders.js';
import { codeWaiting, codeInUse, isGoReady, gearLeft, defuseCandidate, entryModeFits } from './queries.js';
import { PHASE } from './round.js';
import { planFor } from '../config/operators.js';

const TEAM = 'attackers';

/** The commander's state (sim.attackAi), or null when the attackers are not AI. */
export function createAttackAi(sim) {
  if (sim.controllers.attackers !== 'ai') return null;
  return {
    target: null, // site id the squad is going for
    cleared: new Set(), // site ids known not to hold the bomb
    drone: { legs: [], leg: 0, point: 0, lastX: 0, lastY: 0, still: 0 },
    goWait: {}, // GO code -> s since someone started waiting for it
    goReady: {}, // GO code -> s everyone of it has been in position
    // The squad's game plan (config/operators.js COMPOSITIONS): its archetype's, or what its classes suggest.
    plan: { ...planFor(TEAM, sim.teams.attackers.map((u) => u.role)), ...(globalThis.PLAN_OVERRIDE || {}) },
  };
}

/** A decision phase ends: the AI side gives its orders for it (before the round moves on). */
export function attackAiDecide(sim) {
  const ai = sim.attackAi;
  if (!ai) return;
  if (sim.phase === PHASE.buy) return buy(sim);
  if (sim.phase === PHASE.plan) return plan(sim, ai);
}

/** Every live step (drone phase and execution turns), before the systems run. */
export function attackAiTick(sim) {
  const ai = sim.attackAi;
  if (!ai) return;
  if (sim.phase === PHASE.drone) return driveDrone(sim, ai);
  if (sim.phase === PHASE.exec) return callGos(sim, ai);
}

const order = (sim, cmd) => applyCommand(sim, { team: TEAM, ...cmd }, 'ai');

// ------------------------------------------------------------ buy

function buy(sim) {
  const list = sim.attackAi.plan.buy || AI_ATTACK.buy; // the plan's shopping list (COMPOSITIONS), else the default
  for (const u of sim.teams.attackers) {
    for (const item of list) {
      if (u.points >= BUY.prices[item] && (u.gear[item] || 0) < BUY.max[item]) order(sim, { type: 'buy', unitId: u.id, item, count: 1 });
    }
  }
}

// ------------------------------------------------------------ drone

const eyeCfg = { fov: DRONE.fov, range: DRONE.range };

/** Legs to fly, nearest site first: the nav path from the drone to each site's bomb spot. */
function droneLegs(sim) {
  const d = sim.drone;
  const legs = [];
  for (const s of sim.compiled.sites) {
    const path = sim.world.nav.findPath(d.x, d.y, s.bombX, s.bombY, NAV.snapRadius);
    if (path) legs.push({ site: s.id, path, length: pathLength(d, path) });
  }
  return legs.sort((a, b) => a.length - b.length);
}

function driveDrone(sim, ai) {
  const d = sim.drone;
  if (!d || !d.active) return;
  const st = ai.drone;
  if (!st.legs.length) {
    st.legs = droneLegs(sim);
    st.lastX = d.x;
    st.lastY = d.y;
  }
  noteEmptySites(sim, ai, d);
  // Done: the bomb was found, or every site but one is ruled out (it must be that one).
  if (sim.bomb.spotted || ai.cleared.size >= sim.compiled.sites.length - 1) return order(sim, { type: 'droneRecall' });
  let leg = st.legs[st.leg];
  while (leg && ai.cleared.has(leg.site)) leg = st.legs[++st.leg];
  if (!leg) return order(sim, { type: 'droneRecall' });
  if (st.point === 0 && st.leg > 0 && !leg.rerouted) {
    // A later leg starts where the drone is now, not where it was launched.
    const s = siteById(sim, leg.site);
    const path = sim.world.nav.findPath(d.x, d.y, s.bombX, s.bombY, NAV.snapRadius);
    if (path) leg.path = path;
    leg.rerouted = true;
  }
  let p = leg.path[st.point];
  while (p && (p.x - d.x) ** 2 + (p.y - d.y) ** 2 < AI_ATTACK.droneReach * AI_ATTACK.droneReach) p = leg.path[++st.point];
  // Stuck (a barricade, furniture): skip to the next point, then to the next leg.
  st.still = Math.hypot(d.x - st.lastX, d.y - st.lastY) < DRONE.speed * sim.dt * 0.2 && d.dir >= 0 ? st.still + sim.dt : 0;
  st.lastX = d.x;
  st.lastY = d.y;
  if (st.still > AI_ATTACK.droneStuck) {
    st.still = 0;
    p = leg.path[++st.point];
  }
  if (!p) {
    st.leg++;
    st.point = 0;
    return order(sim, { type: 'drone', dir: -1 });
  }
  const heading = Math.atan2(p.y - d.y, p.x - d.x);
  const dir = ((Math.round((heading / TAU) * DRONE.directions) % DRONE.directions) + DRONE.directions) % DRONE.directions;
  if (dir !== d.dir) order(sim, { type: 'drone', dir });
}

/** A site whose bomb spot the drone has in view while the bomb is not spotted holds no bomb. */
function noteEmptySites(sim, ai, eye) {
  if (sim.bomb.spotted) return;
  for (const s of sim.compiled.sites) if (!ai.cleared.has(s.id) && canSee(sim.world, eye, s.bombX, s.bombY, eyeCfg)) ai.cleared.add(s.id);
}

// ------------------------------------------------------------ plan

function plan(sim, ai) {
  const first = sim.turn === 1 && sim.round.execTotal === 0;
  learnSites(sim, ai);
  const target = pickTarget(sim, ai);
  const retarget = target !== ai.target;
  ai.target = target;
  if (first) {
    const entry = pickEntry(sim, target);
    if (entry !== sim.entry.id) order(sim, { type: 'chooseEntry', entry });
  }
  const site = siteById(sim, target);
  const squad = sim.teams.attackers.filter((u) => u.alive);
  if (defuseCandidate(sim) && sim.bomb.defuserId < 0) order(sim, { type: 'defuseNow' });
  const plan = ai.plan;
  const ways = plan.split && (retarget || first) && squad.length ? siteDoors(sim, site, squad[0]) : [];
  squad.forEach((u, i) => {
    if (u.defusing) return;
    const fresh = retarget || first;
    if (fresh) order(sim, { type: 'clearRoute', unitId: u.id });
    else if (u.route.length || u.entry || u.bash) return; // still on his way
    const [x, y] = spot(sim, site, i);
    if ((u.x - x) ** 2 + (u.y - y) ** 2 < 0.25) return; // already there
    // Overwatch: the Tirador stops short of the site the first time and holds the way in (a turn later he joins).
    if (fresh && plan.overwatch === u.role && overwatch(sim, u, x, y)) return;
    // A pinch: the second operator comes in through another door of the site.
    const via = i === 1 ? flankDoor(sim, u, ways, x, y) : null;
    if (fresh && via) order(sim, { type: 'addWaypoint', unitId: u.id, x: via.x, y: via.y, user: true });
    order(sim, { type: 'addWaypoint', unitId: u.id, x, y, user: true });
  });
  stackDoors(sim, squad, plan);
}

/**
 * The ways into a site, nearest to `from` first: doorways within
 * AI_ATTACK.siteDoorReach (walking) of the bomb, as the point just outside
 * each (the side away from the bomb). The first is the squad's main way in;
 * a split plan sends one operator through the second.
 */
function siteDoors(sim, site, from) {
  const nav = sim.world.nav;
  const out = [];
  for (const d of sim.world.doorways) {
    const s = (site.bombX - d.cx) * d.normalX + (site.bombY - d.cy) * d.normalY > 0 ? -1 : 1;
    const x = d.cx + d.normalX * s * AI_ATTACK.viaOffset;
    const y = d.cy + d.normalY * s * AI_ATTACK.viaOffset;
    if (!nav.walkable(x, y)) continue;
    const inside = travel(sim, d.cx, d.cy, site.bombX, site.bombY);
    if (inside > AI_ATTACK.siteDoorReach || travel(sim, x, y, site.bombX, site.bombY) <= inside) continue;
    out.push({ x, y, d: travel(sim, from.x, from.y, x, y) });
  }
  return out.filter((o) => o.d < Infinity).sort((a, b) => a.d - b.d);
}

/**
 * The other door of the site for a pinch: the first way in (after the main
 * one) whose walk, there and on to his spot, is at most AI_ATTACK.splitSlack
 * longer (+ splitExtra m) than his straight walk. A long detour would leave
 * him alone too long: then there is no pinch.
 */
function flankDoor(sim, u, ways, x, y) {
  const direct = travel(sim, u.x, u.y, x, y);
  for (const w of ways.slice(1)) {
    const via = travel(sim, u.x, u.y, w.x, w.y) + travel(sim, w.x, w.y, x, y);
    if (via <= direct * (1 + AI_ATTACK.splitSlack) + AI_ATTACK.splitExtra) return w;
  }
  return null;
}

/**
 * The Tirador of an overwatch plan: walks the way to the site only up to
 * AI_ATTACK.overwatchShort m (walking) before the bomb and holds there looking
 * down the rest of the way (through the door his teammates open first), still,
 * so his holdReaction applies to whoever comes out to meet them. False when
 * the way is too short for that.
 */
function overwatch(sim, u, x, y) {
  const path = sim.world.nav.findPath(u.x, u.y, x, y, NAV.snapRadius);
  if (!path || pathLength(u, path) < AI_ATTACK.overwatchShort * 1.5) return false;
  let left = AI_ATTACK.overwatchShort;
  for (let i = path.length - 1; i > 0; i--) {
    const a = path[i - 1];
    const b = path[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len >= left) {
      const k = left / (len || 1);
      const px = b.x + (a.x - b.x) * k;
      const py = b.y + (a.y - b.y) * k;
      order(sim, { type: 'addWaypoint', unitId: u.id, x: px, y: py, user: true });
      order(sim, { type: 'setLook', unitId: u.id, angle: Math.atan2(b.y - py, b.x - px) });
      return true;
    }
    left -= len;
  }
  return false;
}



/** What the squad has learnt this far: the bomb, or a site walked into with no bomb in it. */
function learnSites(sim, ai) {
  if (sim.bomb.spotted) return;
  for (const s of sim.compiled.sites) {
    if (ai.cleared.has(s.id)) continue;
    for (const u of sim.teams.attackers) if (u.alive && canSee(sim.world, u, s.bombX, s.bombY, u.vision)) ai.cleared.add(s.id);
  }
}

function pickTarget(sim, ai) {
  if (sim.bomb.spotted) return sim.bomb.site;
  const open = sim.compiled.sites.filter((s) => !ai.cleared.has(s.id));
  if (open.length === 1) return open[0].id;
  if (ai.target && open.some((s) => s.id === ai.target)) return ai.target;
  // No clue: the nearest site to the squad (ties: the seed).
  const from = sim.teams.attackers.find((u) => u.alive) || sim.entry.spawns[0];
  const options = (open.length ? open : sim.compiled.sites).map((s) => ({ id: s.id, d: travel(sim, from.x ?? from.at[0], from.y ?? from.at[1], s.bombX, s.bombY) }));
  options.sort((a, b) => a.d - b.d);
  const near = options.filter((o) => o.d <= options[0].d * (1 + AI_ATTACK.choiceSlack));
  return near[hash(sim.seed, 1) % near.length].id;
}

/**
 * The entry to go for the site through: the map's choice for it (`aiEntries`,
 * weighted; the seed picks), else the one with the shortest walk (several
 * close ones: the seed picks).
 */
function pickEntry(sim, siteId) {
  const weights = sim.compiled.aiEntries[siteId];
  if (weights) {
    const ids = Object.keys(weights);
    let roll = hash(sim.seed, 2) % ids.reduce((n, id) => n + weights[id], 0);
    for (const id of ids) if ((roll -= weights[id]) < 0) return id;
  }
  const s = siteById(sim, siteId);
  const options = sim.compiled.entries.map((e) => ({ id: e.id, d: travel(sim, e.spawns[0].at[0], e.spawns[0].at[1], s.bombX, s.bombY) }));
  options.sort((a, b) => a.d - b.d);
  const near = options.filter((o) => o.d <= options[0].d * (1 + AI_ATTACK.choiceSlack));
  return near[hash(sim.seed, 3) % near.length].id;
}

/** Where operator i ends his route: the bomb spot for the first one, a step beside it for the rest. */
function spot(sim, site, i) {
  const off = AI_ATTACK.spotSpacing * Math.ceil(i / 2) * (i % 2 ? 1 : -1);
  const x = site.bombX + off;
  const y = site.bombY;
  return sim.world.nav.walkable(x, y) ? [x, y] : [site.bombX, site.bombY];
}

/**
 * Settles every "?" door point of the squad's routes. Doors are numbered in
 * the order the routes reach them; each gets the next free GO code (past the
 * last one they are simply opened). At each door the first
 * AI_ATTACK.flashers operators with a flashbang throw one (a known
 * barricade: the first with a charge blows it); the others follow on the
 * same code, right after the bang; an Explorador among them looks under
 * the door with his fiber-optic camera while they wait.
 */
function stackDoors(sim, squad, plan = {}) {
  const doors = [];
  for (const u of squad) u.route.forEach((p) => p.ask && !doors.includes(p.door) && doors.push(p.door));
  const free = ENTRY.goCodes.filter((c) => !codeInUse(sim, TEAM, c));
  doors.forEach((k, n) => {
    const code = free[n] || null;
    const at = (u) => u.route.findIndex((p) => (p.ask || p.waitDoor === k) && p.door === k);
    // A known barricade is blown; a breach plan blows every closed door on the way (while charges last).
    const barricade = sim.intel.barricades.has(k) || (!!plan.breach && squad.some((u) => at(u) >= 0 && gearLeft(u, 'breach', at(u)) > 0));
    const stacked = squad.filter((u) => at(u) >= 0);
    // The throwers decide the door first; the rest then wait for them beside the frame (sim/orders.js).
    const throwers = [];
    const gasFirst = stacked.filter((u) => gearLeft(u, 'gas', at(u)) > 0).concat(stacked.filter((u) => gearLeft(u, 'gas', at(u)) <= 0));
    // Gas does not blind: a door gassed gets a flash too, from the next one with a flash (gas, then flash).
    const gassing = !barricade && gasFirst.length && gearLeft(gasFirst[0], 'gas', at(gasFirst[0])) > 0;
    for (const u of gasFirst) {
      if (throwers.length >= (barricade ? 1 : AI_ATTACK.flashers + (gassing ? 1 : 0))) break;
      // A Granadero fires gas into the room instead of a flash (sim/gas.js).
      const gas = !barricade && !throwers.some(([, m]) => m === 'gas') && gearLeft(u, 'gas', at(u)) > 0;
      const mode = barricade && gearLeft(u, 'breach', at(u)) > 0 ? 'breach' : gas ? 'gas' : !barricade && gearLeft(u, 'flash', at(u)) > 0 ? 'flash' : null;
      if (mode) throwers.push([u, mode]);
    }
    const order1 = (u, mode) => {
      const i = at(u); // a hold keeps the point where it is
      if (i < 0) return;
      if (code) order(sim, { type: 'setHold', unitId: u.id, code, index: i });
      if (mode === 'gas') {
        const [x, y] = intoRoom(sim, k, u.route[i], AI_ATTACK.gasDepth);
        order(sim, { type: 'setToss', unitId: u.id, item: 'gas', x, y, index: i }); // last: a throw moves the point
      } else if (mode || u.route[i].ask) order(sim, { type: 'setEntry', unitId: u.id, mode, index: i });
    };
    for (const [u, mode] of throwers) order1(u, mode);
    // The Explorador waiting with them looks under the door with his camera meanwhile.
    for (const u of stacked) if (!throwers.some(([t]) => t === u)) order1(u, code && !barricade && entryModeFits(sim, k, 'cam', u) ? 'cam' : null);
  });
}

// ------------------------------------------------------------ exec

/** GO for every group that is in position (after a short pause), or that has waited too long. */
function callGos(sim, ai) {
  for (const code of ENTRY.goCodes) {
    if (!codeWaiting(sim, TEAM, code)) {
      ai.goWait[code] = 0;
      ai.goReady[code] = 0;
      continue;
    }
    ai.goWait[code] = (ai.goWait[code] || 0) + sim.dt;
    ai.goReady[code] = isGoReady(sim, TEAM, code) ? (ai.goReady[code] || 0) + sim.dt : 0;
    if (ai.goReady[code] >= AI_ATTACK.goPause || ai.goWait[code] >= AI_ATTACK.goTimeout) {
      order(sim, { type: 'go', code });
      ai.goWait[code] = 0;
      ai.goReady[code] = 0;
    }
  }
}

// ------------------------------------------------------------ helpers

const siteById = (sim, id) => sim.compiled.sites.find((s) => s.id === id);

/** A point `depth` m into the room beyond doorway k, seen from route point p (the side he stands on). */
function intoRoom(sim, k, p, depth) {
  const d = sim.world.doorways[k];
  const s = (p.x - d.cx) * d.normalX + (p.y - d.cy) * d.normalY > 0 ? -1 : 1;
  return [d.cx + d.normalX * s * depth, d.cy + d.normalY * s * depth];
}

function pathLength(from, path) {
  let len = 0;
  let a = from;
  for (const p of path) {
    len += Math.hypot(p.x - a.x, p.y - a.y);
    a = p;
  }
  return len;
}

/** Walking distance between two points (Infinity when there is no path). */
function travel(sim, ax, ay, bx, by) {
  const path = sim.world.nav.findPath(ax, ay, bx, by, NAV.snapRadius);
  return path ? pathLength({ x: ax, y: ay }, path) : Infinity;
}

/** A small deterministic hash of the seed (choices with several good options). */
function hash(seed, salt) {
  let h = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}
