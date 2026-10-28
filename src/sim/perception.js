// Who sees whom this tick, target acquisition and reaction times.
import { COMBAT, ENTRY, MONITOR } from '../config/balance.js';
import { angleDiff, angleTo } from '../core/math.js';
import { canSee } from './vision.js';
import { EV } from '../core/events.js';
import { peekEye, isMonitoring } from './queries.js';
import { rememberSeen } from './view.js';
import { camSeesTraps } from './traps.js';

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
      if (canSee(world, viewer, other.x, other.y, cfg)) {
        viewer.visibleEnemies.push(other.id);
        other.seenByEnemy = true;
      }
    }
  }

  // Peeking through a door cracked ajar, or under it with the fiber-optic
  // camera: whoever is in view is revealed to his side (shown, spotted,
  // remembered), but he does not target him — the door is still shut.
  for (const viewer of units) {
    if (viewer.blind > 0 || !peekEye(sim, viewer, eye)) continue;
    for (const other of units) {
      if (!other.alive || other.team === viewer.team || !canSee(world, eye, other.x, other.y, eye)) continue;
      other.seenByEnemy = true;
      rememberSeen(sim, viewer.team, other);
    }
    if (viewer.entry.mode === 'cam') camSeesTraps(sim, eye);
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
    const score = Math.hypot(e.x - u.x, e.y - u.y) + off * COMBAT.targetTurnCost;
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
  if ((e.x - u.x) ** 2 + (e.y - u.y) ** 2 < COMBAT.closeRange ** 2) r *= u.mods.closeReaction; // the Escopetero, point blank
  // Through a doorway: a moment lost, unless he cuts the angle as he goes in (the Asaltante).
  if (sim.time - u.doorwayAt < COMBAT.doorwayTime) r = u.mods.doorwayReaction < 1 ? r * u.mods.doorwayReaction : r + COMBAT.doorwayPenalty;
  if (u.alertTimer > 0 || (u.lastKnown && u.lastKnown.until > sim.time)) r *= COMBAT.alertFactor;
  if (u.gassed > 0) r *= ENTRY.gas.reaction; // tear gas (sim/gas.js)
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
