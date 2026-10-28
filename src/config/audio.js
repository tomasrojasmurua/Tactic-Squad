// Audio tuning: mix, master chain, voices, spaces, per-event levels, weapon
// recipes, music and ambience. Owner: audio. Pure data — the synthesis code
// ("art as code") lives in audio/recipes/*, the runtime in audio/*.
import { DOORS } from './balance.js';

/** How long a kicked door takes to swing open (the slam is scheduled after it). */
export const DOOR_SWING_SECONDS = DOORS.openAngle / DOORS.swingSpeed;

/** Offline baking of one-shots into buffers (audio/SoundBank.js). */
export const BAKE = Object.freeze({
  // Hz. One-shots and loops are baked at the context's own rate: a buffer played at its native rate with
  // playbackRate 1 costs ~9x less CPU than a resampled one (measured). 48 kHz is the usual rate; other
  // devices get a one-time cubic resample when the context is created.
  sampleRate: 48000,
  musicSampleRate: 24000, // rare long music one-shots (stinger boom); drums are native, tonal notes are live
  midSampleRate: 24000, // beds / stops with nothing above ~11 kHz (vent loops, door stop): half the memory
  darkSampleRate: 11025, // rare, dark, long ambience one-shots (siren, airliner): memory over CPU
  seed: 0x5eed, // variations are deterministic: same sounds every session
  edgeFadeSeconds: 0.004, // raised-cosine fade at the end of every baked buffer
  tailFloorDb: -60, // trailing samples below this (re. the peak) are trimmed: masked by the reverb, -0.9 MB
  dcBlockHz: 12, // DC blocker applied after synthesis
  lowpassHz: 13500, // gentle 2-pole low-pass on one-shots: keeps playback resampling images inaudible
  peakDb: -1, // each sound group is normalized to this peak (levels then come from config)
  sliceMs: 8, // max main-thread time per baking slice
  // Bake tiers (audio/recipes/index.js `tier`): 'plan' (interface, beds, music) starts after the first
  // frame; 'combat' starts combatDelaySeconds after 'plan' is done, or at once when a round runs.
  combatDelaySeconds: 1.5,
});

export const MIX = Object.freeze({
  master: 1,
  sfx: 0.85,
  ui: 0.3,
  music: 0.32,
  ambience: 0.16,
  muteSeconds: 0.05, // time constant of mute / unmute
  hearingDistance: 36, // m: beyond this, world sounds are silent (except gunfire)
  panWidth: 0.8,
});

/** Master chain: buses -> glue compressor -> limiter -> soft clip -> output. */
export const MASTER = Object.freeze({
  highpassHz: 28, // removes DC / sub rumble that phone speakers can't play anyway (and frees headroom)
  glue: { threshold: -12, knee: 8, ratio: 2.5, attack: 0.005, release: 0.2 },
  limiter: { threshold: -1.5, knee: 0, ratio: 20, attack: 0.001, release: 0.08 },
  // DynamicsCompressor (Chromium/WebKit) adds automatic makeup gain (~+3.8 dB with the settings above);
  // this trim cancels most of it: the chain is ~transparent (+1.3 dB) below threshold, so quiet beds stay
  // quiet and only loud moments are compressed. Verified by tests/audio-lab.cjs.
  trim: 0.75,
  clipCeiling: 0.97, // soft clipper: linear below ~0.8, never above this
});

/** Tactical pause = "time stopped": world muffled, music filtered, tails keep ringing. */
export const PAUSE = Object.freeze({
  lowpassHz: 480,
  q: 1.4,
  worldGain: 0.6,
  musicLowpassHz: 650,
  seconds: 0.09, // time constant of the transition
  openHz: 18000,
});

/** Simultaneous voices. Over a category limit the oldest one is stolen (with a fade). */
export const VOICES = Object.freeze({
  max: 36,
  stealFadeSeconds: 0.015,
  categories: {
    gun: { limit: 10, priority: 9 }, whiz: { limit: 3, priority: 8 }, impact: { limit: 8, priority: 6 },
    body: { limit: 4, priority: 7 }, door: { limit: 4, priority: 7 }, foley: { limit: 6, priority: 4 }, // foley: reloads, dry fire, mags
    casing: { limit: 6, priority: 2 }, step: { limit: 8, priority: 3 }, ambience: { limit: 3, priority: 1 },
    ui: { limit: 6, priority: 10 }, music: { limit: 14, priority: 5 },
  },

});

/** World point -> stereo pan + gain relative to the camera (audio/Spatializer.js). */
export const SPATIAL = Object.freeze({
  zoomGainBase: 1.1, // gain = falloff² * (base - cameraHeight / heightDivisor)
  zoomGainHeightDivisor: 80,
  minAudibleGain: 0.01,
});

/** Gunfire low-pass by distance: [near, at hearing distance] Hz (air absorption + walls). */
export const DISTANCE_LOWPASS = Object.freeze([16000, 2200]);

/** Convolution reverbs (impulses precomputed once at unlock, audio/reverb.js). */
export const REVERB = Object.freeze({
  room: { seconds: 0.85, predelay: 0.006, early: 14, earlyWindow: 0.035, brightDecay: 0.12, darkDecay: 0.32, gain: 0.5 },
  yard: { seconds: 1.7, predelay: 0.012, slaps: [0.072, 0.15, 0.29], slapGain: 0.45, brightDecay: 0.18, darkDecay: 0.55, gain: 0.42 },
});

/** Acoustic spaces: which reverb, how wet, and how gunfire tails behave there. */
export const ZONES = Object.freeze({
  room: { reverb: 'room', send: 0.2 },
  hall: { reverb: 'room', send: 0.34 }, // the big concrete bomb-site hall
  yard: { reverb: 'yard', send: 0.3 },
});

/** Floor pattern (config/materials.js FLOORS[].pattern) -> footstep surface + space. */
export const FLOOR_ACOUSTICS = Object.freeze({
  checker: { surface: 'tile', zone: 'room' }, tiles: { surface: 'tile', zone: 'room' }, wood: { surface: 'wood', zone: 'room' },
  carpet: { surface: 'carpet', zone: 'room' }, rug: { surface: 'carpet', zone: 'room' },
  concrete: { surface: 'concrete', zone: 'hall' }, asphalt: { surface: 'asphalt', zone: 'yard' },
});
export const DEFAULT_ACOUSTICS = Object.freeze({ surface: 'asphalt', zone: 'yard' });

/** Impact sound group (audio/recipes: impact.<name>) per struck surface (EV.SHOT.material, config/materials.js). */
export const IMPACT_SOUNDS = Object.freeze({ plaster: 'wall', ceramic: 'wall', wood: 'wood', fabric: 'wood', metal: 'metal' });

/** Headgear that turns a head hit into a helmet clank (config/render.js ROLE_GEAR head); bare heads get impact.head. */
export const HELMET_HEADGEAR = Object.freeze(['helmet', 'heavy']);

/**
 * Level of each world sound (linear gain before spatialization) and random
 * gain variation at playback (dB). No runtime pitch jitter: resampled voices
 * cost ~9x more CPU, so variety comes from the baked variations instead.
 */
export const EVENT_SOUNDS = Object.freeze({
  gunshot: { gain: 1, minGain: 0.14, db: 1.2, farSendMul: 2.2 }, // gunfire carries further than other sounds
  impact: { gain: 0.5, db: 2 },
  ricochet: { gain: 0.22, chance: 0.22, db: 2 },
  whiz: { gain: 0.55, db: 1.5 },
  casing: { gain: 0.3, minShotGain: 0.28, delay: [0.26, 0.42], db: 2.5, send: 0.05 },
  flesh: { gain: 0.5, db: 1.5, limbGain: 0.75 }, // limb hits land softer
  head: { gain: 0.62, db: 1.2 }, // head hits (helmet clank or bare-head knock): the loudest body impact
  bodyFall: { gain: 0.55, delay: 0.3, db: 1.5 },
  gunDrop: { gain: 0.4, delay: 0.46, db: 2 },
  footstep: { gain: 0.6, db: 2, send: 0.35 }, // send is relative to the zone send
  gear: { gain: 0.22, chance: 0.35, delay: 0.03, db: 3 },
  doorKick: { gain: 0.95, db: 1.2 },
  doorSlam: { gain: 0.6, db: 2 },
  doorCreak: { gain: 0.28, chance: 0.55, delay: 0.04, db: 3 },
  doorPush: { creakGain: 1.5, slamGain: 0.55 }, // EV.DOOR_OPEN mode 'push': no kick, a sure creak, a softer stop
  doorCrack: { gain: 0.3, db: 2 }, // mode 'crack': eased ajar, a long quiet creak
  blast: { gain: 1, minGain: 0.2, db: 1, farSendMul: 2 }, // frag grenade / breach charge: heard across the map
  flashbang: { gain: 0.95, minGain: 0.16, db: 1 },
  smoke: { gain: 0.45, db: 1.5 }, // a smoke grenade venting (no bang, no music duck)
  grenadePin: { gain: 0.32, db: 1.5 },
  reload: { gain: 0.42, db: 1.5, send: 0.4 },
  dryFire: { gain: 0.32, db: 1 },
  boltCycle: { gain: 0.38, delay: 0.42, db: 1 },
});

/** Footsteps: loudness per team (enemy steps are louder: a gameplay cue) and speed response. */
export const STEP = Object.freeze({
  teamGain: { attackers: 0.5, defenders: 0.95 },
  walkSpeed: 1.4, // m/s: at or below this, steps are soft
  runSpeed: 3.0, // m/s: at or above this, steps are full and slightly brighter
  softGain: 0.55, // EV.FOOTSTEP.speed drives the walk -> run blend
});

/** Near-miss bullet whiz around the player's operators. */
export const NEAR_MISS = Object.freeze({ radius: 1.7, minTravel: 2.5, perShot: 1 });

/** Bomb arming beeps speed up with progress: interval = start - progress * speedup. */
export const PLANT_BEEP = Object.freeze({ startInterval: 0.5, speedup: 0.32 });
/** The bomb's timer in its last `window` s of execution: beeps from `slowest` s apart down to `fastest`. */
export const BOMB_BEEP = Object.freeze({ window: 20, slowest: 1.0, fastest: 0.15 });

/**
 * Gunshot recipes keyed by weapon id (audio/recipes/guns.js): four independently varied layers
 * (body, mech, tail, refl) baked separately and combined at random per shot (GUN_MIX). Times in s,
 * frequencies in Hz, gains linear. `spread` = spectral spread between variations of a layer,
 * `counts` = variations per layer, `tail.lengths` = tail decay multiplier per tail variation.
 */
export const GUN_SOUNDS = Object.freeze({
  rifle: {
    length: 0.8, bodyLength: 0.22, spread: 0.2, drive: 3.4, counts: { body: 5, mech: 4, tail: 4, refl: 3 },
    snap: { width: 0.0007, gain: 0.8 }, crack: { hz: 3600, q: 0.7, decay: 0.005, gain: 0.7 },
    body: { hz: 6500, endHz: 520, sweep: 0.05, decay: 0.03, gain: 1 }, boom: { hz: 260, q: 0.75, decay: 0.065, gain: 1.1 },
    thump: { hz: 160, endHz: 88, sweep: 0.03, decay: 0.026, gain: 0.32 },
    mech: { hz: 2300, modes: [1, 1.52, 2.43], decay: 0.03 }, tail: { hz: 520, decay: 0.16, attack: 0.008, lengths: [0.55, 0.85, 1.25, 1.8] },
    refl: { hz: 520, decay: 0.03 },
  },
  smg: {
    length: 0.65, bodyLength: 0.16, spread: 0.22, drive: 3, counts: { body: 5, mech: 4, tail: 4, refl: 3 },
    snap: { width: 0.0005, gain: 0.6 }, crack: { hz: 4300, q: 0.8, decay: 0.004, gain: 0.45 },
    body: { hz: 6000, endHz: 700, sweep: 0.03, decay: 0.022, gain: 0.9 }, boom: { hz: 420, q: 0.8, decay: 0.045, gain: 1.25 },
    thump: { hz: 190, endHz: 95, sweep: 0.02, decay: 0.018, gain: 0.35 },
    mech: { hz: 3100, modes: [1, 1.61, 2.7], decay: 0.022 }, tail: { hz: 700, decay: 0.11, attack: 0.006, lengths: [0.6, 0.9, 1.3, 1.75] },
    refl: { hz: 700, decay: 0.024 },
  },
  pistol: {
    length: 0.6, bodyLength: 0.14, spread: 0.2, drive: 2.8, counts: { body: 5, mech: 3, tail: 3, refl: 2 },
    snap: { width: 0.0004, gain: 0.9 }, crack: { hz: 3900, q: 1, decay: 0.006, gain: 0.85 },
    body: { hz: 7000, endHz: 1100, sweep: 0.025, decay: 0.018, gain: 0.9 }, boom: { hz: 560, q: 1.1, decay: 0.034, gain: 1.15 },
    thump: { hz: 230, endHz: 120, sweep: 0.015, decay: 0.014, gain: 0.3 },
    mech: { hz: 2700, modes: [1, 1.38, 2.9], decay: 0.035 }, tail: { hz: 850, decay: 0.09, attack: 0.005, lengths: [0.65, 1, 1.5] },
    refl: { hz: 800, decay: 0.02 },
  },
  dmr: {
    length: 1.1, bodyLength: 0.28, spread: 0.17, drive: 3.6, counts: { body: 4, mech: 3, tail: 3, refl: 2 },
    snap: { width: 0.0008, gain: 0.85 }, crack: { hz: 3300, q: 0.65, decay: 0.007, gain: 0.75 },
    body: { hz: 6000, endHz: 380, sweep: 0.065, decay: 0.04, gain: 1 }, boom: { hz: 210, q: 0.7, decay: 0.09, gain: 1.15 },
    thump: { hz: 140, endHz: 70, sweep: 0.04, decay: 0.035, gain: 0.42 },
    mech: { hz: 2100, modes: [1, 1.5, 2.3], decay: 0.035 }, tail: { hz: 450, decay: 0.26, attack: 0.01, lengths: [0.65, 1, 1.4] },
    refl: { hz: 450, decay: 0.04 },
  },
  sniper: {
    length: 1.6, bodyLength: 0.35, spread: 0.15, drive: 3.8, counts: { body: 4, mech: 2, tail: 3, refl: 2 },
    snap: { width: 0.001, gain: 0.9 }, crack: { hz: 3000, q: 0.6, decay: 0.008, gain: 0.8 },
    body: { hz: 5500, endHz: 320, sweep: 0.08, decay: 0.05, gain: 1 }, boom: { hz: 170, q: 0.7, decay: 0.12, gain: 1.2 },
    thump: { hz: 120, endHz: 60, sweep: 0.05, decay: 0.045, gain: 0.5 },
    mech: { hz: 1900, modes: [1, 1.45, 2.2], decay: 0.04 }, tail: { hz: 380, decay: 0.38, attack: 0.012, lengths: [0.7, 1, 1.4] },
    refl: { hz: 400, decay: 0.05 },
  },
});

/**
 * How the layers of a shot are combined at playback (audio/AudioDirector.js shot): level per weapon,
 * then per layer a gain, a random gain spread (dB) and a start offset range (s). The reflection comes
 * later in bigger spaces (zone, config ZONES) and is sometimes absent (an open side).
 */
export const GUN_MIX = Object.freeze({
  level: { rifle: 1, smg: 0.85, pistol: 0.8, dmr: 1.05, sniper: 1.1 },
  suppressed: { gain: 0.32, lowpass: 2200, send: 0.4 }, // a suppressed shot (EV.SHOT.suppressed): quieter, duller, less room
  body: { gain: 1, db: 1.2, at: [0, 0] },
  mech: { gain: 0.2, db: 3, at: [0.012, 0.03] },
  tail: { gain: 0.34, db: 2.5, at: [0, 0.006] },
  refl: { gain: 0.3, db: 3.5, chance: 0.85, at: { room: [0.006, 0.016], hall: [0.016, 0.034], yard: [0.03, 0.06] } },
});

/** Reload choreography per weapon: [part, seconds after the reload event]. Rate tints the parts. */
export const RELOADS = Object.freeze({
  rifle: { rate: 1, parts: [['magRelease', 0.08], ['magOut', 0.18], ['magDrop', 0.55], ['magIn', 1.25], ['charge', 1.85]] },
  smg: { rate: 1.12, parts: [['magRelease', 0.06], ['magOut', 0.14], ['magDrop', 0.5], ['magIn', 1.05], ['charge', 1.6]] },
  pistol: { rate: 1.28, parts: [['magRelease', 0.05], ['magOut', 0.1], ['magDrop', 0.38], ['magIn', 0.85], ['slide', 1.28]] },
  dmr: { rate: 0.98, parts: [['magRelease', 0.08], ['magOut', 0.2], ['magDrop', 0.6], ['magIn', 1.4], ['charge', 2.1]] },
  sniper: { rate: 0.94, parts: [['magRelease', 0.1], ['magOut', 0.22], ['magIn', 1.6], ['bolt', 2.4]] },
});

/**
 * Generative music (audio/Music.js): global behaviour. The scenes themselves (key, tempo, timbres,
 * patterns) are composition data in audio/music/scenes.js. Intensity 0..1.
 */
export const MUSIC = Object.freeze({
  lookahead: 0.2, // s scheduled ahead of the clock
  readyProbe: 'mus.tick', // drums baked = the score can start
  phaseIntensity: { title: 0, planning: 0.18, running: 0.45, paused: 0.45, ended: 0 },
  // Tactical events push the tension up; the sum decays linearly over impulseDecaySeconds.
  impulses: { shot: 0.3, contact: 0.45, door: 0.12, kick: 0.2, go: 0.25, allyDown: 0.3, plant: 0.3 },
  impulseMax: 0.55,
  impulseDecaySeconds: 9,
  lastStand: { allies: 1, intensity: 0.15 }, // one attacker left: heartbeat arrangement, a bit tenser
  tiers: [0.36, 0.66], // intensity thresholds low | mid | high
  intensitySmoothing: 1.6, // s, time constant
  // Planning: long rests (only ambience), then a short quiet cue now and then (s).
  planning: { firstRest: [15, 35], rest: [35, 80], cue: [10, 22], cueGain: 0.5 },
  presenceFadeIn: 3, // s, time constants of the score's overall gain
  presenceFadeOut: 2.5,
  silentBelow: 0.02, // presence under which nothing is scheduled
  mutate: { drop: 0.18, ghost: 0.05 }, // per-phrase pattern mutation probabilities
  breatheChance: 0.22, // a phrase drops kick + rim
  fillChance: 0.6, // a high-tier phrase ends with a fill
  motifBarFactor: 2.6, // motif density -> chance a phrase bar carries the motif
  layers: { bass: 0.3, lead: 0.24, kick: 0.32, tick: 0.14, rim: 0.18, fill: 0.26 },
  voiceCap: 24, // live tonal notes at once
  padGain: 0.16,
  padLfoHz: 0.07,
  padGlide: 0.25, // s
  padFade: 0.5, // s
  duckDb: -5, // music dips under nearby gunfire
  duckRelease: 0.6,
  stingerGain: 0.55,
  storageKey: 'tacticSquad.music',
});

/** Ambience bed (audio/Ambience.js): interior tone vs distant city, crossfaded by camera position. */
export const AMBIENCE = Object.freeze({
  hum: 0.05,
  vent: 0.22,
  city: 0.28,
  outdoorCity: 0.55,
  indoorVentMul: 1,
  outdoorVentMul: 0.25,
  outdoorHumMul: 0,
  fadeSeconds: 2.5,
  driftSeconds: 9, // slow random level drift so the bed never sounds static
  driftDb: 2,
  loopSeconds: [9.1, 11.3], // vent (L and R), city: long and mutually prime (recipes/index.js)
  // Fluorescent hum synthesized live (no buffer): 100 Hz mains harmonics + a ballast buzz, two
  // oscillators a hair apart (slow beating) with slow incommensurate amplitude wobble.
  liveSiren: { seconds: 8, hz: 720, sweep: 260, period: [2.2, 3], lowpassHz: 1300 },
  liveHum: { hz: 100, beatHz: 0.13, buzz: 0.18, wobbleHz: [0.031, 0.047], wobbleDepth: 0.25 },
  events: [
    { name: 'amb.clank', every: [9, 22], gain: 0.14, pan: 0.8, send: 0.6 },
    { name: 'amb.creak', every: [14, 30], gain: 0.1, pan: 0.6, send: 0.5 },
    { name: 'amb.horn', every: [25, 60], gain: 0.07, pan: 0.9, send: 0.9, outdoor: true },
    { name: 'siren', live: true, every: [70, 150], gain: 0.05, pan: 0.9, send: 0.8, outdoor: true }, // Ambience.siren
    { name: 'amb.plane', every: [90, 180], gain: 0.08, pan: 0.5, send: 0.4 },
  ],
});

/** Interface cue levels (non-positional). */
export const UI_SOUNDS = Object.freeze({
  gain: 1,
  levels: {
    select: 0.45, waypoint: 0.4, look: 0.4, undo: 0.45, hold: 0.5, error: 0.4, button: 0.5, execute: 1, go: 0.85,
    pause: 0.7, resume: 0.6, contact: 0.75, plant: 0.5, bombTick: 0.55, planted: 0.8, hurt: 0.7,
  },
  waypointSteps: [0, 2, 4, 7, 9, 12, 14], // semitones: consecutive waypoints climb a pentatonic scale
  waypointResetSeconds: 1.6,
  selectSlotCents: 300, // each operator slot is a little higher
});
