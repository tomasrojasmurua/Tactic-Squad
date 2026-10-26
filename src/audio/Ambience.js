// Ambience bed: fluorescent hum (synthesized live: two oscillators a hair apart
// beating slowly, with incommensurate wobble — no buffer, never a loop) +
// ventilation (decorrelated L/R loops of 9-13 s, mutually prime lengths, so the
// pattern never repeats audibly) + distant city,
// crossfaded indoor/outdoor by where the camera is, with a slow random level
// drift; plus sparse one-shots (pipe clank, building creak, far horn, siren,
// airliner) at random intervals. Levels in config/audio.js AMBIENCE. Owner: audio.
import { Rng } from '../core/rng.js';
import { AMBIENCE as A, BAKE } from '../config/audio.js';

const BEDS = [
  { name: null, level: 'hum', pan: 0 }, // live (buildHum)
  { name: 'amb.vent', level: 'vent', pan: -0.7, offset: 0 },
  { name: 'amb.vent', level: 'vent', pan: 0.7, offset: 0.5 }, // same loop half a period later: decorrelated
  { name: 'amb.city', level: 'city', pan: 0 },
];

export class Ambience {
  /** @param {(x:number, y:number) => {zone:string}} acousticsAt */
  constructor(engine, acousticsAt) {
    this.e = engine;
    this.acousticsAt = acousticsAt;
    this.rng = new Rng(BAKE.seed ^ 0xab1e);
    this.voices = null;
    this.timers = A.events.map((ev) => this.interval(ev) * 0.5);
    this.drift = BEDS.map(() => 1);
    this.driftTimer = 0;
    this.outdoor = -1;
  }

  interval(ev) {
    return ev.every[0] + this.rng.next() * (ev.every[1] - ev.every[0]);
  }

  start() {
    const e = this.e;
    if (this.voices || !e.ready || !BEDS.every((b) => !b.name || e.bank.has(b.name))) return;
    this.voices = BEDS.map((b) => (b.name ? e.play(b.name, { bus: 'ambience', loop: true, gain: 0, pan: b.pan, category: null, offset: b.offset * A.loopSeconds[0] }) : this.buildHum()));
  }

  /** Mains hum + ballast buzz as live oscillators (100 Hz harmonics; ~0 CPU, 0 memory). */
  buildHum() {
    const ctx = this.e.ctx;
    const H = A.liveHum;
    const out = ctx.createGain();
    out.gain.value = 0;
    const wobble = ctx.createGain();
    wobble.connect(out).connect(this.e.ambience);
    const n = 33;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    [1, 0.55, 0.35, 0.18, 0, 0.12, 0, 0.05].forEach((a, i) => (imag[i + 1] = a));
    for (let h = 18; h < n; h++) imag[h] = (H.buzz * (h % 2 ? 0.6 : 1)) / (1 + Math.abs(h - 24) * 0.4); // buzz around 2.4 kHz
    const wave = ctx.createPeriodicWave(real, imag);
    for (const hz of [H.hz, H.hz + H.beatHz]) {
      const o = ctx.createOscillator();
      o.setPeriodicWave(wave);
      o.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.value = 0.45;
      o.connect(g).connect(wobble);
      o.start();
    }
    for (const hz of H.wobbleHz) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = hz;
      const depth = ctx.createGain();
      depth.gain.value = H.wobbleDepth / H.wobbleHz.length;
      lfo.connect(depth).connect(wobble.gain);
      lfo.start();
    }
    return { gain: out };
  }

  /** @param {{x:number, y:number}} listener */
  update(dt, listener) {
    this.start();
    if (!this.voices) return;
    const outdoor = this.acousticsAt(listener.x, listener.y).zone === 'yard' ? 1 : 0;
    this.driftTimer -= dt;
    const redrift = this.driftTimer <= 0;
    if (redrift) {
      this.driftTimer = A.driftSeconds;
      this.drift = this.drift.map(() => Math.pow(10, ((this.rng.next() * 2 - 1) * A.driftDb) / 20));
    }
    if (outdoor !== this.outdoor || redrift) {
      this.outdoor = outdoor;
      const t = this.e.now;
      BEDS.forEach((b, i) => {
        const v = this.voices[i];
        if (!v) return;
        v.gain.gain.setTargetAtTime(this.level(b.level, outdoor) * this.drift[i], t, A.fadeSeconds / 3);
      });
    }
    for (let i = 0; i < A.events.length; i++) {
      this.timers[i] -= dt;
      if (this.timers[i] > 0) continue;
      const ev = A.events[i];
      this.timers[i] = this.interval(ev);
      const g = ev.gain * (ev.outdoor && !outdoor ? 0.45 : 1);
      if (ev.live) {
        this.siren(g, (this.rng.next() * 2 - 1) * ev.pan, ev.send);
        continue;
      }
      this.e.play(ev.name, {
        bus: 'ambience',
        gain: g,
        pan: (this.rng.next() * 2 - 1) * ev.pan,
        reverb: ev.outdoor ? 'yard' : 'room',
        send: ev.send,
        category: 'ambience',
        cents: this.e.jitterCents(150),
      });
    }
  }

  /** A far-off siren, live: a two-harmonic tone swept by a slow LFO, low-passed, swelling in and out. */
  siren(gain, pan, send) {
    const e = this.e;
    const ctx = e.ctx;
    const S = A.liveSiren;
    const t = e.now;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, 0, 0]), new Float32Array([0, 1, 0.25])));
    osc.frequency.value = S.hz;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1 / this.rng.range(...S.period);
    const depth = ctx.createGain();
    depth.gain.value = S.sweep;
    lfo.connect(depth).connect(osc.frequency);
    const lp = ctx.createBiquadFilter();
    lp.frequency.value = S.lowpassHz;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + S.seconds / 2);
    env.gain.linearRampToValueAtTime(0, t + S.seconds);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    osc.connect(lp).connect(env).connect(p).connect(e.ambience);
    const s = ctx.createGain();
    s.gain.value = send;
    p.connect(s).connect(e.reverbs.yard);
    for (const o of [osc, lfo]) {
      o.start(t);
      o.stop(t + S.seconds);
    }
    osc.onended = () => [osc, lfo, depth, lp, env, p, s].forEach((n) => n.disconnect());
  }

  level(kind, outdoor) {
    if (kind === 'hum') return A.hum * (outdoor ? A.outdoorHumMul : 1);
    if (kind === 'vent') return A.vent * (outdoor ? A.outdoorVentMul : A.indoorVentMul);
    return outdoor ? A.outdoorCity : A.city;
  }
}
