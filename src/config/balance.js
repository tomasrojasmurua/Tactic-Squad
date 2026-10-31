// Gameplay balance: every simulation number lives here, not in sim code.
// Owner: gameplay. Changing any value changes the deterministic replay — that is expected.
// After a change that touches the rules, measure: node scripts/balance.mjs 800 ciegas <mapa>
// (and a second batch of seeds), goal 45-55 % per side and per site.
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
  // "Asomarse y volver" (waypoint.pause): he stands on the point this long, looking where it says,
  // then walks back to where he came from (orders.js setPeek).
  peekTime: 1.5,
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
  // Reaction = time from first sight to first shot. The same for both sides:
  // the posture decides, never the side. Whoever is already watching the
  // angle wins: a target inside the shooter's focus cone is engaged much
  // faster; holding that angle still is faster yet; every radian to turn,
  // walking and having just come through a doorway add time.
  reaction: 0.24, // s, base before modifiers
  reactionJitter: 0.04, // s, uniform random extra (low: the same plan should give a recognizable result)
  focusAngle: 14 * DEG, // half-angle of the "already aiming there" cone
  focusFactor: 0.5, // reaction multiplier when the target appears inside the focus cone
  reactionPerRadian: 0.2, // s per radian the shooter must turn
  movingReaction: 0.07, // s extra when the shooter is walking and NOT already aiming there
  alertFactor: 0.8, // reaction multiplier for a unit already alerted (heard / took fire / remembers a target)
  holdFactor: 0.75, // reaction multiplier for a focused shooter who holds the angle (still, aim set, holdTime)
  holdTime: 0.6, // s standing still without turning before the angle counts as held
  doorwayPenalty: 0.05, // s extra for a shooter who came through a doorway less than doorwayTime ago
  doorwayTime: 0.8, // s
  closeRange: 5, // m: inside it a shooter's closeReaction applies (the Escopetero)
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
  accuracy: 1.0, // spread multiplier (the same for both sides)
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

/**
 * The Explorador's call-out (sim/perception.js callOut): what his fiber-optic camera shows, the stack on
 * that door (within `stack` m) keeps as a known target `memory` s after the last sight: they enter aimed at it.
 */
export const CALLOUT = Object.freeze({ stack: 3, memory: 1.0 });

/**
 * Trained ears (sim/ears.js, the Explorador's sharpEars): an enemy walking close by makes him turn to
 * where that enemy will appear, for `seconds`; the spot is found again every `repathTicks` steps.
 */
export const EARS = Object.freeze({ range: 5, seconds: 0.8, repathTicks: 15 });

/** Defender AI (sim/ai.js). */
export const AI = Object.freeze({
  // When alerted by noise or pain a defender watches the spot where the threat
  // will appear (first corner / doorway on the path toward the noise) instead
  // of staring at a wall: he holds that angle, he does not wander off.
  watchMinDistance: 1.2, // m: path corners closer than this are skipped
  repathInterval: 0.5, // s between watch-point updates while alerted
});

/**
 * Defending AI (sim/aiDefend.js): when the bomb is threatened, a few of its
 * defenders leave their posts to hold the way in by the bomb.
 */
export const AI_DEFEND = Object.freeze({
  threatRadius: 8, // m from the bomb: evidence this close means the site is being hit
  rotators: 2, // defenders sent to the bomb per round
  nearThreat: 7, // m: defenders closer than this to the threat are already in the fight
  coverDistance: 2.5, // m from the bomb along the path toward the threat: where a rotator stands
  lookAhead: 3, // m farther down that path: what he aims at
  spacing: 0.9, // m sideways between two rotators covering the same way
});

/**
 * Which post of the map's layout each class of an AI defending side takes (sim/prep.js aiPosts): the
 * long-range classes the longest sight line, the close-range ones the shortest (rays across ±arc, m).
 */
export const AI_POSTS = Object.freeze({ longRoles: Object.freeze(['sniper']), closeRoles: Object.freeze(['shotgunner']), rays: 9, arc: 25 * DEG, range: 40 });

/**
 * Attacking AI (sim/aiAttack.js): a commander that plays the attackers'
 * side through the same orders as a player (used when the player defends).
 */
export const AI_ATTACK = Object.freeze({
  buy: Object.freeze(['flash', 'frag', 'flash', 'smoke']), // each operator buys these in order while his points last
  droneReach: 0.35, // m: a point of the drone's path counts as reached this close
  droneStuck: 0.6, // s without moving (a barricade, a prop) before it gives up on that point
  choiceSlack: 0.15, // entries / sites up to this much longer than the best are as good (the seed picks)
  spotSpacing: 0.9, // m between the operators' end points around the bomb
  flashers: 1, // operators who throw a flashbang (a Granadero: gas) through each door (if they carry one); the rest follow
  gasDepth: 3.5, // m into the room an AI Granadero aims his gas
  goPause: 0.25, // s a group waits in position before its GO (it reads as a call, not a reflex)
  goTimeout: 4, // s waiting for a GO before it is given anyway (someone is stuck or fighting)
  // Composition plans (config/operators.js COMPOSITIONS):
  siteDoorReach: 9, // m walking from a doorway to the bomb: it is a way into the site (a split plan's second door)
  viaOffset: 1.2, // m outside that doorway: where the flanker goes before stepping in
  // ...and only if his walk through it (there, then to his spot) is at most splitSlack longer than going straight
  splitSlack: 0.15,
  splitExtra: 3, // m, plus this
  splitChance: 0.5, // share of the rounds a split squad goes for the pinch (always: 76 % for the attackers in the Almacén)
  overwatchShort: 7, // m walking short of the bomb where an overwatch Tirador stops and holds
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
});

/**
 * Door entries (sim/entries.js), Door Kickers style: an operator stacked on a
 * waypoint next to a doorway is given HOW to go through it. Every number of
 * the six modes lives here. Ranges in m, times in s.
 */
export const ENTRY = Object.freeze({
  modes: Object.freeze(['kick', 'mirror', 'pie', 'flash', 'frag', 'breach', 'cam']), // order of the picker ('cam': the Explorador only)
  goCodes: Object.freeze(['A', 'B', 'C']), // GO hold codes, in cycling and release order
  doorRange: 1.8, // m: a waypoint this close to a doorway can carry an entry for it
  // A route drawn through a closed door stops this far before it, on a "?" point: how and when to go
  // through is the player's call (sim/orders.js markDoors). Closer than DOORS.triggerDistance would open it.
  askDistance: 0.75,
  // What an operator does at a "?" door nobody decided: 'open' (default, as in Door Kickers: he opens it
  // and goes through — the "?" only offers a better entry) or 'stop' (strict: he waits for a decision).
  undecided: 'open',
  lookPast: 1.6, // m past the doorway a stacked operator aims (at the room)
  // Throwing through a door or blowing it, he stacks beside the frame, not in front of the opening:
  // `jamb` m past the door jamb, as close to the wall as he can walk (`wall` m from the wall plane at
  // most), on the side his route comes from (sim/orders.js stackBeside). He steps in after the bang.
  beside: { modes: Object.freeze(['flash', 'frag', 'breach']), wall: 1, jamb: 0.6 },
  followGap: 0.12, // s after the grenade / charge goes off before the rest of the code moves in
  // De golpe: the door bursts open (no breach pause), loud, and whoever stands right behind it reels.
  kick: { hearing: 12, dazeRadius: 1.4, daze: 0.45 },
  // Espejo (every operator carries one, both sides): on arrival he crouches at the closed door and
  // slides a mirror under it (prepTime). While he waits there it shows a low, short wedge of the room: an
  // eye `under` m past the door, `fov` wide, `range` m (sim/queries.js peekEye). It only reveals. An
  // enemy who sees the mirror (its spot) catches the glint: his side learns someone is at that door, and
  // after `breakTime` s in his sight he shoots it to pieces (the operator has no mirror for the rest of
  // the round). The Explorador's fiber-optic camera ('cam') is the better tool and takes its place.
  mirror: { prepTime: 2.0, fov: 90 * DEG, range: 6, under: 0.12, breakTime: 0.8, glintMemory: 3 },
  // Despejar por cortes: on release he opens the door and stays at the frame `time` s turning through
  // the room's angles, one side to the other (`arc` around the doorway's axis). For `carry` s after it
  // (and while he does it) he reacts `reaction` × faster, and coming through that doorway costs him
  // nothing (an Asaltante keeps his own threshold bonus if it is better). The rest of his GO code waits.
  pie: { time: 1.8, arc: 120 * DEG, carry: 2.5, reaction: 0.6 },
  // Grenades go through the doorway: open it first (if closed), then throw `throwDistance` inside.
  throwDelay: 0.3, // s from the release (door opening) to the throw
  throwDistance: 3.2, // m past the doorway, along its normal (short of a wall)
  wallMargin: 0.45, // m kept from the wall the throw would hit
  throwSpeed: 9, // m/s of the arc (flight time = path length / speed)
  // Flash: whoever has it in sight within `radius` is blinded `blind` s × how much he looked at it
  // (awayFactor with his back to it) × the distance (`edge` of it at the edge, all of it at the bang).
  // 31 oct: radius 9 -> 12, edge 0.4 -> 0.6, awayFactor 0.3 -> 0.4 (a flash in a room barely blinded).
  flash: { fuse: 0.9, radius: 12, blind: 3.2, minBlind: 0.4, awayFactor: 0.4, edge: 0.6, hearing: 18 },
  // Frag: damage falling off linearly to 0 at `radius` (31 oct: 4.2 m / 160 -> 3 m / 190: about as
  // deadly up close, lethal to 100 hp within ~1.4 m, but it no longer reaches across a whole room).
  frag: { fuse: 1.1, radius: 3.0, damage: 190, minDamage: 8, hearing: 22 },
  // Carga de brecha: planted on arrival (prepTime), fired by the release. The door is destroyed.
  // `stun`: s whoever is behind it stands frozen, scaled by the planter's modifiers.breachStun (the Brecha's are longer).
  // `concussion`: s the Brecha's charge leaves reeling (blind and frozen) whoever is beyond the door within
  // radius × his modifiers.breachConcussion (sim/entries.js concussion): half as long at the edge.
  breach: { prepTime: 1.8, fuse: 0.35, radius: 3.0, damage: 75, blind: 1.8, stun: 0.5, hearing: 22, depth: 0.25, concussion: 1.1 },
  // Cámara de fibra óptica (the Explorador's, roles with ability 'fiberCam'): on arrival he threads it under
  // the closed door (prepTime) and, while he waits there, sees the room from the floor beyond it: an eye
  // `under` m past the door, `fov` wide, `range` m. Silent; it only reveals. On release he opens the door.
  cam: { prepTime: 1.0, fov: 150 * DEG, range: 11, under: 0.18 },
  // Thrown from any waypoint to a point the player picks (waypoint.toss; not only through a door).
  tossItems: Object.freeze(['flash', 'frag', 'smoke', 'molotov', 'gas']),
  tossRange: 9, // m at most from the thrower (short of the first wall on the way)
  // Humo: a cloud that blocks sight (not bullets) for `seconds`, growing to `radius` in `grow` s,
  // thinning out over the last `fade` s. Up to `max` clouds at once (the oldest clears first).
  // Incendiaria (defenders only, sim/fire.js): a pool `radius` wide burning `seconds`, `dps` to whoever is in it.
  molotov: { fuse: 0.5, hearing: 10, radius: 1.8, seconds: 7, dps: 22, tick: 0.25 },
  smoke: { fuse: 0.6, hearing: 6, radius: 2.6, grow: 1.4, seconds: 14, fade: 2, sides: 8, max: 4 },
  // Gas lacrimógeno (the Granadero's 40 mm launcher, sim/gas.js): a cloud `radius` wide for `seconds` that
  // does not hide anyone but hurts whoever breathes it: he sees only `vision` m, aims `spread` times worse,
  // reacts `reaction` times slower and coughs (heard, NOISE.radius.cough) every `coughEvery` s. An AI
  // defender caught in it gets out (falls back if he has where to). It kills nobody.
  gas: { fuse: 0.8, hearing: 9, radius: 3.0, grow: 0.8, seconds: 10, fade: 2, vision: 3, spread: 3, reaction: 2.1, coughEvery: 1.4 },
});

/**
 * Suppression (sim/stress.js): stress 0-1 per soldier, from bullets passing close, wounds,
 * explosions and teammates falling in sight; it eases off after a calm moment. It costs aim and
 * reaction and, past `pinAt`, a moment flat on the floor. Both sides, the AI too.
 */
export const STRESS = Object.freeze({
  nearMissRadius: 1.5, // m from a bullet's line
  nearMiss: 0.22, // per bullet passing right by (half of it at nearMissRadius)
  wound: 0.3,
  blast: 0.6, // an explosion right by him (falling to 0 at blastReach × its radius)
  blastReach: 2,
  allyDown: 0.3, // a teammate falling in sight within allyRange
  allyRange: 14,
  calmDelay: 1.2, // s without any of that before it eases off...
  decay: 0.35, // ...this much per second
  spread: 1.0, // aim error × (1 + spread · stress)
  reaction: 0.4, // time to react × (1 + reaction · stress)
  pinAt: 0.75, // at this stress he hugs the floor...
  pinSeconds: 0.6, // ...this long (not walking his route)...
  pinCooldown: 3, // ...and not again before this
});

/**
 * Wounds that last (sim/wounds.js): a bullet in a limb is a leg or an arm. Leg: slower, louder
 * steps. Arm: worse aim, slower reload. Nobody heals. Below `bleedBelow` of his health a soldier
 * leaves a blood drop every `bleedEvery` m he walks: the other side sees it when it comes into its
 * sight (information, not a reveal).
 */
export const WOUNDS = Object.freeze({
  legShare: 0.5, // of the limb hits, the legs
  legSpeed: 0.6,
  legStepNoise: 1.5, // his steps are heard this much farther (NOISE.radius.step / sneak)
  armSpread: 1.5,
  armReload: 1.3,
  bleedBelow: 0.5,
  bleedEvery: 0.9, // m walked per drop
  maxDrops: 240, // the round keeps the latest
  spotEvery: 15, // steps between the checks of who sees new drops
});

export const ROUND = Object.freeze({
  // The assault is played in We-Go turns (sim/round.js): both sides plan blind, then
  // every order runs at once for turnSeconds. The bomb's timer only runs while a turn
  // executes (deciding is free): at 0 it explodes, even mid-defuse — the defenders win.
  turnSeconds: 10, // s of execution per turn (design: 5 s; 10 s since 31 oct: the turns felt cut short)
  timeLimit: 90, // s on the bomb's timer (of execution: 9 turns; a sim without phases runs this long)
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
  radius: Object.freeze({ cough: 7, wire: 10, sneak: 2, reload: 5, step: 6, gravel: 7, metal: 8, glass: 9, door: 7, kick: 12, shot: 34, plant: 8, defuse: 10, bash: 14, trap: 14, flash: 18, frag: 22, breach: 22 }),
  rank: Object.freeze(['sneak', 'reload', 'step', 'gravel', 'metal', 'glass', 'cough', 'door', 'wire', 'plant', 'defuse', 'kick', 'bash', 'trap', 'shot', 'flash', 'frag', 'breach']), // quiet -> loud
});

/**
 * Utility points (sim/prep.js): every operator carries his class's kit
 * (config/operators.js `gear`), free and full again every round, and gets
 * `points` to add utility on top of it: the attackers in the buy phase, the
 * defenders in the preparation. Unspent points are lost: nothing but the
 * class carries over to the next round. In a match the side that lost the
 * last round gets `lossBonus` more each (session/Match.js).
 */
export const BUY = Object.freeze({
  points: 2, // per operator and round
  lossBonus: 1, // each, for the side that lost the last round of a match
  prices: Object.freeze({ flash: 1, frag: 1, smoke: 1, breach: 1, molotov: 2 }), // points
  max: Object.freeze({ flash: 2, frag: 1, smoke: 1, breach: 2, molotov: 1 }), // carried at most (kit included)
  items: Object.freeze(['flash', 'frag', 'smoke', 'breach']), // the attackers' panel, in order
  defenderItems: Object.freeze(['flash', 'frag', 'smoke', 'molotov']), // the defenders' (no charges; the incendiaria is theirs only)
});

/**
 * AI defenders' utility (sim/prep.js aiPrepare, sim/ai.js; only a side the AI
 * commands: a player's defenders throw what he plans): what they buy, in
 * order while their points last, and when they throw it during the assault.
 * An alerted defender who is not fighting throws at the doorway / corner the
 * noise will come through (the spot he watches) once it is in reach and in
 * sight, with no teammate within `friendlyMargin` of the blast: a grenade
 * first, else smoke to shut that way. An incendiaria goes on the bomb while an
 * attacker defuses it, when it is in reach and in sight.
 */
export const AI_UTILITY = Object.freeze({
  buy: Object.freeze(['flash']), // a grenade or smoke more per defender left the attackers at 39 % / 56 % (scripts/balance.mjs)
  throws: Object.freeze(['frag', 'molotov', 'smoke']), // what an alerted defender throws, first one he carries
  minRange: 3, // m: closer than this to the spot, he fights instead (a grenade: never within its radius of him)
  friendlyMargin: 1.2, // m added to a grenade's blast radius around him and his teammates
  cooldown: 6, // s between two throws of the same defender
  molotovs: 1, // defenders who buy an incendiaria (the closest to the bomb first) and burn a defuse with it
});

/** Defender preparation (sim/prep.js): set-up rules and the watch orders. */
export const PREP = Object.freeze({
  barricades: 2, // per round (free for now)
  wires: 1, // barbed wire per round (sim/wires.js)
  barricadeReach: 0.5, // m: a door counts as in the defenders' half this close to it
  sweepPeriod: 6, // s of a full sweep (watch order "barrer")
  sweepArc: 70 * DEG, // the sweep a player gives covers this much, centred on the facing he set
  minSpacing: 0.7, // m between two defenders placed in the set-up
});

/**
 * Barbed wire (sim/wires.js): across a doorway, it slows the attackers who
 * cross it (within `radius` of its center) to `slow` and rattles when one
 * steps in (AI defenders within `hearing` turn to it). A grenade or a breach
 * charge clears it. Seen like a barricade within `spotRange`.
 */
export const WIRE = Object.freeze({
  radius: 0.9, // m from the doorway's center
  slow: 0.5, // 0.35 left the attackers at 43 % (scripts/balance.mjs)
  hearing: 12, // m
  spotRange: 12, // m
  fragCut: 2.5, // m: a grenade this close clears it
  cutTime: 0.8, // s the Brecha kneels to cut it with his pliers (silent)
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

/**
 * Defender cameras (sim/cameras.js, map `cameraMounts`): a fixed eye on a
 * wall, `max` of them on the mounts the defenders pick. While it keeps an
 * attacker in sight for `detect` s every AI defender is told where he is (as if they heard him, COMBAT.alertDuration). The
 * attackers see it like an enemy (their cones, the drone) and whoever has it
 * in sight within `shootRange` and nothing else to shoot breaks it in
 * `shootDelay` s (one loud shot).
 */
export const CAMERA = Object.freeze({
  max: 2, // cameras a side mounts (map `cameraMounts`; the AI: `aiCameras[site]`)
  fov: (80 * Math.PI) / 180,
  range: 15, // m
  detect: 0.3, // s in sight before it reports
  realert: 2, // s between two reports while it keeps seeing someone
  alertSeconds: 6, // s the defenders watch the reported spot
  spot: 9, // m: small and high on the wall, an attacker notices one he did not know of only this close (the drone: anywhere in its cone)
  shootRange: 12, // m (inside its range: even a known camera sees you coming before you can break it)
  shootDelay: 1.2, // s the attacker spends finding and aiming at it
  shootDelayKnown: 0.6, // s when it was already known (the drone found it): he walks in aiming at it
});

/**
 * Vigía (role ability 'monitor', sim/cameras.js): a defender on the monitor watch order looks at the
 * screen, not at his angle. While he does, every live camera reports at once (`detect` s) every attacker
 * it sees, not only the first; he himself sees only `fov` × his field and reacts `reaction` × slower.
 */
export const MONITOR = Object.freeze({ detect: 0, fov: 0.35, reaction: 1.8 });

/**
 * Escudo (role ability 'shield', sim/combat.js): a ballistic shield held in front. A bullet coming from
 * within `arc` of his facing stops on it (`leak`: the chance it finds a leg or an arm instead); whoever
 * is right behind him is covered too, because the bullet stops first. Grenades, fire and flashes are not
 * stopped.
 */
// Each bullet stopped on it jolts him (sim/combat.js joltShield): `jolt` of aim error, recovered like recoil
// (COMBAT.recoilRecovery), up to COMBAT.maxRecoil + `joltMax`, and `joltDelay` s more to a first shot he had
// not fired yet. Sustained fire pins him behind it; one slow shot (the bolt-action sniper) does not.
export const SHIELD = Object.freeze({ arc: 60 * DEG, radius: 0.42, leak: 0.15, jolt: 2.2 * DEG, joltMax: 3.5 * DEG, joltDelay: 0.1 });

/**
 * Ancla (role ability 'prepared', sim/combat.js): at the start of the assault he puts up a portable
 * ballistic barrier in front of his post (facing his watch). While he stays within `reach` m of it,
 * a shot from within `arc` of its facing meets low cover (COVER) and he takes `damage` × of what gets
 * through. Walk away and it stays there, useless to him.
 */
export const PARAPET = Object.freeze({ reach: 0.7, arc: 75 * DEG, damage: 0.8, ahead: 0.55, width: 1.0, height: 0.9 });

/**
 * Trampero's traps (sim/traps.js). An attacker who steps within `trigger` is
 * caught: `stun` s without moving, `damage`, a loud snap, and the defenders
 * learn where he is. Hard to see: an attacker notices one in sight within
 * `spot` only while sneaking (the drone within `droneSpot`, the Explorador's
 * notices them farther and walking normally: modifiers.trapSpot); a known one in sight within `shootRange` he
 * breaks with one shot after `shootDelay`.
 */
export const TRAP = Object.freeze({
  perTrapper: 2,
  trigger: 0.9, // m
  stun: 0.6, // s (2 left the Trampero at +21 points in the Hotel: scripts/balance-clases.mjs)
  damage: 5,
  spot: 5.5, // m
  droneSpot: 4, // m
  shootRange: 10, // m
  shootDelay: 0.5, // s
  minSpacing: 1.5, // m between two traps
});

/**
 * Match against the AI (session/Match.js): best of `bestOf` (3, 5 or 7, the lobby's choice;
 * this is the default), so first to bestOf/2 + 1 rounds. Each attacker keeps
 * his class into the next round; the side that lost a round gets
 * BUY.lossBonus more utility points in the next one. The player switches
 * sides after half the series (3 rounds of a best of 7).
 */
export const MATCH = Object.freeze({ bestOf: 7, formats: Object.freeze([3, 5, 7]) });
