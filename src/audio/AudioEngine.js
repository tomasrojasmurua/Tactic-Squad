// WebAudio graph and playback. Created lazily on the first user gesture
// (autoplay policy / iOS), or around an injected (Offline)AudioContext for
// tests and the sound lab.
//
//   world voices ─┬─────────────────────────▶ pauseFilter ─▶ pauseGain ─┐
//   ambience ─────┤  sends ─▶ room / yard reverbs ─▶ (same) ────────────┤
//   ui ─────────────────────────────────────────────────────────────────┼─▶ high-pass ─▶ glue comp ─▶ limiter ─▶ trim ─▶ soft clip ─▶ master (mute) ─▶ out
//   music ─▶ musicFilter ─▶ duck ─▶ musicGain (on/off) ─────────────────┘
//
// Voices are pooled (VoicePool) and come from the baked SoundBank. Owner: audio.
import { Rng } from '../core/rng.js';
import { MIX, MASTER, PAUSE, REVERB, VOICES, BAKE } from '../config/audio.js';
import { SoundBank } from './SoundBank.js';
import { VoicePool } from './VoicePool.js';
import { createImpulse } from './reverb.js';

const dbToGain = (db) => Math.pow(10, db / 20);
const gainNode = (ctx, v) => {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
};

export class AudioEngine {
  /** @param {{context?: BaseAudioContext, bank?: SoundBank}} [opts] */
  constructor(opts = {}) {
    this.ctx = null;
    this.muted = false;
    this.musicOn = true;
    this.pool = new VoicePool();
    this.rng = new Rng(BAKE.seed ^ 0xa11);
    this.meterNode = null;
    this.meterPeak = 0;
    this.bank = opts.bank || new SoundBank();
    if (!opts.bank) this.bank.bakeInBackground();
    if (opts.context) this.build(opts.context);
  }

  get ready() {
    return !!this.ctx && (this.ctx.state === 'running' || this.offline);
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Must be called from a user gesture handler (creates / resumes the context). */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.build(new Ctx({ latencyHint: 'interactive' }));
      // iOS: a buffer started inside the gesture really unlocks output.
      const s = this.ctx.createBufferSource();
      s.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      s.connect(this.ctx.destination);
      s.start();
      document.addEventListener('visibilitychange', () => this.onVisibility());
    }
    if (this.ctx.state !== 'running' && !document.hidden) this.ctx.resume().catch(() => {});
  }

  onVisibility() {
    if (!this.ctx) return;
    if (document.hidden) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  build(ctx) {
    this.ctx = ctx;
    this.offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
    const gain = (v, to) => {
      const g = ctx.createGain();
      g.gain.value = v;
      if (to) g.connect(to);
      return g;
    };
    const comp = (c, to) => {
      const n = ctx.createDynamicsCompressor();
      n.threshold.value = c.threshold;
      n.knee.value = c.knee;
      n.ratio.value = c.ratio;
      n.attack.value = c.attack;
      n.release.value = c.release;
      n.connect(to);
      return n;
    };

    this.master = gain(MIX.master, ctx.destination);
    this.clipper = ctx.createWaveShaper();
    this.clipper.curve = softClipCurve(MASTER.clipCeiling);
    this.clipper.connect(this.master);
    this.trim = gain(MASTER.trim, this.clipper);
    this.limiter = comp(MASTER.limiter, this.trim);
    this.glue = comp(MASTER.glue, this.limiter);
    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = MASTER.highpassHz;
    this.highpass.Q.value = 0.6;
    this.highpass.connect(this.glue);

    this.pauseGain = gain(1, this.highpass);
    this.pauseFilter = ctx.createBiquadFilter();
    this.pauseFilter.type = 'lowpass';
    this.pauseFilter.frequency.value = PAUSE.openHz;
    this.pauseFilter.Q.value = 0.7;
    this.pauseFilter.connect(this.pauseGain);
    this.world = gain(MIX.sfx, this.pauseFilter);
    this.ambience = gain(MIX.ambience, this.pauseFilter);
    this.ui = gain(MIX.ui, this.highpass);

    this.musicGain = gain(this.musicOn ? MIX.music : 0, this.highpass);
    this.duck = gain(1, this.musicGain);
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = PAUSE.openHz;
    this.musicFilter.connect(this.duck);
    this.music = gain(1, this.musicFilter);

    this.reverbs = {};
    let seed = BAKE.seed;
    for (const [name, spec] of Object.entries(REVERB)) {
      const conv = ctx.createConvolver();
      conv.normalize = false;
      conv.buffer = createImpulse(ctx, spec, seed++);
      this.irBytes = (this.irBytes || 0) + conv.buffer.length * conv.buffer.numberOfChannels * 4;
      conv.connect(this.pauseFilter);
      this.reverbs[name] = gain(1, conv);
    }
    this.buses = { world: this.world, ambience: this.ambience, ui: this.ui, music: this.music };
    this.bank.attach(ctx);
  }

  /**
   * Plays a baked sound. Options: when, gain, pan (-1..1, world/ambience),
   * cents (detune), bus, reverb ('room'|'yard') + send, lowpass (Hz),
   * category (VoicePool; null = unpooled), loop, offset (s into the buffer), variation (fixed index; lab only).
   * Returns the voice, or null if not playable now.
   */
  play(name, o = {}) {
    return this.playLayers([{ name, at: 0, gain: 1, variation: o.variation ?? -1, offset: o.offset || 0 }], o);
  }

  /**
   * Several baked layers as ONE voice (gunshots: body + mech + tail + refl): each layer is a source at
   * its own offset `at` (s) and gain, all through one gain / filter / pan / send chain, so the voice
   * pool, stealing and spatialization treat the shot as a single sound. Options as play().
   */
  playLayers(layers, o = {}) {
    if (!this.ready) return null;
    const ctx = this.ctx;
    const buffers = layers.map((l) => this.bank.pick(l.name, l.variation ?? -1));
    if (!buffers[0]) return null; // the first layer is the sound; the others are optional
    const when = Math.max(o.when ?? ctx.currentTime, ctx.currentTime);
    const category = o.category === undefined ? 'impact' : o.category;
    if (category && !this.pool.admit(category, ctx.currentTime)) return null;
    // playbackRate stays exactly 1 unless asked: native-rate playback is the cheap path.
    const rate = o.cents || (o.rate && o.rate !== 1) ? Math.pow(2, (o.cents || 0) / 1200) * (o.rate || 1) : 1;
    const g = gainNode(ctx, o.gain ?? 1);
    const srcs = [];
    let end = when;
    layers.forEach((l, i) => {
      const buffer = buffers[i];
      if (!buffer) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = !!o.loop;
      if (rate !== 1) src.playbackRate.value = rate;
      if (l.gain !== 1) src.connect((src.layerGain = gainNode(ctx, l.gain))).connect(g);
      else src.connect(g);
      const at = when + (l.at || 0);
      src.start(at, l.offset || 0);
      end = Math.max(end, at + buffer.duration / rate);
      srcs.push(src);
    });
    let out = g;
    if (o.lowpass && o.lowpass < PAUSE.openHz) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lowpass;
      g.connect(f);
      out = f;
    }
    const bus = this.buses[o.bus || 'world'];
    if (o.pan !== undefined && bus !== this.ui) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      out.connect(p);
      out = p;
    }
    out.connect(bus);
    if (o.reverb && o.send > 0) out.connect(gainNode(ctx, o.send)).connect(this.reverbs[o.reverb]);
    const src = srcs.length === 1 ? srcs[0] : { stop: (t) => srcs.forEach((x) => x.stop(t)) };
    const voice = { category, start: when, end: o.loop ? Infinity : end, src, gain: g };
    if (category) this.pool.add(voice);
    let left = srcs.length;
    const cleanup = () => {
      if (--left > 0) return;
      for (const x of srcs) {
        x.disconnect();
        x.layerGain?.disconnect();
      }
      g.disconnect();
      out.disconnect();
    };
    for (const x of srcs) x.onended = cleanup;
    return voice;
  }

  /** The one audio memory figure: baked PCM (SoundBank.stats) + the reverb impulses. */
  memoryStats() {
    return this.bank.stats(this.irBytes || 0);
  }

  /** Random variation helpers (seeded, never Math.random). */
  jitterCents(c) {
    return (this.rng.next() * 2 - 1) * c;
  }

  jitterGain(db) {
    return dbToGain((this.rng.next() * 2 - 1) * db);
  }

  /** Tactical pause: muffle the world (tails keep ringing), filter the music. */
  setPaused(on) {
    if (!this.ctx) return;
    const t = this.now;
    const s = PAUSE.seconds;
    this.pauseFilter.frequency.setTargetAtTime(on ? PAUSE.lowpassHz : PAUSE.openHz, t, s);
    this.pauseFilter.Q.setTargetAtTime(on ? PAUSE.q : 0.7, t, s);
    this.pauseGain.gain.setTargetAtTime(on ? PAUSE.worldGain : 1, t, s);
    this.musicFilter.frequency.setTargetAtTime(on ? PAUSE.musicLowpassHz : PAUSE.openHz, t, s * 2);
  }

  /** Short music dip under loud nearby events. */
  duckMusic(db, release) {
    if (!this.ctx) return;
    const g = this.duck.gain;
    const t = this.now;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(dbToGain(db), t, 0.012);
    g.setTargetAtTime(1, t + 0.06, release / 3);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : MIX.master, this.now, MIX.muteSeconds);
    return this.muted;
  }

  setMusicEnabled(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(on ? MIX.music : 0, this.now, 0.3);
  }

  /** Optional output meter (tests / lab): peak of the final output since the last read. */
  enableMeter() {
    if (!this.ctx || this.meterNode) return;
    this.meterNode = this.ctx.createAnalyser();
    this.meterNode.fftSize = 4096;
    this.meterBuf = new Float32Array(this.meterNode.fftSize);
    this.clipper.connect(this.meterNode);
  }

  readMeter() {
    if (!this.meterNode) return 0;
    this.meterNode.getFloatTimeDomainData(this.meterBuf);
    let p = 0;
    for (let i = 0; i < this.meterBuf.length; i++) p = Math.max(p, Math.abs(this.meterBuf[i]));
    this.meterPeak = Math.max(this.meterPeak, p);
    return p;
  }

  /** Live voice count by category (debug / tests). */
  voiceReport() {
    this.pool.sweep(this.now);
    const by = {};
    for (const c of Object.keys(VOICES.categories)) by[c] = this.pool.count(c);
    return { active: this.pool.active.length, ...this.pool.stats, by };
  }
}

/** Transparent below ~0.8, smoothly saturating to `ceiling`: a last-resort safety net. */
function softClipCurve(ceiling) {
  const n = 2048;
  const curve = new Float32Array(n);
  const knee = 0.8;
  const room = ceiling - knee;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}
