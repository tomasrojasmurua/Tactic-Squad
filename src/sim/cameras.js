// Defender cameras (Rainbow Six's "cams"): fixed eyes high on the walls, on
// CAMERA.max of the map's mounts (`cameraMounts`: {id, at, facing}). The AI
// defenders use the site's `aiCameras[site]`, which is also where a human
// defender starts; he moves them to other mounts in the preparation and
// while the enemy drone flies (order `camera`, stamped like the drone's
// stick: sim/orders.js). A camera that keeps an attacker in sight
// (CAMERA.detect) tells every AI defender where he is: they turn and hold the
// angle he will come through (sim/ai.js alertAiUnit). Lines of sight are the
// world's, so doors and smoke blind it too.
//
// The attackers see cameras like enemies: in an operator's cone or the
// drone's, a camera becomes known (CAMERA_FOUND, drawn on the map). A mount
// they found stays known (sim.knownMounts): taking a camera down and putting
// it back up there does not hide it. An operator with a known camera in sight
// within CAMERA.shootRange and no enemy to shoot breaks it after
// CAMERA.shootDelay — one loud shot (defenders within COMBAT.hearingRadius
// hear it). Deterministic: no randomness.
//
// What a camera reports, its side sees: while it keeps an attacker in sight
// after CAMERA.detect he is shown to the defenders (seenByEnemy, their
// memory: sim/view.js) and the first sight is a contact (EV.SPOTTED byCamera),
// so a player defending is told, not only the AI.
//
//   sim.cameras = [{id, mount, x, y, facing, fov, range, alive, known, watch, seeing, lastAlert, aim, aimBy}]
import { CAMERA, COMBAT } from '../config/balance.js';
import { EV } from '../core/events.js';
import { canSee } from './vision.js';
import { isAiControlled } from './queries.js';
import { alertAiUnit } from './ai.js';
import { rememberSeen } from './view.js';

/** The map's mount with that id, or null. */
export const mountById = (sim, id) => sim.compiled.cameraMounts.find((m) => m.id === id) || null;

function addCamera(sim, m) {
  sim.cameras.push({
    id: sim.cameras.length,
    mount: m.id,
    x: m.at[0],
    y: m.at[1],
    facing: m.facing,
    fov: m.fov ?? CAMERA.fov,
    range: m.range ?? CAMERA.range,
    alive: true,
    known: sim.knownMounts.has(m.id),
    watch: 0, // s it has kept an attacker in sight
    seeing: -1, // the attacker it reports right now (after CAMERA.detect), else -1
    lastAlert: -Infinity,
    aim: 0, // s an attacker has been aiming at it
    aimBy: -1,
    aimDelay: CAMERA.shootDelay, // how long that takes (shorter when it was known before he saw it)
  });
}

/** The site's cameras (`aiCameras[site]`): the AI's, and a human defender's starting pick (a new site: its own). */
export function placeCameras(sim) {
  sim.cameras = [];
  const ids = (sim.compiled.cameras && sim.compiled.cameras[sim.site.id]) || [];
  for (const id of ids.slice(0, CAMERA.max)) {
    const m = mountById(sim, id);
    if (m) addCamera(sim, m);
  }
}

/**
 * The defenders put a camera up on a mount (on) or take theirs down from it.
 * Before the assault only (preparation, drone). Returns a REJECT code or null.
 */
export function setCamera(sim, mountId, on) {
  const m = mountById(sim, mountId);
  if (!m) return 'badMount';
  const i = sim.cameras.findIndex((c) => c.mount === mountId);
  if ((i >= 0) === on) return null;
  if (on) {
    if (sim.cameras.length >= CAMERA.max) return 'tooManyCameras';
    addCamera(sim, m);
  } else {
    sim.cameras.splice(i, 1);
    sim.cameras.forEach((c, k) => (c.id = k));
  }
  sim.emit(EV.CAMERA_SET, { mount: mountId, on });
  return null;
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
    c.seeing = -1;
    return;
  }
  c.watch += dt;
  if (c.watch < CAMERA.detect) return;
  reveal(sim, c, seen);
  if (sim.time - c.lastAlert < CAMERA.realert) return;
  c.lastAlert = sim.time;
  for (const d of sim.teams.defenders) if (d.alive && isAiControlled(sim, d)) alertAiUnit(d, seen.x, seen.y, CAMERA.alertSeconds);
  sim.emit(EV.CAMERA_SPOT, { cameraId: c.id, unitId: seen.id, x: seen.x, y: seen.y });
}

/** The defenders see what their camera reports: shown on their map, remembered, a contact the first time. */
function reveal(sim, c, a) {
  const first = c.seeing !== a.id && !a.seenByEnemy;
  c.seeing = a.id;
  a.seenByEnemy = true;
  rememberSeen(sim, 'defenders', a);
  if (first) sim.emit(EV.SPOTTED, { unitId: a.id, team: a.team, x: a.x, y: a.y, byCamera: true });
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
  sim.knownMounts.add(c.mount);
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
