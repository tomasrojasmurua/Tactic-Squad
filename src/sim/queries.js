// Read-only questions about the simulation state, shared by the sim systems
// and by the presentation layers (input previews, HUD, touch bar). Pure
// functions: they never mutate the state, allocate nothing per call, and are
// the ONLY sim helpers that input/ui/render may import besides vision.js.
import { pointInBox, pointAabbDistance, pointSegDist2, rayCast } from '../core/geom.js';
import { angleDiff } from '../core/math.js';
import { MOVE, ROUND, ENTRY, DOORS } from '../config/balance.js';
import { PROP_SURFACE, SURFACE_PROBE, DOOR_SURFACE, FENCE_SURFACE } from '../config/materials.js';
import { TEAMS } from '../config/squad.js';

/** The opposing side of a team. */
export const enemyTeam = (team) => (team === TEAMS[0] ? TEAMS[1] : TEAMS[0]);

/**
 * Is this unit run by the sim's unit AI (sim/ai.js: watch behaviors, ears,
 * reflexes)? Only the defenders of an AI side: an AI attacking side is a
 * commander (sim/aiAttack.js) that gives its operators a player's orders.
 */
export const isAiControlled = (sim, u) => u.team === 'defenders' && sim.controllers.defenders === 'ai';

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
    if (d.destroyed) continue;
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

/** Bomb defuse progress 0..1 while someone works on it, else -1. */
export const defuseProgress = (sim) => (sim.bomb.defuserId >= 0 ? sim.bomb.progress : -1);

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

/** Id of the bomb site ('A' | 'B') containing a point, or null. */
export function siteAt(sim, x, y) {
  for (const s of sim.compiled.sites) if (pointInBox(x, y, s.box)) return s.id;
  return null;
}

/** Does this side know where the bomb is? The defenders placed it; the attackers must find it. */
export const bombKnownTo = (sim, team) => team === 'defenders' || sim.bomb.spotted || !!sim.outcome;

/** Within defuse reach of the bomb (ROUND.defuseRadius). */
export function nearBomb(sim, u) {
  const b = sim.bomb;
  return (u.x - b.x) ** 2 + (u.y - b.y) ** 2 <= ROUND.defuseRadius * ROUND.defuseRadius;
}

/**
 * The attacker a "defuse now" order would put on the bomb: the given unit,
 * else the closest living one in reach; null when the bomb is not found yet,
 * already defused or nobody is next to it.
 */
export function defuseCandidate(sim, unitId = -1) {
  const b = sim.bomb;
  if (!b.spotted || b.defused) return null;
  const given = unitId >= 0 ? sim.units[unitId] : null;
  if (given) return given.alive && given.team === 'attackers' && nearBomb(sim, given) ? given : null;
  let best = null;
  let bestD = Infinity;
  for (const u of sim.teams.attackers) {
    if (!u.alive || !nearBomb(sim, u)) continue;
    const d = (u.x - b.x) ** 2 + (u.y - b.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

/** True when a "defuse now" order would put someone new on the bomb right now. */
export function canOrderDefuse(sim) {
  const u = defuseCandidate(sim);
  return !!u && !u.defusing && controllableUnit(sim, u.id, 'attackers') !== null;
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

/**
 * Waiting for GO, done preparing his entry (door cracked, charge planted)
 * AND already turned to the angle set for that hold.
 */
export function isInPosition(u) {
  if (!u.waitingGo || (u.entry && u.entry.phase !== 'armed')) return false;
  const look = u.entry && u.entry.look !== null ? u.entry.look : u.lookOverride;
  return look === null || Math.abs(angleDiff(u.facing, look)) <= MOVE.readyAngle;
}

/**
 * The synchronized entry is ready: someone waits for GO (with `code`, or
 * any), nobody is still walking to a hold of that code, and every operator
 * waiting for it is in position.
 */
export function isGoReady(sim, team = humanTeam(sim), code = null) {
  let waiting = false;
  for (const u of sim.teams[team]) {
    if (!u.alive) continue;
    if (u.waitingGo) {
      if (code && u.waitCode !== code) continue;
      if (!isInPosition(u)) return false;
      waiting = true;
    } else if (holdAhead(u, code)) return false;
  }
  return waiting;
}

/** A GO group of the side: how many are waiting in position for `code`, of everyone who holds for it (waiting or on the way). */
export function goStatus(sim, team, code) {
  let ready = 0;
  let total = 0;
  for (const u of sim.teams[team]) {
    if (!u.alive) continue;
    if (u.waitingGo) {
      if (u.waitCode !== code) continue;
      total++;
      if (isInPosition(u)) ready++;
    } else if (holdAhead(u, code)) total++;
  }
  return { ready, total };
}

/** Does the unit still have a GO hold (with `code`, or any) ahead on its route? */
function holdAhead(u, code) {
  for (const p of u.route) if (p.hold && (!code || holdCode(p) === code)) return true;
  return false;
}

/** GO code of a hold waypoint (old plans without one wait for the first code). */
export const holdCode = (p) => p.code || ENTRY.goCodes[0];

/** unit.waitCode of an operator stopped at a "?" door point (no GO releases it: a decision does). */
export const ASK_CODE = '?';

/** "?" door points of the side still undecided (operators already stopped at one included). */
export function pendingDoors(sim, team) {
  let n = 0;
  for (const u of sim.teams[team]) if (u.alive) for (const p of u.route) if (p.ask) n++;
  return n;
}

/** Is someone of the side waiting for this GO code? */
export function codeWaiting(sim, team, code) {
  for (const u of sim.teams[team]) if (u.alive && u.waitingGo && u.waitCode === code) return true;
  return false;
}

/** Is this GO code in use by the side (someone waits for it or has a hold of it ahead)? */
export function codeInUse(sim, team, code) {
  for (const u of sim.teams[team]) if (u.alive && ((u.waitingGo && u.waitCode === code) || holdAhead(u, code))) return true;
  return false;
}

/** The code a plain GO releases: the first one (A, B, C) someone of the side waits for, or null. */
export function nextGoCode(sim, team = humanTeam(sim)) {
  for (const c of ENTRY.goCodes) if (codeWaiting(sim, team, c)) return c;
  return null;
}

// ------------------------------------------------------------ door entries (sim/entries.js)

/** Which piece of gear an entry mode spends (config/operators.js gear), or null. */
export const ENTRY_GEAR = Object.freeze({ kick: null, slow: null, flash: 'flash', frag: 'frag', breach: 'breach' });

/** Index (world.doorways) of the doorway a waypoint at (x, y) can enter through, or -1. */
export function entryDoorwayAt(world, x, y) {
  let best = -1;
  let bestD = ENTRY.doorRange * ENTRY.doorRange;
  const ds = world.doorways;
  for (let i = 0; i < ds.length; i++) {
    const d2 = (ds[i].cx - x) ** 2 + (ds[i].cy - y) ** 2;
    if (d2 < bestD) {
      bestD = d2;
      best = i;
    }
  }
  return best;
}

/** May this mode be used through doorway k? Kick / slow / breach need a door still standing. */
export function entryModeFits(sim, k, mode) {
  if (k < 0 || !ENTRY.modes.includes(mode)) return false;
  if (mode === 'flash' || mode === 'frag') return true;
  const door = k < sim.doors.length ? sim.doors[k] : null;
  return !!door && !door.destroyed && (mode === 'breach' || !door.open);
}

/**
 * How many of a gear item the unit has left for NEW orders: what he carries
 * minus what his route (except waypoint `skip`) and his pending entry will spend.
 */
export function gearLeft(u, item, skip = -1) {
  let n = u.gear[item] || 0;
  for (let i = 0; i < u.route.length; i++) {
    if (i === skip) continue;
    const p = u.route[i];
    if (p.entry && ENTRY_GEAR[p.entry] === item) n--;
    if (p.toss && p.toss.item === item) n--;
  }
  const e = u.entry;
  if (e && !e.spent && (e.mode === 'toss' ? e.item : ENTRY_GEAR[e.mode]) === item) n--;
  return n;
}

/**
 * The eye of an operator looking through a door he cracked ajar ("entreabrir"):
 * on the doorway's center line just past the cracked slab, facing into the
 * room (a head poked through the gap: a real 30° gap shows almost nothing). Writes {x, y, facing} into `out`;
 * false when he is not peeking (door still swinging, opened, or no such entry).
 */
export function peekEye(sim, u, out) {
  const e = u.entry;
  if (!u.alive || !e || e.mode !== 'slow' || e.phase !== 'armed' || e.doorway >= sim.doors.length) return false;
  const door = sim.doors[e.doorway];
  if (!door.cracked || door.angle !== door.target) return false;
  const d = sim.world.doorways[e.doorway];
  const depth = (d.length / 2) * Math.tan(DOORS.crackAngle) + ENTRY.slow.peekDepth;
  out.x = d.cx + d.normalX * e.side * depth;
  out.y = d.cy + d.normalY * e.side * depth;
  out.facing = Math.atan2(d.normalY * e.side, d.normalX * e.side);
  return true;
}

/** Position of a thrown grenade `age` seconds after the throw (2D; its height is presentation). */
export function grenadeAt(g, age, out) {
  const k = Math.min(1, age / g.flight);
  const l1 = g.leg1;
  const along = k * (l1 + g.leg2);
  if (along <= l1) {
    const f = l1 > 1e-6 ? along / l1 : 1;
    out.x = g.fromX + (g.viaX - g.fromX) * f;
    out.y = g.fromY + (g.viaY - g.fromY) * f;
  } else {
    const f = g.leg2 > 1e-6 ? (along - l1) / g.leg2 : 1;
    out.x = g.viaX + (g.x - g.viaX) * f;
    out.y = g.viaY + (g.y - g.viaY) * f;
  }
  out.k = k;
  return out;
}

/**
 * Where a throw from (x, y) toward (tx, ty) lands: at most ENTRY.tossRange
 * away and short of the first wall / closed door on the way (ENTRY.wallMargin).
 * Writes {x, y, reach} into `out`. Shared by the sim (entries.js) and the plan preview.
 */
export function tossLanding(world, x, y, tx, ty, out = {}) {
  const dx = tx - x;
  const dy = ty - y;
  const len = Math.hypot(dx, dy) || 1;
  const want = Math.min(len, ENTRY.tossRange);
  const nx = dx / len;
  const ny = dy / len;
  const hit = rayCast(world.segments, world.solidCount, x, y, nx, ny, want + ENTRY.wallMargin);
  const reach = Math.max(0, Math.min(want, hit - ENTRY.wallMargin));
  out.x = x + nx * reach;
  out.y = y + ny * reach;
  out.reach = reach;
  return out;
}
