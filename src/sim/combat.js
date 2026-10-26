// Shooting: reaction delay, bursts, spread/recoil, hitscan bullets, low
// cover, body-part damage.
//
// Accuracy: weapon spread, + moving spread × (fraction of full speed)² — so
// advancing slowly while engaging is almost as accurate as standing —, × COMBAT.settledSpread
// once the shooter has stood still with his aim set (MOVE.settleTime), + recoil.
// Low cover (config COVER): bullets fly over desks and crates, but a body
// right behind one only exposes its upper half — see coverBetween().
import { COMBAT, COVER, MOVE, UNIT, VISION } from '../config/balance.js';
import { EV } from '../core/events.js';
import { angleDiff, angleTo } from '../core/math.js';
import { rayCast, rayCircle, segmentBlocked } from '../core/geom.js';
import { alertAiUnit } from './ai.js';
import { recordDeath } from './debrief.js';
import { propNear, struckSurface, isAiControlled } from './queries.js';

export function updateCombat(sim, u, dt) {
  u.fireCooldown = Math.max(0, u.fireCooldown - dt);
  u.burstPause = Math.max(0, u.burstPause - dt);
  u.recoil = Math.max(0, u.recoil - COMBAT.recoilRecovery * dt);
  if (u.alertTimer > 0) u.alertTimer -= dt;
  if (u.defusing) return; // both hands on the bomb: no shooting, no reloading

  if (u.reloadTimer > 0) {
    u.reloadTimer -= dt;
    if (u.reloadTimer <= 0) finishReload(u);
    return;
  }

  if (u.target < 0) {
    if (u.mag < u.weapon.magazine * COMBAT.tacticalReloadFraction && u.reserve > 0) startReload(sim, u);
    return;
  }

  if (u.reaction > 0) {
    u.reaction -= dt;
    return;
  }
  if (u.mag <= 0) {
    if (u.reserve > 0) startReload(sim, u);
    return;
  }
  const t = sim.units[u.target];
  if (Math.abs(angleDiff(u.facing, angleTo(u.x, u.y, t.x, t.y))) > COMBAT.aimTolerance) return;
  if (u.fireCooldown > 0 || u.burstPause > 0) return;
  if (!lineOfFire(sim.world, u, t)) return; // sees him only for an instant: hold fire
  fire(sim, u);
}

/**
 * Shots follow the line of sight that revealed the target: center to center,
 * else from the shooter's shoulder / to the target's exposed shoulder (the
 * same rays as vision.canSee). Without this a man spotted by his shoulder
 * would be fired at through the door frame. Result in `fireLine`.
 */
const fireLine = { ox: 0, oy: 0, tx: 0, ty: 0 };
function lineOfFire(world, u, t) {
  const dx = t.x - u.x;
  const dy = t.y - u.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * VISION.probeOffset;
  const py = (dx / len) * VISION.probeOffset;
  const segs = world.segments;
  const c = world.segmentCount;
  for (let i = 0; i < FIRE_PROBES.length; i += 2) {
    const so = FIRE_PROBES[i];
    const st = FIRE_PROBES[i + 1];
    const ox = u.x + px * so;
    const oy = u.y + py * so;
    const tx = t.x + px * st;
    const ty = t.y + py * st;
    if (!segmentBlocked(segs, c, ox, oy, tx, ty)) {
      fireLine.ox = ox;
      fireLine.oy = oy;
      fireLine.tx = tx;
      fireLine.ty = ty;
      return true;
    }
  }
  return false;
}
/** (shooter offset, target offset) pairs in shoulder widths, tried in order. */
const FIRE_PROBES = [0, 0, 0, 1, 0, -1, 1, 0, -1, 0];

function startReload(sim, u) {
  u.reloadTimer = u.weapon.reloadTime;
  sim.emit(EV.RELOAD, { unitId: u.id, weaponId: u.weaponId, x: u.x, y: u.y });
}

function finishReload(u) {
  const need = u.weapon.magazine - u.mag;
  const take = Math.min(need, u.reserve);
  u.mag += take;
  u.reserve -= take;
  u.reloadTimer = 0;
}

/** Is the shooter's aim set (standing still, not turning)? */
const isSettled = (u) => !u.moving && u.stillTime >= MOVE.settleTime;

function fire(sim, u) {
  const w = u.weapon;
  const rng = sim.rng;
  // A shooter whose target appeared where he was already aiming (u.focused)
  // walks "gun up": most of the walking error goes away. Pre-aiming wins duels.
  const walk = u.moving ? w.movingSpread * u.speedFraction * u.speedFraction * (u.focused ? COMBAT.focusedMovingSpread : 1) : 0;
  let spread = w.spread + walk;
  if (isSettled(u) || u.focused) spread *= COMBAT.settledSpread;
  spread = spread * COMBAT.accuracy[u.team] * u.mods.spread + u.recoil;
  const { ox, oy } = fireLine;
  // Aim error is measured from the line of fire; the facing only gates WHEN he can shoot.
  const angle = Math.atan2(fireLine.ty - oy, fireLine.tx - ox) + rng.gauss() * spread;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  const wallT = rayCast(sim.world.segments, sim.world.segmentCount, ox, oy, dx, dy, COMBAT.bulletRange);
  let victim = null;
  let hitT = wallT;
  for (const o of sim.units) {
    if (!o.alive || o.team === u.team) continue;
    const t = rayCircle(ox, oy, dx, dy, o.x, o.y, UNIT.hitRadius);
    if (t < hitT) {
      hitT = t;
      victim = o;
    }
  }

  // Low cover right in front of the victim: the shot may hit the prop instead.
  let covered = false;
  if (victim) {
    const coverT = coverBetween(sim.world.lowCover, ox, oy, dx, dy, hitT);
    if (coverT >= 0) {
      covered = true;
      if (!rng.chance(COVER.exposure)) {
        victim = null;
        hitT = coverT;
      }
    }
  }

  u.mag--;
  u.stats.shots++;
  u.fireCooldown = w.fireInterval;
  u.recoil = Math.min(COMBAT.maxRecoil, u.recoil + COMBAT.recoilPerShot);
  if (--u.burstLeft <= 0) {
    u.burstLeft = rng.int(w.burst[0], w.burst[1]);
    u.burstPause = w.burstPause;
  }

  const toX = ox + dx * hitT;
  const toY = oy + dy * hitT;
  const hit = victim ? 'unit' : hitT < COMBAT.bulletRange ? 'wall' : 'none';
  const struckCover = covered && !victim;
  const coverProp = struckCover ? propNear(sim, toX, toY) : null;
  sim.emit(EV.SHOT, {
    unitId: u.id,
    team: u.team,
    weaponId: u.weaponId,
    x: ox,
    y: oy,
    angle,
    toX,
    toY,
    hit,
    victimId: victim ? victim.id : -1,
    cover: struckCover, // the bullet struck low cover (desk, crate...) in front of the target
    // Presentation facts (read by FX/audio, never by the sim): what was struck and how high.
    material: hit === 'unit' ? 'flesh' : hit === 'wall' ? struckSurface(sim, toX, toY) : 'none',
    impactZ: coverProp ? coverProp.h : -1, // m: top of the low cover struck, -1 = default bullet height
    mag: u.mag, // rounds left after this shot
  });

  // Gunfire is loud: nearby AI units (teammates of the shooter too) turn toward it.
  const r2 = COMBAT.hearingRadius * COMBAT.hearingRadius;
  for (const o of sim.units) {
    if (o === u || !isAiControlled(sim, o)) continue;
    if ((o.x - u.x) ** 2 + (o.y - u.y) ** 2 < r2) alertAiUnit(o, u.x, u.y, COMBAT.alertDuration, true);
  }

  if (victim) applyHit(sim, u, victim, toX, toY, dx, dy, covered);
}

/**
 * Entry distance of the ray into a low-cover box that lies within
 * COVER.range in front of the body hit at `bodyT`, or -1. Props near the
 * shooter do not count: he leans over his own cover.
 */
function coverBetween(boxes, ox, oy, dx, dy, bodyT) {
  let best = -1;
  const from = bodyT - COVER.range;
  for (let i = 0; i < boxes.length; i++) {
    const t = rayBoxEntry(ox, oy, dx, dy, boxes[i], bodyT);
    if (t >= from && t >= 0 && (best < 0 || t < best)) best = t;
  }
  return best;
}

/** Slab test: distance where the ray enters the box (0..maxT), or -1. */
function rayBoxEntry(ox, oy, dx, dy, b, maxT) {
  let t0 = 0;
  let t1 = maxT;
  if (Math.abs(dx) < 1e-12) {
    if (ox < b.minX || ox > b.maxX) return -1;
  } else {
    let a = (b.minX - ox) / dx;
    let c = (b.maxX - ox) / dx;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
  }
  if (Math.abs(dy) < 1e-12) {
    if (oy < b.minY || oy > b.maxY) return -1;
  } else {
    let a = (b.minY - oy) / dy;
    let c = (b.maxY - oy) / dy;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
  }
  return t0 <= t1 && t0 > 0 ? t0 : -1;
}

/** Which body part a bullet lands on: 'head' | 'torso' | 'limb'. */
function rollBodyPart(rng, shooter, covered) {
  if (covered) return rng.chance(COVER.headChance) ? 'head' : 'torso';
  let head = COMBAT.headChance;
  if (shooter.focused || isSettled(shooter)) head *= COMBAT.headChanceSettled; // aim set or pre-aimed
  else if (shooter.moving) head *= COMBAT.headChanceMoving;
  const r = rng.next();
  if (r < head) return 'head';
  return r < head + COMBAT.limbChance ? 'limb' : 'torso';
}

function applyHit(sim, shooter, victim, x, y, dx, dy, covered) {
  const rng = sim.rng;
  const w = shooter.weapon;
  const part = rollBodyPart(rng, shooter, covered);
  let damage = rng.range(w.damage[0], w.damage[1]);
  if (part === 'head') damage *= COMBAT.headshotMultiplier;
  else if (part === 'limb') damage *= COMBAT.limbMultiplier;
  damage = Math.round(damage);
  victim.hp -= damage;
  shooter.stats.hits++;
  const lethal = victim.hp <= 0;
  const headshot = part === 'head';
  sim.emit(EV.HIT, { unitId: victim.id, team: victim.team, role: victim.role, attackerId: shooter.id, x, y, dirX: dx, dirY: dy, damage, headshot, part, covered, lethal });

  if (!lethal) {
    // Aim punch: a wound throws the victim's aim off and delays a first shot
    // he had not fired yet — whoever lands first (the one who pre-aimed) wins.
    victim.recoil = Math.min(COMBAT.maxRecoil + COMBAT.flinchRecoil, victim.recoil + COMBAT.flinchRecoil);
    if (victim.reaction > 0) victim.reaction += COMBAT.flinchDelay;
    // Pain: turn toward the shooter even if he is unseen.
    if (victim.target < 0) {
      if (isAiControlled(sim, victim)) {
        victim.ai.noiseX = shooter.x;
        victim.ai.noiseY = shooter.y;
        victim.ai.repath = 0;
      }
      victim.alertTimer = COMBAT.alertDuration;
      victim.alertX = shooter.x;
      victim.alertY = shooter.y;
    }
    return;
  }
  kill(sim, victim, shooter, Math.atan2(dy, dx));
}

export function kill(sim, victim, killer, angle) {
  recordDeath(sim, victim, killer); // reads the state BEFORE it is cleared below
  victim.hp = 0;
  victim.alive = false;
  victim.deathTime = sim.time;
  victim.killerId = killer ? killer.id : -1;
  victim.deathAngle = angle;
  victim.route.length = 0;
  victim.target = -1;
  victim.waitingGo = false;
  if (killer) killer.stats.kills++;
  sim.emit(EV.DEATH, { unitId: victim.id, killerId: victim.killerId, team: victim.team, x: victim.x, y: victim.y, angle });
}
