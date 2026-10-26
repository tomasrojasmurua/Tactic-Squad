// Gameplay balance: every simulation number lives here, not in sim code.
// Owner: gameplay. Changing any value changes the deterministic replay
// (tests/sim-bench.mjs prints a new hash) — that is expected.
// tests/sim-plans.mjs plays hundreds of rounds with good and clumsy plans:
// run it after any change here.
import { DEG } from '../core/math.js';

export const SIM = Object.freeze({
  tickRate: 60, // fixed steps per second
  seed: 20261025,
  retrySeedStride: 7919, // each restart uses seed + attempt * stride (new but reproducible RNG)
  postRoundSeconds: 1.6, // sim keeps running briefly after the outcome (bodies fall, smoke)
});

export const UNIT = Object.freeze({
  radius: 0.28, // collision radius (m)
  hitRadius: 0.3, // bullet hit radius (m)
  maxHp: 100,
});

export const MOVE = Object.freeze({
  speed: 2.7, // m/s, normal advance
  patrolSpeed: 1.25,
  strafeFactor: 0.72, // speed multiplier when facing away from the path
  strafeAngle: 65 * DEG,
  engageFactor: 0.3, // speed multiplier while shooting at a target (walking spread scales with speed²)
  turnRate: 430 * DEG, // rad/s
  combatTurnRate: 820 * DEG,
  footstepStride: 0.82, // m between footstep events
  friendlySpacing: 0.7, // allies never rest closer than this (m)
  separationStrength: 9.0, // how fast an idle ally steps aside (1/s)
  followGap: 0.7, // m: a moving operator slows behind an ally walking ahead of him...
  followSlowRange: 0.45, // ...and is back to full speed this much farther away
  // Door queue: single-file doorways (width <= queueDoorMaxWidth) are passed one at a time —
  // the next one waits until the first is out of the vano (doorwayDepth either side of the wall).
  doorQueueRange: 1.2, // m along the route: a busy doorway this close makes the unit wait
  doorwayDepth: 0.5, // m either side of the wall plane counted as "in the doorway"
  queueDoorMaxWidth: 1.4, // m: wider openings (arches) let two through side by side
  stackDoorRange: 2.4, // m: resting allies this close to a doorway space out along its wall
  collisionPasses: 2, // hard separation + wall push-out iterations per tick
  // "Slicing the pie": while walking, look at a point this far ahead along the
  // route, so the operator turns into corners and doorways BEFORE reaching them.
  lookAhead: 2.2, // m
  doorPeek: 1.4, // m past a doorway an approaching operator aims through it
  doorPeekRange: 3.0, // m along the route: doorways closer than this are aimed through
  settleTime: 0.35, // s standing still before the aim counts as "set" (accuracy bonus)
  readyAngle: 8 * DEG, // a unit waiting for GO is "in position" once aimed this close to its set look
});

export const VISION = Object.freeze({
  attackers: { fov: 112 * DEG, range: 30 },
  defenders: { fov: 100 * DEG, range: 30 },
  awarenessRadius: 1.7, // 360° close-range awareness (m)
  probeOffset: 0.2, // lateral LOS probes so a shoulder peeking out is visible
  rayExtend: 0.14, // visibility polygon pushes slightly into walls so their faces light up
  arcStep: 2.5 * DEG,
  endpointEpsilon: 0.00035,
});

export const COMBAT = Object.freeze({
  // Reaction = time from first sight to first shot. Whoever is already
  // watching the angle wins: a target inside the shooter's focus cone is
  // engaged much faster; every radian to turn and walking add time.
  reaction: { attackers: 0.2, defenders: 0.36 }, // s, base before modifiers (the squad is elite)
  reactionJitter: 0.04, // s, uniform random extra (low: the same plan should give a recognizable result)
  focusAngle: 14 * DEG, // half-angle of the "already aiming there" cone
  focusFactor: 0.5, // reaction multiplier when the target appears inside the focus cone
  reactionPerRadian: 0.2, // s per radian the shooter must turn
  movingReaction: 0.07, // s extra when the shooter is walking and NOT already aiming there
  alertFactor: 0.8, // reaction multiplier for a defender already alerted
  aimTolerance: 5 * DEG, // must be this well aligned to shoot
  targetTurnCost: 2.5, // m: picking a target, one radian of turning weighs like this much distance
  settledSpread: 0.75, // spread multiplier when standing with the aim set (MOVE.settleTime) or pre-aimed (focused)
  focusedMovingSpread: 0.3, // walking error multiplier for a shooter whose target appeared in his focus cone
  // Where a bullet lands: chance of head (scaled by the shooter's stance) and
  // of a limb; the rest is torso. Damage multipliers per body part.
  headChance: 0.13,
  headChanceSettled: 1.35, // multiplier when the shooter's aim is set
  headChanceMoving: 0.6, // multiplier when the shooter walks
  limbChance: 0.25,
  headshotMultiplier: 3,
  limbMultiplier: 0.7,
  recoilPerShot: 0.55 * DEG,
  recoilRecovery: 7 * DEG, // per second
  maxRecoil: 4.5 * DEG,
  flinchRecoil: 3 * DEG, // aim punch: spread added to a wounded shooter (decays like recoil)
  flinchDelay: 0.12, // s added to a wounded unit's pending reaction (he had not fired yet)
  accuracy: { attackers: 1.0, defenders: 1.1 }, // spread multiplier per team
  hearingRadius: 15, // defenders turn toward gunfire within this distance
  footstepHearing: 4.2, // m: defenders hear attackers walking this close (even through walls)
  alertDuration: 6, // s a defender keeps watching where a noise / pain came from
  lostTargetMemory: 2.5, // seconds a unit keeps watching where a target vanished
  tacticalReloadFraction: 0.34,
  bulletRange: 60, // m, hitscan length
});

/**
 * Low cover rule (furniture lower than a wall: desks, counters, crates...).
 * Everyone stands, so low props never block sight and bullets fly OVER them
 * (tracers are drawn above crate height). But a body standing right behind
 * one only shows its upper half: a shot at it hits the prop unless it finds
 * the exposed part, and only head and chest can be hit.
 */
export const COVER = Object.freeze({
  minHeight: 0.7, // m: blocking props at least this tall (and not vision-blocking) are low cover
  range: 1.0, // m: the prop protects a body at most this far behind it
  exposure: 0.5, // chance a shot at a covered body reaches the exposed part
  headChance: 0.4, // head share of the hits on a covered body
});

/** Defender AI (sim/ai.js). */
export const AI = Object.freeze({
  // When alerted by noise or pain a defender watches the spot where the threat
  // will appear (first corner / doorway on the path toward the noise) instead
  // of staring at a wall: he holds that angle, he does not wander off.
  watchMinDistance: 1.2, // m: path corners closer than this are skipped
  repathInterval: 0.5, // s between watch-point updates while alerted
});

/** Round debrief (sim/debrief.js). */
export const DEBRIEF = Object.freeze({
  doorwayRadius: 1.6, // m: a death this close to a doorway is reported "at the X door"
});

export const DOORS = Object.freeze({
  triggerDistance: 0.85, // a moving unit this close to a closed door opens it
  openAngle: 98 * DEG,
  swingSpeed: 640 * DEG, // rad/s
  kickPause: 0.16, // the opener stops this long (pushing the door open)
  thickness: 0.12,
  routeLookahead: 4, // route points checked for "does my path cross this doorway?" (stops at GO holds)
  crossingSlack: 0.2, // m beyond the door half-width still counted as crossing it
  crackAngle: 32 * DEG, // "entreabrir": the slab stops this far open (a crack to look through)
  crackSpeed: 50 * DEG, // rad/s: a cracked door opens slowly and quietly
});

/**
 * Door entries (sim/entries.js), Door Kickers style: an operator stacked on a
 * waypoint next to a doorway is given HOW to go through it. Every number of
 * the six modes lives here. Ranges in m, times in s.
 */
export const ENTRY = Object.freeze({
  modes: Object.freeze(['kick', 'slow', 'flash', 'frag', 'breach']), // order of the picker
  goCodes: Object.freeze(['A', 'B', 'C']), // GO hold codes, in cycling and release order
  doorRange: 1.8, // m: a waypoint this close to a doorway can carry an entry for it
  lookPast: 1.6, // m past the doorway a stacked operator aims (through the crack / at the room)
  followGap: 0.12, // s after the grenade / charge goes off before the rest of the code moves in
  // De golpe: the door bursts open (no breach pause), loud, and whoever stands right behind it reels.
  kick: { hearing: 12, dazeRadius: 1.4, daze: 0.45 },
  // Entreabrir: on arrival the door is cracked (DOORS.crackAngle) and he waits; GO opens it fully.
  // While the door stays ajar he looks through the gap: an extra eye just past the cracked slab, facing
  // into the room with this field of view (it only reveals: no shooting through a closed door).
  // peekDepth: m beyond the point where the slab crosses the doorway's center line.
  slow: { prepTime: 0.7, hearing: 2.2, peekFov: 70 * DEG, peekDepth: 0.08 },
  // Grenades go through the doorway: open it first (if closed), then throw `throwDistance` inside.
  throwDelay: 0.3, // s from the release (door opening) to the throw
  throwDistance: 3.2, // m past the doorway, along its normal (short of a wall)
  wallMargin: 0.45, // m kept from the wall the throw would hit
  throwSpeed: 9, // m/s of the arc (flight time = path length / speed)
  flash: { fuse: 0.9, radius: 9, blind: 3.2, minBlind: 0.4, awayFactor: 0.3, hearing: 18 },
  frag: { fuse: 1.1, radius: 4.2, damage: 160, minDamage: 8, hearing: 22 },
  // Carga de brecha: planted on arrival (prepTime), fired by the release. The door is destroyed.
  breach: { prepTime: 1.8, fuse: 0.35, radius: 3.0, damage: 75, blind: 1.8, hearing: 22, depth: 0.25 },
});

export const ROUND = Object.freeze({
  timeLimit: 120, // seconds of execution
  defuseTime: 7.0, // s standing still next to the bomb
  defuseRadius: 1.1, // m from the bomb an attacker can work on it
  goStallHint: 3, // s with every planned operator waiting for GO before the HUD insists
});

export const NAV = Object.freeze({
  cellSize: 0.2,
  clearance: 0.33, // distance kept from walls by planned paths
  dragSpacing: 0.6, // freehand drawing adds a point every N meters
  snapRadius: 1.5, // clicks inside obstacles snap to walkable ground within this radius
  doorSnap: 0.8, // m from the wall plane: points this close to a doorway snap onto its center line...
  doorSnapSide: 0.3, // m: ...if they are at most this far beyond the door jambs
  simplifyTolerance: 0.3, // m: a drawn stroke is straightened wherever that stays this close to the drawing
  maxRoutePoints: 220,
  lineSampleFactor: 0.45, // straight-walk checks sample every cellSize * factor
});

/** Map data format defaults (src/data/maps/*). */
export const MAP_FORMAT = Object.freeze({
  wallThickness: 0.3, // m, when a wall omits `t`
  onWallTolerance: 0.05, // m, a door/opening this close to a wall line cuts it
  minWallSpan: 0.01, // m, shorter leftover wall pieces are dropped
});
