// Plays one music scene (audio/music/scenes.js) on a 16th-note grid: harmony from a progression
// picked per cycle, and per 4-bar phrase a fresh arrangement — one pattern variant per instrument for
// the current intensity tier, mutated (dropped / added ghost hits), a melodic motif generated on the
// spot (random walk on chord tones over a rhythm cell, stated, varied, answered), sometimes a thin
// "breathing" phrase, and a fill into the next phrase. Seeded: same session, same music; never a loop.
// Writes to a `sink` (audio/music/Synth.js live, or a recorder for analysis). Owner: audio.
import { clamp } from '../../core/math.js';
import { MUSIC as M } from '../../config/audio.js';

const STEPS = 16;
const PHRASE_BARS = 4;
export const TIERS = Object.freeze(['low', 'mid', 'high']);

export class ScenePlayer {
  constructor(scene, rng, sink) {
    this.s = scene;
    this.rng = rng;
    this.sink = sink;
    this.progression = rng.pick(scene.progressions);
    this.barsPerChord = rng.pick(scene.barsPerChord);
    this.cycleStart = 0;
    this.phrase = null;
    this.walk = 4; // motif random-walk position (scale degrees)
    this.padChord = null;
  }

  get stepSeconds() {
    return 60 / this.s.bpm / 4;
  }

  tierOf(I) {
    return I < M.tiers[0] ? 'low' : I < M.tiers[1] ? 'mid' : 'high';
  }

  midi(degree, octave = 0) {
    const sc = this.s.scale;
    const o = Math.floor(degree / sc.length);
    const d = ((degree % sc.length) + sc.length) % sc.length;
    return this.s.root + sc[d] + 12 * (o + octave);
  }

  chordAt(bar) {
    const cycle = this.progression.length * this.barsPerChord;
    if (bar - this.cycleStart >= cycle) {
      // New harmonic cycle: another progression, maybe another harmonic rhythm.
      this.cycleStart = bar;
      this.progression = this.rng.pick(this.s.progressions);
      this.barsPerChord = this.rng.pick(this.s.barsPerChord);
    }
    return this.progression[Math.floor((bar - this.cycleStart) / this.barsPerChord) % this.progression.length];
  }

  /** A pattern variant with a few hits dropped and a few ghost notes added. */
  mutate(pattern) {
    const out = pattern.split('');
    for (let i = 0; i < STEPS; i++) {
      if (out[i] === 'o' && this.rng.chance(M.mutate.drop)) out[i] = '.';
      else if (out[i] === '.' && i % 2 === 0 && this.rng.chance(M.mutate.ghost)) out[i] = 'o';
    }
    return out;
  }

  newPhrase(bar, tier, lastStand) {
    const pools = this.s.rhythm[tier];
    const parts = {};
    for (const [inst, pool] of Object.entries(pools)) parts[inst] = this.mutate(this.rng.pick(pool));
    if (lastStand) {
      // One operator left: the band drops out, a heartbeat and the bass remain.
      parts.tick = parts.tick ? parts.tick.map((c, i) => (i % 8 === 0 ? 'o' : '.')) : undefined;
      parts.kick = 'x..o........x...'.split('');
      delete parts.rim;
    }
    const thin = !lastStand && this.rng.chance(M.breatheChance);
    if (thin) for (const k of ['kick', 'rim']) delete parts[k];
    const ti = TIERS.indexOf(tier);
    const cell = this.rng.pick(this.s.motif.rhythms).split('');
    const pitches = cell.map(() => {
      this.walk = clamp(this.walk + this.rng.int(-2, 2), 0, this.s.motif.range);
      return this.walk;
    });
    const play = [];
    for (let b = 0; b < PHRASE_BARS; b++) play.push(this.rng.chance(clamp(this.s.motif.density[ti] * M.motifBarFactor * (thin ? 0.5 : 1), 0, 1)));
    this.phrase = { start: bar, tier, parts, cell, pitches, play, fill: tier === 'high' && !thin && this.rng.chance(M.fillChance), lastStand };
  }

  /**
   * Schedules step `step` (from the scene start) at time t. `I` intensity 0..1, `level` the
   * presence gain (0..1), `lastStand` the arrangement for one operator left.
   */
  schedule(step, t, I, level, lastStand) {
    const bar = Math.floor(step / STEPS);
    const s = step % STEPS;
    const tier = this.tierOf(I);
    const p = this.phrase;
    if (!p || (s === 0 && (bar - p.start >= PHRASE_BARS || p.tier !== tier || p.lastStand !== lastStand))) this.newPhrase(bar, tier, lastStand);
    const root = this.chordAt(bar);
    const P = this.phrase;
    const L = M.layers;
    const scene = this.s;
    const g = level * (0.75 + 0.25 * I);
    if (s === 0) this.updatePad(root, t);

    const hit = (inst, name, gain) => {
      const c = P.parts[inst]?.[s];
      if (c && c !== '.') this.sink.hit(name, t, gain * (c === 'x' ? 1 : 0.55) * g);
    };
    hit('kick', scene.drums.kick, L.kick);
    hit('tick', scene.drums.tick, L.tick);
    hit('rim', scene.drums.rim, L.rim);
    const inPhrase = bar - P.start;
    if (P.fill && inPhrase === PHRASE_BARS - 1 && s >= 12) this.sink.hit(scene.drums.fill, t, L.fill * (0.6 + (s - 12) * 0.13) * g);

    const bc = P.parts.bass?.[s];
    if (bc && bc !== '.') {
      const deg = bc === '5' ? root + 4 : bc === '8' ? root + 7 : root;
      this.sink.note(scene.bass, this.midi(deg, scene.bass.octave), t, L.bass * scene.bass.gain * (bc === 'o' ? 0.65 : 1) * g);
    }

    // Motif: bar 1 states it, bar 2 repeats it on the new chord, bar 3 answers (new tail), bar 4 rests or echoes.
    if (P.play[inPhrase] && P.cell[s] !== '.') {
      let deg = P.pitches[s];
      if (inPhrase === 2 && s >= 8) deg = clamp(deg + this.rng.int(-3, 3), 0, scene.motif.range);
      let best = root;
      for (const tn of [root - 7, root - 5, root - 3, root, root + 2, root + 4, root + 7, root + 9]) if (Math.abs(tn - deg) < Math.abs(best - deg)) best = tn;
      const m = this.midi(best, scene.lead.octave);
      const lg = L.lead * scene.lead.gain * g * (P.cell[s] === 'x' ? 1 : 0.7);
      this.sink.note(scene.lead, m, t, lg);
      if (scene.lead.echo) this.sink.note(scene.lead, m, t + this.stepSeconds * 3, lg * scene.lead.echo);
    }
  }

  updatePad(root, t) {
    const pad = this.s.pad;
    const degrees = pad.drone ? [0, 4, 7, 11] : [root, root + 2, root + 4, root + 6];
    const key = degrees.join();
    if (key === this.padChord) return;
    this.padChord = key;
    this.sink.padChord(degrees.map((d) => this.midi(d, pad.octave)), t);
  }
}
