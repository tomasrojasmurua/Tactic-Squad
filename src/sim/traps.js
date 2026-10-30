// Trampero's traps: TRAP.perTrapper each, laid on the floor of the
// defenders' half in the preparation (a human defender: order placeTrap; the
// AI: map data `aiTraps[site]`). An attacker who steps on one is caught:
// frozen TRAP.stun s, hurt, a loud snap (sim/noise.js 'trap'), and the
// defenders learn where he is (memory, AI alert) — like a camera report.
//
// They are hard to see. An attacker notices a trap in his sight within
// TRAP.spot only while sneaking; the drone within TRAP.droneSpot; the
// Explorador (modifiers.trapSpot > 1) farther, and walking normally too. A known
// trap in an attacker's sight within TRAP.shootRange he breaks with one shot,
// as he does a camera. Deterministic: no randomness.
//
//   sim.traps = [{id, ownerId, x, y, alive, known, aim, aimBy}]
import { TRAP, CAMERA, COMBAT } from '../config/balance.js';
import { EV } from '../core/events.js';
import { canSee } from './vision.js';
import { isAiControlled } from './queries.js';
import { alertAiUnit } from './ai.js';
import { applyBlast } from './combat.js';
import { datan2, sq } from '../core/dmath.js';

/** The live traps a defender laid. */
export const trapsOf = (sim, u) => sim.traps.filter((t) => t.alive && t.ownerId === u.id);

function addTrap(sim, u, x, y) {
  sim.traps.push({ id: sim.traps.length, ownerId: u.id, x, y, alive: true, known: false, aim: 0, aimBy: -1 });
}

/**
 * Preparation: the Trampero `u` lays a trap at (x, y), or picks his own up
 * when one is there already. `inHalf(x, y)`: the defenders' half (sim/prep.js).
 * Returns a REJECT code or null.
 */
export function placeTrap(sim, u, px, py, inHalf) {
  if (u.role !== 'trapper') return 'notTrapper';
  const nav = sim.world.nav;
  const p = nav.walkable(px, py) ? { x: px, y: py } : nav.nearestWalkable(px, py, 0.8);
  if (!p) return 'unreachable';
  const min2 = TRAP.minSpacing * TRAP.minSpacing;
  const own = sim.traps.find((t) => t.alive && t.ownerId === u.id && sq(t.x - p.x) + sq(t.y - p.y) < min2);
  if (own) {
    own.alive = false; // picked up
    sim.traps = sim.traps.filter((t) => t !== own);
    sim.traps.forEach((t, i) => (t.id = i));
  } else {
    if (!inHalf(p.x, p.y)) return 'outsideHalf';
    if (trapsOf(sim, u).length >= TRAP.perTrapper) return 'tooManyTraps';
    if (sim.traps.some((t) => t.alive && sq(t.x - p.x) + sq(t.y - p.y) < min2)) return 'tooClose';
    addTrap(sim, u, p.x, p.y);
  }
  sim.emit(EV.SETUP_CHANGED, { unitId: u.id, kind: 'trap' });
  return null;
}

/** Traps whose layer is no longer a Trampero (class changed, site changed) go away. */
export function dropOrphanTraps(sim) {
  const kept = sim.traps.filter((t) => sim.units[t.ownerId].role === 'trapper');
  if (kept.length === sim.traps.length) return;
  kept.forEach((t, i) => (t.id = i));
  sim.traps = kept;
}

/** The map's layout: its Trampero lays the site's traps (`aiTraps[site]`); a human defender may move them. */
export function layTraps(sim) {
  sim.traps = [];
  const u = sim.teams.defenders.find((d) => d.role === 'trapper');
  const spots = (sim.compiled.traps && sim.compiled.traps[sim.site.id]) || [];
  if (!u) return;
  for (const s of spots.slice(0, TRAP.perTrapper)) addTrap(sim, u, s[0], s[1]);
}

/** Once per tick of a turn, after perception. */
export function updateTraps(sim, dt) {
  for (const t of sim.traps) {
    if (!t.alive) continue;
    if (spring(sim, t)) continue;
    attackersSee(sim, t, dt);
  }
}

function spring(sim, t) {
  const r2 = TRAP.trigger * TRAP.trigger;
  const caught = sim.teams.attackers.find((a) => a.alive && sq(a.x - t.x) + sq(a.y - t.y) <= r2);
  if (!caught) return false;
  t.alive = false;
  t.known = true;
  caught.stun = Math.max(caught.stun, TRAP.stun);
  sim.emit(EV.TRAP_SPRUNG, { trapId: t.id, unitId: caught.id, team: caught.team, ownerId: t.ownerId, x: caught.x, y: caught.y });
  // The defenders know where he is, as if a camera saw him.
  const mem = sim.memory.defenders;
  let k = mem.get(caught.id);
  if (!k) mem.set(caught.id, (k = { id: caught.id, x: 0, y: 0, tick: 0, alive: true }));
  Object.assign(k, { x: caught.x, y: caught.y, tick: sim.tick, alive: true });
  for (const d of sim.teams.defenders) if (d.alive && isAiControlled(sim, d)) alertAiUnit(d, caught.x, caught.y, CAMERA.alertSeconds, true);
  applyBlast(sim, sim.units[t.ownerId], caught, TRAP.damage, t.x, t.y);
  return true;
}

function attackersSee(sim, t, dt) {
  const shoot2 = TRAP.shootRange * TRAP.shootRange;
  let shooter = null;
  for (const u of sim.teams.attackers) {
    if (!u.alive || u.blind > 0) continue;
    const d2 = sq(u.x - t.x) + sq(u.y - t.y);
    const spot = TRAP.spot * u.mods.trapSpot;
    if (d2 > (t.known ? shoot2 : spot * spot) || !canSee(sim.world, u, t.x, t.y, u.vision)) continue;
    if (!t.known) {
      if (!u.sneaking && u.mods.trapSpot <= 1) continue; // walking normally he does not look at the floor (the Explorador does)
      found(sim, t, u.mods.trapSpot > 1 ? 'scout' : 'sight');
    }
    const free = u.target < 0 && u.reloadTimer <= 0 && !(u.entry && u.entry.phase === 'act') && !u.defusing;
    if (free && d2 <= shoot2 && (!shooter || u.id === t.aimBy)) shooter = u;
  }
  if (!shooter) {
    t.aim = 0;
    t.aimBy = -1;
    return;
  }
  if (shooter.id !== t.aimBy) t.aim = 0;
  t.aimBy = shooter.id;
  t.aim += dt;
  if (t.aim >= TRAP.shootDelay) destroy(sim, t, shooter);
}

/** The attackers learn where a trap is (`by`: 'sight' | 'drone' | 'scout'). */
export function found(sim, t, by) {
  if (t.known || !t.alive) return;
  t.known = true;
  sim.emit(EV.TRAP_FOUND, { trapId: t.id, x: t.x, y: t.y, by });
}

/** The Explorador's fiber-optic camera under a door (sim/perception.js): traps in its view become known. */
export function camSeesTraps(sim, eye) {
  for (const t of sim.traps) if (t.alive && !t.known && canSee(sim.world, eye, t.x, t.y, eye)) found(sim, t, 'scout');
}

/** The drone's eye (sim/drone.js): traps it sees close by become known. */
export function droneSeesTraps(sim, d, cfg) {
  const r2 = TRAP.droneSpot * TRAP.droneSpot;
  for (const t of sim.traps) if (t.alive && !t.known && sq(d.x - t.x) + sq(d.y - t.y) <= r2 && canSee(sim.world, d, t.x, t.y, cfg)) found(sim, t, 'drone');
}

function destroy(sim, t, u) {
  t.alive = false;
  t.known = true;
  sim.emit(EV.TRAP_DESTROYED, { trapId: t.id, unitId: u.id, x: t.x, y: t.y });
  sim.emit(EV.SHOT, { unitId: u.id, team: u.team, weaponId: u.weaponId, x: u.x, y: u.y, angle: datan2(t.y - u.y, t.x - u.x), toX: t.x, toY: t.y, hit: 'wall', victimId: -1, cover: false, material: 'metal', impactZ: -1, mag: u.mag });
  const r2 = COMBAT.hearingRadius * COMBAT.hearingRadius;
  for (const o of sim.teams.defenders) {
    if (o.alive && isAiControlled(sim, o) && sq(o.x - u.x) + sq(o.y - u.y) < r2) alertAiUnit(o, u.x, u.y, COMBAT.alertDuration, true);
  }
}
