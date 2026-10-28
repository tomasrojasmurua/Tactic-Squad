// The last kill of the round, shown again before its result. Nothing is
// recorded while playing beyond what a retry already keeps: the round is
// played once more, off screen, from its start — the same seed and options,
// the player's orders phase by phase (session/PlanRecorder.js: decision
// phases end when they ended, the GOs and the drone's stick wait for their
// step) — up to KILLCAM.before s before the kill. The AI decides the same
// (deterministic sim), so it is the same round. Game then runs that copy on
// screen (render, sound, effects) until KILLCAM.after s past the kill.
import { Simulation } from '../sim/Simulation.js';
import { SIM } from '../config/balance.js';
import { KILLCAM } from '../config/ui.js';

const DECIDE = ['buy', 'prep', 'plan'];
const GUARD = 200000; // steps / phases at most (a recording that never gets there)

/** The copy of a round and where it is in the recording. */
function createRun(mapDef, args, segments) {
  const run = { sim: new Simulation(mapDef, args), segments, seg: 0 };
  feed(run);
  return run;
}

function feed(run) {
  for (const cmd of run.segments[run.seg] || []) run.sim.enqueue(cmd);
}

/**
 * Moves the copy on: a decision phase ends at once (its orders are in), a
 * live one runs one step. Entering the next phase queues its orders. Returns
 * whether it was a step (time ran).
 */
function advance(run, onStep) {
  const sim = run.sim;
  const phase = sim.phase;
  const step = !DECIDE.includes(phase);
  if (step) sim.step();
  else sim.advancePhase();
  if (step && onStep) onStep(sim);
  sim.drainEvents();
  if (sim.phase !== phase && sim.phase !== 'end') {
    run.seg++;
    feed(run);
  }
  return step;
}

/**
 * A copy of the round (built with `args` = {seed, ...options}) played with
 * `segments` up to step `tick` (or its end). Its events are dropped.
 */
export function replayTo(mapDef, args, segments, tick) {
  return runTo(createRun(mapDef, args, segments), tick).sim;
}

function runTo(run, tick) {
  for (let n = 0; n < GUARD && run.sim.phase !== 'end' && run.sim.tick < tick; n++) advance(run);
  return run;
}

/**
 * The kill cam of a round: its copy at the start of the clip, and when it
 * ends / runs slow. `kill` = {tick, killerId, unitId} (the last EV.DEATH).
 */
export function createKillCam(mapDef, args, segments, kill) {
  const rate = SIM.tickRate;
  const from = Math.max(0, kill.tick - Math.round(KILLCAM.before * rate));
  const run = runTo(createRun(mapDef, args, segments), from);
  const slow = Math.round((KILLCAM.slowWindow * rate) / 2);
  return {
    run,
    sim: run.sim,
    kill,
    end: kill.tick + Math.round(KILLCAM.after * rate),
    slowFrom: kill.tick - slow,
    slowTo: kill.tick + slow,
    acc: 0, // fraction of a step owed (slow motion)
  };
}

/**
 * One fixed step of the screen: 0, 1 or a fraction of a step of the copy
 * (`onStep(sim)` after each, with its events still queued). Returns false
 * when the clip is over.
 */
export function stepKillCam(kc, onStep) {
  const sim = kc.sim;
  kc.acc += sim.tick >= kc.slowFrom && sim.tick < kc.slowTo ? KILLCAM.slow : 1;
  while (kc.acc >= 1) {
    kc.acc -= 1;
    // A decision phase in between (the clip spans the end of a turn) goes by at once.
    for (let n = 0; n < 8 && DECIDE.includes(sim.phase); n++) advance(kc.run);
    if (sim.tick >= kc.end || DECIDE.includes(sim.phase)) return false;
    advance(kc.run, onStep);
  }
  return true;
}
