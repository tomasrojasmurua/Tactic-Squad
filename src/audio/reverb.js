// Precomputed stereo impulse responses for the convolution reverbs, built
// once when the AudioContext is created. "room": dense early reflections and
// a short, darkening tail (offices, corridors, the concrete hall gets a
// larger send). "yard": slap-back echoes off the facades and a long, low
// open-air tail. Deterministic (seeded). Owner: audio.
import { Rng } from '../core/rng.js';
import { OnePole } from './dsp.js';

export function createImpulse(ctx, spec, seed) {
  const sr = ctx.sampleRate;
  const n = Math.ceil(sr * spec.seconds);
  const buf = ctx.createBuffer(2, n, sr);
  const rng = new Rng(seed);
  const pre = Math.floor(spec.predelay * sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const dark = new OnePole(sr, 2200);
    const darker = new OnePole(sr, 700);
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      const w = rng.next() * 2 - 1;
      const bright = w * Math.exp(-t / spec.brightDecay) * 0.5;
      const low = darker.lp(dark.lp(w)) * Math.exp(-t / spec.darkDecay) * 2.4;
      const fadeIn = Math.min(1, t / 0.012); // the diffuse tail builds up after the early reflections
      const fadeOut = Math.min(1, (n - i) / (sr * 0.05));
      d[i] = (bright + low) * fadeIn * fadeOut;
    }
    if (spec.early) addEarly(d, sr, pre, spec, rng);
    if (spec.slaps) addSlaps(d, sr, pre, spec, ch);
    normalize(d, spec.gain);
  }
  return buf;
}

/** Sparse discrete reflections in the first few tens of ms (walls, desk, ceiling). */
function addEarly(d, sr, pre, spec, rng) {
  for (let r = 0; r < spec.early; r++) {
    const t = rng.next() * spec.earlyWindow;
    const i = pre + Math.floor(t * sr);
    const g = (0.9 - (0.6 * t) / spec.earlyWindow) * (rng.next() < 0.5 ? -1 : 1) * 0.6;
    for (let j = 0; j < 6 && i + j < d.length; j++) d[i + j] += g * (1 - j / 6);
  }
}

/** Discrete echoes off distant facades; alternate sides for width. */
function addSlaps(d, sr, pre, spec, ch) {
  spec.slaps.forEach((at, idx) => {
    const g = Math.pow(spec.slapGain, idx + 1) * (idx % 2 === ch ? 1 : 0.55);
    const i = pre + Math.floor(at * sr);
    const width = Math.floor(sr * 0.003);
    for (let j = 0; j < width && i + j < d.length; j++) d[i + j] += g * Math.sin((Math.PI * j) / width) * (j % 2 ? -0.6 : 1);
  });
}

/** Unit energy scaled by `gain` (keeps the wet level predictable). */
function normalize(d, gain) {
  let e = 0;
  for (let i = 0; i < d.length; i++) e += d[i] * d[i];
  const k = e > 0 ? gain / Math.sqrt(e) : 0;
  for (let i = 0; i < d.length; i++) d[i] *= k;
}
