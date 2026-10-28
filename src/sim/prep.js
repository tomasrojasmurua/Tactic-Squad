// What each side does before the assault, as plain state changes driven by
// orders (sim/orders.js) or, for an AI side, by aiPrepare:
//
//   buy   (attackers) each operator carries his class's kit (free) and adds
//         utility with his points (BUY); the defenders do the same in prep.
//   prep  (defenders) pick the site (the bomb never moves once the
//         preparation ends), place each operator in their half of the map,
//         give each one a watch order and put up PREP.barricades barricades.
//         Each defender has a class (Defensor / Ancla / Merodeador / Trampero,
//         at most ROLES[id].max each); the Trampero lays his traps (sim/traps.js).
//
// Watch orders ({facing, sweep, react, fallback}) become the AI behaviors of
// sim/ai.js, so they keep working on their own during the assault:
//   ángulo fijo      {facing}                       hold, deaf to noise
//   barrer           {facing, sweep: [from, to]}    scan between two angles
//   reaccionar       {facing, react: true}          hold, turns to noise
//   replegarse       {facing, react: true, fallback: {to: [x, y], look}}
//                    on the first firefight heard, falls back there and holds `look`
// Everything here is deterministic and uses no sim.rng (the AI's barricade
// pick hashes the seed), so a set-up cannot shift the rest of the round.
import { placeCameras } from './cameras.js';
import { layTraps, dropOrphanTraps, placeTrap as layTrap } from './traps.js';
import { BUY, PREP, NAV, AI_UTILITY } from '../config/balance.js';
import { EV } from '../core/events.js';
import { pointInBox } from '../core/geom.js';
import { WEAPONS } from '../config/weapons.js';
import { ROLES, DEFAULT_DEFENDER_ROLE } from '../config/operators.js';
import { applyRole, roleGear } from './units.js';
import { createBomb } from './objectives.js';
import { setWire } from './wires.js';

// ------------------------------------------------------------ buy

/** The phase each side buys in: the attackers in the buy phase, the defenders in their preparation. */
const BUY_PHASE = Object.freeze({ attackers: 'buy', defenders: 'prep' });

/** What a side may buy (BUY.items / BUY.defenderItems). */
export const buyableItems = (team) => (team === 'attackers' ? BUY.items : BUY.defenderItems);

/** The utility points an operator of `team` gets this round: BUY.points, plus BUY.lossBonus if his side lost the last round of a match. */
export function pointsFor(sim, team) {
  return BUY.points + (sim.lossBonus === team ? BUY.lossBonus : 0);
}

/** Phased rounds: every operator starts with his points (his class's kit is free). */
export function initPoints(sim) {
  for (const u of sim.units) u.points = pointsFor(sim, u.team);
}

/**
 * Buys (count +1) or gives back (-1) one item for its points. The class's kit
 * cannot be given back (it costs nothing). Returns a REJECT code or null.
 */
export function buyItem(sim, u, item, count) {
  if (!buyableItems(u.team).includes(item) || (count !== 1 && count !== -1)) return 'badItem';
  if (sim.phase !== BUY_PHASE[u.team]) return 'badItem';
  const have = u.gear[item] || 0;
  const price = BUY.prices[item];
  if (count > 0) {
    if (have >= BUY.max[item]) return 'gearFull';
    if (u.points < price) return 'noPoints';
    u.gear[item] = have + 1;
    u.points -= price;
  } else {
    if (have <= (roleGear(u.role)[item] || 0)) return 'noGear';
    u.gear[item] = have - 1;
    u.points += price;
  }
  sim.emit(EV.GEAR_CHANGED, { unitId: u.id, item, count: u.gear[item], points: u.points });
  return null;
}

/** A new class: its kit, and the points back (what he bought goes back with the old class). */
function resetGear(sim, u) {
  u.gear = roleGear(u.role);
  u.points = pointsFor(sim, u.team);
}

/**
 * An attacker changes class (buy phase): he takes the new class's stats,
 * weapon and kit, and gets his points back. Brecha and Explorador: one per squad.
 */
export function setRole(sim, u, roleId) {
  const role = ROLES[roleId];
  if (u.team !== 'attackers' || !role || !role.pick) return 'badRole';
  if (u.role === roleId) return null;
  if (role.unique && sim.teams.attackers.some((o) => o !== u && o.role === roleId)) return 'roleTaken';
  applyRole(u, roleId);
  resetGear(sim, u);
  sim.emit(EV.ROLE_CHANGED, { unitId: u.id, role: roleId, points: u.points });
  return null;
}

// ------------------------------------------------------------ defender set-up

/** Is the point inside the defenders' half (map `deployment.defenders`)? */
export function inDefenderHalf(sim, x, y) {
  for (const b of sim.compiled.deployment.defenders) if (pointInBox(x, y, b)) return true;
  return false;
}

/**
 * The defenders keep the bomb on another site: it moves there and their
 * set-up starts over from that site's map layout (positions, watch orders);
 * the barricades stay.
 */
export function chooseSite(sim, id) {
  const site = sim.compiled.sites.find((s) => s.id === id);
  if (!site) return 'badSite';
  if (site === sim.site) return null;
  sim.site = site;
  sim.bomb = createBomb(site);
  applyLayout(sim, sim.compiled.defense[site.id]);
  placeCameras(sim);
  layTraps(sim);
  sim.emit(EV.SITE_CHOSEN, { site: site.id });
  return null;
}

/** Puts the defenders where a map layout says (`defense[site]`: at, facing, weapon, behavior). */
export function applyLayout(sim, layout) {
  sim.teams.defenders.forEach((u, i) => {
    const s = layout[(sim.defenderSlots ? sim.defenderSlots[i] : i) % layout.length];
    moveTo(u, s.at[0], s.at[1], s.facing);
    const role = sim.roles.defenders[i] || s.role || DEFAULT_DEFENDER_ROLE; // the lobby's class, else the post's
    if (role !== u.role) {
      applyRole(u, role); // an anchor slot makes him an Ancla (config/operators.js)
      resetGear(sim, u); // and gives him the Ancla's kit
    }
    if (s.weapon && s.weapon !== u.weaponId) setWeapon(u, s.weapon);
    setBehavior(u, s.behavior || null);
  });
}

/**
 * Places a defender (in their half, on walkable ground, not on top of a
 * teammate). A point on furniture or against a wall slides to the nearest
 * walkable spot (NAV.snapRadius), like a route point. Returns a REJECT code or null.
 */
export function placeDefender(sim, u, px, py, facing = u.facing) {
  const nav = sim.world.nav;
  const p = nav.walkable(px, py) ? { x: px, y: py } : nav.nearestWalkable(px, py, NAV.snapRadius);
  if (!p) return 'unreachable';
  const { x, y } = p;
  if (!inDefenderHalf(sim, x, y)) return 'outsideHalf';
  const min2 = PREP.minSpacing * PREP.minSpacing;
  for (const o of sim.teams.defenders) if (o !== u && (o.x - x) ** 2 + (o.y - y) ** 2 < min2) return 'tooClose';
  moveTo(u, x, y, facing);
  sim.emit(EV.SETUP_CHANGED, { unitId: u.id, kind: 'place' });
  return null;
}

/**
 * A defender changes class (preparation): stats and health of the new class;
 * his weapon is his post's. At most ROLES[id].max of a class per side. A
 * Trampero who stops being one takes his traps with him. He takes the new
 * class's kit and gets his points back.
 */
export function setDefenderRole(sim, u, roleId) {
  const role = ROLES[roleId];
  if (u.team !== 'defenders' || !role || !role.defPick) return 'badRole';
  if (u.role === roleId) return null;
  if (sim.teams.defenders.filter((o) => o !== u && o.role === roleId).length >= role.max) return 'roleTaken';
  const weaponId = u.weaponId;
  applyRole(u, roleId);
  if (weaponId !== u.weaponId) setWeapon(u, weaponId);
  resetGear(sim, u);
  dropOrphanTraps(sim);
  sim.emit(EV.ROLE_CHANGED, { unitId: u.id, role: roleId, points: u.points });
  return null;
}

/** The Trampero lays a trap there, or picks his own up (sim/traps.js). Returns a REJECT code or null. */
export function placeTrap(sim, u, x, y) {
  return layTrap(sim, u, x, y, (px, py) => inDefenderHalf(sim, px, py));
}

/** A watch order (see the header) -> the unit's behavior. Returns a REJECT code or null. */
export function setWatch(sim, u, watch) {
  if (!watch || typeof watch.facing !== 'number') return 'badWatch';
  const fb = watch.fallback || null;
  if (fb && (!inDefenderHalf(sim, fb.to[0], fb.to[1]) || !sim.world.nav.walkable(fb.to[0], fb.to[1]))) return 'outsideHalf';
  const react = !!watch.react;
  const rotate = fb ? { to: [fb.to[0], fb.to[1]], look: fb.look ?? watch.facing } : undefined;
  const behavior = watch.sweep
    ? { type: 'scan', from: watch.sweep[0], to: watch.sweep[1], period: PREP.sweepPeriod, reactsToNoise: react, rotate }
    : { type: 'hold', reactsToNoise: react, rotate };
  u.facing = u.prevFacing = watch.facing;
  setBehavior(u, behavior);
  u.ai.baseFacing = watch.facing;
  sim.emit(EV.SETUP_CHANGED, { unitId: u.id, kind: 'watch' });
  return null;
}

/** Doors barricaded now (indices into sim.doors). */
export function barricadedDoors(sim) {
  const out = [];
  sim.doors.forEach((d, i) => d.barricaded && out.push(i));
  return out;
}

/** Puts up (on) or takes down a barricade on a door the map allows (`barricadeSlots`). Returns a REJECT code or null. */
export function setBarricade(sim, doorId, on) {
  const door = sim.doors.find((d) => d.def.id === doorId);
  if (!door || !sim.compiled.barricadeSlots.includes(doorId)) return 'badDoor';
  if (door.barricaded === !!on) return null;
  if (on && door.wired) return 'doorTaken';
  if (on && barricadedDoors(sim).length >= PREP.barricades) return 'tooManyBarricades';
  door.barricaded = !!on;
  sim.emit(EV.BARRICADE_SET, { doorId, on: !!on });
  return null;
}

// ------------------------------------------------------------ AI

/**
 * On entering the preparation: an AI defending side sets up (for now its
 * plan is the map's: the site rolled from the seed, that site's layout and
 * PREP.barricades of the site's `aiBarricades`, picked by a hash of the seed,
 * then PREP.wires of barbed wire on the options left)
 * and buys AI_UTILITY.buy with each defender's points.
 */
export function aiPrepare(sim) {
  if (sim.controllers.defenders !== 'ai') return;
  for (const u of sim.teams.defenders) for (const item of AI_UTILITY.buy) buyItem(sim, u, item, 1); // what the points reach
  const options = (sim.compiled.aiBarricades[sim.site.id] || []).slice();
  let h = (sim.seed ^ 0x5bd1e995) >>> 0;
  for (let n = 0; n < PREP.barricades && options.length; n++) {
    h = Math.imul(h ^ (h >>> 13), 0x2c1b3c6d) >>> 0;
    const [id] = options.splice(h % options.length, 1);
    setBarricade(sim, id, true);
  }
  // Barbed wire on the options left (sim/wires.js).
  for (let n = 0; n < PREP.wires && options.length; n++) {
    h = Math.imul(h ^ (h >>> 13), 0x2c1b3c6d) >>> 0;
    const [id] = options.splice(h % options.length, 1);
    setWire(sim, id, true);
  }
}

// ------------------------------------------------------------ helpers

function moveTo(u, x, y, facing) {
  u.x = u.prevX = x;
  u.y = u.prevY = y;
  u.facing = u.prevFacing = u.heading = facing;
  u.ai.baseFacing = facing;
  u.route.length = 0;
}

function setBehavior(u, behavior) {
  u.behavior = behavior;
  u.ai = { patrolIndex: 0, wait: 0, baseFacing: u.facing, repath: 0, noiseX: 0, noiseY: 0, rotating: null, rotated: false };
}

function setWeapon(u, weaponId) {
  const w = WEAPONS[weaponId];
  u.weaponId = weaponId;
  u.weapon = w;
  u.mag = w.magazine;
  u.reserve = w.reserve;
  u.burstLeft = w.burst[0];
}
