// Live music voices: tonal notes are OscillatorNodes (a cached PeriodicWave per timbre, or a 2-operator
// FM pair) with gain / low-pass envelopes, so every pitch of every scene is exact without transposing
// samples (no playbackRate on the music path) and costs no memory. Drums are baked one-shots played at
// rate 1 through the engine. A pad / drone of detuned oscillators holds the harmony. Measured cost:
// docs/audio/report.json "musicCost" (live note vs resampled buffer voice). Owner: audio.
import { MUSIC as M } from '../../config/audio.js';

export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Synth {
  constructor(engine) {
    this.e = engine;
    this.waves = new Map();
    this.live = 0; // tonal notes still sounding
    this.pad = null;
    this.stats = { notes: 0, skipped: 0 };
  }

  get ctx() {
    return this.e.ctx;
  }

  wave(harmonics) {
    const key = harmonics.join(',');
    let w = this.waves.get(key);
    if (!w) {
      const real = new Float32Array(harmonics.length + 1);
      const imag = new Float32Array(harmonics.length + 1);
      harmonics.forEach((a, i) => (imag[i + 1] = a));
      w = this.ctx.createPeriodicWave(real, imag);
      this.waves.set(key, w);
    }
    return w;
  }

  /** One tonal note. `spec` is a scene timbre (bass / lead). */
  note(spec, midi, when, gain) {
    if (this.live >= M.voiceCap) {
      this.stats.skipped++;
      return;
    }
    const ctx = this.ctx;
    const hz = midiHz(midi);
    const end = when + spec.attack + spec.decay * 2.4; // ~-60 dB
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(gain, when + spec.attack);
    env.gain.setTargetAtTime(0, when + spec.attack, spec.decay / 3);
    env.connect(this.e.music);
    const nodes = [env];
    const osc = ctx.createOscillator();
    osc.frequency.value = hz;
    if (spec.kind === 'fm') {
      const mod = ctx.createOscillator();
      mod.frequency.value = hz * spec.ratio;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(hz * spec.index, when);
      depth.gain.setTargetAtTime(hz * spec.index * 0.15, when, spec.decay / 5);
      mod.connect(depth).connect(osc.frequency);
      mod.start(when);
      mod.stop(end);
      nodes.push(mod, depth);
      osc.connect(env);
    } else {
      osc.setPeriodicWave(this.wave(spec.harmonics));
      if (spec.lowpass) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.Q.value = 0.9;
        const top = Math.min(16000, spec.lowpass * (spec.filterEnv || 1));
        f.frequency.setValueAtTime(top, when);
        if (spec.filterEnv) f.frequency.setTargetAtTime(spec.lowpass, when, spec.decay / 4);
        osc.connect(f).connect(env);
        nodes.push(f);
      } else osc.connect(env);
    }
    osc.start(when);
    osc.stop(end);
    this.live++;
    this.stats.notes++;
    osc.onended = () => {
      this.live--;
      osc.disconnect();
      for (const n of nodes) n.disconnect();
    };
  }

  /** A baked drum one-shot, at rate 1 (variety from its baked variations). */
  hit(name, when, gain) {
    this.e.play(name, { when, gain, bus: 'music', category: 'music' });
  }

  // ------------------------------------------------------------ pad / drone

  /** (Re)builds the pad for a scene; the previous one fades out and stops. */
  buildPad(spec) {
    const ctx = this.ctx;
    this.disposePad();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.8;
    filter.frequency.value = spec.lowpass[0];
    const gain = ctx.createGain();
    gain.gain.value = 0;
    filter.connect(gain).connect(this.e.music);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = M.padLfoHz;
    const depth = ctx.createGain();
    depth.gain.value = spec.lowpass[0] * 0.35;
    lfo.connect(depth).connect(filter.frequency);
    lfo.start();
    const wave = this.wave(spec.harmonics);
    const oscs = [];
    for (let v = 0; v < spec.voices; v++) {
      const vg = ctx.createGain();
      vg.gain.value = 1 / spec.voices;
      vg.connect(filter);
      for (const c of [-spec.detune, spec.detune]) {
        const o = ctx.createOscillator();
        o.setPeriodicWave(wave);
        o.detune.value = c;
        o.connect(vg);
        o.start();
        oscs.push(o);
      }
    }
    this.pad = { spec, filter, gain, oscs: [...oscs, lfo], voices: spec.voices };
  }

  /** Pad pitches (one MIDI note per voice), glided. */
  padChord(midis, t) {
    if (!this.pad) return;
    const { oscs, voices } = this.pad;
    for (let v = 0; v < voices; v++) {
      const hz = midiHz(midis[v % midis.length]);
      oscs[v * 2].frequency.setTargetAtTime(hz, t, M.padGlide);
      oscs[v * 2 + 1].frequency.setTargetAtTime(hz, t, M.padGlide);
    }
  }

  /** Pad level (0..1 of its scene gain) and brightness (0..1 across its low-pass range). */
  padLevel(level, brightness, t) {
    if (!this.pad) return;
    const { spec, gain, filter } = this.pad;
    gain.gain.setTargetAtTime(level * spec.gain * M.padGain, t, M.padFade);
    filter.frequency.setTargetAtTime(spec.lowpass[0] + (spec.lowpass[1] - spec.lowpass[0]) * brightness, t, M.padFade);
  }

  disposePad() {
    const pad = this.pad;
    if (!pad) return;
    const t = this.ctx.currentTime;
    pad.gain.gain.setTargetAtTime(0, t, M.padFade / 2);
    for (const o of pad.oscs) o.stop(t + M.padFade * 3);
    pad.oscs[0].onended = () => pad.gain.disconnect();
    this.pad = null;
  }
}
