// Music percussion as code, baked at the native rate and played at playbackRate 1 (audio/music/*):
// the electronic kit of "Pulso" (kick, tick, rim, tom), the brushes / frame drum of "Vigilia" and the
// hand drums of "Asedio" (doum = low open stroke, tek = high rim slap), plus the stinger boom.
// Variety comes from baked variations (no pitch jitter). Owner: audio.
import { SVF, OnePole, ad, sat, white, expLerp } from '../dsp.js';
import { tick, sweep, thump } from './interface.js';

/** Hand-drum skin: a pitched membrane + a noisy slap, `bright` 0..1. */
function skin(k, out, hz, decay, slap, bright) {
  const { sr, rng } = k;
  const f = new SVF(sr).set(k.vary(1200 + 2600 * bright, 0.1), 1.2);
  const hp = new OnePole(sr, 400);
  let ph = 0;
  const f0 = k.vary(hz, 0.04);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    ph += (2 * Math.PI * expLerp(f0 * 1.25, f0, t / 0.015)) / sr;
    f.tick(white(rng));
    out[i] += Math.sin(ph) * ad(t, 0.001, decay) * (1 - bright * 0.6) + hp.hp(f.bp * f.k) * ad(t, 0.0004, 0.012 + 0.01 * bright) * slap;
  }
  return out;
}

export const DRUMS = {
  kick: (k) => {
    const out = k.buf(0.4);
    thump(k, out, 0, k.vary(95, 0.05), 40, 0.11, 1);
    tick(k, out, 0, k.vary(1800, 0.1), 0.12, 0.004);
    return out;
  },
  tick: (k) => {
    const out = k.buf(0.05);
    tick(k, out, 0, k.vary(3100, 0.05), 0.6, 0.006);
    return out;
  },
  rim: (k) => {
    const out = k.buf(0.12);
    tick(k, out, 0, k.vary(1700, 0.05), 0.6, 0.02);
    sweep(k, out, 0, 0.05, 2500, 2000, 3, 0.25, (t, a) => ad(t - a, 0.0005, 0.01));
    return out;
  },
  tom: (k) => {
    const out = k.buf(0.5);
    thump(k, out, 0, k.vary(150, 0.06), 82, 0.13, 0.9);
    sweep(k, out, 0, 0.08, 900, 400, 1, 0.2, (t, a) => ad(t - a, 0.001, 0.02));
    return out;
  },
  /** Brushed shaker: a soft swish of high noise. */
  shaker: (k) => {
    const out = k.buf(0.09);
    sweep(k, out, 0, k.vary(0.07, 0.2), k.vary(7000, 0.15), 5200, 1.1, 0.35, (t, a, b) => ad(t - a, 0.006, (b - a) * 0.3));
    return out;
  },
  /** Frame drum: deep, soft, long. */
  frame: (k) => skin(k, k.buf(0.6), 72, 0.16, 0.25, 0.1),
  doum: (k) => skin(k, k.buf(0.45), 96, 0.11, 0.5, 0.2),
  tek: (k) => {
    const out = skin(k, k.buf(0.12), 420, 0.02, 1, 1);
    for (let i = 0; i < out.length; i++) out[i] = sat(out[i], 1.3);
    return out;
  },
  boom: (k) => {
    const out = k.buf(3);
    const { sr, rng } = k;
    thump(k, out, 0, 70, 28, 0.6, 1);
    const lp = new SVF(sr);
    for (let i = 0; i < out.length; i++) {
      const t = i / sr;
      if ((i & 15) === 0) lp.set(expLerp(1800, 120, t / 2), 0.8);
      out[i] += lp.tick(white(rng)) * ad(t, 0.004, 0.7) * 0.5;
      out[i] = sat(out[i], 1.6);
    }
    return out;
  },
};
