// Simulation tuning: every gameplay number lives here, not in sim code.
import { DEG } from '../core/math.js';

export const SIM = Object.freeze({
  tickRate: 60, // fixed steps per second
  seed: 20261025,
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
  engageFactor: 0.55, // speed multiplier while shooting at a target
  turnRate: 430 * DEG, // rad/s
  combatTurnRate: 820 * DEG,
  footstepStride: 0.82, // m between footstep events
  friendlySpacing: 0.55, // soft separation between allies (m)
  separationStrength: 3.0,
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
  reaction: { attackers: 0.19, defenders: 0.45 }, // seconds before first shot at a new target
  reactionJitter: 0.14,
  reactionPerRadian: 0.13, // extra reaction for each radian the shooter must turn
  aimTolerance: 5 * DEG, // must be this well aligned to shoot
  headshotChance: 0.16,
  headshotMultiplier: 3,
  recoilPerShot: 0.55 * DEG,
  recoilRecovery: 7 * DEG, // per second
  maxRecoil: 4.5 * DEG,
  accuracy: { attackers: 1.0, defenders: 1.4 }, // spread multiplier per team
  hearingRadius: 15, // defenders turn toward gunfire within this distance
  alertDuration: 4.5,
  lostTargetMemory: 2.5, // seconds a unit keeps watching where a target vanished
  tacticalReloadFraction: 0.34,
});

export const DOORS = Object.freeze({
  triggerDistance: 0.85, // a moving unit this close to a closed door opens it
  openAngle: 98 * DEG,
  swingSpeed: 640 * DEG, // rad/s
  kickPause: 0.16, // the opener stops this long (the "breach" beat)
  thickness: 0.12,
});

export const ROUND = Object.freeze({
  timeLimit: 120, // seconds of execution
  plantTime: 4.0,
  bombPickupRadius: 0.7,
});

export const NAV = Object.freeze({
  cellSize: 0.2,
  clearance: 0.33, // distance kept from walls by planned paths
  dragSpacing: 0.6, // freehand drawing adds a point every N meters
  snapRadius: 1.5, // clicks inside obstacles snap to walkable ground within this radius
  maxRoutePoints: 220,
});
