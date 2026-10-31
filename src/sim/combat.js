// Shooting: reaction delay, bursts, spread/recoil, hitscan bullets, low
// cover, body-part damage.
//
// Accuracy: weapon spread, + moving spread × (fraction of full speed)² — so
// advancing slowly while engaging is almost as accurate as standing —, × COMBAT.settledSpread
// once the shooter has stood still with his aim set (MOVE.settleTime), + recoil.
// Low cover (config COVER): bullets fly over desks and crates, but a body
// right behind one only exposes its upper half — see coverBetween(). The
// Ancla's barrier works the same (sim/parapets.js); the Escudo's shield stops
// what comes from the front (shieldFacing).
import { COMBAT, COVER, MOVE, UNIT, VISION, SHIELD, PARAPET, ENTRY } from '../config/balance.js';
import { parapetCovering } from './parapets.js';
import { EV } from '../core/events.js';
import { angleDiff, angleTo } from '../core/math.js';
import { rayCast, rayCircle, segmentBlocked } from '../core/geom.js';
import { alertAiUnit } from './ai.js';
import { recordDeath } from './debrief.js';
import { propNear, struckSurface, isAiControlled } from './queries.js';
import { datan2, dcos, dhypot, dsin, dtan, sq } from '../core/dmath.js';
import { stressShot, stressAllyDown, stressSpread } from './stress.js';
import { woundLimb, woundSpread, woundReload } from './wounds.js';

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

  if (u.reloadNow) {
    // Ordered (RECARGAR): now, whatever he faces — the player chose the moment.
    u.reloadNow = false;
    if (u.mag < u.weapon.magazine && u.reserve > 0) return startReload(sim, u);
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
  const len = dhypot(dx, dy) || 1;
  const px = (-dy / len) * VISION.probeOffset;
  const py = (dx / len) * VISION.probeOffset;
  const segs = world.segments;
  const c = world.solidCount; // smoke hides, it does not stop bullets
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
  u.reloadTimer = u.weapon.reloadTime * woundReload(u); // an arm wound slows it (sim/wounds.js)
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
  spread = spread * COMBAT.accuracy * u.mods.spread * (u.gassed > 0 ? ENTRY.gas.spread : 1) * stressSpread(u) * woundSpread(u) + u.recoil; // tear gas (sim/gas.js), suppression (sim/stress.js)
  const { ox, oy } = fireLine;
  // Aim error is measured from the line of fire; the facing only gates WHEN he can shoot.
  const angle = datan2(fireLine.ty - oy, fireLine.tx - ox) + rng.gauss() * spread;
  const dx = dcos(angle);
  const dy = dsin(angle);

  const wallT = rayCast(sim.world.segments, sim.world.solidCount, ox, oy, dx, dy, COMBAT.bulletRange);
  let victim = null;
  let hitT = wallT;
  for (const o of sim.units) {
    if (!o.alive || o.team === u.team) continue;
    // A raised shield facing the shot is wider than the body behind it; buckshot spreads with distance.
    const pattern = w.cone ? dhypot(o.x - ox, o.y - oy) * dtan(w.cone) : 0;
    const t = rayCircle(ox, oy, dx, dy, o.x, o.y, (shieldFacing(o, dx, dy) ? SHIELD.radius : UNIT.hitRadius) + pattern);
    if (t < hitT) {
      hitT = t;
      victim = o;
    }
  }

  // The Escudo's shield: the bullet stops on it (and so never reaches whoever
  // stands behind him), unless it finds a leg or an arm (SHIELD.leak).
  let shielded = false;
  let limb = false;
  if (victim && shieldFacing(victim, dx, dy)) {
    if (rng.chance(SHIELD.leak)) limb = true;
    else {
      shielded = true;
      sim.emit(EV.SHIELD_HIT, { unitId: victim.id, attackerId: u.id, x: ox + dx * hitT, y: oy + dy * hitT });
      joltShield(victim);
      victim = null;
    }
  }

  // Low cover right in front of the victim (a prop, or the Ancla's barrier): the shot may hit it instead.
  let covered = false;
  let guard = 1;
  let barrier = false; // the bullet struck the Ancla's barrier
  if (victim && !limb) {
    const parapet = parapetCovering(sim, victim, dx, dy);
    const coverT = parapet ? hitT - UNIT.hitRadius : coverBetween(sim.world.lowCover, ox, oy, dx, dy, hitT);
    if (coverT >= 0) {
      covered = true;
      if (parapet) guard = PARAPET.damage;
      if (!rng.chance(COVER.exposure)) {
        victim = null;
        hitT = coverT;
        barrier = !!parapet;
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
  const metal = shielded || barrier; // the shield, the Ancla's steel barrier
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
    material: hit === 'unit' ? 'flesh' : metal ? 'metal' : hit === 'wall' ? struckSurface(sim, toX, toY) : 'none',
    impactZ: coverProp && !barrier ? coverProp.h : barrier ? PARAPET.height : -1, // m: top of the low cover struck, -1 = default bullet height
    mag: u.mag, // rounds left after this shot
    suppressed: u.mods.shotNoise < 1, // a suppressor: heard much less (presentation and sim/noise.js)
  });

  // Gunfire is loud: nearby AI units (teammates of the shooter too) turn toward it. A suppressor (shotNoise) carries less.
  const hearing = COMBAT.hearingRadius * u.mods.shotNoise;
  const r2 = hearing * hearing;
  for (const o of sim.units) {
    if (o === u || !isAiControlled(sim, o)) continue;
    if (sq(o.x - u.x) + sq(o.y - u.y) < r2) alertAiUnit(o, u.x, u.y, COMBAT.alertDuration, true);
  }

  stressShot(sim, u, ox, oy, dx, dy, hitT, victim); // whom it whizzed past (sim/stress.js)
  if (victim) applyHit(sim, u, victim, toX, toY, dx, dy, covered, limb, guard);
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

/**
 * A bullet stopped on the shield still hits it: every impact jolts the arm
 * that holds it and the pistol in the other hand (SHIELD.jolt of aim error,
 * recovered like recoil; SHIELD.joltDelay to a first shot he had not fired
 * yet). A burst on the shield pins him behind it: he cannot answer well until
 * it stops. A single slow shot (a bolt-action sniper) is shaken off at once.
 */
function joltShield(u) {
  u.recoil = Math.min(COMBAT.maxRecoil + SHIELD.joltMax, u.recoil + SHIELD.jolt);
  if (u.reaction > 0) u.reaction += SHIELD.joltDelay;
}

/**
 * Is u holding his shield up toward a bullet flying along (dx, dy)? Only an
 * Escudo, not flashed or stunned (he lowers it), and the shot from within
 * SHIELD.arc of his facing.
 */
function shieldFacing(u, dx, dy) {
  if (u.ability !== 'shield' || u.blind > 0 || u.stun > 0) return false;
  return Math.abs(angleDiff(u.facing, datan2(-dy, -dx))) <= SHIELD.arc;
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

/** Damage fraction left at distance d (m): buckshot loses its punch fast (weapon `falloff`). */
function falloff(w, d) {
  if (!w.falloff) return 1;
  const [full, far, floor] = w.falloff;
  if (d <= full) return 1;
  return d >= far ? floor : 1 - ((d - full) / (far - full)) * (1 - floor);
}

/** `limb`: past a shield, only a leg or an arm shows; `guard`: damage multiplier (the Ancla's barrier). */
function applyHit(sim, shooter, victim, x, y, dx, dy, covered, limb = false, guard = 1) {
  const rng = sim.rng;
  const w = shooter.weapon;
  const part = limb ? 'limb' : rollBodyPart(rng, shooter, covered);
  const wound = part === 'limb' ? woundLimb(sim, victim) : null; // a leg or an arm, for the rest of the round
  let damage = rng.range(w.damage[0], w.damage[1]) * falloff(w, dhypot(x - shooter.x, y - shooter.y));
  if (part === 'head') damage *= COMBAT.headshotMultiplier;
  else if (part === 'limb') damage *= COMBAT.limbMultiplier;
  damage = Math.round(damage * guard);
  victim.hp -= damage;
  shooter.stats.hits++;
  const lethal = victim.hp <= 0;
  const headshot = part === 'head';
  sim.emit(EV.HIT, { unitId: victim.id, team: victim.team, role: victim.role, attackerId: shooter.id, x, y, dirX: dx, dirY: dy, damage, headshot, part, wound, covered, lethal });

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
  kill(sim, victim, shooter, datan2(dy, dx));
}

/**
 * Explosion damage (grenade, breach charge: sim/entries.js) from (x, y).
 * Same consequences as a bullet: wound flinch and pain alert, or death.
 */
export function applyBlast(sim, attacker, victim, amount, x, y) {
  const damage = Math.round(amount);
  const dx = victim.x - x;
  const dy = victim.y - y;
  const len = dhypot(dx, dy) || 1;
  victim.hp -= damage;
  const lethal = victim.hp <= 0;
  sim.emit(EV.HIT, {
    unitId: victim.id, team: victim.team, role: victim.role, attackerId: attacker ? attacker.id : -1, x: victim.x, y: victim.y,
    dirX: dx / len, dirY: dy / len, damage, headshot: false, part: 'torso', covered: false, lethal, blast: true,
  });
  if (lethal) return kill(sim, victim, attacker, datan2(dy, dx), 'explosive');
  victim.recoil = Math.min(COMBAT.maxRecoil + COMBAT.flinchRecoil, victim.recoil + COMBAT.flinchRecoil);
  if (victim.reaction > 0) victim.reaction += COMBAT.flinchDelay;
  if (victim.target < 0) {
    victim.alertTimer = COMBAT.alertDuration;
    victim.alertX = x;
    victim.alertY = y;
  }
}

/** `code` forces the debrief cause (e.g. 'explosive'); otherwise it is read from the duel. */
export function kill(sim, victim, killer, angle, code = null) {
  recordDeath(sim, victim, killer, code); // reads the state BEFORE it is cleared below
  victim.hp = 0;
  victim.alive = false;
  victim.deathTime = sim.time;
  victim.killerId = killer ? killer.id : -1;
  victim.deathAngle = angle;
  victim.route.length = 0;
  victim.target = -1;
  victim.waitingGo = false;
  victim.entry = null;
  if (killer && killer.team !== victim.team) killer.stats.kills++;
  stressAllyDown(sim, victim);
  sim.emit(EV.DEATH, { unitId: victim.id, killerId: victim.killerId, team: victim.team, x: victim.x, y: victim.y, angle });
}
