// Door entries, Door Kickers style: an operator stacked on a waypoint next to
// a doorway is told HOW to go through it (waypoint.entry, set by the
// 'setEntry' order), and usually waits there for a GO code:
//
//   kick    on release the door bursts open (no pause to push it); loud, and
//           whoever stands right behind it reels for a moment
//   slow    on arrival the door is cracked ajar (sight gets through, bodies
//           do not) and he waits; on release he pushes it open and goes
//   flash   on release he opens the door, throws a flashbang inside and goes
//   frag    same with a fragmentation grenade
//   breach  on arrival he plants a charge on the door; on release it blows
//           the door away and hurts / stuns whoever is close behind it
//   cam     (the Explorador) on arrival he threads a fiber-optic camera under
//           the closed door and, while he waits, sees the room beyond it
//           (sim/queries.js peekEye); on release he opens it and goes
//
// Lifecycle (unit.entry): 'prep' (cracking / planting, cannot move) ->
// 'armed' (done; waits while waitingGo or goDelay) -> 'act' (opening,
// throwing, fuse) -> null. A GO that releases a thrower or a breacher holds
// the rest of that code (unit.goDelay) until the bang, so the room is
// entered right after it: "flash and clear". Everything here is
// deterministic (no RNG at all) and driven by orders: it works the same in
// real time and in We-Go turns.
import { ENTRY, COMBAT, WIRE } from '../config/balance.js';
import { EV } from '../core/events.js';
import { angleTo } from '../core/math.js';
import { rayCast } from '../core/geom.js';
import { solidLineOfSight } from './vision.js';
import { spawnSmoke } from './smoke.js';
import { spawnFire } from './fire.js';
import { spawnGas } from './gas.js';
import { openDoor, crackDoor, destroyDoor } from './doors.js';
import { alertAiUnit } from './ai.js';
import { applyBlast } from './combat.js';
import { isAiControlled, ENTRY_GEAR, tossLanding, tossDoorway, tossRangeOf } from './queries.js';

const LAND = { x: 0, y: 0, reach: 0, viaX: 0, viaY: 0, leg1: 0, leg2: 0 };
import { startBash, breakBarricade } from './barricades.js';
import { cutWiresNear } from './wires.js';
import { dcos, dhypot, dsin, sq } from '../core/dmath.js';

/** Seconds each mode works on arrival before it is armed (0 = armed at once). */
const PREP = Object.freeze({ slow: ENTRY.slow.prepTime, breach: ENTRY.breach.prepTime, cam: ENTRY.cam.prepTime });

/**
 * Called when a unit reaches a waypoint with a throw (waypoint.toss: {item,
 * x, y}): he turns to the target and, on the release (right away, or the GO
 * of the hold there), throws it there — a flash, a grenade or smoke. When the
 * point is at a door and the target beyond it (tossDoorway), he opens the
 * door first and throws through the doorway. Either way he stays put until
 * it goes off (step 'wait'), then follows his route.
 */
export function armToss(sim, u, p) {
  const t = p.toss;
  const k = tossDoorway(sim.world, p, t.x, t.y);
  const d = k >= 0 ? sim.world.doorways[k] : null;
  const look = d ? angleTo(u.x, u.y, d.cx, d.cy) : angleTo(u.x, u.y, t.x, t.y);
  const side = d ? farSide(d, u, u.route[0]) : 1;
  u.entry = { mode: 'toss', item: t.item, tx: t.x, ty: t.y, doorway: k, side, look, phase: 'armed', t: 0, spent: false, step: null, grenade: null };
}

/** Called when a unit reaches a waypoint carrying an entry (sim/movement.js arriveAt). */
export function armEntry(sim, u, p) {
  const k = p.entryDoor;
  const d = sim.world.doorways[k];
  if (!d) return;
  const side = farSide(d, u, u.route[0]);
  const door = doorOf(sim, k);
  // While stacked he aims through the doorway (unless the player set a look there);
  // cracking a door, through the gap it leaves at the latch side.
  let ax = d.cx;
  let ay = d.cy;
  if (p.entry === 'slow' && door && !door.open) {
    ax = door.def.hingeX + dcos(door.def.closedAngle) * door.def.length * 0.85;
    ay = door.def.hingeY + dsin(door.def.closedAngle) * door.def.length * 0.85;
  }
  const look = p.look !== null ? p.look : angleTo(u.x, u.y, ax + d.normalX * side * ENTRY.lookPast, ay + d.normalY * side * ENTRY.lookPast);
  const prep = (PREP[p.entry] || 0) * (p.entry === 'breach' ? u.mods.breachPrep : 1);
  u.entry = { mode: p.entry, doorway: k, side, look, phase: prep > 0 ? 'prep' : 'armed', t: prep, spent: false, step: null, grenade: null };
  if (p.entry === 'slow' && door) {
    crackDoor(sim, door, u);
    alertNear(sim, u, d.cx, d.cy, ENTRY.slow.hearing, false);
  } else if (p.entry === 'breach') {
    sim.emit(EV.CHARGE_PLANT, { unitId: u.id, doorId: d.id, x: d.cx, y: d.cy, time: prep });
  }
}

/** Cancels a pending entry (route cleared, defuse order, death). A thrown grenade still goes off. */
export function cancelEntry(u) {
  u.entry = null;
  u.goDelay = 0;
}

/**
 * Seconds a GO must hold the rest of its code because of this unit's armed
 * entry (thrower / breacher), 0 otherwise. Called by the GO order before release.
 */
export function releaseDelay(sim, u) {
  const e = u.entry;
  if (!e || e.phase === 'act') return 0;
  // A charge still being planted: the others wait for the plant AND the blast.
  if (e.mode === 'breach') return (e.phase === 'prep' ? e.t : 0) + ENTRY.breach.fuse + ENTRY.followGap;
  if (e.phase !== 'armed') return 0;
  const item = thrownItem(e);
  if (!item) return 0;
  if ((u.gear[item] || 0) <= 0) return 0;
  const g = throwPath(sim, u, e);
  return ENTRY.throwDelay + g.flight + ENTRY[item].fuse + ENTRY.followGap;
}

/** Blindness / daze recovery, the entry state machines, grenades in flight. Once per tick, before movement. */
export function updateEntries(sim, dt) {
  for (const u of sim.units) {
    if (!u.alive) continue;
    if (u.blind > 0) u.blind = Math.max(0, u.blind - dt);
    if (u.goDelay > 0 && !u.waitingGo) u.goDelay = Math.max(0, u.goDelay - dt);
    const e = u.entry;
    if (!e || u.bash) continue; // breaking a barricade first: the entry waits (sim/barricades.js)
    if (e.phase === 'prep') {
      e.t -= dt;
      if (e.t <= 0) finishPrep(sim, u, e);
    } else if (e.phase === 'armed') {
      if (!u.waitingGo && u.goDelay <= 0) release(sim, u, e);
    } else if (e.phase === 'act') {
      e.t -= dt;
      if (e.t <= 0) act(sim, u, e);
    }
  }
  updateGrenades(sim, dt);
}

function finishPrep(sim, u, e) {
  e.phase = 'armed';
  if (e.mode === 'cam') sim.emit(EV.FIBER_CAM, { unitId: u.id, doorId: sim.world.doorways[e.doorway].id, x: u.x, y: u.y });
  if (e.mode === 'breach') {
    if ((u.gear.breach || 0) <= 0) return reject(sim, u, e);
    u.gear.breach--;
    e.spent = true;
    sim.emit(EV.CHARGE_READY, { unitId: u.id, doorId: sim.world.doorways[e.doorway].id });
  }
}

/** The GO (or no hold at all): do the entry. */
function release(sim, u, e) {
  const d = sim.world.doorways[e.doorway];
  const door = e.doorway >= 0 ? doorOf(sim, e.doorway) : null;
  switch (e.mode) {
    case 'kick':
      if (door && !door.open) {
        openDoor(sim, door, u, 'kick'); // a barricade: he starts breaking it instead
        if (door.open) kickEffects(sim, u, d, e.side);
      }
      u.entry = null;
      return;
    case 'slow':
    case 'cam':
      u.entry = null; // the door is ajar / he pulls the camera back: his route through it opens it
      return;
    case 'toss':
      if ((u.gear[e.item] || 0) <= 0) return reject(sim, u, e);
      if (door && door.barricaded) return startBash(sim, door, u); // through a door: break it first, then throw
      if (door && !door.open) openDoor(sim, door, u, 'push');
      e.phase = 'act';
      e.step = 'throw';
      e.t = ENTRY.throwDelay;
      return;
    case 'flash':
    case 'frag':
      if ((u.gear[e.mode] || 0) <= 0) return reject(sim, u, e);
      if (door && door.barricaded) return startBash(sim, door, u); // break it first, then throw (still armed)
      if (door && !door.open) openDoor(sim, door, u, 'push');
      e.phase = 'act';
      e.step = 'throw';
      e.t = ENTRY.throwDelay;
      return;
    case 'breach':
      if (!e.spent) {
        u.entry = null;
        return;
      }
      e.phase = 'act';
      e.step = 'fire';
      e.t = ENTRY.breach.fuse;
      sim.emit(EV.CHARGE_FIRE, { unitId: u.id, doorId: d.id, x: d.cx, y: d.cy, fuse: ENTRY.breach.fuse });
      return;
    default:
      u.entry = null;
  }
}

function act(sim, u, e) {
  if (e.step === 'throw') {
    throwGrenade(sim, u, e);
    e.step = 'wait';
    e.t = e.grenade.flight + ENTRY[thrownItem(e)].fuse + ENTRY.followGap;
    return;
  }
  if (e.step === 'fire') detonateBreach(sim, u, e);
  u.entry = null; // 'wait' / 'fire' done: he follows his route through the doorway
}

function reject(sim, u, e) {
  sim.emit(EV.ORDER_REJECTED, { unitId: u.id, reason: 'noGear' });
  u.entry = null;
  return e;
}

// ------------------------------------------------------------ geometry

const doorOf = (sim, k) => (k < sim.doors.length ? sim.doors[k] : null);

/** Signed distance from the wall plane of a doorway. */
const across = (d, x, y) => (x - d.cx) * d.normalX + (y - d.cy) * d.normalY;

/**
 * +1 / -1: the side of the wall the room to enter is on — opposite to the
 * stacked unit; if he stands on the wall line, where his route goes next.
 */
function farSide(d, u, next) {
  const s = across(d, u.x, u.y);
  if (Math.abs(s) > 0.05) return s > 0 ? -1 : 1;
  if (next) {
    const n = across(d, next.x, next.y);
    if (Math.abs(n) > 0.05) return n > 0 ? 1 : -1;
  }
  return 1;
}

/**
 * Where a grenade thrown by u through the entry's doorway lands: through the
 * doorway center, ENTRY.throwDistance into the room (short of the first wall).
 * The cast starts past the slab of a cracked door. Pure: same answer at
 * release and at the throw.
 */
const path = { fromX: 0, fromY: 0, viaX: 0, viaY: 0, x: 0, y: 0, leg1: 0, leg2: 0, flight: 0 };

/** The item an entry throws: its mode for a door flash / grenade, the chosen one for a toss, else null. */
const thrownItem = (e) => (e.mode === 'toss' ? e.item : e.mode === 'flash' || e.mode === 'frag' ? e.mode : null);

function throwPath(sim, u, e) {
  if (e.mode === 'toss') return tossPath(sim, u, e);
  const d = sim.world.doorways[e.doorway];
  const nx = d.normalX * e.side;
  const ny = d.normalY * e.side;
  const start = 0.4;
  const ox = d.cx + nx * start;
  const oy = d.cy + ny * start;
  const w = sim.world;
  const hit = rayCast(w.segments, w.solidCount, ox, oy, nx, ny, ENTRY.throwDistance + ENTRY.wallMargin);
  const reach = Math.max(0, Math.min(ENTRY.throwDistance, hit - ENTRY.wallMargin));
  path.fromX = u.x;
  path.fromY = u.y;
  path.viaX = d.cx;
  path.viaY = d.cy;
  path.x = ox + nx * reach;
  path.y = oy + ny * reach;
  path.leg1 = dhypot(d.cx - u.x, d.cy - u.y);
  path.leg2 = dhypot(path.x - d.cx, path.y - d.cy);
  path.flight = (path.leg1 + path.leg2) / ENTRY.throwSpeed;
  return path;
}

/**
 * A toss to the point the player picked: straight from the thrower, at most
 * his throwing range (tossRangeOf) away and short of the first wall on the way (ENTRY.wallMargin),
 * through the doorway of the point when it was armed at a door (armToss).
 */
function tossPath(sim, u, e) {
  const land = tossLanding(sim.world, u.x, u.y, e.tx, e.ty, LAND, e.doorway, tossRangeOf(u));
  path.fromX = u.x;
  path.fromY = u.y;
  path.x = land.x;
  path.y = land.y;
  path.viaX = land.viaX;
  path.viaY = land.viaY;
  path.leg1 = land.leg1;
  path.leg2 = land.leg2;
  path.flight = land.reach / ENTRY.throwSpeed;
  return path;
}

// ------------------------------------------------------------ grenades

function throwGrenade(sim, u, e) {
  const p = throwPath(sim, u, e);
  const item = thrownItem(e);
  u.gear[item]--;
  e.spent = true;
  const g = {
    id: sim.grenadeSeq++,
    kind: item,
    ownerId: u.id,
    team: u.team,
    fromX: p.fromX,
    fromY: p.fromY,
    viaX: p.viaX,
    viaY: p.viaY,
    x: p.x,
    y: p.y,
    leg1: p.leg1,
    leg2: p.leg2,
    flight: p.flight,
    fuse: p.flight + ENTRY[item].fuse, // from the throw
    age: 0,
    // Thrown through a doorway: the thrower and whoever stacks with him are behind the frame.
    cover: e.doorway >= 0 && e.mode === 'toss' ? { d: sim.world.doorways[e.doorway], side: e.side } : null,
  };
  e.grenade = g;
  sim.grenades.push(g);
  sim.emit(EV.GRENADE_THROWN, { id: g.id, kind: g.kind, unitId: u.id, x: g.fromX, y: g.fromY, viaX: g.viaX, viaY: g.viaY, toX: g.x, toY: g.y, flight: g.flight });
}

function updateGrenades(sim, dt) {
  const list = sim.grenades;
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const g = list[i];
    g.age += dt;
    if (g.age >= g.fuse) detonate(sim, g);
    else list[n++] = g;
  }
  list.length = n;
}

function detonate(sim, g) {
  const owner = sim.units[g.ownerId];
  sim.emit(EV.GRENADE_DETONATE, { id: g.id, kind: g.kind, unitId: g.ownerId, x: g.x, y: g.y });
  if (g.kind === 'flash') flashAt(sim, g);
  else if (g.kind === 'smoke') spawnSmoke(sim, g.x, g.y);
  else if (g.kind === 'molotov') spawnFire(sim, g.x, g.y, owner);
  else if (g.kind === 'gas') spawnGas(sim, g.x, g.y, owner);
  else {
    blastAt(sim, g.x, g.y, ENTRY.frag.radius, ENTRY.frag.damage, ENTRY.frag.minDamage, 0, owner, g.cover);
    cutWiresNear(sim, g.x, g.y, WIRE.fragCut, owner); // barbed wire (sim/wires.js)
  }
  alertNear(sim, owner, g.x, g.y, ENTRY[g.kind].hearing, true);
}

/**
 * Flashbang: everyone within range with a line of sight to it is blinded
 * (perception sees nothing, no target, no shots), longer the closer and the
 * more he looked at it. Teammates too: do not stand in the doorway. Only the
 * thrower and the allies holding for this bang (goDelay) are ready for it:
 * they turn away behind the frame and are not blinded.
 */
function flashAt(sim, g) {
  const F = ENTRY.flash;
  const { x, y } = g;
  for (const o of sim.units) {
    if (!o.alive) continue;
    if (o.id === g.ownerId || (o.team === g.team && o.goDelay > 0)) continue;
    const dist = dhypot(o.x - x, o.y - y);
    if (dist > F.radius || !solidLineOfSight(sim.world, x, y, o.x, o.y)) continue;
    const toward = dcos(angleTo(o.x, o.y, x, y) - o.facing); // 1 = staring at it
    const look = F.awayFactor + (1 - F.awayFactor) * Math.max(0, toward);
    const seconds = F.blind * look * (0.4 + 0.6 * (1 - dist / F.radius));
    if (seconds < F.minBlind) continue;
    blind(sim, o, seconds, 'flash', x, y);
  }
}

/**
 * Explosion at (x, y): damage falling off linearly to 0 at `radius`, only
 * through a line of sight (walls and closed doors stop it). `plane` ({d, side})
 * restricts it to one side of a doorway (breach charge). Optional blindness
 * and stun (frozen where he stands).
 */
function blastAt(sim, x, y, radius, damage, minDamage, blindSeconds, owner, plane, stunSeconds = 0) {
  for (const o of sim.units) {
    if (!o.alive) continue;
    const dist = dhypot(o.x - x, o.y - y);
    if (dist > radius) continue;
    if (plane && across(plane.d, o.x, o.y) * plane.side <= 0) continue;
    if (!solidLineOfSight(sim.world, x, y, o.x, o.y)) continue;
    const k = 1 - dist / radius;
    if (blindSeconds > 0) blind(sim, o, blindSeconds * (0.5 + 0.5 * k), 'blast', x, y);
    if (stunSeconds > 0) o.stun = Math.max(o.stun, stunSeconds * (0.5 + 0.5 * k));
    const dmg = damage * k;
    if (dmg >= minDamage) applyBlast(sim, owner, o, dmg, x, y);
  }
}

function detonateBreach(sim, u, e) {
  const B = ENTRY.breach;
  const d = sim.world.doorways[e.doorway];
  const door = doorOf(sim, e.doorway);
  if (door && door.barricaded) breakBarricade(sim, door, u, 'breach');
  else if (door) destroyDoor(sim, door);
  cutWiresNear(sim, d.cx, d.cy, ENTRY.breach.radius, u);
  const x = d.cx + d.normalX * e.side * B.depth;
  const y = d.cy + d.normalY * e.side * B.depth;
  sim.emit(EV.CHARGE_BLAST, { unitId: u.id, doorId: d.id, x: d.cx, y: d.cy, dirX: d.normalX * e.side, dirY: d.normalY * e.side });
  blastAt(sim, x, y, B.radius, B.damage, 1, B.blind, u, { d, side: e.side }, B.stun * u.mods.breachStun);
  if (u.mods.breachConcussion > 1) concussion(sim, u, x, y, { d, side: e.side });
  alertNear(sim, u, d.cx, d.cy, B.hearing, true);
}

/**
 * The Brecha's shaped charge (modifiers.breachConcussion > 1): its overpressure
 * fills the room beyond the door. Whoever is on that side, with no wall between
 * him and the blast, out to B.radius × breachConcussion, is left reeling for
 * ENTRY.breach.concussion s (less the farther he is): he loses his aim and his
 * target (blind: the flash's rule) and cannot move. Who waits behind a door for
 * it to open is the one it catches: the Ancla on his barrier first of all.
 */
function concussion(sim, u, x, y, plane) {
  const B = ENTRY.breach;
  const reach = B.radius * u.mods.breachConcussion;
  for (const o of sim.units) {
    if (!o.alive || o.team === u.team) continue;
    const dist = dhypot(o.x - x, o.y - y);
    if (dist > reach || across(plane.d, o.x, o.y) * plane.side <= 0) continue;
    if (!solidLineOfSight(sim.world, x, y, o.x, o.y)) continue;
    const s = B.concussion * (1 - 0.5 * (dist / reach));
    if (o.blind < s) blind(sim, o, s, 'blast', x, y);
    o.stun = Math.max(o.stun, s);
  }
}

/** A kicked door: loud, and enemies right behind it reel (blind + frozen) for an instant. */
function kickEffects(sim, u, d, side) {
  const K = ENTRY.kick;
  for (const o of sim.units) {
    if (!o.alive || o.team === u.team) continue;
    if (across(d, o.x, o.y) * side <= 0 || dhypot(o.x - d.cx, o.y - d.cy) > K.dazeRadius) continue;
    blind(sim, o, K.daze, 'kick', d.cx, d.cy);
    o.stun = Math.max(o.stun, K.daze);
  }
  alertNear(sim, u, d.cx, d.cy, K.hearing, true);
}

function blind(sim, o, seconds, cause, x, y) {
  o.blind = Math.max(o.blind, seconds);
  o.target = -1;
  sim.emit(EV.BLINDED, { unitId: o.id, team: o.team, seconds, cause, x: o.x, y: o.y });
  if (isAiControlled(sim, o)) alertAiUnit(o, x, y, COMBAT.alertDuration + seconds, true);
}

/** Noise: AI units of the other side within `radius` turn to it (`loud`: like gunfire, triggers rotations). */
function alertNear(sim, u, x, y, radius, loud) {
  const r2 = radius * radius;
  for (const o of sim.units) {
    if (!o.alive || (u && o.team === u.team) || !isAiControlled(sim, o)) continue;
    if (sq(o.x - x) + sq(o.y - y) <= r2) alertAiUnit(o, x, y, COMBAT.alertDuration, loud);
  }
}
