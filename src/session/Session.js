// Session state: everything about "this play session" that is NOT part of
// the deterministic simulation (phase, selection, transient UI state).
// Owned by session/SessionController; read by render, input and ui.
//
// Phases mirror the round's (sim/round.js) plus what only the screen has:
//   title              before the first round
//   buy, prep          the round's first decision phases (time stopped)
//   planning           a turn's planning: orders apply instantly (routes update live)
//   running            a turn's execution: the fixed-step simulation advances, no orders
//   paused             a running turn stopped by the system (help, page hidden, lost graphics)
//   ended              outcome shown; the sim runs SIM.postRoundSeconds more
// The deadlines of the decision phases are session/PhaseClock.js (session.clock).

import { PLAYER_TEAM } from '../config/squad.js';
import { lastUserIndex } from '../sim/queries.js';

export const PHASES = Object.freeze(['title', 'buy', 'prep', 'planning', 'running', 'paused', 'ended']);

/** Session phase for each round phase of the sim. */
export const SESSION_PHASE = Object.freeze({ buy: 'buy', prep: 'prep', plan: 'planning', exec: 'running', end: 'ended' });

/** Phases where the player decides and a clock counts down. */
export const isDecisionPhase = (session) => session.phase === 'buy' || session.phase === 'prep' || session.phase === 'planning';

export function createSession({ touch }) {
  return {
    phase: 'title',
    team: PLAYER_TEAM, // the side this player commands (orders are stamped with it)
    selectedId: -1, // unit id of the player's side, -1 = none
    // The waypoint the entry picker edits when it is not the last one: a "?" door point the
    // player tapped ({unitId, index}), null = the selected operator's last waypoint.
    pointTarget: null,
    // Why a running turn stopped: 'help' | 'background' | 'graphics' | 'orientation' | null
    pauseReason: null,
    confirm: { action: null, until: 0 }, // destructive request armed until `until` (performance.now ms)
    replay: { pending: 0, attempt: 0, exec: false }, // recorded phases still to replay; retries of this plan; this turn is a replayed one
    clock: { left: 0, total: 0, unlimited: false, auto: false }, // session/PhaseClock.js (decision phases)
    tutorial: { active: false, step: 0, id: null, count: 0, done: false }, // session/Tutorial.js
    hoverUnitId: -1,
    helpOpen: false,
    musicOn: true, // mirrors the audio (set by SessionController); the UI shows it
    touch, // coarse pointer (phone / tablet) — switches HUD and gestures
    ui: {
      hoverPath: null, // flat [x, y, ...] preview of the leg a click would add
      drawing: false, // a freehand route is being drawn
      lookPreview: null, // {x, y, angle, valid} while aiming a facing
      cursorWorld: null, // pointer position on the floor
    },
  };
}

/** Clears the transient planning previews (new round). */
export function resetSessionPreviews(session) {
  Object.assign(session.ui, { hoverPath: null, drawing: false, lookPreview: null });
}

/** Phases where routes can be edited (orders are taken only while deciding: sim/orders.js). */
export const canEditRoutes = (session) => (session.phase === 'prep' || session.phase === 'planning') && !session.helpOpen;

/** Is this destructive request armed (waiting for its confirming repeat)? */
export const isArmed = (session, action) => session.confirm.action === action && performance.now() < session.confirm.until;

/** The waypoint the door picker and E / H act on for operator u: the tapped "?" point, else his last one. */
export function targetIndex(session, u) {
  const t = session.pointTarget;
  if (t && t.unitId === u.id && t.index < u.route.length && u.route[t.index].user) return t.index;
  return lastUserIndex(u);
}

/** Phases where time is stopped and the player is planning. */
export const isPlanningTime = (session) => session.phase === 'prep' || session.phase === 'planning';
