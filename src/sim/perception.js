// Who sees whom this tick, target acquisition and reaction times.
import { COMBAT, ENTRY, MONITOR, CALLOUT, NIGHT } from '../config/balance.js';
import { angleDiff, angleTo } from '../core/math.js';
import { canSee } from './vision.js';
import { EV } from '../core/events.js';
import { peekEye, isMonitoring, isAiControlled, isDark } from './queries.js';
import { alertAiUnit } from './ai.js';
import { rememberSeen } from './view.js';
import { camSeesTraps } from './traps.js';
import { dhypot, sq } from '../core/dmath.js';
import { stressReaction } from './stress.js';

export function updatePerception(sim) {
  const { units, world } = sim;
  for (const u of units) {
    u.monitor = isMonitoring(u);
    u.vision = impairedVision(u);
    u.visibleEnemies.length = 0;
    u.seenByEnemyPrev = u.seenByEnemy;
    u.seenByEnemy = false;
  }

  for (const viewer of units) {
    if (!viewer.alive || viewer.blind > 0) continue; // flashed: sees nothing
    const cfg = viewer.vision; // VISION[team], scaled by the role
    for (const other of units) {
      if (!other.alive || other.team === viewer.team) continue;
      if (canSee(world, viewer, other.x, other.y, cfg) && litFor(sim, viewer, other)) {
        viewer.visibleEnemies.push(other.id);
        other.seenByEnemy = true;
      }
    }
  }

  // Looking under a closed door with a mirror or the fiber-optic camera:
  // whoever is in view is revealed to his side (shown, spotted, remembered),
  // but he does not target him — the door is still shut. A mirror can be
  // seen from the room: its glint gives him away (mirrorGlint).
  for (const viewer of units) {
    if (viewer.blind > 0 || !peekEye(sim, viewer, eye)) continue;
    for (const other of units) {
      if (!other.alive || other.team === viewer.team || !canSee(world, eye, other.x, other.y, eye)) continue;
      other.seenByEnemy = true;
      rememberSeen(sim, viewer.team, other);
    }
    if (viewer.entry.mode === 'cam') {
      camSeesTraps(sim, eye);
      callOut(sim, viewer);
    } else mirrorGlint(sim, viewer);
  }

  for (const u of units) {
    if (u.alive && u.seenByEnemy && !u.seenByEnemyPrev) {
      sim.emit(EV.SPOTTED, { unitId: u.id, team: u.team, x: u.x, y: u.y });
    }
    if (u.alive) selectTarget(sim, u);
  }
}

const eye = { x: 0, y: 0, facing: 0, fov: 0, range: 0 };

/**
 * Night (NIGHT): can `v`, who has a line of sight to `o`, make him out? Always, unless `o` stands
 * in a dark room with his flashlight off; then only up close or inside the cone of v's flashlight.
 */
function litFor(sim, v, o) {
  if (o.light || !isDark(sim, o.x, o.y)) return true;
  const d2 = sq(o.x - v.x) + sq(o.y - v.y);
  if (d2 <= NIGHT.range * NIGHT.range) return true;
  const L = NIGHT.light;
  return v.light && d2 <= L.range * L.range && Math.abs(angleDiff(v.facing, angleTo(v.x, v.y, o.x, o.y))) <= L.fov / 2;
}

/**
 * A mirror under a door (`eye`: its spot) in the sight of an enemy in the room glints: his side
 * learns someone is at that door (remembered there, an AI defender alerted to it) and, after
 * ENTRY.mirror.breakTime s in his sight, he shoots it to pieces — the operator has no mirror for
 * the rest of the round. Out of sight, the count runs back down.
 */
function mirrorGlint(sim, u) {
  const e = u.entry;
  const M = ENTRY.mirror;
  let by = null;
  for (const o of sim.teams[u.team === 'attackers' ? 'defenders' : 'attackers']) {
    if (o.alive && o.blind <= 0 && canSee(sim.world, o, eye.x, eye.y, o.vision)) {
      by = o;
      break;
    }
  }
  if (!by) {
    e.glint = Math.max(0, e.glint - sim.dt);
    return;
  }
  if (e.glint === 0) {
    sim.emit(EV.MIRROR_SEEN, { unitId: u.id, byId: by.id, team: by.team, x: eye.x, y: eye.y });
    if (isAiControlled(sim, by)) alertAiUnit(by, eye.x, eye.y, M.glintMemory, false);
  }
  rememberSeen(sim, by.team, u);
  e.glint += sim.dt;
  if (e.glint < M.breakTime) return;
  u.mirror = false;
  sim.emit(EV.MIRROR_BROKEN, { unitId: u.id, byId: by.id, team: u.team, x: eye.x, y: eye.y, fromX: by.x, fromY: by.y });
}

/**
 * The Explorador under the door calls out what his fiber-optic camera shows
 * ("one, left corner, by the desk"): he and every teammate stacked on that
 * doorway (within CALLOUT.stack m of it, on his side) keep the nearest enemy
 * in view as a known target (lastKnown, CALLOUT.memory s after the last
 * sight): they aim at him through the closed door and, on the GO, walk in
 * with the muzzle already on him (the focus cone of the duel rule), alerted.
 * Without the camera they would come in aiming at the middle of the room.
 */
function callOut(sim, viewer) {
  const d = sim.world.doorways[viewer.entry.doorway];
  let best = null;
  let bestD = Infinity;
  for (const o of sim.teams[viewer.team === 'attackers' ? 'defenders' : 'attackers']) {
    if (!o.alive || !canSee(sim.world, eye, o.x, o.y, eye)) continue;
    const d2 = sq(o.x - d.cx) + sq(o.y - d.cy);
    if (d2 < bestD) {
      bestD = d2;
      best = o;
    }
  }
  if (!best) return;
  const side = Math.sign((viewer.x - d.cx) * d.normalX + (viewer.y - d.cy) * d.normalY);
  const r2 = CALLOUT.stack * CALLOUT.stack;
  const until = sim.time + CALLOUT.memory;
  for (const t of sim.teams[viewer.team]) {
    if (!t.alive || t.target >= 0 || sq(t.x - d.cx) + sq(t.y - d.cy) > r2) continue;
    if (Math.sign((t.x - d.cx) * d.normalX + (t.y - d.cy) * d.normalY) !== side) continue;
    if (!t.lastKnown) t.lastKnown = { x: best.x, y: best.y, until };
    else {
      t.lastKnown.x = best.x;
      t.lastKnown.y = best.y;
      t.lastKnown.until = until;
    }
  }
}

/**
 * What a unit can see with right now: his class's vision, cut short by tear
 * gas (ENTRY.gas.vision) or narrowed to a glance while a Vigía looks at his
 * monitor (MONITOR.fov). u.vision is what perception and the fog of war use.
 */
function impairedVision(u) {
  const base = u.roleVision;
  if (u.gassed <= 0 && !u.monitor) return base;
  const fov = u.monitor ? base.fov * MONITOR.fov : base.fov;
  const range = u.gassed > 0 ? Math.min(base.range, ENTRY.gas.vision) : base.range;
  const v = u.visionScratch || (u.visionScratch = { fov, range });
  v.fov = fov;
  v.range = range;
  return v;
}

function selectTarget(sim, u) {
  const current = u.target >= 0 ? sim.units[u.target] : null;
  if (current && current.alive && u.visibleEnemies.includes(current.id)) {
    remember(sim, u, current);
    return;
  }
  if (current && current.alive) remember(sim, u, current); // lost sight: remember where they were
  else if (current && u.lastKnown) u.lastKnown.until = 0; // target down: stop staring at the body
  u.target = -1;
  // Prefer the enemy that is closest AND needs the least turning.
  let best = -1;
  let bestScore = Infinity;
  for (const id of u.visibleEnemies) {
    const e = sim.units[id];
    const off = Math.abs(angleDiff(u.facing, angleTo(u.x, u.y, e.x, e.y)));
    const score = dhypot(e.x - u.x, e.y - u.y) + off * COMBAT.targetTurnCost;
    if (score < bestScore) {
      bestScore = score;
      best = id;
    }
  }
  if (best < 0) return;
  const e = sim.units[best];
  u.target = best;
  u.reaction = reactionTime(sim, u, e);
  u.burstPause = 0;
}

/**
 * Time before the first shot at a newly seen enemy — the same rules for both
 * sides: the posture decides. Whoever already aims at the angle wins the
 * duel: inside the focus cone the base is cut by COMBAT.focusFactor, and by
 * COMBAT.holdFactor too if he has held it still (COMBAT.holdTime); outside it
 * every radian to turn costs time, and so does walking. Having just come
 * through a doorway costs a moment (the Asaltante, cutting the angle, is
 * sharper instead); an alerted unit is a bit sharper. Class modifiers, tear
 * gas and a Vigía's monitor scale the result.
 */
function reactionTime(sim, u, e) {
  const off = Math.abs(angleDiff(u.facing, angleTo(u.x, u.y, e.x, e.y)));
  const focused = off <= COMBAT.focusAngle;
  u.focused = focused;
  let r = COMBAT.reaction * (focused ? COMBAT.focusFactor : 1);
  if (focused && !u.moving && u.stillTime >= COMBAT.holdTime) r *= COMBAT.holdFactor;
  r += sim.rng.next() * COMBAT.reactionJitter;
  if (!focused) {
    r += (off - COMBAT.focusAngle) * COMBAT.reactionPerRadian;
    if (u.moving) r += COMBAT.movingReaction;
  }
  if (focused && !u.moving && u.stillTime >= COMBAT.holdTime) r *= u.mods.holdReaction; // a marksman on his angle
  if (sq(e.x - u.x) + sq(e.y - u.y) < sq(COMBAT.closeRange)) r *= u.mods.closeReaction; // the Escopetero, point blank
  // Through a doorway: a moment lost, unless he cuts the angle as he goes in (the Asaltante) or has
  // just cleared the room's angles from the frame ("despejar por cortes": sharper, the better of the two).
  if (sim.time < u.pieUntil) r *= Math.min(ENTRY.pie.reaction, u.mods.doorwayReaction);
  else if (sim.time - u.doorwayAt < COMBAT.doorwayTime) r = u.mods.doorwayReaction < 1 ? r * u.mods.doorwayReaction : r + COMBAT.doorwayPenalty;
  if (u.alertTimer > 0 || (u.lastKnown && u.lastKnown.until > sim.time)) r *= COMBAT.alertFactor;
  if (u.gassed > 0) r *= ENTRY.gas.reaction; // tear gas (sim/gas.js)
  r *= stressReaction(u); // suppression (sim/stress.js)
  return r * u.mods.reaction * (u.monitor ? MONITOR.reaction : 1); // a Vigía looking at his monitor (sim/cameras.js)
}

/** Updates the unit's memory of where its target was (in place: runs every tick). */
function remember(sim, u, target) {
  const until = sim.time + COMBAT.lostTargetMemory;
  if (!u.lastKnown) u.lastKnown = { x: target.x, y: target.y, until };
  else {
    u.lastKnown.x = target.x;
    u.lastKnown.y = target.y;
    u.lastKnown.until = until;
  }
}
