// Music scenes as composition data ("art as code", like audio/recipes/*): each one has its own key,
// tempo, harmony, timbres and rhythm vocabulary, so consecutive rounds do not sound alike. One scene
// plays per round (audio/music/Conductor.js rotates them without repeating the last one).
//
// Patterns are 16 steps per bar: 'x' = accent, 'o' = soft hit, '.' = rest. Bass patterns use
// 'x'/'o' = chord root, '5' = fifth, '8' = octave. Each pool holds variants; a phrase (4 bars) picks
// one per instrument and mutates it a little (ScenePlayer). Tiers by intensity: low < mid < high.
// Timbres are live oscillators (audio/music/Synth.js): `harmonics` = PeriodicWave amplitudes,
// envelopes in s. Drums are baked one-shots ('mus.*', audio/recipes/index.js), played at rate 1.
// Owner: audio.

export const SCENES = Object.freeze({
  // Night watch: slow, glassy, lots of air. C# dorian, 70 BPM. Bells, a sine pad, brushes.
  vigil: {
    label: 'Vigilia',
    bpm: 70,
    root: 37, // C#2 (MIDI)
    scale: [0, 2, 3, 5, 7, 9, 10],
    progressions: [[0, 5, 3, 4], [0, 3, 5, 6], [0, 6, 3, 4], [5, 3, 0, 4], [0, 4, 5, 3]],
    barsPerChord: [2, 4],
    pad: { harmonics: [1, 0.12, 0.05], detune: 4, voices: 3, octave: 1, lowpass: [260, 900], gain: 0.9 },
    bass: { harmonics: [1, 0.25], attack: 0.04, decay: 1.4, lowpass: 600, octave: 0, gain: 0.9 },
    lead: { kind: 'fm', ratio: 3.5, index: 2.4, attack: 0.004, decay: 1.6, octave: 2, gain: 0.5, echo: 0.35 },
    motif: { density: [0.06, 0.12, 0.2], range: 6, rhythms: ['x.....x.........', 'x.......x...x...', '....x.......x...', 'x.........x.....'] },
    drums: { kick: 'mus.frame', tick: 'mus.shaker', rim: 'mus.rim', fill: 'mus.tom' },
    rhythm: {
      low: { tick: ['x.......x.......', 'x...........o...', '....x.......x...', 'x.....o.........'], bass: ['x...............', 'x.......5.......', 'x...........8...'] },
      mid: {
        tick: ['x...o...x...o...', 'x..o..o.x...o..o', 'x...o.o.x...o...'],
        kick: ['x.........x.....', 'x...............', 'x.......o.......'],
        bass: ['x.......5.......', 'x.....o...5.....', 'x...........8...'],
      },
      high: {
        tick: ['x.o.x.o.x.o.x.oo', 'x.oox.o.x.oox.o.', 'xoo.xo.oxoo.xo.o'],
        kick: ['x.....x...x.....', 'x.......x.x.....', 'x..x......x.....'],
        rim: ['....x.......x...', '....x.......x..o'],
        bass: ['x.....x.5.....o.', 'x..o..x.5.....8.', 'x.....o.x...5...'],
      },
    },
  },

  // Clockwork pulse: synthetic, driving. F minor, 100 BPM. Square bass, saw pad, plucked arps, ticks.
  pulse: {
    label: 'Pulso',
    bpm: 100,
    root: 29, // F1
    scale: [0, 2, 3, 5, 7, 8, 10],
    progressions: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [0, 5, 3, 4], [0, 2, 5, 6], [3, 4, 0, 0]],
    barsPerChord: [1, 2],
    pad: { harmonics: [1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.14], detune: 8, voices: 4, octave: 2, lowpass: [380, 1700], gain: 0.7 },
    bass: { harmonics: [1, 0, 0.33, 0, 0.2, 0, 0.14, 0, 0.11], attack: 0.004, decay: 0.32, lowpass: 900, filterEnv: 3, octave: 1, gain: 0.9 },
    lead: { kind: 'wave', harmonics: [1, 0.5, 0.33, 0.25, 0.2], attack: 0.002, decay: 0.28, lowpass: 2600, filterEnv: 2.5, octave: 3, gain: 0.45, echo: 0.3 },
    motif: { density: [0.12, 0.28, 0.42], range: 9, rhythms: ['x.x...x.x...x...', 'x..x..x...x..x..', 'x.xx..x.x.x.....', '..x.x...x.x.x...'] },
    drums: { kick: 'mus.kick', tick: 'mus.tick', rim: 'mus.rim', fill: 'mus.tom' },
    rhythm: {
      low: { tick: ['x...x...x...x...', 'x...x...x...x.o.', 'x.o.....x.o.....', 'x.......x...x...'], bass: ['x...............', 'x.......o.......', 'x.....o.........', 'x.......5.......'] },
      mid: {
        tick: ['x.o.x.o.x.o.x.o.', 'x.o.x.oox.o.x.o.', 'xoo.x.o.xoo.x.o.'],
        kick: ['x.........x.....', 'x.....x...x.....', 'x.........x...o.'],
        bass: ['x.o.x.o.x.o.x.o.', 'x...x.o.x...x.o.', 'x.o.5.o.x.o.8.o.'],
      },
      high: {
        tick: ['xoxoxoxoxoxoxoxo', 'xooxxooxxooxxoox', 'x.xxx.xxx.xxx.xx'],
        kick: ['x...x...x...x...', 'x...x...x...x.o.', 'x..ox...x..ox...'],
        rim: ['....x.......x...', '....x.......x.o.', '....x..o....x...'],
        bass: ['xx.ox.oxx.ox.oxo', 'x.oxx.ox5.ox8.ox', 'xxoxxxoxxxoxxxox'],
      },
    },
  },

  // Desert siege: modal, hand drums. A phrygian dominant, 116 BPM. Reed lead over a drone, doum/tek.
  siege: {
    label: 'Asedio',
    bpm: 116,
    root: 33, // A1
    scale: [0, 1, 4, 5, 7, 8, 10],
    progressions: [[0, 0, 6, 0], [0, 1, 0, 6], [0, 6, 5, 1], [0, 0, 1, 0], [5, 6, 1, 0]],
    barsPerChord: [2, 4],
    pad: { drone: true, harmonics: [1, 0.6, 0.45, 0.3, 0.22, 0.15], detune: 6, voices: 2, octave: 1, lowpass: [320, 1400], gain: 0.75 },
    bass: { harmonics: [1, 0.5, 0.2], attack: 0.006, decay: 0.5, lowpass: 700, filterEnv: 1.5, octave: 1, gain: 0.85 },
    lead: { kind: 'wave', harmonics: [1, 0.15, 0.6, 0.1, 0.4, 0.05, 0.25, 0.04, 0.12], attack: 0.03, decay: 0.55, lowpass: 3200, octave: 3, gain: 0.4, echo: 0.25 },
    motif: { density: [0.08, 0.2, 0.32], range: 7, rhythms: ['x..x..x.x.......', 'x.x.x...x..x....', 'x...x.x.x.x.x...', 'x..x..x...x.x...'] },
    drums: { kick: 'mus.doum', tick: 'mus.tek', rim: 'mus.tek', fill: 'mus.frame' },
    rhythm: {
      low: { tick: ['x.......x.......', 'x.....x.........', 'x..x....x.......', '..x...x.........'], bass: ['x...............', 'x.......5.......', 'x.....x.........'] },
      mid: {
        kick: ['x.....x...x.....', 'x..x..x.........', 'x.....x.....x...'],
        tick: ['..x...x.x...x...', '..x.o.x.x.o.x.o.', 'o.x...x.o.x.x...'],
        bass: ['x.....x...x.....', 'x..o..x...5.....', 'x.....o...x...5.'],
      },
      high: {
        kick: ['x..x..x...x.x...', 'x.ox..x.x.x.....', 'x..x..x.x.x..x..'],
        tick: ['.ox.oox.xox.oox.', 'oox.ox.ooxx.ox.o', '.oxo.oxoxoxo.ox.'],
        rim: ['............x.x.', '..........x...x.'],
        bass: ['x..x..x.x.x.....', 'x..o..x.5.x..8..', 'x.ox..x.x.x.5...'],
      },
    },
  },
});

export const SCENE_IDS = Object.freeze(Object.keys(SCENES));
