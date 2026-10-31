// Sample-level DSP toolkit used to bake every one-shot (pure JS, no WebAudio,
// deterministic with a seeded Rng). Small stateful units that write into
// Float32Arrays: filters, resonators, envelopes, saturation, post-processing.
// Owner: audio.

export const TWO_PI = Math.PI * 2;

/** Seconds -> sample count. */
export const len = (sr, seconds) => Math.max(1, Math.ceil(sr * seconds));

/** Exponential attack/decay envelope value at time t (s). Linear attack, exp decay (tau). */
export function ad(t, attack, tau) {
  if (t < 0) return 0;
  if (t < attack) return t / attack;
  const x = (t - attack) / tau;
  return x > 14 ? 0 : Math.exp(-x); // e^-14 ≈ -122 dB: treat as silence
}

/** Smooth bell-shaped envelope (0 -> 1 -> 0) between t0 and t1. */
export function bell(t, t0, t1) {
  if (t <= t0 || t >= t1) return 0;
  const x = (t - t0) / (t1 - t0);
  return Math.sin(Math.PI * x) ** 2;
}

/** Normalized soft saturation. */
let satDrive = 1;
let satNorm = 1 / Math.tanh(1);
export function sat(x, drive) {
  if (drive !== satDrive) {
    satDrive = drive;
    satNorm = 1 / Math.tanh(drive);
  }
  return Math.tanh(x * drive) * satNorm;
}

/** Exponential interpolation (for frequency sweeps). */
export const expLerp = (a, b, k) => a * Math.pow(b / a, Math.min(1, Math.max(0, k)));

/** Topology-preserving state-variable filter (stable under modulation). */
export class SVF {
  constructor(sr) {
    this.sr = sr;
    this.ic1 = 0;
    this.ic2 = 0;
    this.lp = 0;
    this.bp = 0;
    this.hp = 0;
    this.set(1000, 0.707);
  }

  set(hz, q) {
    const f = Math.min(hz, this.sr * 0.45);
    const g = Math.tan((Math.PI * f) / this.sr);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
    return this;
  }

  /** Processes one sample; results in this.lp / this.bp / this.hp. */
  tick(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2;
    this.bp = v1;
    this.hp = v0 - this.k * v1 - v2;
    return v2;
  }
}

/** One-pole low-pass (also gives a high-pass as input - lp). */
export class OnePole {
  constructor(sr, hz) {
    this.sr = sr;
    this.z = 0;
    this.set(hz);
  }

  set(hz) {
    this.a = 1 - Math.exp((-TWO_PI * hz) / this.sr);
    return this;
  }

  lp(x) {
    this.z += this.a * (x - this.z);
    return this.z;
  }

  hp(x) {
    return x - this.lp(x);
  }
}

/** Two-pole resonator: a single damped mode (metal, wood, glass...). */
export class Mode {
  constructor(sr, hz, t60, gain = 1) {
    const r = Math.exp(-6.907755 / (t60 * sr));
    const w = (TWO_PI * Math.min(hz, sr * 0.45)) / sr;
    this.b1 = 2 * r * Math.cos(w);
    this.b2 = -r * r;
    this.g = gain * Math.sin(w); // flat-ish loudness across frequencies
    this.y1 = 0;
    this.y2 = 0;
  }

  tick(x) {
    const y = this.g * x + this.b1 * this.y1 + this.b2 * this.y2;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** A bank of modes excited together. */
export class ModeBank {
  constructor(sr, modes) {
    this.modes = modes.map(([hz, t60, gain]) => new Mode(sr, hz, t60, gain));
  }

  tick(x) {
    let s = 0;
    for (const m of this.modes) s += m.tick(x);
    return s;
  }
}

/** Pink-ish noise (Paul Kellet's economy filter) from a white source. */
export class Pink {
  constructor() {
    this.b0 = 0;
    this.b1 = 0;
    this.b2 = 0;
  }

  tick(w) {
    this.b0 = 0.99765 * this.b0 + w * 0.099046;
    this.b1 = 0.963 * this.b1 + w * 0.2965164;
    this.b2 = 0.57 * this.b2 + w * 1.0526913;
    return (this.b0 + this.b1 + this.b2 + w * 0.1848) * 0.2;
  }
}

/** Uniform white noise sample from a seeded Rng. */
export const white = (rng) => rng.next() * 2 - 1;

/**
 * Sparse random grains (debris, grit, crackle): returns a function of time
 * that yields an impulse train whose density follows `density(t)` (per s).
 */
export function grains(rng, sr, density) {
  return (t) => (rng.next() < density(t) / sr ? white(rng) * (0.4 + rng.next() * 0.6) : 0);
}

// ------------------------------------------------------------ post-processing

/** Removes DC with a gentle one-pole high-pass (no step at the start). */
export function dcBlock(data, sr, hz) {
  const r = Math.exp((-TWO_PI * hz) / sr);
  let x1 = 0;
  let y1 = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const y = x - x1 + r * y1;
    x1 = x;
    y1 = y;
    data[i] = y;
  }
  return data;
}

/** Trims the silent tail and applies a raised-cosine fade-out; first sample is forced to 0. */
export function finish(data, sr, floorDb, fadeSeconds) {
  const floor = Math.pow(10, floorDb / 20);
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  let end = data.length;
  const thr = peak * floor;
  while (end > 1 && Math.abs(data[end - 1]) < thr) end--;
  const fade = Math.min(end, len(sr, fadeSeconds));
  const out = data.slice(0, Math.min(data.length, end + fade));
  const n = out.length;
  for (let i = 0; i < fade && i < n; i++) out[n - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fade);
  // A tiny fade-in too: synthesized transients may start mid-waveform.
  const fin = Math.min(n, 8);
  for (let i = 0; i < fin; i++) out[i] *= i / fin;
  return out;
}

export function peakOf(data) {
  let p = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > p) p = a;
  }
  return p;
}

/**
 * Makes a buffer loop seamlessly: renders `extra` samples beyond the loop
 * length and cross-fades them (equal power) over the head.
 */
export function seamlessLoop(data, loopLength) {
  const extra = data.length - loopLength;
  const out = data.slice(0, loopLength);
  for (let i = 0; i < extra; i++) {
    const k = i / extra;
    out[i] = out[i] * Math.sin((k * Math.PI) / 2) + data[loopLength + i] * Math.cos((k * Math.PI) / 2);
  }
  return out;
}

/** 32-bit FNV-1a hash of a string (seeds per sound name). */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Cubic (Catmull-Rom) resampling; content is low-passed at bake time, so this is clean. */
export function resampleCubic(src, from, to, loop) {
  const n = Math.round((src.length * to) / from);
  const out = new Float32Array(n);
  const step = from / to;
  const len = src.length;
  const at = (i) => (loop ? src[((i % len) + len) % len] : i < 0 || i >= len ? 0 : src[i]);
  for (let i = 0; i < n; i++) {
    const x = i * step;
    const j = Math.floor(x);
    const f = x - j;
    const p0 = at(j - 1);
    const p1 = at(j);
    const p2 = at(j + 1);
    const p3 = at(j + 2);
    out[i] = p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0)));
  }
  return out;
}
