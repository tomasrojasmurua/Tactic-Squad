// Read-only questions about the simulation state, shared by the sim systems
// and by the presentation layers (input previews, HUD, touch bar). Pure
// functions: they never mutate the state, allocate nothing per call, and are
// the ONLY sim helpers that input/ui/render may import besides vision.js.
import { pointInBox, pointAabbDistance, pointSegDist2 } from '../core/geom.js';
import { angleDiff } from '../core/math.js';
import { MOVE } from '../config/balance.js';
import { PROP_SURFACE, SURFACE_PROBE, DOOR_SURFACE, FENCE_SURFACE } from '../config/materials.js';
import { TEAMS } from '../config/squad.js';

/** The opposing side of a team. */
export const enemyTeam = (team) => (team === TEAMS[0] ? TEAMS[1] : TEAMS[0]);

/** Is this unit driven by the sim's AI (its side's controller is 'ai')? */
export const isAiControlled = (sim, u) => sim.controllers[u.team] === 'ai';

/** First side whose orders come from a human (default for the GO / HUD questions), or null. */
export function humanTeam(sim) {
  for (const t of TEAMS) if (sim.controllers[t] === 'human') return t;
  return null;
}

/** Units of a team, in spawn order (array owned by the sim — do not mutate). */
export const teamUnits = (sim, team) => sim.teams[team];

/** Unit by id (read-only: weapon, mag, team, role, slot...), or null. */
export const unitById = (sim, unitId) => (unitId >= 0 && sim.units[unitId]) || null;

/** Floor material id (config/materials.js FLOORS) at a point: the last map floor rect covering it, or null. */
export function floorMaterialAt(sim, x, y) {
  const floors = sim.compiled.floors || [];
  for (let i = floors.length - 1; i >= 0; i--) {
    const r = floors[i].rect; // [x, y, w, h] (indexed: destructuring allocates an iterator)
    if (x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3]) return floors[i].material;
  }
  return null;
}

/** The prop whose footprint is within SURFACE_PROBE of a point (first in map order), or null. */
export function propNear(sim, x, y) {
  for (const p of sim.compiled.props) if (pointAabbDistance(x, y, p.box) < SURFACE_PROBE) return p;
  return null;
}

/**
 * Surface a bullet struck at (x, y): a door slab, a prop's material, a fence,
 * or plaster (config/materials.js). Same answer for FX and audio.
 */
export function struckSurface(sim, x, y) {
  const r2 = SURFACE_PROBE * SURFACE_PROBE;
  for (const d of sim.doors) {
    const def = d.def;
    const a = def.closedAngle + d.angle;
    const ex = def.hingeX + Math.cos(a) * def.length;
    const ey = def.hingeY + Math.sin(a) * def.length;
    if (pointSegDist2(x, y, def.hingeX, def.hingeY, ex, ey) < r2) return DOOR_SURFACE;
  }
  const prop = propNear(sim, x, y);
  if (prop) return PROP_SURFACE[prop.type] || 'plaster';
  for (const w of sim.compiled.walls) if (w.kind === 'fence' && pointAabbDistance(x, y, w.box) < SURFACE_PROBE) return FENCE_SURFACE;
  return 'plaster';
}

/** Bomb arming progress 0..1 while someone plants, else -1. */
export const plantProgress = (sim) => (sim.bomb.planterId >= 0 ? sim.bomb.progress : -1);

export function firstAlive(sim, team) {
  for (const u of sim.teams[team]) if (u.alive) return u;
  return null;
}

/** A living unit the given (human) side may command, or null. */
export function controllableUnit(sim, unitId, team = humanTeam(sim)) {
  const u = unitId >= 0 ? sim.units[unitId] : null;
  return u && u.alive && u.team === team && sim.controllers[team] === 'human' ? u : null;
}

/** Last point of the route, or the unit itself. */
export function routeTail(unit) {
  const r = unit.route;
  return r.length ? r[r.length - 1] : unit;
}

/** Index of the last user-placed waypoint, or -1. */
export function lastUserIndex(unit) {
  for (let i = unit.route.length - 1; i >= 0; i--) if (unit.route[i].user) return i;
  return -1;
}

/** Is any living unit already waiting for the GO code? */
export function anyWaitingGo(sim) {
  for (const u of sim.units) if (u.alive && u.waitingGo) return true;
  return false;
}

/** Does any living unit have a GO hold on its route (reached or not)? */
export function anyGoHold(sim) {
  for (const u of sim.units) {
    if (!u.alive) continue;
    for (const p of u.route) if (p.hold) return true;
  }
  return false;
}

export function inSiteA(sim, x, y) {
  const site = sim.world.zones.siteA;
  return !!site && pointInBox(x, y, site.box);
}

/** The living bomb carrier, or null. */
export function bombCarrier(sim) {
  const u = sim.bomb.carrierId >= 0 ? sim.units[sim.bomb.carrierId] : null;
  return u && u.alive ? u : null;
}

/** True when a "plant now" order would be accepted right now. */
export function canOrderPlant(sim) {
  const c = bombCarrier(sim);
  return !!c && !c.planting && inSiteA(sim, c.x, c.y);
}

/** Id of the named area (map `rooms`) containing a point, or null. */
export function roomAt(world, x, y) {
  for (const r of world.rooms) if (pointInBox(x, y, r.box)) return r.id;
  return null;
}

/** Nearest doorway (door or opening) within maxDist of a point, or null. */
export function doorwayNear(world, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const d of world.doorways) {
    const d2 = (d.cx - x) ** 2 + (d.cy - y) ** 2;
    if (d2 < bestD) {
      bestD = d2;
      best = d;
    }
  }
  return best;
}

/** Living units of a side that still have a GO hold ahead on their route (not yet waiting). */
export function holdsPending(sim, team = humanTeam(sim)) {
  let n = 0;
  for (const u of sim.teams[team]) {
    if (!u.alive || u.waitingGo) continue;
    for (const p of u.route) {
      if (p.hold) {
        n++;
        break;
      }
    }
  }
  return n;
}

/** Waiting for GO AND already turned to the angle set for that hold. */
export const isInPosition = (u) =>
  u.waitingGo && (u.lookOverride === null || Math.abs(angleDiff(u.facing, u.lookOverride)) <= MOVE.readyAngle);

/**
 * The synchronized entry is ready: someone waits for GO, nobody is still
 * walking to a hold, and every waiting operator already aims his angle.
 */
export function isGoReady(sim, team = humanTeam(sim)) {
  if (!anyWaitingGo(sim) || holdsPending(sim, team) > 0) return false;
  for (const u of sim.teams[team]) if (u.alive && u.waitingGo && !isInPosition(u)) return false;
  return true;
}
