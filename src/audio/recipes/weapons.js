// Weapon foley as code: dry fire, bolt work, reload parts, magazine drops and
// brass casings per floor (the gunshot layers live in recipes/guns.js).
// Each recipe gets a kit {sr, rng, vary, buf} and returns a mono Float32Array.
// Owner: audio.
import { SVF, OnePole, ModeBank, ad, white, bell } from '../dsp.js';

/** Hammer falls on an empty chamber. */
export function dryFire(k) {
  const { sr, rng } = k;
  const out = k.buf(0.12);
  const hammer = new ModeBank(sr, [[k.vary(3300, 0.06), 0.012, 1], [k.vary(5200, 0.06), 0.02, 0.5], [k.vary(1500, 0.08), 0.008, 0.6]]);
  const spring = new ModeBank(sr, [[k.vary(6100, 0.05), 0.05, 0.25]]);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const x = t < 0.0006 ? white(rng) : 0;
    const y = t > 0.003 && t < 0.0034 ? white(rng) * 0.6 : 0;
    out[i] = hammer.tick(x) + spring.tick(y);
  }
  return out;
}

/** Short metallic click (buttons, latches): `hz` base, `ring` t60 in s. */
function clack(k, out, at, hz, ring, gain, thudHz = 0) {
  const { sr, rng } = k;
  const bank = new ModeBank(sr, [
    [k.vary(hz, 0.06), ring, 1],
    [k.vary(hz * 1.73, 0.06), ring * 0.7, 0.6],
    [k.vary(hz * 2.62, 0.06), ring * 0.5, 0.4],
    [k.vary(hz * 3.9, 0.06), ring * 0.35, 0.25],
  ]);
  let phase = 0;
  const start = Math.floor(at * sr);
  for (let i = start; i < out.length; i++) {
    const t = (i - start) / sr;
    const x = t < 0.0008 ? white(rng) : 0;
    let v = bank.tick(x) * gain;
    if (thudHz) {
      phase += (2 * Math.PI * thudHz) / sr;
      v += Math.sin(phase) * ad(t, 0.001, 0.02) * gain * 0.5;
    }
    out[i] += v;
    if (t > ring * 1.5 + 0.03) break;
  }
}

/** Filtered noise scrape between t0 and t1 (metal sliding on metal/polymer). */
function scrape(k, out, t0, t1, hz, q, gain) {
  const { sr, rng } = k;
  const f = new SVF(sr).set(hz, q);
  const grit = new OnePole(sr, 90);
  for (let i = Math.floor(t0 * sr); i < Math.min(out.length, Math.ceil(t1 * sr)); i++) {
    const t = i / sr;
    f.tick(white(rng));
    const rough = Math.abs(grit.lp(white(rng))) * 9;
    out[i] += f.bp * f.k * bell(t, t0, t1) * gain * (0.4 + rough);
  }
}

/** Reload parts (one recipe per part; the choreography lives in config RELOADS). */
export const reloadPart = {
  magRelease: (k) => {
    const out = k.buf(0.06);
    clack(k, out, 0, 2900, 0.012, 0.7);
    return out;
  },
  magOut: (k) => {
    const out = k.buf(0.22);
    scrape(k, out, 0, k.vary(0.13, 0.15), k.vary(1900, 0.1), 2.2, 0.6);
    clack(k, out, 0.12, 1700, 0.02, 0.35);
    return out;
  },
  magIn: (k) => {
    const out = k.buf(0.2);
    scrape(k, out, 0, 0.05, k.vary(1500, 0.1), 2, 0.4);
    clack(k, out, 0.05, k.vary(1150, 0.06), 0.045, 1, 170);
    clack(k, out, 0.085, 3100, 0.012, 0.35);
    return out;
  },
  charge: (k) => {
    const out = k.buf(0.36);
    scrape(k, out, 0, 0.09, k.vary(2300, 0.1), 3, 0.35);
    clack(k, out, 0.09, 2100, 0.02, 0.45);
    clack(k, out, k.vary(0.2, 0.08), k.vary(880, 0.05), 0.06, 1, 140);
    return out;
  },
  slide: (k) => {
    const out = k.buf(0.2);
    scrape(k, out, 0, 0.03, 2600, 3, 0.3);
    clack(k, out, 0.03, k.vary(1500, 0.06), 0.04, 1, 190);
    return out;
  },
  bolt: (k) => {
    const out = k.buf(0.62);
    clack(k, out, 0, 2400, 0.015, 0.5); // bolt up
    scrape(k, out, 0.05, 0.17, 2000, 2.5, 0.45); // back
    clack(k, out, 0.17, 1700, 0.025, 0.55);
    scrape(k, out, 0.32, 0.42, 2200, 2.5, 0.4); // forward
    clack(k, out, 0.42, k.vary(1000, 0.05), 0.05, 1, 150); // down & locked
    return out;
  },
};

/** How a dropped object behaves on each floor surface. */
const SURFACE_DROP = {
  tile: { ring: 1, thudHz: 900, grit: 0, bright: 1 },
  concrete: { ring: 0.85, thudHz: 700, grit: 0.35, bright: 0.9 },
  asphalt: { ring: 0.6, thudHz: 600, grit: 0.7, bright: 0.75 },
  wood: { ring: 0.45, thudHz: 420, grit: 0, bright: 0.6, tock: 1 },
  carpet: { ring: 0.12, thudHz: 300, grit: 0, bright: 0.25, muffle: true },
};
export const SURFACES = Object.keys(SURFACE_DROP);

/** Empty magazine hitting the floor. */
export function magDrop(k, surface) {
  const s = SURFACE_DROP[surface];
  const { sr, rng } = k;
  const out = k.buf(0.45);
  const body = new SVF(sr).set(s.thudHz, 1.2);
  const shell = new ModeBank(sr, [
    [k.vary(1350, 0.08), 0.09 * s.ring, 1],
    [k.vary(2450, 0.08), 0.06 * s.ring, 0.6 * s.bright],
    [k.vary(3800, 0.08), 0.04 * s.ring, 0.4 * s.bright],
  ]);
  const lp = new OnePole(sr, s.muffle ? 1400 : 9000);
  const hits = [0, k.vary(0.07, 0.25), k.vary(0.13, 0.25)];
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let x = 0;
    hits.forEach((h, n) => {
      if (t >= h && t < h + 0.0012) x += white(rng) * Math.pow(0.4, n);
    });
    body.tick(x * 30);
    const grit = s.grit && t < 0.05 ? white(rng) * ad(t, 0.0005, 0.01) * s.grit * 0.3 : 0;
    out[i] = lp.lp(shell.tick(x) * 0.8 + body.bp * 0.25 + grit);
  }
  return out;
}

/** Brass casing bouncing on the floor (strike-point dependent timbre per bounce). */
export function casing(k, surface) {
  const s = SURFACE_DROP[surface];
  const { sr, rng } = k;
  const out = k.buf(0.6);
  const f0 = k.vary(3900, 0.09);
  const end = new ModeBank(sr, [[f0, 0.16 * s.ring, 1], [f0 * 2.41, 0.09 * s.ring, 0.55 * s.bright], [f0 * 3.3, 0.05 * s.ring, 0.3 * s.bright]]);
  const side = new ModeBank(sr, [[f0 * 1.58, 0.12 * s.ring, 0.9], [f0 * 2.86, 0.07 * s.ring, 0.5 * s.bright]]);
  const tock = new SVF(sr).set(k.vary(650, 0.1), 3);
  const lp = new OnePole(sr, s.muffle ? 2200 : 12000);
  const bounces = [];
  let at = 0;
  let gap = k.vary(0.085, 0.2);
  const count = s.muffle ? 2 : 3 + Math.floor(rng.next() * 2);
  for (let b = 0; b < count; b++) {
    bounces.push([at, Math.pow(0.5, b) * k.vary(1, 0.2), rng.next() < 0.5]);
    at += gap;
    gap *= k.vary(0.62, 0.15);
  }
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let xe = 0;
    let xs = 0;
    for (const [h, amp, isSide] of bounces) {
      if (t >= h && t < h + 0.0004) {
        const x = white(rng) * amp;
        if (isSide) xs += x;
        else xe += x;
      }
    }
    tock.tick((xe + xs) * 8);
    const v = end.tick(xe) + side.tick(xs) + (s.tock ? tock.bp * 0.12 : 0);
    out[i] = lp.lp(v);
  }
  return out;
}
