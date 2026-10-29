// Weapon balance (generic names only). Owner: gameplay.
// Presentation is keyed by the same weapon id elsewhere, so each specialist
// edits only their own file: gun model in config/render.js WEAPON_MODELS +
// render/geometry/character.js, sound in config/audio.js GUN_SOUNDS, HUD
// silhouette in ui/icons.js WEAPON_ICONS.
import { DEG } from '../core/math.js';

export const WEAPONS = Object.freeze({
  rifle: {
    name: 'Rifle',
    fireInterval: 0.105, // s between shots inside a burst
    burst: [3, 4], // shots per burst (min, max)
    burstPause: 0.2,
    damage: [40, 50], // torso: 2 hits often, 3 always kill
    spread: 1.5 * DEG, // 1-sigma aim error while still
    movingSpread: 3.0 * DEG, // added while walking at full speed (scaled by speed)
    magazine: 30,
    reserve: 90,
    reloadTime: 2.3,
  },
  smg: {
    name: 'SMG',
    fireInterval: 0.075,
    burst: [4, 6],
    burstPause: 0.18,
    damage: [29, 35],
    spread: 1.8 * DEG,
    movingSpread: 1.6 * DEG, // SMGs shoot well on the move
    magazine: 30,
    reserve: 120,
    reloadTime: 2.0,
  },
  pistol: {
    name: 'Pistola',
    fireInterval: 0.22,
    burst: [2, 3],
    burstPause: 0.25,
    damage: [30, 38],
    spread: 2.0 * DEG,
    movingSpread: 2.6 * DEG,
    magazine: 12,
    reserve: 36,
    reloadTime: 1.6,
  },
  // Designated marksman rifle (the attacking Tirador): one aimed shot at a time, hits hard.
  dmr: {
    name: 'Fusil de tirador',
    fireInterval: 0.32,
    burst: [1, 2],
    burstPause: 0.15,
    damage: [70, 82], // two torso hits always kill, one to the head too
    spread: 0.7 * DEG,
    movingSpread: 3.6 * DEG,
    magazine: 20,
    reserve: 60,
    reloadTime: 2.6,
  },
  // Pump shotgun (the Escopetero): one shot is a pattern of buckshot. `cone`: the pattern's
  // half-width per meter of distance (it widens the target for that shot, sim/combat.js);
  // `falloff`: [full damage up to (m), the floor reached at (m), the floor (fraction)].
  shotgun: {
    name: 'Escopeta',
    fireInterval: 0.8,
    burst: [1, 1],
    burstPause: 0,
    damage: [88, 104],
    spread: 2.2 * DEG,
    movingSpread: 2.4 * DEG,
    cone: 3 * DEG,
    falloff: [5, 14, 0.2],
    magazine: 7,
    reserve: 28,
    reloadTime: 3.2,
  },
  sniper: {
    name: 'Francotirador',
    fireInterval: 1.0, // the bolt worked from the shoulder
    burst: [1, 1],
    burstPause: 0,
    damage: [112, 130], // a torso hit always drops a man (100, an Ancla's 120 most of the time); a limb does not
    spread: 0.4 * DEG,
    movingSpread: 7 * DEG,
    magazine: 5,
    reserve: 20,
    reloadTime: 3.0,
  },
});
