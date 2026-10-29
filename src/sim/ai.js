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
import { barricadeBoxes } from './barricades.js';
import { inFire } from './fire.js';

/** One AI-controlled unit (any side whose controller is 'ai'). */
export function updateAiUnit(sim, u, dt) {
  listenForFootsteps(sim, u);
  burnDefuse(sim, u);
  if (u.alertTimer > 0 && u.target < 0) {
    updateWatchPoint(sim, u, dt);
    throwAtWatchPoint(sim, u);
  }

  const b = u.behavior;
  if (!b) return;
  if (u.ai.rotating) return updateRotation(sim, u);
  const busy = u.target >= 0 || u.alertTimer > 0 || (u.lastKnown && u.lastKnown.until > sim.time);

  if (b.type === 'scan') {
    // Centred on the look he was given where he stands (moved or turned while
    // planning: sim/orders.js), else on the order's own arc.
    const phase = (sim.time / b.period) * TAU + u.id;
    const k = 0.5 - 0.5 * Math.cos(phase);
    const half = (b.to - b.from) / 2;
    const c = u.idleLook !== null && !u.route.length ? u.idleLook : b.from + half;
    u.ai.baseFacing = c - half + 2 * half * k;
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
  watchPointToward(sim, u, u.ai.noiseX, u.ai.noiseY, u);
}

/**
 * Where to look for a threat heard at (nx, ny): the noise itself in plain
 * sight, else a step past the first corner / doorway of the walking path
 * toward it (where a body will appear). Written into out.alertX / alertY.
 */
export function watchPointToward(sim, u, nx, ny, out) {
  out.alertX = nx;
  out.alertY = ny;
  if (lineOfSight(sim.world, u.x, u.y, nx, ny)) return;
  const path = sim.world.nav.findPath(u.x, u.y, nx, ny, NAV.snapRadius);
  if (!path) return;
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const d = Math.hypot(p.x - u.x, p.y - u.y);
    if (d < AI.watchMinDistance && i < path.length - 1) continue;
    const next = path[i + 1] || p;
    const len = Math.hypot(next.x - p.x, next.y - p.y) || 1;
    const k = Math.min(1, AI.watchMinDistance / len);
    out.alertX = p.x + (next.x - p.x) * k;
    out.alertY = p.y + (next.y - p.y) * k;
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
 * An AI defender carrying an incendiaria throws it on the bomb while an
 * attacker defuses it, if it is in reach and in sight and none of his own
 * stands there (sim/fire.js).
 */
function burnDefuse(sim, u) {
  if (u.team !== 'defenders' || sim.controllers.defenders !== 'ai' || u.entry || !(u.gear.molotov > 0)) return;
  const bomb = sim.bomb;
  if (bomb.defuserId < 0 || inFire(sim, bomb.x, bomb.y)) return;
  if (Math.hypot(bomb.x - u.x, bomb.y - u.y) > ENTRY.tossRange) return;
  if (!lineOfSight(sim.world, u.x, u.y, bomb.x, bomb.y)) return;
  const r2 = (ENTRY.molotov.radius + AI_UTILITY.friendlyMargin) ** 2;
  for (const o of sim.teams.defenders) if (o.alive && (o.x - bomb.x) ** 2 + (o.y - bomb.y) ** 2 < r2) return;
  u.entry = { mode: 'toss', item: 'molotov', tx: bomb.x, ty: bomb.y, doorway: -1, side: 1, look: angleTo(u.x, u.y, bomb.x, bomb.y), phase: 'armed', t: 0, spent: false, step: null, grenade: null };
}

/**
 * Rotation (`u.ai.rotateTo = {to: [x, y], look}`): the defender walks once to
 * a position and holds `look` there — e.g. the kitchen guard moves to cover
 * the site through the arch. A player's defender does it on the first
 * firefight he hears (his fallback, `behavior.rotate`); an AI side's are sent
 * by sim/aiDefend.js when the bomb is threatened.
 */
function updateRotation(sim, u) {
  const r = u.ai.rotateTo;
  if (u.ai.rotating === 'pending') {
    if (u.target >= 0) return; // finish the fight first
    const path = pathAroundBarricades(sim, u.x, u.y, r.to[0], r.to[1]);
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

/** A defender's walking path: around his side's barricades (he cannot open them), straight through when there is no other way. */
const barricades = [];
export function pathAroundBarricades(sim, ax, ay, bx, by) {
  barricadeBoxes(sim, barricades);
  return sim.world.nav.findPathAvoiding(ax, ay, bx, by, NAV.snapRadius, barricades) || sim.world.nav.findPath(ax, ay, bx, by, NAV.snapRadius);
}

/** Starts a one-off rotation to `spot` ({to: [x, y], look}); sim/aiDefend.js decides when for an AI side. */
export function startRotation(u, spot) {
  u.ai.rotateTo = spot;
  u.ai.rotating = 'pending';
  u.ai.rotated = true;
}

const HOLD_AFTER_ROTATION = Object.freeze({ type: 'hold', reactsToNoise: true });

/** Gunfire / pain / footsteps make an AI unit watch where that came from (callers pass AI units only). */
export function alertAiUnit(u, x, y, duration, gunfire = false) {
  if (!u.alive) return;
  u.ai.report = { x, y }; // evidence for an AI side's commander (sim/aiDefend.js)
  // A player's defender falls back on the first firefight he hears; an AI
  // side's commander only rotates when the bomb is threatened.
  if (gunfire && !u.ai.commanded && u.behavior && u.behavior.rotate && u.ai.rotating === null && !u.ai.rotated) startRotation(u, u.behavior.rotate);
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
