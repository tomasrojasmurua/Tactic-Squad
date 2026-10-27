// Defender cameras (Rainbow Six's "cams"): fixed eyes on the walls of the
// site the bomb is on (map data `aiCameras[site]`: {at, facing}). A camera
// that keeps an attacker in sight (CAMERA.detect) tells every AI defender
// where he is: they turn and hold the angle he will come through
// (sim/ai.js alertAiUnit). Lines of sight are the world's, so doors and smoke
// blind it too.
//
// The attackers see cameras like enemies: in an operator's cone or the
// drone's, a camera becomes known (CAMERA_FOUND, drawn on the map). An
// operator with a known camera in sight within CAMERA.shootRange and no enemy
// to shoot breaks it after CAMERA.shootDelay — one loud shot (defenders within
// COMBAT.hearingRadius hear it). Deterministic: no randomness.
//
//   sim.cameras = [{id, x, y, facing, fov, range, alive, known, watch, lastAlert, aim, aimBy}]
import { CAMERA, COMBAT } from '../config/balance.js';
import { EV } from '../core/events.js';
import { canSee } from './vision.js';
import { isAiControlled } from './queries.js';
import { alertAiUnit } from './ai.js';

/** The cameras of the current site (a new site in preparation: its own cameras). */
export function placeCameras(sim) {
  const defs = (sim.compiled.cameras && sim.compiled.cameras[sim.site.id]) || [];
  sim.cameras = defs.map((c, id) => ({
    id,
    x: c.at[0],
    y: c.at[1],
    facing: c.facing,
    fov: c.fov ?? CAMERA.fov,
    range: c.range ?? CAMERA.range,
    alive: true,
    known: false,
    watch: 0, // s it has kept an attacker in sight
    lastAlert: -Infinity,
    aim: 0, // s an attacker has been aiming at it
    aimBy: -1,
    aimDelay: CAMERA.shootDelay, // how long that takes (shorter when it was known before he saw it)
  }));
}

/** Once per tick of a turn, after perception. */
export function updateCameras(sim, dt) {
  for (const c of sim.cameras) {
    if (!c.alive) continue;
    watch(sim, c, dt);
    if (!c.alive) continue;
    attackersSee(sim, c, dt);
  }
}

/** The drone's eye (sim/drone.js): cameras it sees become known. */
export function droneSeesCameras(sim, d, cfg) {
  for (const c of sim.cameras) if (c.alive && !c.known && canSee(sim.world, d, c.x, c.y, cfg)) found(sim, c, true);
}

function watch(sim, c, dt) {
  let seen = null;
  for (const a of sim.teams.attackers) {
    if (a.alive && canSee(sim.world, c, a.x, a.y, c)) {
      seen = a;
      break;
    }
  }
  if (!seen) {
    c.watch = 0;
    return;
  }
  c.watch += dt;
  if (c.watch < CAMERA.detect || sim.time - c.lastAlert < CAMERA.realert) return;
  c.lastAlert = sim.time;
  for (const d of sim.teams.defenders) if (d.alive && isAiControlled(sim, d)) alertAiUnit(d, seen.x, seen.y, CAMERA.alertSeconds);
  sim.emit(EV.CAMERA_SPOT, { cameraId: c.id, unitId: seen.id, x: seen.x, y: seen.y });
}

function attackersSee(sim, c, dt) {
  let shooter = null;
  const wasKnown = c.known;
  const r2 = CAMERA.shootRange * CAMERA.shootRange;
  for (const u of sim.teams.attackers) {
    if (!u.alive || u.blind > 0 || !canSee(sim.world, u, c.x, c.y, u.vision)) continue;
    if (!c.known) found(sim, c, false);
    const free = u.target < 0 && u.reloadTimer <= 0 && !(u.entry && u.entry.phase === 'act') && !u.defusing;
    if (free && (u.x - c.x) ** 2 + (u.y - c.y) ** 2 <= r2 && (!shooter || u.id === c.aimBy)) shooter = u;
  }
  if (!shooter) {
    c.aim = 0;
    c.aimBy = -1;
    return;
  }
  if (shooter.id !== c.aimBy) {
    c.aim = 0;
    c.aimDelay = wasKnown ? CAMERA.shootDelayKnown : CAMERA.shootDelay;
  }
  c.aimBy = shooter.id;
  c.aim += dt;
  if (c.aim >= c.aimDelay) destroy(sim, c, shooter);
}

function found(sim, c, byDrone) {
  c.known = true;
  sim.emit(EV.CAMERA_FOUND, { cameraId: c.id, x: c.x, y: c.y, byDrone });
}

function destroy(sim, c, u) {
  c.alive = false;
  c.known = true;
  sim.emit(EV.CAMERA_DESTROYED, { cameraId: c.id, unitId: u.id, x: c.x, y: c.y });
  // One shot: the gun is heard like any other.
  sim.emit(EV.SHOT, { unitId: u.id, team: u.team, weaponId: u.weaponId, x: u.x, y: u.y, angle: Math.atan2(c.y - u.y, c.x - u.x), toX: c.x, toY: c.y, hit: 'wall', victimId: -1, cover: false, material: 'metal', impactZ: -1, mag: u.mag });
  const r2 = COMBAT.hearingRadius * COMBAT.hearingRadius;
  for (const o of sim.teams.defenders) {
    if (o.alive && isAiControlled(sim, o) && (o.x - u.x) ** 2 + (o.y - u.y) ** 2 < r2) alertAiUnit(o, u.x, u.y, COMBAT.alertDuration, true);
  }
}
