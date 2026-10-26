// Registry of every baked sound: name -> {variations, render, sr?, loop?, lazy?, tier}.
// No `sr` = the native (context) rate, played at playbackRate 1; `lazy` = baked only when a round
// needs it (AudioDirector requires the weapons on the map); `tier` = 'plan' (what title and planning
// need: interface, music drums, ambience) is baked first, after the first frame; 'combat' after it
// (audio/SoundBank.js). Order inside a tier = bake priority. Owner: audio.
//
// Sample rates follow measured content (energy above Nyquist of the lower rate, see
// docs/ARCHITECTURE.md "Presupuestos"): one-shots with air (guns, steps, casings,
// impacts, drums) stay native; dark beds and stops use BAKE.midSampleRate / darkSampleRate.
import { BAKE, GUN_SOUNDS, DOOR_SWING_SECONDS, RELOADS, AMBIENCE } from '../../config/audio.js';
import { dryFire, reloadPart, magDrop, casing, SURFACES } from './weapons.js';
import { GUN_LAYERS, GUN_LAYER_RECIPES } from './guns.js';

export { GUN_LAYERS };
import { footstep, gear, bodyFall, gunDrop, impactWall, impactWood, impactMetal, impactFlesh, impactHead, ricochet, whiz } from './foley.js';
import { doorKick, doorSlam, creak, ventLoop, cityLoop, pipeClank, farHorn, farPlane } from './world.js';
import { UI_RECIPES } from './interface.js';
import { DRUMS } from './drums.js';

const STEP_VARIATIONS = 7; // with no-repeat picking + gain jitter, 7 per surface never sounds looped (was 10, then 8)
// Reload parts of the always-present weapons (rifle, SMG: squad + defenders) are baked eagerly.
const SHARED_RELOAD_PARTS = new Set([...RELOADS.rifle.parts, ...RELOADS.smg.parts].map(([part]) => part));

/** Layer groups of a weapon's gunshot (audio/AudioDirector.js shot combines them). */
export const gunLayerNames = (weaponId) => GUN_LAYERS.map((layer) => `gun.${weaponId}.${layer}`);

/** Groups a round with these weapons needs that may be lazy (gun layers + reload parts). */
export function weaponSoundNames(weaponId) {
  const names = gunLayerNames(weaponId);
  for (const [part] of (RELOADS[weaponId] || RELOADS.rifle).parts) if (part !== 'magDrop') names.push(`reload.${part}`);
  if (weaponId === 'sniper') names.push('reload.bolt');
  return names;
}

const groups = [];
let tier = 'plan';
const add = (name, variations, render, opts = {}) => groups.push({ name, variations, render, tier, ...opts });

const MID = { sr: BAKE.midSampleRate };
const DARK = { sr: BAKE.darkSampleRate };
const MUS = { sr: BAKE.musicSampleRate };
const LOOP = { loop: true };

// ---- tier 'plan': title + planning
// < -60 dB above 5.5 kHz: dark rate; < -60 dB above 11 kHz: mid rate (measured).
const UI_RATES = Object.freeze({ error: DARK, hurt: DARK, planted: MID, go: MID, plant: MID });
for (const name of Object.keys(UI_RECIPES)) add(`ui.${name}`, 1, UI_RECIPES[name], UI_RATES[name]);

// Music: only percussion is baked (native rate, rate 1); tonal voices are live (audio/music/Synth.js).
add('mus.tick', 3, DRUMS.tick);
add('mus.kick', 2, DRUMS.kick);
add('mus.rim', 2, DRUMS.rim);
add('mus.tom', 2, DRUMS.tom);
add('mus.shaker', 3, DRUMS.shaker);
add('mus.frame', 2, DRUMS.frame);
add('mus.doum', 2, DRUMS.doum);
add('mus.tek', 3, DRUMS.tek);
add('mus.boom', 1, DRUMS.boom, MUS); // rare stinger, dark: memory over CPU

// Beds: one long vent loop played twice (L / R, half a loop apart: decorrelated) and a city loop of
// a mutually prime length; the hum and the siren are live oscillators (Ambience.js).
const [vent, city] = AMBIENCE.loopSeconds;
add('amb.vent', 1, (k) => ventLoop(k, vent), { ...LOOP, ...MID }); // -52 dB above 12 kHz
add('amb.city', 1, (k) => cityLoop(k, city), { ...LOOP, ...DARK }); // -50 dB above 5.5 kHz
add('amb.clank', 3, pipeClank, DARK);
add('amb.creak', 3, (k) => creak(k, 70, 140, k.vary(0.7, 0.3), [[400, 4], [820, 5], [1500, 6]]), DARK);
add('amb.horn', 3, farHorn, DARK);
add('amb.plane', 1, farPlane, DARK);

// ---- tier 'combat': execution
tier = 'combat';
// Guns: four layers per weapon, only the weapons present in a round are baked (lazy).
for (const [id, p] of Object.entries(GUN_SOUNDS)) {
  for (const layer of GUN_LAYERS) {
    // Tails are dark (< -51 dB above 12 kHz, measured): mid rate, half the memory.
    add(`gun.${id}.${layer}`, p.counts[layer], (k) => GUN_LAYER_RECIPES[layer](k, p, k.index), { lazy: true, ...(layer === 'tail' ? MID : {}) });
  }
}
for (const s of SURFACES) add(`step.${s}`, STEP_VARIATIONS, (k) => footstep(k, s));
add('impact.wall', 6, impactWall);
add('impact.flesh', 5, (k) => impactFlesh(k, false));
add('impact.helmet', 4, (k) => impactFlesh(k, true));
add('impact.head', 3, impactHead);
add('impact.wood', 5, impactWood);
add('impact.metal', 4, impactMetal);
add('whiz', 5, whiz);
add('ricochet', 3, ricochet);
add('door.kick', 4, (k) => doorKick(k, DOOR_SWING_SECONDS));
add('door.slam', 3, doorSlam, MID); // -51 dB above 11 kHz
add('door.creak', 4, (k) => creak(k, 260, 620, k.vary(0.34, 0.25), [[950, 7], [1900, 9], [3100, 10]]));
for (const s of SURFACES) add(`casing.${s}`, 4, (k) => casing(k, s));
add('dryFire', 3, dryFire);
// Reload parts used only by lazy weapons are lazy too (config/audio.js RELOADS).
for (const part of Object.keys(reloadPart)) add(`reload.${part}`, 2, reloadPart[part], { lazy: !SHARED_RELOAD_PARTS.has(part) });
for (const s of SURFACES) add(`magDrop.${s}`, 2, (k) => magDrop(k, s));
add('gear', 4, gear);
add('bodyFall', 3, bodyFall);
add('gunDrop.hard', 3, (k) => gunDrop(k, false), MID); // < -51 dB above 12 kHz
add('gunDrop.soft', 2, (k) => gunDrop(k, true), MID);

export const SOUND_GROUPS = Object.freeze(groups);
