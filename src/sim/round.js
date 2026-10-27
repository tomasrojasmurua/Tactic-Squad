// Round phases, inside the simulation (they decide which orders are valid,
// so they are part of the authoritative state, not of the screen):
//
//   buy -> prep -> drone -> plan <-> exec -> end
//
//   buy   each attacker buys his utility (sim/prep.js)
//   prep  both sides set up blind: the attackers pick their entry and may
//         sketch routes; the defenders pick the site, place their operators,
//         give them watch orders and put up barricades (sim/prep.js; an AI
//         side does it on entering the phase)
//   drone the attackers drive their recon drone in real time (sim/drone.js,
//         DRONE.seconds); only the drone and the defenders' eyes run, the
//         bomb's timer does not. It ends when the time is up, the drone is
//         shot down or recalled. The attacking AI drives it too (sim/aiAttack.js).
//   plan  both sides edit their orders blind; time does not run (in the
//         first one the attackers may still change their entry)
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
// applies it at that same step and the turn plays out the same. The drone's
// stick and its recall are stamped the same way (steps of the drone phase).
//
// A Simulation built with {phases: false} has none of this: it always runs
// and takes orders at any time (unit tests of single mechanics).
import { ROUND, SIM } from '../config/balance.js';
import { EV } from '../core/events.js';
import { summarizeNoise } from './noise.js';
import { launchDrone, droneOver, endDrone } from './drone.js';
import { aiPrepare } from './prep.js';

export const PHASE = Object.freeze({ buy: 'buy', prep: 'prep', drone: 'drone', plan: 'plan', exec: 'exec', end: 'end' });

/** Phases where the sides decide (time stopped). */
export const DECISION_PHASES = Object.freeze([PHASE.buy, PHASE.prep, PHASE.plan]);

/** Steps per execution turn. */
export const TURN_TICKS = Math.round(ROUND.turnSeconds * SIM.tickRate);

/** Steps a turn runs at least before a contact can end it (Simulation stopOnContact). */
const MIN_CONTACT_TICKS = Math.round(ROUND.minContactSeconds * SIM.tickRate);

export function createRound(phases) {
  return {
    enabled: phases,
    phase: phases ? PHASE.buy : PHASE.exec,
    turn: 0, // 1, 2 ... once the assault starts (as many as the bomb's timer lasts)
    execTick: 0, // steps run in the current execution turn
    execTotal: 0, // steps run in every turn so far (the bomb's timer)
    droneTick: 0, // steps run in the drone phase
    contact: false, // stopOnContact: the attackers saw a new enemy this turn (the turn ends early)
    cut: false, // the last turn ended early on contact
  };
}

/** Step of the current live phase that stamped orders (atTick) count in: the turn's or the drone's. */
export function phaseTick(sim) {
  const r = sim.round;
  return r.phase === PHASE.drone ? r.droneTick : r.execTick;
}

/** Is the round in a live phase (time runs: a turn's execution or the drone)? */
export const isLive = (sim) => sim.round.phase === PHASE.exec || sim.round.phase === PHASE.drone;

/**
 * Ends the current decision phase: buy -> prep -> drone (or plan, turn 1);
 * plan -> exec. During the drone phase it recalls the drone (-> plan).
 */
export function advancePhase(sim) {
  const r = sim.round;
  if (!r.enabled) return;
  const from = r.phase;
  if (from === PHASE.buy) {
    r.phase = PHASE.prep;
    aiPrepare(sim);
  } else if (from === PHASE.prep) {
    r.droneTick = 0;
    if (launchDrone(sim)) r.phase = PHASE.drone;
    else return toFirstPlan(sim, from);
  } else if (from === PHASE.drone) {
    endDrone(sim, 'recalled');
    return toFirstPlan(sim, from);
  } else if (from === PHASE.plan) {
    r.phase = PHASE.exec;
    r.execTick = 0;
    r.contact = false;
    r.cut = false;
  } else return;
  sim.emit(EV.ROUND_PHASE, { phase: r.phase, previous: from, turn: r.turn });
}

function toFirstPlan(sim, from) {
  const r = sim.round;
  r.phase = PHASE.plan;
  r.turn = 1;
  sim.emit(EV.ROUND_PHASE, { phase: r.phase, previous: from, turn: r.turn });
}

/** May the sim step now? (decision phases are frozen) */
export const canStep = (sim) => isLive(sim) || sim.round.phase === PHASE.end;

/** After the tick's systems: the bomb's timer and the turn; at its end, back to planning (or the bomb goes off). */
export function afterTick(sim, endRound) {
  const r = sim.round;
  if (r.enabled && r.phase === PHASE.drone) {
    r.droneTick++;
    if (droneOver(sim)) toFirstPlan(sim, PHASE.drone);
    return;
  }
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
  const cut = r.contact && r.execTick >= MIN_CONTACT_TICKS;
  if (r.execTick < TURN_TICKS && !cut) return;
  r.cut = cut && r.execTick < TURN_TICKS;
  r.contact = false;
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
