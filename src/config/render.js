// Render tuning: camera, fog of war, lighting, overlays and FX.
// Owner: visual. Pure data; nothing here affects the simulation.
import { DEG } from '../core/math.js';

/** Resolution caps: phones have 3x screens but fill-rate is the bottleneck. */
export const DISPLAY = Object.freeze({
  maxPixelRatio: 2, // desktop / mouse devices
  maxPixelRatioTouch: 1.5, // touch devices (phones, tablets)
  antialias: true,
  // Dynamic resolution: when frames stay slow the pixel ratio steps down
  // (never below minPixelRatio) and climbs back once there is headroom.
  adaptive: Object.freeze({
    enabled: true,
    windowSeconds: 2, // averaging window
    slowFrameMs: 25, // average above this -> lower the ratio
    fastFrameMs: 13, // average below this -> raise it again
    step: 0.25,
    minPixelRatio: 1,
    raiseAfterWindows: 3, // fast windows in a row before stepping up (6 s)
    ceilingSeconds: 30, // after a step down, the slow ratio is off-limits this long (no oscillation)
    hitchSeconds: 0.25, // longer frames are hitches (tab switch, loading), not load
  }),
  // Frame pacing (render/FramePacer.js): nothing moving -> no full-rate redraws.
  idleFps: 15, // planning / pause with only cosmetic loops (route dashes, ring ticks)
  inputAwakeSeconds: 0.9, // full rate this long after any pointer / key input (pings, previews)
});

export const CAMERA = Object.freeze({
  fovY: 38 * DEG,
  startHeight: 20,
  minHeight: 9,
  maxHeight: 38,
  zoomSmoothing: 12, // higher = snappier
  mapMargin: 4, // how far the camera center may leave the map (m)
  shakeDecay: 7,
  maxShake: 0.35,
  shakeFloorDecay: 0.02, // linear decay per second so tiny shakes end
  shakeGain: 2.2, // shake amount -> offset (m), squared response
  shortScreenPx: 520, // viewports shorter than this (phones in landscape)...
  shortScreenZoom: 0.8, // ...start this much closer
  nearPlane: 0.5,
  farPadding: 10, // far plane = camera height + padding
});
// Input-side camera controls (zoom step, pan speed, edge scroll) live in config/input.js.

/** Visual scale of characters (gameplay radius is in config/balance.js). */
export const CHARACTER_SCALE = 1.05; // shoulders ~0.46 m wide: inside the 0.56 m a stack keeps between centres (#13)

/** Character animation feel (render/layers/UnitLayer.js). */
export const ANIMATION = Object.freeze({
  walkCyclePerMeter: 7.2, // walk phase radians per meter walked
  walkBlendSpeed: 10, // how fast the walk cycle fades in/out (1/s)
  recoilRecovery: 9, // gun kick decay (1/s)
  deathSlide: 0.4, // m a falling body slides along the killing shot
  deathTurnSpeed: 1.6, // fraction of the fall after which the body faces the shot
  bombYaw: 0.4, // the bomb lying on the floor
  hitTint: [1, 0.92, 0.85], // flash color when hit
  hitTintStrength: 0.75,
  aimBlendSpeed: 9, // low ready <-> shouldered (1/s)
  reloadBlendSpeed: 10,
});

/**
 * Visible gear per operator role id (config/operators.js ROLES): head cover,
 * pack and an optional extra. Classes must be told apart by silhouette on a
 * phone, so each one changes the outline, not only a color. Unknown roles
 * fall back to their team default. head: helmet | heavy | cap | beanie;
 * pack: large | small | none; extra: charges | antenna | tools | null.
 */
export const ROLE_GEAR = Object.freeze({
  assault: { head: 'helmet', pack: 'large', extra: null },
  entry: { head: 'heavy', pack: 'none', extra: 'charges' },
  scout: { head: 'helmet', pack: 'small', extra: 'antenna' },
  anchor: { head: 'heavy', pack: 'none', extra: null },
  defender: { head: 'cap', pack: 'small', extra: null },
  roamer: { head: 'cap', pack: 'none', extra: null },
  trapper: { head: 'beanie', pack: 'small', extra: 'tools' },
  shield: { head: 'heavy', pack: 'none', extra: null }, // + the shield itself (UnitLayer)
  marksman: { head: 'helmet', pack: 'small', extra: null },
  grenadier: { head: 'helmet', pack: 'large', extra: 'charges' }, // 40 mm rounds on the pack
  lookout: { head: 'cap', pack: 'small', extra: 'antenna' }, // the monitor's radio
  sniper: { head: 'beanie', pack: 'none', extra: null },
  shotgunner: { head: 'helmet', pack: 'small', extra: null },
});
export const TEAM_GEAR = Object.freeze({
  attackers: { head: 'helmet', pack: 'large', extra: null },
  defenders: { head: 'cap', pack: 'small', extra: null },
});

/** Gun models keyed by weapon id (config/weapons.js). length (m) places the muzzle. */
export const WEAPON_MODELS = Object.freeze({
  rifle: { length: 0.78 },
  smg: { length: 0.58 },
  pistol: { length: 0.34 },
  dmr: { length: 0.9 },
  shotgun: { length: 0.82 },
  sniper: { length: 1.0 },
});

export const HEIGHTS = Object.freeze({
  wall: 2.2,
  fence: 1.15,
  sill: 0.95, // window sill (map `windows`): below the muzzle, you shoot over it
  door: 1.95,
  muzzle: 1.2, // z of tracers / muzzle flashes (matches the scaled gun height)
  label: 1.45, // z used to place DOM labels over units (just above the head at CHARACTER_SCALE)
  floorDecal: 0.006,
  bloodDecal: 0.012,
  overlay: 0.03,
});

export const FOG = Object.freeze({
  pixelsPerMeter: 12, // vision mask resolution
  blurTexels: 1.25,
  // Execution (Redie): unseen = near black, but the remembered layout stays legible.
  explored: 0.3, // brightness of remembered areas
  unexplored: 0.12, // brightness of never-seen areas
  memoryTint: [0.78, 0.86, 1.0], // cool tint for remembered areas
  memorySaturation: 0.15,
  memoryWallBoost: 2.1, // remembered wall/prop sides are this much brighter: the layout reads as a plan
  wallSampleOffset: 0.2, // wall faces sample vision this far in front of themselves
});

/**
 * Planning / pause "blueprint" (Door Kickers tactical plan): everything the
 * squad does not see is drawn as a plan — pale wall caps on deep blue, doors
 * in amber, furniture in mid blue, a faint 1 m grid. Enemies stay hidden (the
 * unit layer only draws what the sim says is seen). Execution goes back to the
 * black Redie fog through a circular wipe centred on the squad.
 * Validated at 0.6x brightness (outdoor phone): every door still separates.
 */
export const BLUEPRINT = Object.freeze({
  deep: [0.03, 0.062, 0.115], // floor, dark end (linear-ish 0..1 rgb)
  high: [0.11, 0.21, 0.35], // floor, light end (floor luminance picks between both)
  line: [0.86, 0.95, 1.0], // wall caps + grid
  prop: [0.26, 0.4, 0.58], // furniture
  door: [1.0, 0.66, 0.2], // door slabs (accent)
  doorAmount: 0.85,
  paintKeep: 0.82, // site paint / blood keep this much of their own color
  gridAlpha: 0.07,
  wipeSeconds: 0.55, // plan <-> execution transition
  wipeBand: 5, // m, soft edge of the circular wipe
});

/** Baked ceiling-lamp pools on every floor area (render/textures/shadowMap.js). */
export const LAMPS = Object.freeze({
  spacing: 6.5, // m between lamps in big rooms
  radius: 0.62, // pool radius as a fraction of the lamp cell
  base: 0.18, // light level between pools (0..1 in the bake)
  floor: 0.76, // floor brightness = floor + gain * bake
  gain: 0.4,
});

/** Baked cosmetic floor dressing (render/textures/floorDecor.js). */
export const DECOR = Object.freeze({
  pixelsPerMeter: 40,
});

export const LIGHTING = Object.freeze({
  direction: [0.45, 0.62, -1.0], // direction light travels: from the top-left of the screen, downward
  ambient: 0.48, // night (realism stage 6): was 0.6
  diffuse: 0.44, // night: was 0.5
  shadowOffset: [0.42, 0.55], // wall shadow offset on floor (m), matches light direction
  shadowStrength: 0.42,
  shadowTint: [0.52, 0.6, 0.82],
  shadowPixelsPerMeter: 16,
  shadowBlurPx: 7,
  aoBlurPx: 10,
  aoStrength: 0.35,
  maxDynamicLights: 8,
});

export const OUTLINE = Object.freeze({
  width: 0.028, // m
  strength: 0.78,
});

/** Night (config/balance.js NIGHT): the dark rooms' shade over the floor and the flashlights' beams. */
export const NIGHT_LOOK = Object.freeze({
  shade: [0.02, 0.03, 0.08, 0.62], // over a dark room's floor
  beam: [1, 0.95, 0.78, 0.34], // at the flashlight, fading to `beamEdge` at its reach
  beamEdge: [1, 0.95, 0.78, 0],
});

export const OVERLAY = Object.freeze({
  routeWidthPx: 4,
  routeWidthIdlePx: 2.4,
  routeOutlinePx: 3,
  waypointRadiusPx: 6,
  dashLength: 0.42,
  dashGap: 0.28,
  dashSpeed: 1.6, // m/s flow animation along the selected route
  chevronSpacing: 0.95, // m between direction chevrons on the selected route
  chevronSizePx: 6.5,
  selectTickSpeed: 0.8, // rad/s rotation of the selection ring ticks
  coneEdgeLength: 2.6, // m, visible part of the FOV edge lines
  lookArrowLength: 1.25,
  lastKnownSeconds: 7,
  hoverPathAlpha: 0.45,
  // Rings under units (m). Sized to the body (balance.js UNIT.radius 0.28): a stack at 2r reads as
  // separate, nearly tangent circles instead of one blob of overlapping rings.
  unitRing: Object.freeze({
    shadow: 0.36, // soft contact shadow
    own: 0.31, // own operators
    selected: 0.35, // selected operator (+ spinning ticks at selectTicks)
    selectTicks: 0.43,
    hover: 0.4,
    enemy: 0.31, // seen enemy, with a facing tick from enemyTick[0] to enemyTick[1]
    enemyTick: Object.freeze([0.38, 0.55]),
    waitGo: 0.4, // pulsing white ring of an operator waiting for GO (+ pulse amplitude)
    waitGoPulse: 0.06,
    blind: 0.52, // flashed / dazed unit: pale yellow flicker ring
    prep: 0.47, // progress arc of an entry being prepared (cracking a door, planting a charge)
  }),
  // Door entries: dashed link waypoint -> doorway and a marker on the doorway, per mode (rgb).
  entryColors: Object.freeze({ kick: [1, 1, 1], mirror: [0.6, 0.85, 1], pie: [0.95, 0.75, 0.95], flash: [1, 0.96, 0.62], frag: [0.72, 0.85, 0.45], breach: [1, 0.69, 0.18], cam: [0.6, 0.88, 0.36], smoke: [0.78, 0.8, 0.82], molotov: [1, 0.45, 0.15], gas: [0.86, 0.9, 0.55] }),
  smokeColor: [0.72, 0.74, 0.76], // a smoke cloud (sim/smoke.js)
  gasColor: [0.88, 0.9, 0.58], // tear gas (sim/gas.js): a thin yellowish haze
  // Defender cameras (sim/cameras.js), seen from above and to scale: a wall plate, a short arm and the
  // body with its lens toward `facing`. length / width: m. What makes them easy to find is the red
  // recording light: it blinks (blink: s per on/off) with a halo that grows to haloPx, and is never
  // drawn smaller than ledPx (screen px). coneAlpha / edgeAlpha: its field of view on the floor
  // (fill, outline); ghost: a free mount's dashed outline while the defender picks (ui/CameraMounts.js).
  camera: Object.freeze({ length: 0.42, width: 0.2, ledPx: 2.6, haloPx: 9, blink: 0.6, color: [1, 0.33, 0.3], coneAlpha: 0.13, edgeAlpha: 0.6, ghostAlpha: 0.45, spotPulse: 1.2 }),
  trap: Object.freeze({ size: 0.28, color: [1, 0.62, 0.18], steel: [0.78, 0.8, 0.83] }), // Trampero's traps (sim/traps.js)
  entryMarker: 0.2, // m, half-size of the doorway marker
  grenadeRadius: 0.09, // m, a grenade in flight / on the floor
  glyphPx: 13, // px: half-size of a grenade's pictogram where it will land / at the door it goes through
  glyphFlightPx: 11, // px: ...and of one in flight
});

/** Feedback pings (render/layers/OverlayPings.js): life (s), radii (m), ring width (px). */
export const PINGS = Object.freeze({
  select: { life: 0.35, r0: 1.1, r1: 0.55, widthPx: 3, color: [1, 1, 1], follow: true },
  waypoint: { life: 0.4, r0: 0.08, r1: 0.55, widthPx: 3, color: [1, 1, 1] },
  look: { life: 0.35, r0: 0.2, r1: 0.7, widthPx: 2.5, color: [1, 1, 1] },
  hold: { life: 0.5, r0: 0.15, r1: 0.8, widthPx: 3.5, color: [1, 1, 1] },
  clear: { life: 0.45, r0: 0.6, r1: 0.2, widthPx: 2.5, color: [1, 0.35, 0.3] },
  go: { life: 0.7, r0: 0.4, r1: 2.0, widthPx: 4, color: [0.56, 0.89, 0.42], follow: true },
  door: { life: 0.35, r0: 0.3, r1: 1.5, widthPx: 3, color: [1, 1, 1] },
  kill: { life: 0.8, r0: 0.3, r1: 0.9, widthPx: 3, color: [1, 0.25, 0.2] },
  scout: { life: 0.9, r0: 0.3, r1: 1.6, widthPx: 3, color: [0.6, 0.88, 0.36] }, // the Explorador threads his camera
  glint: { life: 0.7, r0: 0.15, r1: 0.9, widthPx: 3, color: [0.85, 0.95, 1] }, // a mirror under a door, caught from the room
});

export const FX = Object.freeze({
  tracerLife: 0.085,
  tracerWidth: 0.05,
  trailLife: 0.45, // faint smoke left along the bullet path (s)
  trailWidth: 0.035,
  flashLife: 0.055,
  flashSize: 0.62,
  flashGlow: 0.9, // radius of the additive glow on the floor under the muzzle (m)
  debrisLife: 12, // chips / splinters stay on the floor (s)
  smokePerShot: 2,
  smokeLife: [0.9, 1.6],
  casingLife: 25,
  bloodDropsHit: 9,
  bloodDropsDeath: 22,
  bloodRed: [0.86, 0.02, 0.03],
  bloodDark: [0.55, 0.0, 0.02],
  muzzleLight: { radius: 4.5, intensity: 0.85, life: 0.07, color: [1.0, 0.75, 0.4] },
  shake: { ownShot: 0.025, death: 0.12, door: 0.07, hitTaken: 0.18, flash: 0.12, frag: 0.3, breach: 0.35 },
  // Grenades and the breach charge (render/fx/FxDirector.js).
  flashLight: { radius: 9, intensity: 2.6, life: 0.45, color: [1, 0.98, 0.9] },
  blastLight: { radius: 7, intensity: 2.0, life: 0.35, color: [1, 0.6, 0.25] },
  maxParticles: 4000,
  maxDecals: 700,
  hitFlashSeconds: 0.09,
  deathFallSeconds: 0.38,
  spotPulseSeconds: 0.7,
});
