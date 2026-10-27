// Session state: everything about "this play session" that is NOT part of
// the deterministic simulation (phase, selection, transient UI state).
// Owned by session/SessionController; read by render, input and ui.
//
// Phases mirror the round's (sim/round.js) plus what only the screen has:
//   title              the main menu (play against the AI / guided tutorial)
//   buy, prep          the round's first decision phases (time stopped)
//   drone              the attackers drive their recon drone (real time, like a turn)
//   planning           a turn's planning: orders apply instantly (routes update live)
//   running            a turn's execution: the fixed-step simulation advances, no orders
//   paused             a running turn (or the drone) stopped by the system (help, page hidden, lost graphics)
//   ended              outcome shown; the sim runs SIM.postRoundSeconds more
// The deadlines of the decision phases are session/PhaseClock.js (session.clock).

import { PLAYER_TEAM } from '../config/squad.js';
import { lastUserIndex } from '../sim/queries.js';

export const PHASES = Object.freeze(['title', 'buy', 'prep', 'drone', 'planning', 'running', 'paused', 'ended']);

/** Session phase for each round phase of the sim. */
export const SESSION_PHASE = Object.freeze({ buy: 'buy', prep: 'prep', drone: 'drone', plan: 'planning', exec: 'running', end: 'ended' });

/** Phases where the fixed-step simulation runs live (a turn, the drone). */
export const isLivePhase = (phase) => phase === 'running' || phase === 'drone';

/** Phases where the player decides and a clock counts down. */
export const isDecisionPhase = (session) => session.phase === 'buy' || session.phase === 'prep' || session.phase === 'planning';

export function createSession({ touch }) {
  return {
    phase: 'title',
    mode: 'play', // 'play' (against the AI) | 'tutorial' (the guided round: config/ui.js TUTORIAL)
    team: PLAYER_TEAM, // the side this player commands (orders are stamped with it); the menu picks it, the AI plays the other
    selectedId: -1, // unit id of the player's side, -1 = none
    // The waypoint the player tapped ({unitId, index}: a "?" door, a tag, a waypoint): the door
    // picker shows for it; E / H / ESPERAR act on it. null = the selected operator's last waypoint.
    pointTarget: null,
    // Why a running turn stopped: 'help' | 'background' | 'graphics' | 'orientation' | null
    pauseReason: null,
    resumePhase: 'running', // what a pause goes back to: 'running' | 'drone'
    confirm: { action: null, until: 0 }, // destructive request armed until `until` (performance.now ms)
    replay: { pending: 0, attempt: 0, exec: false }, // recorded phases still to replay; retries of this plan; this turn is a replayed one
    clock: { left: 0, total: 0, unlimited: false, auto: false }, // session/PhaseClock.js (decision phases)
    tutorial: { active: false, step: 0, id: null, info: false, card: false, count: 0, done: false }, // session/Tutorial.js
    // Per-device progress (session/storage.js): finished rounds unlock the phases before the assault.
    progress: { roundsDone: 0, fullRound: false, stopOnContact: true },
    match: null, // a best-of-7 against the AI (session/Match.js), mode 'match'
    locked: [], // round phases skipped in this attempt ('buy' | 'prep' | 'drone'), set by SessionController
    hoverUnitId: -1,
    helpOpen: false,
    musicOn: true, // mirrors the audio (set by SessionController); the UI shows it
    touch, // coarse pointer (phone / tablet) — switches HUD and gestures
    ui: {
      hoverPath: null, // flat [x, y, ...] preview of the leg a click would add
      drawing: false, // a freehand route is being drawn
      lookPreview: null, // {x, y, angle, valid} while aiming a facing
      movePreview: null, // {unitId, index, insert, x, y} while dragging a waypoint (or a new one out of a leg)
      cursorWorld: null, // pointer position on the floor
      holdMenu: false, // the touch ESPERAR chooser (GO colors) is open
      tossPick: null, // {unitId, index, item}: the next tap on the map is where that point throws it
      wheelAt: null, // {unitId, x, y}: a tap on a door stacked him there; the door wheel opens once the point is added
      trapMode: false, // defender set-up: taps lay (or pick up) the selected Trampero's traps
    },
  };
}

/** Clears the transient planning previews (new round). */
export function resetSessionPreviews(session) {
  Object.assign(session.ui, { hoverPath: null, drawing: false, lookPreview: null, movePreview: null, holdMenu: false, tossPick: null, wheelAt: null, trapMode: false });
}

/** Phases where routes can be edited (orders are taken only while deciding: sim/orders.js). */
export const canEditRoutes = (session) => (session.phase === 'prep' || session.phase === 'planning') && !session.helpOpen;

/** Is this destructive request armed (waiting for its confirming repeat)? */
export const isArmed = (session, action) => session.confirm.action === action && performance.now() < session.confirm.until;

/**
 * The waypoint the door picker and E / H act on for operator u: the point
 * the player tapped (a "?" door or a waypoint tag), else his last one.
 * Undecided doors are opened on the way (ENTRY.undecided), so nothing is
 * forced on the player: the picker comes when he asks for it.
 */
export function targetIndex(session, u) {
  const t = session.pointTarget;
  if (t && t.unitId === u.id && t.index < u.route.length && u.route[t.index].user) return t.index;
  return lastUserIndex(u);
}

/** Does this player drive the recon drone (the attackers' side)? A defender only watches it come. */
export const pilotsDrone = (session) => session.team === 'attackers';

/** The defender's set-up: preparation phase, playing the defenders (place, watch orders, site, barricades). */
export const isDefenderSetup = (session) => session.phase === 'prep' && session.team === 'defenders';

/** Phases where time is stopped and the player is planning. */
export const isPlanningTime = (session) => session.phase === 'prep' || session.phase === 'planning';
