// What each side does before the assault, as plain state changes driven by
// orders (sim/orders.js) or, for an AI side, by aiPrepare:
//
//   buy   (attackers) each operator buys the utility he carries with his own
//         money (BUY); he starts with his role's gear, already paid for.
//   prep  (defenders) pick the site (the bomb never moves once the
//         preparation ends), place each operator in their half of the map,
//         give each one a watch order and put up PREP.barricades barricades.
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
import { BUY, PREP } from '../config/balance.js';
import { EV } from '../core/events.js';
import { pointInBox } from '../core/geom.js';
import { WEAPONS } from '../config/weapons.js';
import { createBomb } from './objectives.js';

// ------------------------------------------------------------ buy

/** What a set of gear costs. */
export function gearCost(gear) {
  let c = 0;
  for (const item of BUY.items) c += (gear[item] || 0) * BUY.prices[item];
  return c;
}

/** Phased rounds: every attacker's money is what is left after his role's gear (never below 0). */
export function initMoney(sim) {
  for (const u of sim.teams.attackers) u.money = Math.max(0, BUY.startMoney - gearCost(u.gear));
}

/** Buys (count +1) or sells back (-1) one item. Returns a REJECT code or null. */
export function buyItem(sim, u, item, count) {
  if (u.team !== 'attackers' || !BUY.items.includes(item) || (count !== 1 && count !== -1)) return 'badItem';
  const have = u.gear[item] || 0;
  const price = BUY.prices[item];
  if (count > 0) {
    if (have >= BUY.max[item]) return 'gearFull';
    if (u.money < price) return 'noMoney';
    u.gear[item] = have + 1;
    u.money -= price;
  } else {
    if (have <= 0) return 'noGear';
    u.gear[item] = have - 1;
    u.money += price;
  }
  sim.emit(EV.GEAR_CHANGED, { unitId: u.id, item, count: u.gear[item], money: u.money });
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
  sim.emit(EV.SITE_CHOSEN, { site: site.id });
  return null;
}

/** Puts the defenders where a map layout says (`defense[site]`: at, facing, weapon, behavior). */
export function applyLayout(sim, layout) {
  sim.teams.defenders.forEach((u, i) => {
    const s = layout[(sim.defenderSlots ? sim.defenderSlots[i] : i) % layout.length];
    moveTo(u, s.at[0], s.at[1], s.facing);
    if (s.weapon && s.weapon !== u.weaponId) setWeapon(u, s.weapon);
    setBehavior(u, s.behavior || null);
  });
}

/** Places a defender (in their half, on walkable ground, not on top of a teammate). Returns a REJECT code or null. */
export function placeDefender(sim, u, x, y, facing = u.facing) {
  if (!inDefenderHalf(sim, x, y)) return 'outsideHalf';
  if (!sim.world.nav.walkable(x, y)) return 'unreachable';
  const min2 = PREP.minSpacing * PREP.minSpacing;
  for (const o of sim.teams.defenders) if (o !== u && (o.x - x) ** 2 + (o.y - y) ** 2 < min2) return 'tooClose';
  moveTo(u, x, y, facing);
  sim.emit(EV.SETUP_CHANGED, { unitId: u.id, kind: 'place' });
  return null;
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
  if (on && barricadedDoors(sim).length >= PREP.barricades) return 'tooManyBarricades';
  door.barricaded = !!on;
  sim.emit(EV.BARRICADE_SET, { doorId, on: !!on });
  return null;
}

// ------------------------------------------------------------ AI

/**
 * On entering the preparation: an AI defending side sets up (for now its
 * plan is the map's: the site rolled from the seed, that site's layout and
 * PREP.barricades of the site's `aiBarricades`, picked by a hash of the seed).
 */
export function aiPrepare(sim) {
  if (sim.controllers.defenders !== 'ai') return;
  const options = (sim.compiled.aiBarricades[sim.site.id] || []).slice();
  let h = (sim.seed ^ 0x5bd1e995) >>> 0;
  for (let n = 0; n < PREP.barricades && options.length; n++) {
    h = Math.imul(h ^ (h >>> 13), 0x2c1b3c6d) >>> 0;
    const [id] = options.splice(h % options.length, 1);
    setBarricade(sim, id, true);
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
