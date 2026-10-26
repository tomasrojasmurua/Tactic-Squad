// Round phases, inside the simulation (they decide which orders are valid,
// so they are part of the authoritative state, not of the screen):
//
//   buy -> prep -> plan <-> exec -> end
//
//   buy   choose equipment (shell for now: the role's gear)
//   prep  attackers pick their entry; defenders set up (shell: map data)
//   plan  both sides edit their orders blind; time does not run
//   exec  every order runs at once for ROUND.turnSeconds (turnTicks steps);
//         nobody can pause it. The only order taken is a GO code (A, B, C):
//         the player calls "now!" and that group acts together. Then back
//         to plan, next turn.
//   end   the outcome is known (the world still settles: bodies, smoke)
//
// Decision phases (buy, prep, plan) never consume ticks or randomness: how
// long a side takes to decide cannot change the result. Who ends them (a
// "ready" button, a deadline) is outside: session/PhaseClock.js now, the
// server later. They only call advancePhase().
//
// A GO is live input, so it is stamped with the step it was given at
// ({type:'go', code, atTick}: Simulation.enqueue). A replay or the server
// applies it at that same step and the turn plays out the same.
//
// A Simulation built with {phases: false} has none of this: it always runs
// and takes orders at any time (unit tests of single mechanics).
import { ROUND, SIM } from '../config/balance.js';
import { EV } from '../core/events.js';
import { summarizeNoise } from './noise.js';

export const PHASE = Object.freeze({ buy: 'buy', prep: 'prep', plan: 'plan', exec: 'exec', end: 'end' });

/** Phases where the sides decide (time stopped). */
export const DECISION_PHASES = Object.freeze([PHASE.buy, PHASE.prep, PHASE.plan]);

/** Steps per execution turn. */
export const TURN_TICKS = Math.round(ROUND.turnSeconds * SIM.tickRate);

export function createRound(phases) {
  return {
    enabled: phases,
    phase: phases ? PHASE.buy : PHASE.exec,
    turn: 0, // 1, 2 ... once the assault starts (as many as the bomb's timer lasts)
    execTick: 0, // steps run in the current execution turn
    execTotal: 0, // steps run in every turn so far (the bomb's timer)
  };
}

/** Ends the current decision phase: buy -> prep -> plan (turn 1); plan -> exec. */
export function advancePhase(sim) {
  const r = sim.round;
  if (!r.enabled) return;
  const from = r.phase;
  if (from === PHASE.buy) r.phase = PHASE.prep;
  else if (from === PHASE.prep) {
    r.phase = PHASE.plan;
    r.turn = 1;
  } else if (from === PHASE.plan) {
    r.phase = PHASE.exec;
    r.execTick = 0;
  } else return;
  sim.emit(EV.ROUND_PHASE, { phase: r.phase, previous: from, turn: r.turn });
}

/** May the sim step now? (decision phases are frozen) */
export const canStep = (sim) => sim.round.phase === PHASE.exec || sim.round.phase === PHASE.end;

/** After the tick's systems: the bomb's timer and the turn; at its end, back to planning (or the bomb goes off). */
export function afterTick(sim, endRound) {
  const r = sim.round;
  if (!r.enabled || r.phase !== PHASE.exec) return;
  if (sim.outcome) return toEnd(sim);
  r.execTick++;
  r.execTotal++;
  sim.timeLeft = Math.max(0, ROUND.timeLimit - r.execTotal / SIM.tickRate);
  if (sim.timeLeft <= 0) {
    sim.emit(EV.BOMB_EXPLODED, { x: sim.bomb.x, y: sim.bomb.y });
    endRound(sim, 'defenders', 'time');
    return toEnd(sim);
  }
  if (r.execTick < TURN_TICKS) return;
  summarizeNoise(sim);
  r.turn++;
  r.phase = PHASE.plan;
  sim.emit(EV.ROUND_PHASE, { phase: r.phase, previous: PHASE.exec, turn: r.turn });
}

function toEnd(sim) {
  const r = sim.round;
  summarizeNoise(sim); // what was heard of the last moments (a no-op right after a turn's own summary)
  r.phase = PHASE.end;
  sim.emit(EV.ROUND_PHASE, { phase: PHASE.end, previous: PHASE.exec, turn: r.turn });
}
