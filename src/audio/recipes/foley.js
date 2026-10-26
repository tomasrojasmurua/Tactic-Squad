// Foley as code: footsteps per floor surface, equipment rattle, body falls,
// a dropped weapon, bullet impacts (wall, wood, metal, body, helmet),
// ricochets and near-miss whiz. Tasteful by design: impacts are dry thuds,
// never gore. Owner: audio.
import { SVF, OnePole, ModeBank, Mode, ad, bell, sat, white, grains, expLerp } from '../dsp.js';

/** Heel/toe character of each floor surface. */
const STEP_SURFACE = {
  tile: { thud: 140, thudGain: 0.5, click: 2600, clickQ: 1.8, clickGain: 0.9, clickDecay: 0.006, ring: [[1850, 0.018, 0.35]], toe: 0.45, scuff: 0.1 },
  concrete: { thud: 120, thudGain: 0.6, click: 1500, clickQ: 0.9, clickDecay: 0.008, clickGain: 0.7, grit: 0.55, toe: 0.5, scuff: 0.3 },
  asphalt: { thud: 110, thudGain: 0.55, click: 1200, clickQ: 0.8, clickDecay: 0.008, clickGain: 0.45, grit: 1, toe: 0.55, scuff: 0.55 },
  wood: { thud: 105, thudGain: 0.9, click: 900, clickQ: 1.4, clickDecay: 0.01, clickGain: 0.55, ring: [[190, 0.07, 0.8], [430, 0.05, 0.5], [960, 0.03, 0.25]], toe: 0.4, scuff: 0.12, creak: 0.25, attack: 0.0025 },
  carpet: { thud: 95, thudGain: 0.7, click: 520, clickQ: 0.7, clickDecay: 0.014, clickGain: 0.35, toe: 0.35, scuff: 0.2, muffle: 1600, attack: 0.005 },
};

/** One footstep: heel strike, toe roll, scuff (and the odd wooden creak). */
export function footstep(k, surface) {
  const s = STEP_SURFACE[surface];
  const { sr, rng } = k;
  const out = k.buf(0.32);
  const click = new SVF(sr).set(k.vary(s.click, 0.12), s.clickQ);
  const thud = new SVF(sr).set(k.vary(s.thud * 2, 0.1), 0.9);
  const ring = s.ring ? new ModeBank(sr, s.ring.map(([hz, t60, g]) => [k.vary(hz, 0.08), t60, g])) : null;
  const scuff = new SVF(sr).set(k.vary(3200, 0.2), 0.6);
  const lp = new OnePole(sr, s.muffle || 14000);
  const grit = grains(rng, sr, (t) => (s.grit ? 2500 * s.grit * ad(t, 0.002, 0.03) : 0));
  const gritF = new SVF(sr).set(3800, 0.7);
  const toeAt = k.vary(0.055, 0.25);
  const scuffEnd = toeAt + k.vary(0.07, 0.3);
  const creak = s.creak && rng.next() < s.creak;
  const creakHz = k.vary(520, 0.15);
  const creakF = new SVF(sr).set(creakHz * 2.1, 6);
  let creakPhase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const atk = s.attack || 0.0015;
    const heelEnv = ad(t, atk, s.clickDecay);
    const toeEnv = ad(t - toeAt, atk * 1.3, s.clickDecay * 1.4) * s.toe;
    const n = white(rng);
    click.tick(n);
    thud.tick(white(rng));
    let v = click.bp * click.k * (heelEnv + toeEnv) * s.clickGain;
    v += thud.lp * ad(t, atk * 1.4, 0.022) * s.thudGain * 2;
    if (ring) v += ring.tick(t < 0.001 ? n : 0) * 0.6;
    scuff.tick(white(rng));
    v += scuff.bp * bell(t, toeAt * 0.6, scuffEnd) * s.scuff * 0.5;
    gritF.tick(grit(t));
    v += gritF.bp * 0.9;
    if (creak) {
      creakPhase += (2 * Math.PI * creakHz * (1 + 0.02 * Math.sin(t * 90))) / sr;
      const saw = (creakPhase / (2 * Math.PI)) % 1;
      creakF.tick(saw * 2 - 1);
      v += creakF.bp * bell(t, 0.05, 0.24) * 0.12;
    }
    out[i] = lp.lp(v);
  }
  return out;
}

/** Equipment rattle: buckles and sling swivels, layered over some steps. */
export function gear(k) {
  const { sr, rng } = k;
  const out = k.buf(0.18);
  const bank = new ModeBank(sr, [[k.vary(3600, 0.1), 0.03, 1], [k.vary(5100, 0.1), 0.025, 0.7], [k.vary(2400, 0.1), 0.02, 0.5]]);
  const cloth = new SVF(sr).set(2400, 0.5);
  const hits = [0, k.vary(0.03, 0.4), k.vary(0.07, 0.3)];
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let x = 0;
    for (let h = 0; h < hits.length; h++) if (t >= hits[h] && t < hits[h] + 0.0005) x += white(rng) * (1 - h * 0.25);
    cloth.tick(white(rng));
    out[i] = bank.tick(x) * 0.5 + cloth.bp * bell(t, 0, 0.14) * 0.08;
  }
  return out;
}

/** A body going down: knees, then torso, then a cloth/gear settle. Dull, not graphic. */
export function bodyFall(k) {
  const { sr, rng } = k;
  const out = k.buf(0.8);
  const hits = [[0, 0.7, 150], [k.vary(0.11, 0.2), 1, 120], [k.vary(0.24, 0.2), 0.35, 170]];
  const thud = new SVF(sr).set(k.vary(320, 0.1), 0.8);
  const cloth = new SVF(sr).set(1800, 0.6);
  const phases = hits.map(() => 0);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    thud.tick(white(rng));
    cloth.tick(white(rng));
    let v = 0;
    for (let h = 0; h < hits.length; h++) {
      const [at, g, hz] = hits[h];
      const e = ad(t - at, 0.003, 0.04) * g;
      if (e <= 0) continue;
      phases[h] += (2 * Math.PI * expLerp(hz * k.vary(1, 0.08), hz * 0.6, (t - at) / 0.06)) / sr;
      v += (Math.sin(phases[h]) * 0.3 + thud.bp * thud.k * 2.6) * e;
    }
    v += cloth.bp * bell(t, 0.02, 0.45) * 0.14;
    out[i] = sat(v, 1.6);
  }
  return out;
}

/** Rifle hitting the floor (hard surfaces ring, carpet damps it). */
export function gunDrop(k, soft) {
  const { sr, rng } = k;
  const out = k.buf(0.6);
  const ring = soft ? 0.25 : 1;
  const bank = new ModeBank(sr, [[k.vary(780, 0.08), 0.12 * ring, 1], [k.vary(1720, 0.08), 0.09 * ring, 0.7], [k.vary(2950, 0.08), 0.06 * ring, 0.5], [k.vary(4400, 0.08), 0.04 * ring, 0.3]]);
  const thud = new SVF(sr).set(300, 1);
  const lp = new OnePole(sr, soft ? 1800 : 10000);
  const hits = [0, k.vary(0.09, 0.3), k.vary(0.16, 0.3)];
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let x = 0;
    for (let h = 0; h < hits.length; h++) if (t >= hits[h] && t < hits[h] + 0.001) x += white(rng) * Math.pow(0.45, h);
    thud.tick(x * 20);
    out[i] = lp.lp(bank.tick(x) * 0.7 + thud.bp * 0.2);
  }
  return out;
}

// ------------------------------------------------------------ bullet impacts

/** Plaster / concrete: sharp crack, short body, then crumbling debris and dust. */
export function impactWall(k) {
  const { sr, rng } = k;
  const out = k.buf(0.5);
  const crack = new SVF(sr).set(k.vary(3800, 0.15), 0.7);
  const body = new SVF(sr).set(k.vary(850, 0.15), 1.2);
  const debrisLen = k.vary(0.28, 0.3);
  const debris = grains(rng, sr, (t) => 900 * Math.max(0, 1 - t / debrisLen) * (t > 0.015 ? 1 : 0));
  const debrisF = new SVF(sr).set(k.vary(2600, 0.2), 1.1);
  const dust = new SVF(sr).set(5000, 0.5);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    crack.tick(white(rng));
    body.tick(white(rng));
    debrisF.tick(debris(t));
    dust.tick(white(rng));
    out[i] = crack.bp * crack.k * ad(t, 0.0002, 0.004) * 1.2 + body.bp * body.k * ad(t, 0.0005, 0.02) * 0.9 + debrisF.bp * 1.4 + dust.hp * ad(t, 0.01, 0.08) * 0.05;
  }
  return out;
}

/** Wood (doors, crates, shelves): hollow thock + splinter crackle. */
export function impactWood(k) {
  const { sr, rng } = k;
  const out = k.buf(0.35);
  const bank = new ModeBank(sr, [[k.vary(330, 0.1), 0.07, 1], [k.vary(790, 0.1), 0.05, 0.7], [k.vary(1550, 0.1), 0.03, 0.45], [k.vary(2900, 0.1), 0.015, 0.3]]);
  const splinter = grains(rng, sr, (t) => 2200 * ad(t, 0.002, 0.03));
  const sf = new SVF(sr).set(4200, 0.9);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const x = t < 0.0008 ? white(rng) : 0;
    sf.tick(splinter(t));
    out[i] = bank.tick(x) * 1.1 + sf.bp * 0.9;
  }
  return out;
}

/** Metal (fences, vehicles, fridges): bright inharmonic ping with a clang body. */
export function impactMetal(k) {
  const { sr, rng } = k;
  const out = k.buf(0.7);
  const f0 = k.vary(1150, 0.18);
  const bank = new ModeBank(sr, [[f0, 0.45, 1], [f0 * 2.32, 0.32, 0.7], [f0 * 3.87, 0.22, 0.5], [f0 * 5.41, 0.15, 0.35], [f0 * 7.1, 0.1, 0.2]]);
  const click = new SVF(sr).set(6000, 0.7);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const x = t < 0.0005 ? white(rng) : 0;
    click.tick(white(rng));
    out[i] = bank.tick(x) * 0.55 + click.bp * ad(t, 0.0001, 0.003) * 0.8;
  }
  return out;
}

/** Bullet hitting a body: a dry, low "thwack" through cloth. Deliberately not wet. */
export function impactFlesh(k, helmet) {
  const { sr, rng } = k;
  const out = k.buf(0.25);
  const body = new SVF(sr).set(k.vary(430, 0.12), 0.8);
  const cloth = new SVF(sr).set(k.vary(1500, 0.15), 1.2);
  const tick = helmet ? new ModeBank(sr, [[k.vary(2700, 0.06), 0.035, 1], [k.vary(4300, 0.06), 0.025, 0.5]]) : null;
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    body.tick(white(rng));
    cloth.tick(white(rng));
    phase += (2 * Math.PI * expLerp(190, 95, t / 0.04)) / sr;
    let v = body.bp * body.k * ad(t, 0.0008, 0.024) * 2.2 + Math.sin(phase) * ad(t, 0.001, 0.02) * 0.22 + cloth.bp * cloth.k * ad(t, 0.0004, 0.007) * 0.7;
    if (tick) v += tick.tick(t < 0.0005 ? white(rng) : 0) * 0.35;
    out[i] = sat(v, 1.8);
  }
  return out;
}

/**
 * Bare-head hit (no helmet): drier and harder than a body hit — a short bony
 * knock (two damped modes) over a tight, higher thump. No gore.
 */
export function impactHead(k) {
  const { sr, rng } = k;
  const out = k.buf(0.2);
  const body = new SVF(sr).set(k.vary(620, 0.12), 0.9);
  const bone = new ModeBank(sr, [[k.vary(1250, 0.08), 0.022, 1], [k.vary(2350, 0.08), 0.014, 0.55], [k.vary(3900, 0.1), 0.008, 0.3]]);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    body.tick(white(rng));
    phase += (2 * Math.PI * expLerp(260, 120, t / 0.03)) / sr;
    let v = body.bp * body.k * ad(t, 0.0005, 0.016) * 2.4 + Math.sin(phase) * ad(t, 0.0008, 0.014) * 0.3;
    v += bone.tick(t < 0.0004 ? white(rng) : 0) * 0.5;
    out[i] = sat(v, 2.2);
  }
  return out;
}

/** Ricochet whine: a sliding, wavering tone that falls in pitch and fades. */
export function ricochet(k) {
  const { sr, rng } = k;
  const out = k.buf(0.6);
  const f0 = k.vary(3600, 0.2);
  const f1 = k.vary(1300, 0.25);
  const dur = k.vary(0.42, 0.25);
  const noise = new SVF(sr).set(f0, 8);
  const vib = k.vary(38, 0.3);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const f = expLerp(f0, f1, t / dur) * (1 + 0.018 * Math.sin(2 * Math.PI * vib * t));
    phase += (2 * Math.PI * f) / sr;
    if ((i & 15) === 0) noise.set(f, 9);
    noise.tick(white(rng));
    const env = ad(t, 0.004, dur * 0.35);
    out[i] = (Math.sin(phase) * 0.5 + noise.bp * noise.k * 1.5) * env;
  }
  return out;
}

/** Near-miss whiz: Doppler-falling hiss with a ripping texture, peak at the pass. */
export function whiz(k) {
  const { sr, rng } = k;
  const out = k.buf(0.32);
  const pass = k.vary(0.05, 0.2);
  const f = new SVF(sr);
  const rip = new Mode(sr, k.vary(230, 0.2), 0.02, 1);
  const hi = k.vary(5200, 0.12);
  const lo = k.vary(1900, 0.15);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const x = (t - pass) / 0.03;
    if ((i & 7) === 0) f.set(lo + (hi - lo) / (1 + Math.exp(x * 2.2)), 2.2);
    f.tick(white(rng));
    const env = Math.exp(-((t - pass) ** 2) / (t < pass ? 0.0004 : 0.003));
    const ripV = 1 + rip.tick(white(rng)) * 0.4;
    out[i] = f.bp * f.k * env * ripV * 1.3;
  }
  return out;
}
