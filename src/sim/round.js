// Round phases, inside the simulation (they decide which orders are valid,
// so they are part of the authoritative state, not of the screen):
//
//   buy -> prep -> plan <-> exec -> end
//
//   buy   choose equipment (shell for now: the role's gear)
//   prep  attackers pick their entry; defenders set up (shell: map data)
//   plan  both sides edit their orders blind; time does not run
//   exec  every order runs at once for ROUND.turnSeconds (turnTicks steps);
//         nobody can pause or give orders. Then back to plan, next turn.
//   end   the outcome is known (the world still settles: bodies, smoke)
//
// Decision phases (buy, prep, plan) never consume ticks or randomness: how
// long a side takes to decide cannot change the result. Who ends them (a
// "ready" button, a deadline) is outside: session/PhaseClock.js now, the
// server later. They only call advancePhase().
//
// GO codes are scheduled while planning ({type:'go', code, at}, sim/orders.js):
// during the execution the code is released at the first tick at or after
// `at` seconds into the turn when everyone holding for it is in position
// (queries.js isGoReady). A GO that could not fire stays armed for the next
// turn. That keeps coordinated entries without live input during a turn.
//
// A Simulation built with {phases: false} has none of this: it always runs
// and takes orders at any time (unit tests of single mechanics).
import { ROUND, SIM } from '../config/balance.js';
import { EV } from '../core/events.js';
import { isGoReady, codeInUse } from './queries.js';
import { issueGo } from './orders.js';
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
    turn: 0, // 1..ROUND.maxTurns once the assault starts
    execTick: 0, // steps run in the current execution turn
    gos: [], // scheduled GO codes: {team, code, at (s into the turn)}
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

/** Before the tick's systems: fire the scheduled GO codes that are due and ready. */
export function fireScheduledGos(sim) {
  const r = sim.round;
  if (r.phase !== PHASE.exec || !r.gos.length) return;
  const t = r.execTick / SIM.tickRate;
  for (let i = 0; i < r.gos.length; i++) {
    const g = r.gos[i];
    if (t + 1e-9 < g.at || !isGoReady(sim, g.team, g.code)) continue;
    r.gos.splice(i--, 1);
    issueGo(sim, { type: 'go', team: g.team, code: g.code });
  }
}

/** After the tick's systems: count the turn; at its end, back to planning (or time is up). */
export function afterTick(sim, endRound) {
  const r = sim.round;
  if (!r.enabled || r.phase !== PHASE.exec) return;
  if (sim.outcome) return toEnd(sim);
  r.execTick++;
  sim.timeLeft = Math.max(0, (ROUND.maxTurns - r.turn) * ROUND.turnSeconds + (TURN_TICKS - r.execTick) / SIM.tickRate);
  if (r.execTick < TURN_TICKS) return;
  summarizeNoise(sim);
  // A scheduled GO nobody holds for any more is dropped; the rest wait for the next turn.
  r.gos = r.gos.filter((g) => codeInUse(sim, g.team, g.code));
  if (r.turn >= ROUND.maxTurns) {
    sim.timeLeft = 0;
    endRound(sim, 'defenders', 'time');
    return toEnd(sim);
  }
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

/** Schedules (at = seconds into the turn) or cancels (at = null) a side's GO code. */
export function scheduleGo(sim, team, code, at) {
  const r = sim.round;
  r.gos = r.gos.filter((g) => !(g.team === team && g.code === code));
  if (at === null || at === undefined) return;
  const step = ROUND.goStepSeconds;
  const max = ROUND.turnSeconds - step;
  const t = Math.min(max, Math.max(0, Math.round(at / step) * step));
  r.gos.push({ team, code, at: t });
}

/** The scheduled GO of a side for a code, or null. */
export function scheduledGo(sim, team, code) {
  for (const g of sim.round.gos) if (g.team === team && g.code === code) return g;
  return null;
}
