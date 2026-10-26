// Gunshots as independent layers, combined at random at playback
// (audio/AudioEngine.js playLayers, audio/AudioDirector.js shot):
//   body  — supersonic snap + crack + muzzle blast + mid "boom" + low thump (the transient and the weight)
//   mech  — the action cycling (bolt carrier / slide): a short metallic chatter after the blast
//   tail  — the dry gas/air tail; each variation has a clearly different length and colour
//   refl  — a dark early reflection ("slap" off the nearest wall), delayed by the space at runtime
// Every variation of a layer gets its own colour (a resonant peak or notch somewhere in the spectrum,
// a different crack / boom balance), so two shots differ in transient, body, tail and spectrum, not
// just in noise. The room itself is the convolution reverb. Owner: audio. Numbers: config/audio.js GUN_SOUNDS.
import { SVF, OnePole, ModeBank, ad, sat, expLerp, white } from '../dsp.js';

export const GUN_LAYERS = Object.freeze(['body', 'mech', 'tail', 'refl']);

/** Spreads variation `index` of `count` evenly over [-1, 1] (shuffled by the seed): variations never bunch up. */
function spreadOf(k, index, count) {
  const x = count > 1 ? (index / (count - 1)) * 2 - 1 : 0;
  return Math.max(-1, Math.min(1, x + (k.rng.next() * 2 - 1) * 0.25));
}

/** A random resonant colour applied to a layer: +/- `db` around a frequency picked per variation. */
function colour(k, out, loHz, hiHz, db) {
  const hz = expLerp(loHz, hiHz, k.rng.next());
  const g = Math.pow(10, ((k.rng.next() * 2 - 1) * db) / 20) - 1; // -0.5 .. +1 (for 6 dB)
  const f = new SVF(k.sr).set(hz, 1.4);
  for (let i = 0; i < out.length; i++) {
    f.tick(out[i]);
    out[i] += f.bp * f.k * g;
  }
  return out;
}

/** Spectral tilt around `hz`: `a` in -1..1 -> up to +/- `db` on each side (dark vs bright variations). */
function tilt(k, out, hz, a, db) {
  const g = Math.pow(10, (a * db) / 20);
  const lp = new OnePole(k.sr, hz);
  for (let i = 0; i < out.length; i++) {
    const low = lp.lp(out[i]);
    out[i] = low / g + (out[i] - low) * g;
  }
  return out;
}

/** Blast layer: what makes a shot loud, sharp and heavy. */
export function gunBody(k, p, index) {
  const { sr, rng } = k;
  const s = spreadOf(k, index, p.counts.body);
  const S = p.spread;
  const out = k.buf(p.bodyLength);
  // Opposite moves: a variation with a brighter crack has a lighter boom, and vice versa.
  const crackGain = p.crack.gain * Math.pow(10, (s * 4.5) / 20);
  const boomGain = p.boom.gain * Math.pow(10, (-s * 3.5) / 20);
  const snapW = p.snap.width * k.vary(1, 0.35);
  const crackDecay = p.crack.decay * k.vary(1, S * 2);
  const bodyHz = k.vary(p.body.hz, S);
  const bodyEnd = p.body.endHz * (1 - s * S * 1.2);
  const bodySweep = p.body.sweep * k.vary(1, S * 2);
  const bodyDecay = p.body.decay * (1 + s * S * 2);
  const boomDecay = p.boom.decay * k.vary(1, S * 2);
  const thumpHz = k.vary(p.thump.hz, S);
  const thumpEnd = k.vary(p.thump.endHz, S * 0.6);
  const drive = p.drive * k.vary(1, S);
  const crack = new SVF(sr).set(p.crack.hz * (1 + s * S * 1.5), p.crack.q);
  const air = new SVF(sr).set(k.vary(9000, 0.15), 0.5);
  const body = new SVF(sr);
  const boom = new SVF(sr).set(p.boom.hz * (1 - s * S), p.boom.q);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const snap = t < snapW ? 1 - (2 * t) / snapW : 0; // supersonic N-wave
    crack.tick(white(rng));
    const crackV = crack.bp * crack.k * ad(t, 0.0002, crackDecay);
    air.tick(white(rng));
    const airV = air.hp * ad(t, 0.0003, crackDecay * 2) * 0.3;
    if ((i & 15) === 0) body.set(expLerp(bodyHz, bodyEnd, t / bodySweep), 0.7);
    const bodyV = body.tick(white(rng)) * ad(t, 0.0005, bodyDecay);
    boom.tick(white(rng));
    const boomV = boom.bp * boom.k * ad(t, 0.0015, boomDecay);
    phase += (2 * Math.PI * expLerp(thumpHz, thumpEnd, t / p.thump.sweep)) / sr;
    const thumpV = Math.sin(phase) * ad(t, 0.0015, p.thump.decay);
    const blast = snap * p.snap.gain + crackV * crackGain + airV + bodyV * p.body.gain * 1.6 + boomV * boomGain * 1.4 + thumpV * p.thump.gain;
    out[i] = sat(blast * 0.75, drive);
  }
  tilt(k, out, 1200, s, 5); // with the crack/boom balance: bright-and-light vs dark-and-heavy
  colour(k, out, 300, 1500, 7); // weight: chest / boom colour
  return colour(k, out, 1500, 8000, 8); // bite: crack / air colour
}

/** Action layer: the mechanism cycling, a few modes per variation (some rattle, some ring). */
export function gunMech(k, p, index) {
  const { sr, rng } = k;
  const m = p.mech;
  const s = spreadOf(k, index, p.counts.mech);
  const out = k.buf(0.12);
  const hz = m.hz * (1 + s * 0.22);
  const bank = new ModeBank(sr, m.modes.map((r, i) => [hz * r * k.vary(1, 0.05), m.decay * (1 - i * 0.22) * (1 - s * 0.35), 1 / (1 + i)]));
  const rattle = new ModeBank(sr, [[k.vary(hz * 1.9, 0.1), m.decay * 0.5, 0.5]]);
  const second = k.vary(0.028, 0.35); // carrier slamming home
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const x = t < 0.0015 ? white(rng) : 0;
    const y = t >= second && t < second + 0.001 ? white(rng) * (0.5 + 0.4 * s) : 0;
    out[i] = bank.tick(x) + rattle.tick(y);
  }
  return out;
}

/** Tail layer: dry gas tail; variation i lasts p.tail.lengths[i] times the base decay. */
export function gunTail(k, p, index) {
  const { sr, rng } = k;
  const tp = p.tail;
  const mul = tp.lengths[index % tp.lengths.length];
  const decay = tp.decay * mul;
  const out = k.buf(Math.min(p.length, tp.attack + decay * 7));
  const s = spreadOf(k, index, p.counts.tail);
  const f = new SVF(sr).set(tp.hz * (1 + s * 0.35) / Math.sqrt(mul), 0.55);
  const wobble = new OnePole(sr, k.vary(18, 0.4));
  const roughness = k.vary(6, 0.45);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const rough = 1 + wobble.lp(white(rng)) * roughness;
    out[i] = sat(f.tick(white(rng)) * ad(t, tp.attack, decay) * rough, 1.5);
  }
  tilt(k, out, 700, s, 4);
  return colour(k, out, 250, 2500, 8);
}

/** Early reflection: a dark, smeared copy of the blast (the wall answers). */
export function gunRefl(k, p, index) {
  const { sr, rng } = k;
  const r = p.refl;
  const s = spreadOf(k, index, p.counts.refl);
  const out = k.buf(r.decay * 8);
  const f = new SVF(sr).set(r.hz * (1 + s * 0.4), 0.8);
  const lp = new OnePole(sr, r.hz * 3);
  const decay = r.decay * (1 + s * 0.3);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    f.tick(white(rng));
    out[i] = lp.lp(f.bp * f.k * ad(t, 0.002, decay) + f.lp * ad(t, 0.003, decay * 0.6) * 0.5);
  }
  return out;
}

export const GUN_LAYER_RECIPES = Object.freeze({ body: gunBody, mech: gunMech, tail: gunTail, refl: gunRefl });
