// The attackers' recon drone (round phase 'drone', between the preparation
// and the first planning). Driven in real time with a stick: orders
// {type:'drone', dir, atTick} (dir = one of DRONE.directions headings, -1 =
// stop) and {type:'droneRecall', atTick}, stamped with the step of the drone
// phase like a GO, so a replay drives it the same way.
//
// It rolls under doors (closed ones do not stop it) but not through
// barricades, walls or furniture. What it sees, the attackers learn: the
// defenders in its cone are shown and remembered where they stood
// (sim.memory, the "last known" marks of sim/view.js), a barricade it sees
// is known, and seeing the bomb reveals the site. The defenders keep their
// set-up: they only turn (watch orders, AI ears: they hear it close by) and
// any of them who keeps it in sight DRONE.shootDelay s shoots it down.
// No sim.rng is used. It ends when its time is up, it is shot or recalled.
import { DRONE, COMBAT } from '../config/balance.js';
import { EV } from '../core/events.js';
import { TAU, approachAngle, angleTo } from '../core/math.js';
import { circleAabbPush } from '../core/geom.js';
import { canSee } from './vision.js';
import { alertAiUnit } from './ai.js';
import { isAiControlled } from './queries.js';
import { barricadeBoxes, spotBarricades } from './barricades.js';

/** Launches the drone in front of the attackers' entry door, facing it (a player or the attacking AI drives it). */
export function launchDrone(sim) {
  const door = sim.compiled.doors.find((d) => d.id === sim.entry.door);
  const s = sim.entry.spawns[0];
  const side = Math.sign((s.at[0] - door.cx) * door.normalX + (s.at[1] - door.cy) * door.normalY) || -1;
  const x = door.cx + door.normalX * side * DRONE.launchDistance;
  const y = door.cy + door.normalY * side * DRONE.launchDistance;
  const facing = Math.atan2(-door.normalY * side, -door.normalX * side);
  sim.drone = {
    x,
    y,
    prevX: x,
    prevY: y,
    facing,
    prevFacing: facing,
    dir: -1, // stick heading index, -1 = stopped
    moving: false,
    active: true,
    left: DRONE.seconds,
    end: null, // 'time' | 'recalled' | 'destroyed'
    shooterId: -1,
    watched: new Map(), // defender id -> s he has had it in sight
  };
  sim.emit(EV.DRONE_LAUNCHED, { x, y, seconds: DRONE.seconds });
  return true;
}

/** Is the drone phase over (no drone, or it is done)? */
export const droneOver = (sim) => !sim.drone || !sim.drone.active;

/** The drone stops for good. The defenders it saw become "last known" marks (no longer in sight). */
export function endDrone(sim, reason) {
  const d = sim.drone;
  if (!d || !d.active) return;
  d.active = false;
  d.moving = false;
  d.end = reason;
  for (const u of sim.teams.defenders) u.seenByEnemy = false;
  sim.emit(EV.DRONE_ENDED, { reason });
}

/** The stick (dir index or -1) / the recall. */
export function steerDrone(sim, dir) {
  const d = sim.drone;
  if (!d || !d.active) return;
  d.dir = Number.isInteger(dir) && dir >= 0 && dir < DRONE.directions ? dir : -1;
}

const blockers = [];
const push = { x: 0, y: 0 };
const eyeCfg = { fov: DRONE.fov, range: DRONE.range };
const shotCfg = { fov: 0, range: DRONE.shootRange };

/** One step of the drone phase (Simulation.step): the drone, the defenders' eyes and ears. */
export function updateDrone(sim, dt) {
  const d = sim.drone;
  for (const u of sim.units) {
    u.prevX = u.x;
    u.prevY = u.y;
    u.prevFacing = u.facing;
  }
  if (!d || !d.active) return;
  d.prevX = d.x;
  d.prevY = d.y;
  d.prevFacing = d.facing;
  move(sim, d, dt);
  look(sim, d);
  if (d.active) defend(sim, d, dt);
  d.left -= dt;
  if (d.active && d.left <= 1e-9) endDrone(sim, 'time');
}

function move(sim, d, dt) {
  d.moving = d.dir >= 0;
  if (!d.moving) return;
  const heading = (d.dir / DRONE.directions) * TAU;
  d.facing = approachAngle(d.facing, heading, DRONE.turnRate * dt);
  d.x += Math.cos(heading) * DRONE.speed * dt;
  d.y += Math.sin(heading) * DRONE.speed * dt;
  barricadeBoxes(sim, blockers);
  const walls = sim.world.moveBlockers;
  for (let pass = 0; pass < 2; pass++) {
    for (const b of walls) pushOut(d, b);
    for (const b of blockers) pushOut(d, b);
  }
  d.x = Math.min(sim.world.width, Math.max(0, d.x));
  d.y = Math.min(sim.world.height, Math.max(0, d.y));
}

function pushOut(d, box) {
  const r = DRONE.radius;
  if (d.x + r < box.minX || d.x - r > box.maxX || d.y + r < box.minY || d.y - r > box.maxY) return;
  if (circleAabbPush(d.x, d.y, r, box, push)) {
    d.x += push.x;
    d.y += push.y;
  }
}

/** What the camera sees: defenders (shown and remembered), barricades, the bomb. */
function look(sim, d) {
  const mem = sim.memory.attackers;
  for (const u of sim.teams.defenders) {
    u.seenByEnemyPrev = u.seenByEnemy;
    u.seenByEnemy = u.alive && canSee(sim.world, d, u.x, u.y, eyeCfg);
    if (!u.seenByEnemy) continue;
    let k = mem.get(u.id);
    if (!k) mem.set(u.id, (k = { id: u.id, x: 0, y: 0, tick: 0, alive: true }));
    k.x = u.x;
    k.y = u.y;
    k.tick = sim.tick;
    k.alive = u.alive;
    if (!u.seenByEnemyPrev) sim.emit(EV.SPOTTED, { unitId: u.id, team: u.team, x: u.x, y: u.y, byDrone: true });
  }
  spotBarricades(sim, d, DRONE.fov);
  const bomb = sim.bomb;
  if (!bomb.spotted && canSee(sim.world, d, bomb.x, bomb.y, eyeCfg)) {
    bomb.spotted = true;
    sim.emit(EV.BOMB_SPOTTED, { unitId: -1, site: bomb.site, x: bomb.x, y: bomb.y, byDrone: true });
  }
}

/** The defenders hold their set-up: they turn (watch orders, noise) and shoot the drone if they keep it in sight. */
function defend(sim, d, dt) {
  const h2 = DRONE.hearing * DRONE.hearing;
  for (const u of sim.teams.defenders) {
    if (!u.alive) continue;
    if (u.alertTimer > 0) u.alertTimer -= dt;
    if (isAiControlled(sim, u) && d.moving && (u.x - d.x) ** 2 + (u.y - d.y) ** 2 <= h2) alertAiUnit(u, d.x, d.y, COMBAT.alertDuration);
    shotCfg.fov = u.vision.fov;
    if (u.blind > 0 || !canSee(sim.world, u, d.x, d.y, shotCfg)) {
      d.watched.delete(u.id);
      continue;
    }
    const t = (d.watched.get(u.id) || 0) + dt;
    d.watched.set(u.id, t);
    if (t >= DRONE.shootDelay) return shootDown(sim, d, u);
  }
}

function shootDown(sim, d, u) {
  const angle = angleTo(u.x, u.y, d.x, d.y);
  u.facing = angle;
  sim.emit(EV.SHOT, {
    unitId: u.id,
    team: u.team,
    weaponId: u.weaponId,
    x: u.x,
    y: u.y,
    angle,
    toX: d.x,
    toY: d.y,
    hit: 'none',
    victimId: -1,
    cover: false,
    material: 'none',
    impactZ: -1,
    mag: u.mag,
  });
  d.shooterId = u.id;
  sim.emit(EV.DRONE_DESTROYED, { x: d.x, y: d.y, shooterId: u.id });
  endDrone(sim, 'destroyed');
}
