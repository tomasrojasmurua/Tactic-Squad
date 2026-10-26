// Interface cues as code: short, soft-attacked, tuned to D (a neutral centre: the
// music scenes are in other keys, so the cues read as "interface", not as notes of
// the score). The tone helpers are shared with the music drums (recipes/drums.js).
// Owner: audio.
import { SVF, OnePole, ModeBank, ad, bell, sat, white, expLerp } from '../dsp.js';

const D5 = 587.33;
const A5 = 880;

/** Two-operator FM note added into `out`. */
export function fm(k, out, at, hz, { ratio = 2, index = 1.5, decay = 0.2, gain = 0.5, attack = 0.002, indexDecay = decay * 0.5 }) {
  const { sr } = k;
  const start = Math.floor(at * sr);
  let pc = 0;
  let pm = 0;
  for (let i = start; i < out.length; i++) {
    const t = (i - start) / sr;
    const env = ad(t, attack, decay);
    if (env < 1e-4 && t > attack) break;
    pm += (2 * Math.PI * hz * ratio) / sr;
    pc += (2 * Math.PI * hz) / sr;
    out[i] += Math.sin(pc + index * Math.exp(-t / indexDecay) * Math.sin(pm)) * env * gain;
  }
}

/** Soft mechanical tick (a good switch, not a beep). */
export function tick(k, out, at, hz, gain, ring = 0.008) {
  const { sr, rng } = k;
  const bank = new ModeBank(sr, [[hz, ring, 1], [hz * 1.9, ring * 0.6, 0.5]]);
  const start = Math.floor(at * sr);
  for (let i = start; i < Math.min(out.length, start + Math.ceil(sr * (ring * 6 + 0.01))); i++) {
    const t = (i - start) / sr;
    out[i] += bank.tick(t < 0.0006 ? white(rng) : 0) * gain;
  }
}

/** Band-passed noise sweep (whooshes, risers, radio squelch). */
export function sweep(k, out, t0, t1, hz0, hz1, q, gain, shape = bell) {
  const { sr, rng } = k;
  const f = new SVF(sr);
  for (let i = Math.floor(t0 * sr); i < Math.min(out.length, Math.ceil(t1 * sr)); i++) {
    const t = i / sr;
    if ((i & 7) === 0) f.set(expLerp(hz0, hz1, (t - t0) / (t1 - t0)), q);
    f.tick(white(rng));
    out[i] += f.bp * f.k * shape(t, t0, t1) * gain;
  }
}

/** Sub impact: pitched-down sine thump. */
export function thump(k, out, at, hz0, hz1, decay, gain) {
  const { sr } = k;
  let ph = 0;
  for (let i = Math.floor(at * sr); i < out.length; i++) {
    const t = i / sr - at;
    const env = ad(t, 0.003, decay);
    if (env < 1e-4 && t > 0.01) break;
    ph += (2 * Math.PI * expLerp(hz0, hz1, t / (decay * 2))) / sr;
    out[i] += Math.sin(ph) * env * gain;
  }
}

/** Radio key-up: squelch burst with a little ring modulation. */
function radio(k, out, at, gain) {
  const { sr, rng } = k;
  const f = new SVF(sr).set(2300, 2.5);
  for (let i = Math.floor(at * sr); i < Math.min(out.length, Math.ceil((at + 0.06) * sr)); i++) {
    const t = i / sr - at;
    f.tick(white(rng));
    out[i] += f.bp * f.k * Math.sin(2 * Math.PI * 1150 * t) * ad(t, 0.001, 0.014) * gain;
  }
  tick(k, out, at, 2600, gain * 0.4, 0.004);
}

export const UI_RECIPES = {
  select: (k) => {
    const out = k.buf(0.16);
    tick(k, out, 0, 2400, 0.45);
    fm(k, out, 0.004, A5, { ratio: 2, index: 1.2, decay: 0.05, gain: 0.32 });
    fm(k, out, 0.03, A5 * 1.5, { ratio: 2, index: 0.8, decay: 0.06, gain: 0.2 });
    return out;
  },
  waypoint: (k) => {
    const out = k.buf(0.28);
    tick(k, out, 0, 3200, 0.25, 0.004);
    fm(k, out, 0.002, A5, { ratio: 4, index: 1.1, decay: 0.07, gain: 0.42, indexDecay: 0.01 }); // marimba-ish
    return out;
  },
  look: (k) => {
    const out = k.buf(0.14);
    sweep(k, out, 0, 0.09, 1800, 4800, 1.4, 0.3);
    tick(k, out, 0.07, 2800, 0.2, 0.005);
    return out;
  },
  undo: (k) => {
    const out = k.buf(0.2);
    tick(k, out, 0, 2000, 0.3, 0.006);
    fm(k, out, 0.004, D5 * 1.335, { ratio: 2, index: 1, decay: 0.05, gain: 0.25 });
    fm(k, out, 0.045, D5, { ratio: 2, index: 0.8, decay: 0.07, gain: 0.25 });
    return out;
  },
  hold: (k) => {
    const out = k.buf(0.24);
    radio(k, out, 0, 0.35);
    fm(k, out, 0.03, D5 * 1.122, { ratio: 1, index: 0.6, decay: 0.05, gain: 0.25, attack: 0.004 });
    fm(k, out, 0.1, D5 * 1.122, { ratio: 1, index: 0.6, decay: 0.05, gain: 0.25, attack: 0.004 });
    return out;
  },
  error: (k) => {
    const out = k.buf(0.26);
    const { sr } = k;
    const lp = new OnePole(sr, 900);
    for (let i = 0; i < out.length; i++) {
      const t = i / sr;
      const env = bell(t, 0, 0.09) + bell(t, 0.11, 0.2);
      out[i] = lp.lp(Math.tanh(Math.sin(2 * Math.PI * 165 * t) * 3)) * env * 0.4;
    }
    return out;
  },
  button: (k) => {
    const out = k.buf(0.08);
    tick(k, out, 0, 2100, 0.5, 0.007);
    return out;
  },
  execute: (k) => {
    const out = k.buf(1.3);
    sweep(k, out, 0, 0.16, 500, 4200, 1.2, 0.35, (t, a, b) => ((t - a) / (b - a)) ** 2);
    thump(k, out, 0.15, 120, 38, 0.12, 0.9);
    sweep(k, out, 0.15, 0.3, 3000, 900, 0.8, 0.25);
    for (const [r, g] of [[1, 0.2], [1.189, 0.16], [1.498, 0.16], [2.245, 0.09]]) fm(k, out, 0.15, D5 * r, { ratio: 3, index: 1.4, decay: 0.38, gain: g, indexDecay: 0.05 });
    for (let i = 0; i < out.length; i++) out[i] = sat(out[i], 1.3);
    return out;
  },
  go: (k) => {
    const out = k.buf(0.7);
    radio(k, out, 0, 0.5);
    thump(k, out, 0.05, 140, 50, 0.07, 0.55);
    fm(k, out, 0.05, A5, { ratio: 3, index: 1.6, decay: 0.08, gain: 0.32, indexDecay: 0.02 });
    fm(k, out, 0.13, D5 * 2, { ratio: 3, index: 1.6, decay: 0.22, gain: 0.36, indexDecay: 0.03 });
    fm(k, out, 0.13, A5 * 1.5, { ratio: 2, index: 0.6, decay: 0.18, gain: 0.12 });
    return out;
  },
  pause: (k) => {
    // "Time stops": a tape-stop glide with a soft sub landing.
    const out = k.buf(0.6);
    const { sr } = k;
    const lp = new SVF(sr);
    let ph = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / sr;
      const f = expLerp(900, 70, (t / 0.38) ** 1.5);
      ph += (2 * Math.PI * f) / sr;
      if ((i & 15) === 0) lp.set(Math.max(200, f * 3), 0.9);
      out[i] = lp.tick(Math.sin(ph) + 0.4 * Math.sin(ph * 2) + 0.2 * Math.sin(ph * 3)) * bell(t, 0, 0.42) * 0.4;
    }
    sweep(k, out, 0, 0.3, 5000, 400, 0.7, 0.14);
    thump(k, out, 0.3, 80, 35, 0.12, 0.45);
    return out;
  },
  resume: (k) => {
    const out = k.buf(0.36);
    const { sr } = k;
    let ph = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / sr;
      ph += (2 * Math.PI * expLerp(110, 880, (t / 0.2) ** 0.8)) / sr;
      out[i] = (Math.sin(ph) + 0.3 * Math.sin(ph * 2)) * bell(t, 0, 0.24) * 0.3;
    }
    sweep(k, out, 0, 0.2, 500, 5000, 0.8, 0.14);
    tick(k, out, 0.2, 2600, 0.3, 0.006);
    return out;
  },
  contact: (k) => {
    const out = k.buf(0.45);
    radio(k, out, 0, 0.5);
    fm(k, out, 0.04, 659.25, { ratio: 1, index: 2, decay: 0.08, gain: 0.26, indexDecay: 0.05 });
    fm(k, out, 0.13, 698.46, { ratio: 1, index: 2, decay: 0.16, gain: 0.26, indexDecay: 0.06 });
    return out;
  },
  plant: (k) => {
    const out = k.buf(0.12);
    fm(k, out, 0, 1975.5, { ratio: 1, index: 0.8, decay: 0.035, gain: 0.35, attack: 0.002 });
    return out;
  },
  // The bomb's timer in its last seconds: a harder, lower beep than the defuse's.
  bombTick: (k) => {
    const out = k.buf(0.14);
    fm(k, out, 0, 2349.3, { ratio: 1, index: 1.4, decay: 0.05, gain: 0.4, attack: 0.002 });
    return out;
  },
  planted: (k) => {
    const out = k.buf(1.1);
    for (let n = 0; n < 3; n++) fm(k, out, n * 0.11, 1975.5, { ratio: 1, index: 0.8, decay: 0.035, gain: 0.32 });
    thump(k, out, 0.34, 90, 40, 0.15, 0.6);
    fm(k, out, 0.34, D5, { ratio: 2, index: 1, decay: 0.4, gain: 0.25 });
    fm(k, out, 0.34, D5 * 1.498, { ratio: 2, index: 1, decay: 0.4, gain: 0.18 });
    return out;
  },
  hurt: (k) => {
    const out = k.buf(0.45);
    thump(k, out, 0, 70, 38, 0.11, 0.9);
    thump(k, out, 0.17, 62, 36, 0.09, 0.5);
    for (let i = 0; i < out.length; i++) out[i] = sat(out[i], 1.4);
    return out;
  },
};
