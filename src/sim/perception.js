// Who sees whom this tick, target acquisition and reaction times.
import { VISION, COMBAT } from '../config/balance.js';
import { angleDiff, angleTo } from '../core/math.js';
import { canSee } from './vision.js';
import { EV } from '../core/events.js';
import { isAiControlled } from './queries.js';

export function updatePerception(sim) {
  const { units, world } = sim;
  for (const u of units) {
    u.visibleEnemies.length = 0;
    u.seenByEnemyPrev = u.seenByEnemy;
    u.seenByEnemy = false;
  }

  for (const viewer of units) {
    if (!viewer.alive) continue;
    const cfg = viewer.vision; // VISION[team], scaled by the role
    for (const other of units) {
      if (!other.alive || other.team === viewer.team) continue;
      if (canSee(world, viewer, other.x, other.y, cfg)) {
        viewer.visibleEnemies.push(other.id);
        other.seenByEnemy = true;
      }
    }
  }

  for (const u of units) {
    if (u.alive && u.seenByEnemy && !u.seenByEnemyPrev) {
      sim.emit(EV.SPOTTED, { unitId: u.id, team: u.team, x: u.x, y: u.y });
    }
    if (u.alive) selectTarget(sim, u);
  }
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
 * Time before the first shot at a newly seen enemy. Whoever already aims at
 * the angle wins the duel: inside the focus cone the base is cut by
 * COMBAT.focusFactor; outside it every radian to turn costs time, and so
 * does walking. An alerted AI unit is a bit sharper.
 */
function reactionTime(sim, u, e) {
  const off = Math.abs(angleDiff(u.facing, angleTo(u.x, u.y, e.x, e.y)));
  const focused = off <= COMBAT.focusAngle;
  u.focused = focused;
  let r = COMBAT.reaction[u.team] * (focused ? COMBAT.focusFactor : 1);
  r += sim.rng.next() * COMBAT.reactionJitter;
  if (!focused) {
    r += (off - COMBAT.focusAngle) * COMBAT.reactionPerRadian;
    if (u.moving) r += COMBAT.movingReaction;
  }
  if (isAiControlled(sim, u) && (u.alertTimer > 0 || (u.lastKnown && u.lastKnown.until > sim.time))) r *= COMBAT.alertFactor;
  return r * u.mods.reaction;
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
