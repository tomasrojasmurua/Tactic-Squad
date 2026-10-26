// Procedural sound bank. Every function synthesizes one sound into `out`
// (a voice node from AudioEngine). No samples, no files.

const rand = (a, b) => a + Math.random() * (b - a);

/** Plays a slice of a noise buffer through a filter with a gain envelope. */
function noiseBurst(e, out, { t = e.now, type = 'bandpass', freq = 1000, q = 1, attack = 0.001, peak = 1, decay = 0.1, freqEnd = null, buffer = e.noise }) {
  const ctx = e.ctx;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + decay);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * (buffer.duration - attack - decay - 0.05));
  src.stop(t + attack + decay + 0.05);
}

/** Oscillator with pitch glide and gain envelope. */
function tone(e, out, { t = e.now, type = 'sine', freq = 440, freqEnd = null, attack = 0.002, peak = 0.5, decay = 0.2, glide = null }) {
  const ctx = e.ctx;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + (glide ?? decay));
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

export function gunshot(e, out, p, distance = 0) {
  const t = e.now;
  const far = Math.min(1, distance / 25);
  const crack = p.crackHz * (1 - far * 0.6) * rand(0.92, 1.08);
  // Supersonic crack
  noiseBurst(e, out, { t, type: 'highpass', freq: crack, q: 0.7, peak: p.gain * (1 - far * 0.7), decay: 0.045 });
  // Body of the report
  noiseBurst(e, out, { t, type: 'lowpass', freq: p.bodyHz * rand(0.9, 1.1), freqEnd: p.bodyHz * 0.35, q: 0.9, peak: p.gain * 0.9, decay: p.decay });
  // Low thump
  tone(e, out, { t, type: 'sine', freq: p.thumpHz * 1.8, freqEnd: p.thumpHz * 0.6, peak: p.gain * 0.8, decay: p.decay * 0.8 });
  // Room tail
  noiseBurst(e, out, { t: t + 0.01, type: 'bandpass', freq: 600, q: 0.6, peak: p.gain * 0.18 * (0.6 + far), decay: p.tail });
}

export function footstep(e, out) {
  const t = e.now;
  noiseBurst(e, out, { t, type: 'bandpass', freq: rand(380, 620), q: 1.2, peak: 0.6, decay: 0.05 });
  noiseBurst(e, out, { t: t + 0.012, type: 'highpass', freq: 2500, q: 0.5, peak: 0.12, decay: 0.025 });
}

export function doorKick(e, out) {
  const t = e.now;
  tone(e, out, { t, type: 'sine', freq: 140, freqEnd: 45, peak: 0.9, decay: 0.18 });
  noiseBurst(e, out, { t, type: 'lowpass', freq: 900, q: 0.8, peak: 0.8, decay: 0.16 });
  noiseBurst(e, out, { t: t + 0.005, type: 'bandpass', freq: 2400, q: 3, peak: 0.25, decay: 0.03 }); // latch
  // Creak: detuned saw through a resonant band
  const ctx = e.ctx;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(rand(95, 120), t + 0.04);
  o.frequency.exponentialRampToValueAtTime(rand(55, 70), t + 0.38);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 23;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 12;
  lfo.connect(lfoGain).connect(o.frequency);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400;
  bp.Q.value = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  o.connect(bp).connect(g).connect(out);
  o.start(t + 0.04);
  lfo.start(t + 0.04);
  o.stop(t + 0.45);
  lfo.stop(t + 0.45);
  // Door hits the wall
  tone(e, out, { t: t + 0.2, type: 'triangle', freq: 90, freqEnd: 50, peak: 0.35, decay: 0.12 });
  noiseBurst(e, out, { t: t + 0.2, type: 'lowpass', freq: 700, q: 0.7, peak: 0.3, decay: 0.1 });
}

export function impactWall(e, out) {
  const t = e.now;
  noiseBurst(e, out, { t, type: 'highpass', freq: 2800, q: 0.7, peak: 0.45, decay: 0.035 });
  noiseBurst(e, out, { t, type: 'bandpass', freq: 900, q: 1, peak: 0.3, decay: 0.07 });
  if (Math.random() < 0.3) tone(e, out, { t: t + 0.01, type: 'sine', freq: rand(2600, 3600), freqEnd: rand(900, 1300), peak: 0.07, decay: 0.28 });
}

export function impactFlesh(e, out, headshot) {
  const t = e.now;
  tone(e, out, { t, type: 'sine', freq: 120, freqEnd: 55, peak: 0.7, decay: 0.09 });
  noiseBurst(e, out, { t, type: 'lowpass', freq: 700, q: 1.5, peak: 0.6, decay: 0.08 });
  if (headshot) noiseBurst(e, out, { t: t + 0.01, type: 'bandpass', freq: 1800, q: 2, peak: 0.35, decay: 0.06 });
}

export function casing(e, out) {
  const t = e.now + rand(0.28, 0.42);
  for (let i = 0; i < 2; i++) {
    tone(e, out, { t: t + i * rand(0.05, 0.09), type: 'sine', freq: rand(4200, 6200), peak: 0.05 / (i + 1), decay: 0.06 });
  }
}

export function reload(e, out) {
  const t = e.now;
  noiseBurst(e, out, { t, type: 'bandpass', freq: 1800, q: 4, peak: 0.35, decay: 0.03 });
  noiseBurst(e, out, { t: t + 0.35, type: 'bandpass', freq: 1200, q: 3, peak: 0.3, decay: 0.04 });
  noiseBurst(e, out, { t: t + 0.9, type: 'bandpass', freq: 2200, q: 5, peak: 0.45, decay: 0.03 });
  noiseBurst(e, out, { t: t + 0.98, type: 'bandpass', freq: 1500, q: 5, peak: 0.4, decay: 0.035 });
}

export function bodyFall(e, out) {
  const t = e.now + 0.28;
  tone(e, out, { t, type: 'sine', freq: 95, freqEnd: 40, peak: 0.7, decay: 0.2 });
  noiseBurst(e, out, { t, type: 'lowpass', freq: 500, q: 0.7, peak: 0.55, decay: 0.18 });
  noiseBurst(e, out, { t: t + 0.12, type: 'bandpass', freq: 1500, q: 2, peak: 0.12, decay: 0.08 }); // gear rattle
}

// ---------------------------------------------------------------- UI / cues

export function ui(e, out, name) {
  const t = e.now;
  switch (name) {
    case 'select':
      tone(e, out, { t, type: 'triangle', freq: 880, freqEnd: 1320, peak: 0.25, decay: 0.07, glide: 0.04 });
      break;
    case 'waypoint':
      tone(e, out, { t, type: 'sine', freq: 1500, peak: 0.12, decay: 0.035 });
      break;
    case 'look':
      tone(e, out, { t, type: 'sine', freq: 1000, freqEnd: 1400, peak: 0.12, decay: 0.06 });
      break;
    case 'undo':
      tone(e, out, { t, type: 'sine', freq: 900, freqEnd: 500, peak: 0.15, decay: 0.08 });
      break;
    case 'hold':
      tone(e, out, { t, type: 'square', freq: 520, peak: 0.08, decay: 0.05 });
      tone(e, out, { t: t + 0.07, type: 'square', freq: 520, peak: 0.08, decay: 0.05 });
      break;
    case 'error':
      tone(e, out, { t, type: 'square', freq: 180, peak: 0.12, decay: 0.12 });
      break;
    case 'execute':
      noiseBurst(e, out, { t, type: 'bandpass', freq: 600, freqEnd: 3000, q: 1.5, peak: 0.3, decay: 0.25 });
      tone(e, out, { t: t + 0.05, type: 'triangle', freq: 440, freqEnd: 880, peak: 0.25, decay: 0.2, glide: 0.12 });
      break;
    case 'pause':
      tone(e, out, { t, type: 'triangle', freq: 660, freqEnd: 330, peak: 0.25, decay: 0.18, glide: 0.1 });
      break;
    case 'resume':
      tone(e, out, { t, type: 'triangle', freq: 330, freqEnd: 660, peak: 0.25, decay: 0.15, glide: 0.08 });
      break;
    case 'go':
      radioChirp(e, out, t);
      tone(e, out, { t: t + 0.08, type: 'square', freq: 1046, peak: 0.12, decay: 0.07 });
      tone(e, out, { t: t + 0.16, type: 'square', freq: 1568, peak: 0.12, decay: 0.12 });
      break;
    case 'contact':
      radioChirp(e, out, t);
      tone(e, out, { t: t + 0.05, type: 'sawtooth', freq: 740, peak: 0.08, decay: 0.09 });
      break;
    case 'plant':
      tone(e, out, { t, type: 'sine', freq: 1900, peak: 0.18, decay: 0.07 });
      break;
    case 'planted':
      for (let i = 0; i < 3; i++) tone(e, out, { t: t + i * 0.12, type: 'sine', freq: 2100, peak: 0.22, decay: 0.08 });
      break;
    case 'win':
      chord(e, out, t, [523, 659, 784], 0.9);
      chord(e, out, t + 0.22, [659, 784, 1046], 1.2);
      break;
    case 'lose':
      chord(e, out, t, [392, 466, 554], 0.8);
      chord(e, out, t + 0.3, [311, 370, 440], 1.4);
      break;
    case 'hurt':
      tone(e, out, { t, type: 'sine', freq: 70, freqEnd: 40, peak: 0.5, decay: 0.3 });
      break;
    default:
      tone(e, out, { t, type: 'sine', freq: 1200, peak: 0.1, decay: 0.04 });
  }
}

function radioChirp(e, out, t) {
  noiseBurst(e, out, { t, type: 'bandpass', freq: 2500, q: 2, peak: 0.18, decay: 0.05 });
}

function chord(e, out, t, freqs, dur) {
  for (const f of freqs) {
    tone(e, out, { t, type: 'triangle', freq: f, peak: 0.1, attack: 0.02, decay: dur });
    tone(e, out, { t, type: 'sine', freq: f * 2, peak: 0.03, attack: 0.02, decay: dur * 0.6 });
  }
}
