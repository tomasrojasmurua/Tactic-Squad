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
  // Pace per stretch of route (waypoint.pace): 'sneak' trades speed for silence (Door Kickers' slow
  // move, Counter-Strike's walk). Footsteps are heard only sneakHearing m away (noise and the AI's ears).
  sneakFactor: 0.5,
  sneakHearing: 1.6,
  // Squad route (sim/follow.js): followers walk the leader's route in file, this far behind each other,
  // and stack behind him at his GO holds.
  fileGap: 0.85,
  // "Slicing the pie": while walking, look at a point this far ahead along the
  // route, so the operator turns into corners and doorways BEFORE reaching them.
  lookAhead: 2.2, // m
  doorPeek: 1.4, // m past a doorway an approaching operator aims through it
  doorPeekRange: 3.0, // m along the route: doorways closer than this are aimed through
  settleTime: 0.35, // s standing still before the aim counts as "set" (accuracy bonus)
  readyAngle: 8 * DEG, // a unit waiting for GO is "in position" once aimed this close to its set look
  // Stuck: over stuckTime s of walking he got less than stuckFraction of the way he walked
  // (pushed against a wall): he finds the way to his next point again.
  stuckFraction: 0.15,
  stuckTime: 0.6,
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

/**
 * Attacking AI (sim/aiAttack.js): a commander that plays the attackers'
 * side through the same orders as a player (used when the player defends).
 */
export const AI_ATTACK = Object.freeze({
  buyFlashes: 1, // flashbangs each operator tries to buy (as long as his money lasts)
  droneReach: 0.35, // m: a point of the drone's path counts as reached this close
  droneStuck: 0.6, // s without moving (a barricade, a prop) before it gives up on that point
  choiceSlack: 0.15, // entries / sites up to this much longer than the best are as good (the seed picks)
  spotSpacing: 0.9, // m between the operators' end points around the bomb
  flashers: 1, // operators who throw a flashbang through each door (if they carry one); the rest follow
  goPause: 0.25, // s a group waits in position before its GO (it reads as a call, not a reflex)
  goTimeout: 4, // s waiting for a GO before it is given anyway (someone is stuck or fighting)
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
  // A route drawn through a closed door stops this far before it, on a "?" point: how and when to go
  // through is the player's call (sim/orders.js markDoors). Closer than DOORS.triggerDistance would open it.
  askDistance: 0.75,
  // What an operator does at a "?" door nobody decided: 'open' (default, as in Door Kickers: he opens it
  // and goes through — the "?" only offers a better entry) or 'stop' (strict: he waits for a decision).
  undecided: 'open',
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
  // The assault is played in We-Go turns (sim/round.js): both sides plan blind, then
  // every order runs at once for turnSeconds. The bomb's timer only runs while a turn
  // executes (deciding is free): at 0 it explodes, even mid-defuse — the defenders win.
  turnSeconds: 5, // s of execution per turn (design: 5 s)
  timeLimit: 90, // s on the bomb's timer (of execution: 18 turns; a sim without phases runs this long)
  // Seconds each side gets to decide in every decision phase (wall clock: the session's
  // PhaseClock, later the server). Never read by the sim: they cannot change the result.
  // null: no limit, the phase ends with LISTO (against the AI). Online, e.g. {buy: 20, prep: 90, plan: 60}.
  phaseSeconds: Object.freeze({ buy: null, prep: null, plan: null }),
  endSeconds: 10, // the result stays on screen this long before it offers the next round
  defuseTime: 7.0, // s standing still next to the bomb
  defuseRadius: 1.1, // m from the bomb an attacker can work on it
  goStallHint: 3, // s with every planned operator waiting for GO before the HUD insists
  // Option (Simulation `stopOnContact`, against the AI): the turn ends early when the attackers see a
  // new enemy, so the player can react (the tutorial plays with it). Never before minContactSeconds.
  minContactSeconds: 0.5,
});

/**
 * Noise (sim/noise.js): what the other side hears of a turn. Each loud thing is
 * heard by the enemy if one of them is within its radius (m, through walls), and
 * at the end of the turn it becomes a pulse on their map: a cell of `cell` m,
 * shifted up to `jitter` m — where, roughly, never who or exactly.
 */
export const NOISE = Object.freeze({
  cell: 3, // m: pulses are snapped to this grid...
  jitter: 0.9, // ...and shifted up to this much (deterministic, from the seed)
  keepTurns: 3, // a pulse stays on the map this many turns, fading
  // Radius heard (m) by kind; the loudest kind of a cell names its pulse.
  radius: Object.freeze({ sneak: 2, step: 6, door: 7, crack: 2.2, kick: 12, shot: 34, plant: 8, defuse: 10, bash: 14, flash: 18, frag: 22, breach: 22 }),
  rank: Object.freeze(['sneak', 'step', 'crack', 'door', 'plant', 'defuse', 'kick', 'bash', 'shot', 'flash', 'frag', 'breach']), // quiet -> loud
});

/**
 * Buying (sim/prep.js, buy phase): every attacker has his own money and buys
 * the utility he carries. Starts with his role's gear (config/operators.js),
 * already paid for. The round economy (win / loss income) comes later.
 */
export const BUY = Object.freeze({
  startMoney: 800, // $ per operator
  prices: Object.freeze({ flash: 200, frag: 300, breach: 300 }),
  max: Object.freeze({ flash: 2, frag: 1, breach: 2 }), // carried at most
  items: Object.freeze(['flash', 'frag', 'breach']), // order of the buy panel
});

/** Defender preparation (sim/prep.js): set-up rules and the watch orders. */
export const PREP = Object.freeze({
  barricades: 2, // per round (free for now)
  barricadeReach: 0.5, // m: a door counts as in the defenders' half this close to it
  sweepPeriod: 6, // s of a full sweep (watch order "barrer")
  minSpacing: 0.7, // m between two defenders placed in the set-up
});

/** Barricades (sim/barricades.js): block bodies, sight and the drone until broken or blown. */
export const BARRICADE = Object.freeze({
  breakTime: 3, // s hitting it (a kick starts the same work): the doorway is then clear
  hitEvery: 0.6, // s between the blows (noise, sound)
  hearing: 14, // m: AI defenders this close turn to it (and rotate, like gunfire)
  spotRange: 14, // m: an attacker (or the drone) with a line of sight this close finds it
});

/**
 * Recon drone (sim/drone.js): after the preparation the attackers drive it in
 * real time for `seconds` (the bomb's timer does not run). It rolls under
 * doors but not through barricades, marks the defenders it sees where they
 * are and reveals the site if it sees the bomb. A defender who keeps it in
 * sight `shootDelay` s shoots it down. Not used in the assault (yet).
 */
export const DRONE = Object.freeze({
  seconds: 15,
  launchDistance: 1.2, // m in front of the entry's door (outside), facing it
  speed: 2.4, // m/s
  turnRate: 540 * DEG, // rad/s (it faces where it goes)
  radius: 0.16, // m (collides with walls, furniture and barricades)
  fov: 100 * DEG,
  range: 14, // m
  directions: 16, // the stick is quantized to this many headings (few, compact orders)
  hearing: 3, // m: AI defenders this close hear it and turn to it
  shootDelay: 0.6, // s a defender must see it before shooting it down
  shootRange: 16, // m
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
