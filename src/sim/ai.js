// Defender behaviors: hold an angle, scan between two angles, or patrol.
// Engagement itself is shared with the player squad (perception + combat);
// this module only decides where an idle defender looks and walks.
//
// Alerts (gunfire, pain, footsteps heard nearby) make a defender stop and
// hold the angle the threat must come through: the first corner or doorway
// on the walking path toward the noise — not the noise itself, which is
// usually behind a wall. This is what makes them dangerous rather than
// random: they pre-aim the entry the attackers have to use. Defenders of a
// side the AI commands also throw their utility there (AI_UTILITY): a grenade
// into the doorway before the attackers come through it, or smoke to shut it.
import { TAU, angleTo } from '../core/math.js';
import { AI, AI_UTILITY, COMBAT, ENTRY, NAV, MOVE } from '../config/balance.js';
import { lineOfSight } from './vision.js';
import { enemyTeam } from './queries.js';

/** One AI-controlled unit (any side whose controller is 'ai'). */
export function updateAiUnit(sim, u, dt) {
  listenForFootsteps(sim, u);
  if (u.alertTimer > 0 && u.target < 0) {
    updateWatchPoint(sim, u, dt);
    throwAtWatchPoint(sim, u);
  }

  const b = u.behavior;
  if (!b) return;
  if (u.ai.rotating) return updateRotation(sim, u);
  const busy = u.target >= 0 || u.alertTimer > 0 || (u.lastKnown && u.lastKnown.until > sim.time);

  if (b.type === 'scan') {
    const phase = (sim.time / b.period) * TAU + u.id;
    const k = 0.5 - 0.5 * Math.cos(phase);
    u.ai.baseFacing = b.from + (b.to - b.from) * k;
  }

  if (b.type === 'patrol') {
    if (busy) {
      u.route.length = 0; // freeze while fighting / alerted
      return;
    }
    if (u.route.length === 0) {
      if (u.ai.wait > 0) {
        u.ai.wait -= dt;
        return;
      }
      u.ai.patrolIndex = (u.ai.patrolIndex + 1) % b.points.length;
      const [px, py] = b.points[u.ai.patrolIndex];
      u.route.push({ x: px, y: py, user: true, look: null, hold: false });
      u.ai.wait = b.wait;
    }
  }
}

/** Enemies walking close by are heard, even through a wall. */
function listenForFootsteps(sim, u) {
  if (u.target >= 0 || u.alertTimer > 0) return;
  const r2 = COMBAT.footstepHearing * COMBAT.footstepHearing;
  const quiet2 = MOVE.sneakHearing * MOVE.sneakHearing;
  for (const a of sim.teams[enemyTeam(u.team)]) {
    if (!a.alive || !a.moving) continue;
    if ((a.x - u.x) ** 2 + (a.y - u.y) ** 2 < (a.sneaking ? quiet2 : r2)) {
      alertAiUnit(u, a.x, a.y, COMBAT.alertDuration);
      return;
    }
  }
}

/** Aims an alerted defender at the corner / doorway the noise will come through. */
function updateWatchPoint(sim, u, dt) {
  u.ai.repath -= dt;
  if (u.ai.repath > 0) return;
  u.ai.repath = AI.repathInterval;
  const nx = u.ai.noiseX;
  const ny = u.ai.noiseY;
  u.alertX = nx;
  u.alertY = ny;
  if (lineOfSight(sim.world, u.x, u.y, nx, ny)) return;
  const path = sim.world.nav.findPath(u.x, u.y, nx, ny, NAV.snapRadius);
  if (!path) return;
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const d = Math.hypot(p.x - u.x, p.y - u.y);
    if (d < AI.watchMinDistance && i < path.length - 1) continue;
    // Look a step past the corner, where a body will appear.
    const next = path[i + 1] || p;
    const len = Math.hypot(next.x - p.x, next.y - p.y) || 1;
    const k = Math.min(1, AI.watchMinDistance / len);
    u.alertX = p.x + (next.x - p.x) * k;
    u.alertY = p.y + (next.y - p.y) * k;
    return;
  }
}

/**
 * An alerted AI defender, not fighting, throws the first AI_UTILITY.throws
 * item he carries at the spot he watches, when it is in sight and in reach
 * and a grenade would hurt none of his own (him included). Through the usual
 * entry machine (sim/entries.js): he stays put until it goes off.
 */
function throwAtWatchPoint(sim, u) {
  if (u.team !== 'defenders' || sim.controllers.defenders !== 'ai' || u.entry) return;
  if (sim.time < (u.ai.throwAt || 0)) return;
  const item = AI_UTILITY.throws.find((i) => (u.gear[i] || 0) > 0);
  if (!item) return;
  const tx = u.alertX;
  const ty = u.alertY;
  const d = Math.hypot(tx - u.x, ty - u.y);
  if (d < AI_UTILITY.minRange || d > ENTRY.tossRange) return;
  if (!lineOfSight(sim.world, u.x, u.y, tx, ty)) return;
  if (item === 'frag') {
    const r2 = (ENTRY.frag.radius + AI_UTILITY.friendlyMargin) ** 2;
    for (const o of sim.teams.defenders) if (o.alive && (o.x - tx) ** 2 + (o.y - ty) ** 2 < r2) return;
  }
  u.entry = { mode: 'toss', item, tx, ty, doorway: -1, side: 1, look: angleTo(u.x, u.y, tx, ty), phase: 'armed', t: 0, spent: false, step: null, grenade: null };
  u.ai.throwAt = sim.time + AI_UTILITY.cooldown;
}

/**
 * Rotation (map data `behavior.rotate = {to: [x, y], look}`): the first time a
 * defender hears a firefight he walks once to a planned position and holds
 * `look` there — e.g. the kitchen guard moves to cover the site through the
 * arch. Authored per map, so it reads as a plan, never as randomness.
 */
function updateRotation(sim, u) {
  const r = u.behavior.rotate;
  if (u.ai.rotating === 'pending') {
    if (u.target >= 0) return; // finish the fight first
    const path = sim.world.nav.findPath(u.x, u.y, r.to[0], r.to[1], NAV.snapRadius);
    u.ai.rotating = 'moving';
    if (!path) return;
    u.route.length = 0;
    path.forEach((p, i) => u.route.push({ x: p.x, y: p.y, user: i === path.length - 1, look: i === path.length - 1 ? r.look : null, hold: false }));
    return;
  }
  if (!u.route.length) {
    u.ai.rotating = null;
    u.ai.baseFacing = r.look;
    u.behavior = HOLD_AFTER_ROTATION;
  }
}

const HOLD_AFTER_ROTATION = Object.freeze({ type: 'hold', reactsToNoise: true });

/** Gunfire / pain / footsteps make an AI unit watch where that came from (callers pass AI units only). */
export function alertAiUnit(u, x, y, duration, gunfire = false) {
  if (!u.alive) return;
  if (gunfire && u.behavior && u.behavior.rotate && u.ai.rotating === null && !u.ai.rotated) {
    u.ai.rotating = 'pending';
    u.ai.rotated = true;
  }
  if (u.target >= 0) return;
  if (u.behavior && u.behavior.reactsToNoise === false) return;
  const fresh = u.alertTimer <= 0 || (u.ai.noiseX - x) ** 2 + (u.ai.noiseY - y) ** 2 > 1;
  u.alertTimer = duration;
  u.ai.noiseX = x;
  u.ai.noiseY = y;
  if (fresh) {
    u.alertX = x;
    u.alertY = y;
    u.ai.repath = 0; // find the angle to hold on the next tick
  }
}
