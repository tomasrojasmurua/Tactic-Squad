// Defender cameras (Rainbow Six's "cams"): fixed eyes high on the walls, on
// CAMERA.max of the map's mounts (`cameraMounts`: {id, at, facing}). The AI
// defenders use the site's `aiCameras[site]`, which is also where a human
// defender starts; he moves them to other mounts in his recon (the first
// step of his preparation: sim/prep.js) and once it ends they stay there for
// the rest of the round, drone included. A camera that keeps an attacker in sight
// (CAMERA.detect) tells every AI defender where he is: they turn and hold the
// angle he will come through (sim/ai.js alertAiUnit). Lines of sight are the
// world's, so doors and smoke blind it too.
//
// The attackers find cameras: in the drone's cone, or in an operator's within
// CAMERA.spot (small and high, he misses one farther away), a camera becomes
// known (CAMERA_FOUND, drawn on the map). A mount
// they found stays known (sim.knownMounts): taking a camera down and putting
// it back up there does not hide it. An operator with a known camera in sight
// within CAMERA.shootRange and no enemy to shoot breaks it after
// CAMERA.shootDelay — one loud shot (defenders within COMBAT.hearingRadius
// hear it). Deterministic: no randomness.
//
// A Vigía looking at his monitor (role ability 'monitor', sim/queries.js
// isMonitoring) makes every camera report at once (MONITOR.detect) and show
// every attacker in its view, not only the first.
//
// What a camera reports, its side sees: while it keeps an attacker in sight
// after CAMERA.detect he is shown to the defenders (seenByEnemy, their
// memory: sim/view.js) and the first sight is a contact (EV.SPOTTED byCamera),
// so a player defending is told, not only the AI.
//
//   sim.cameras = [{id, mount, x, y, facing, fov, range, alive, known, watch, seeing, also, lastAlert, aim, aimBy}]
import { CAMERA, COMBAT, MONITOR } from '../config/balance.js';
import { EV } from '../core/events.js';
import { canSee } from './vision.js';
import { isAiControlled, cameraLimit } from './queries.js';
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
    also: [], // the others it shows at the same time, while a Vigía watches the monitor
    lastAlert: -Infinity,
    aim: 0, // s an attacker has been aiming at it
    aimBy: -1,
    aimDelay: CAMERA.shootDelay, // how long that takes (shorter when it was known before he saw it)
  });
}

/**
 * The site's cameras (`aiCameras[site]`): the AI's, and a human defender's
 * starting pick (a new site: its own). When the side may mount more than the
 * map lists (a Vigía), the free mounts closest to the bomb fill the rest.
 */
export function placeCameras(sim) {
  sim.cameras = [];
  const limit = cameraLimit(sim);
  const ids = ((sim.compiled.cameras && sim.compiled.cameras[sim.site.id]) || []).slice(0, limit);
  if (ids.length < limit) {
    const d2 = (m) => (m.at[0] - sim.site.bombX) ** 2 + (m.at[1] - sim.site.bombY) ** 2;
    const rest = sim.compiled.cameraMounts.filter((m) => !ids.includes(m.id)).sort((a, b) => d2(a) - d2(b) || (a.id < b.id ? -1 : 1));
    for (const m of rest.slice(0, limit - ids.length)) ids.push(m.id);
  }
  for (const id of ids) {
    const m = mountById(sim, id);
    if (m) addCamera(sim, m);
  }
}

/**
 * The defenders put a camera up on a mount (on) or take theirs down from it.
 * In their recon only (sim/orders.js). Returns a REJECT code or null.
 */
export function setCamera(sim, mountId, on) {
  const m = mountById(sim, mountId);
  if (!m) return 'badMount';
  const i = sim.cameras.findIndex((c) => c.mount === mountId);
  if ((i >= 0) === on) return null;
  if (on) {
    if (sim.cameras.length >= cameraLimit(sim)) return 'tooManyCameras';
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
  const monitored = sim.teams.defenders.some((d) => d.monitor); // a Vigía at his monitor (sim/perception.js)
  let seen = null;
  c.also.length = 0;
  for (const a of sim.teams.attackers) {
    if (!a.alive || !canSee(sim.world, c, a.x, a.y, c)) continue;
    if (!seen) seen = a;
    else if (monitored) reveal(sim, c, a, false); // watched on the screen: every one it shows, not only the first
    if (!monitored) break;
  }
  if (!seen) {
    c.watch = 0;
    c.seeing = -1;
    return;
  }
  c.watch += dt;
  if (c.watch < (monitored ? MONITOR.detect : CAMERA.detect)) return;
  reveal(sim, c, seen);
  if (sim.time - c.lastAlert < CAMERA.realert) return;
  c.lastAlert = sim.time;
  for (const d of sim.teams.defenders) if (d.alive && isAiControlled(sim, d)) alertAiUnit(d, seen.x, seen.y, CAMERA.alertSeconds);
  sim.emit(EV.CAMERA_SPOT, { cameraId: c.id, unitId: seen.id, x: seen.x, y: seen.y });
}

/** The defenders see what their camera reports: shown on their map, remembered, a contact the first time. */
function reveal(sim, c, a, main = true) {
  const first = c.seeing !== a.id && !a.seenByEnemy;
  if (main) c.seeing = a.id;
  else c.also.push(a.id);
  a.seenByEnemy = true;
  rememberSeen(sim, 'defenders', a);
  if (first) sim.emit(EV.SPOTTED, { unitId: a.id, team: a.team, x: a.x, y: a.y, byCamera: true });
}

function attackersSee(sim, c, dt) {
  let shooter = null;
  const wasKnown = c.known;
  const r2 = CAMERA.shootRange * CAMERA.shootRange;
  const spot2 = CAMERA.spot * CAMERA.spot;
  for (const u of sim.teams.attackers) {
    if (!u.alive || u.blind > 0) continue;
    const d2 = (u.x - c.x) ** 2 + (u.y - c.y) ** 2;
    if ((!c.known && d2 > spot2) || !canSee(sim.world, u, c.x, c.y, u.vision)) continue;
    if (!c.known) found(sim, c, false);
    const free = u.target < 0 && u.reloadTimer <= 0 && !(u.entry && u.entry.phase === 'act') && !u.defusing;
    if (free && d2 <= r2 && (!shooter || u.id === c.aimBy)) shooter = u;
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
