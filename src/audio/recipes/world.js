// World sounds as code: doors (kick/breach, slam against the stop, hinge
// creak), ambience loops (fluorescent hum, ventilation, distant city) and
// sparse ambience one-shots (pipe clank, building creak, far horn, airliner;
// the siren is live, audio/Ambience.js). Loops are made seamless at bake time. Owner: audio.
import { SVF, OnePole, ModeBank, ad, bell, sat, white, grains, expLerp, Pink, len, seamlessLoop } from '../dsp.js';

/** Boot meets door: thud, panel resonance, latch tearing out, splinters, swing air. */
export function doorKick(k, swingSeconds) {
  const { sr, rng } = k;
  const out = k.buf(0.6);
  const panel = new ModeBank(sr, [
    [k.vary(128, 0.08), 0.14, 0.45],
    [k.vary(290, 0.08), 0.12, 1],
    [k.vary(610, 0.08), 0.08, 0.95],
    [k.vary(1180, 0.08), 0.05, 0.75],
    [k.vary(2150, 0.08), 0.03, 0.5],
  ]);
  const latch = new ModeBank(sr, [[k.vary(2300, 0.06), 0.04, 1], [k.vary(3700, 0.06), 0.03, 0.6], [k.vary(5600, 0.06), 0.02, 0.35]]);
  const splinter = grains(rng, sr, (t) => 3000 * ad(t - 0.004, 0.001, 0.025));
  const sf = new SVF(sr).set(3600, 1);
  const whack = new SVF(sr).set(k.vary(900, 0.1), 0.7);
  const thudLp = new SVF(sr).set(380, 0.9);
  const air = new SVF(sr);
  const latchAt = k.vary(0.006, 0.3);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const x = t < 0.003 ? white(rng) : 0;
    phase += (2 * Math.PI * expLerp(130, 65, t / 0.06)) / sr;
    thudLp.tick(white(rng));
    let v = Math.sin(phase) * ad(t, 0.0015, 0.04) * 0.5 + thudLp.lp * ad(t, 0.001, 0.025) * 1.6;
    v += panel.tick(x) * 1.1;
    whack.tick(white(rng));
    v += whack.bp * whack.k * ad(t, 0.0005, 0.012) * 0.9;
    v += latch.tick(t >= latchAt && t < latchAt + 0.0008 ? white(rng) : 0) * 0.45;
    sf.tick(splinter(t));
    v += sf.bp * 1.1;
    if ((i & 15) === 0) air.set(expLerp(900, 380, t / swingSeconds), 0.8);
    air.tick(white(rng));
    v += air.bp * bell(t, 0.01, swingSeconds + 0.03) * 0.22;
    out[i] = sat(v, 1.5);
  }
  return out;
}

/** The slab hits its stop: wooden bang, handle rattle against the wall. */
export function doorSlam(k) {
  const { sr, rng } = k;
  const out = k.buf(0.45);
  const panel = new ModeBank(sr, [[k.vary(150, 0.1), 0.12, 1], [k.vary(340, 0.1), 0.09, 0.7], [k.vary(720, 0.1), 0.05, 0.45], [k.vary(1500, 0.1), 0.03, 0.3]]);
  const handle = new ModeBank(sr, [[k.vary(1900, 0.08), 0.05, 1], [k.vary(3100, 0.08), 0.035, 0.5]]);
  const thud = new SVF(sr).set(200, 0.8);
  const rattle = [k.vary(0.012, 0.3), k.vary(0.05, 0.3), k.vary(0.085, 0.3)];
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const x = t < 0.002 ? white(rng) : 0;
    let h = 0;
    for (let r = 0; r < rattle.length; r++) if (t >= rattle[r] && t < rattle[r] + 0.0005) h += white(rng) * (1 - r * 0.3);
    thud.tick(white(rng));
    out[i] = panel.tick(x) * 0.7 + handle.tick(h) * 0.3 + thud.lp * ad(t, 0.001, 0.025) * 1.6;
  }
  return out;
}

/** Hinge creak: stick-slip pulse train through narrow wooden/metal formants. */
export function creak(k, lowHz, highHz, dur, formants) {
  const { sr, rng } = k;
  const out = k.buf(dur + 0.05);
  const fs = formants.map(([hz, q]) => new SVF(sr).set(k.vary(hz, 0.1), q));
  const f0 = k.vary(lowHz, 0.2);
  const f1 = k.vary(highHz, 0.2);
  let acc = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const contour = Math.sin(Math.PI * Math.min(1, t / dur));
    const f = f0 + (f1 - f0) * contour * (1 + 0.08 * white(rng));
    acc += f / sr;
    let x = 0;
    if (acc >= 1) {
      acc -= 1;
      x = 1 + 0.3 * white(rng);
    }
    let v = 0;
    for (const flt of fs) {
      flt.tick(x);
      v += flt.bp * flt.k;
    }
    out[i] = v * bell(t, 0, dur) * 1.6;
  }
  return out;
}

// ------------------------------------------------------------ ambience loops

/** Fluorescent ballast: exact 100 Hz harmonics (periodic, loops by itself) + gated buzz (cross-faded). */
export function humLoop(k, seconds) {
  const { sr, rng } = k;
  const n = len(sr, seconds);
  const extra = len(sr, 0.25);
  const buzz = new Float32Array(n + extra);
  const bf = new SVF(sr).set(2400, 1.3);
  for (let i = 0; i < buzz.length; i++) {
    const t = i / sr;
    bf.tick(white(rng));
    buzz[i] = bf.bp * Math.pow(Math.abs(Math.sin(2 * Math.PI * 50 * t)), 12) * 0.5;
  }
  const out = seamlessLoop(buzz, n);
  const harmonics = [[100, 1], [200, 0.55], [300, 0.35], [400, 0.18], [600, 0.12], [800, 0.05]];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    for (const [hz, a] of harmonics) s += Math.sin(2 * Math.PI * hz * t) * a;
    out[i] += s * 0.35;
  }
  return out;
}

/** Air handling: band-limited pink noise with slow swells that fit the loop exactly. */
export function ventLoop(k, seconds) {
  const { sr, rng } = k;
  const n = len(sr, seconds);
  const extra = len(sr, 0.4);
  const raw = new Float32Array(n + extra);
  const pink = new Pink();
  const bp = new SVF(sr).set(k.vary(420, 0.15), 0.6);
  const lp = new OnePole(sr, 1500);
  const rumble = new SVF(sr).set(95, 0.9);
  const lfoA = Math.floor(seconds / 3) || 1;
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr;
    const p = pink.tick(white(rng));
    bp.tick(p);
    rumble.tick(p);
    const swell = 1 + 0.18 * Math.sin((2 * Math.PI * lfoA * t) / seconds) + 0.08 * Math.sin((2 * Math.PI * (lfoA * 2 + 1) * t) / seconds);
    raw[i] = (lp.lp(bp.bp * bp.k * 1.8) + rumble.bp * 0.9) * swell;
  }
  return seamlessLoop(raw, n);
}

/** Distant city: low traffic wash with slow swells and a faint hiss. */
export function cityLoop(k, seconds) {
  const { sr, rng } = k;
  const n = len(sr, seconds);
  const extra = len(sr, 0.5);
  const raw = new Float32Array(n + extra);
  const pink = new Pink();
  const low = new SVF(sr).set(180, 0.7);
  const mid = new SVF(sr).set(900, 0.5);
  let brown = 0;
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr;
    const w = white(rng);
    brown = (brown + 0.02 * w) / 1.02;
    low.tick(brown * 6);
    mid.tick(pink.tick(white(rng)));
    const swell = 1 + 0.35 * Math.sin((2 * Math.PI * 2 * t) / seconds + 1.3) + 0.2 * Math.sin((2 * Math.PI * 5 * t) / seconds);
    raw[i] = low.lp * 1.6 * swell + mid.bp * 0.12 * (2 - swell);
  }
  return seamlessLoop(raw, n);
}

// ------------------------------------------------------------ ambience one-shots

export function pipeClank(k) {
  const { sr, rng } = k;
  const out = k.buf(1.4);
  const f0 = k.vary(240, 0.25);
  const bank = new ModeBank(sr, [[f0, 0.9, 1], [f0 * 2.76, 0.6, 0.6], [f0 * 5.4, 0.35, 0.35], [f0 * 8.9, 0.2, 0.15]]);
  const lp = new OnePole(sr, 2400);
  const second = k.vary(0.18, 0.4);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const x = (t < 0.001 ? white(rng) : 0) + (t >= second && t < second + 0.0006 ? white(rng) * 0.4 : 0);
    out[i] = lp.lp(bank.tick(x));
  }
  return out;
}

export function farHorn(k) {
  const { sr } = k;
  const out = k.buf(1.3);
  const f1 = k.vary(410, 0.08);
  const f2 = f1 * 1.26;
  const lp = new SVF(sr).set(1000, 0.7);
  const honks = k.vary(1, 0.5) > 1 ? [[0, 0.22], [0.32, 0.5]] : [[0, 0.55]];
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let env = 0;
    for (const [a, d] of honks) env += bell(t, a, a + d) ** 0.3 * (t > a && t < a + d ? 1 : 0);
    const sq = Math.sign(Math.sin(2 * Math.PI * f1 * t)) * 0.5 + Math.sign(Math.sin(2 * Math.PI * f2 * t)) * 0.5;
    out[i] = lp.tick(sq) * env * 0.5;
  }
  return out;
}

export function farPlane(k) {
  const { sr, rng } = k;
  const out = k.buf(9);
  const pink = new Pink();
  const bp = new SVF(sr);
  const low = new SVF(sr).set(120, 0.7);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    if ((i & 31) === 0) bp.set(expLerp(700, 380, t / 9), 1.2);
    const p = pink.tick(white(rng));
    bp.tick(p);
    low.tick(p);
    out[i] = (bp.bp * bp.k * 0.8 + low.lp * 1.4) * bell(t, 0, 9);
  }
  return out;
}
