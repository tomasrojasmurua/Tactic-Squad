// Session state: everything about "this play session" that is NOT part of
// the deterministic simulation (phase, selection, transient UI state).
// Owned by session/SessionController; read by render, input and ui.
//
// Phases: title -> planning -> running <-> paused -> ended (restart -> planning).
//   planning / paused : orders apply instantly (routes update live)
//   running           : the fixed-step simulation advances
//   ended             : outcome shown; the sim runs SIM.postRoundSeconds more

import { PLAYER_TEAM } from '../config/squad.js';

export const PHASES = Object.freeze(['title', 'planning', 'running', 'paused', 'ended']);

export function createSession({ touch }) {
  return {
    phase: 'title',
    team: PLAYER_TEAM, // the side this player commands (orders are stamped with it)
    selectedId: -1, // unit id of the player's side, -1 = none
    // Why time stopped: 'manual' | 'help' | 'contact' | 'idle' | 'background' | 'graphics' | 'orientation' | null
    pauseReason: null,
    confirm: { action: null, until: 0 }, // destructive request armed until `until` (performance.now ms)
    replay: { pending: 0, attempt: 0 }, // recorded orders still to re-issue; retries of this plan
    autoPause: { contact: true, idle: true }, // session/AutoPause.js (saved per device)
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

/** Phases where routes can be edited. */
export const canEditRoutes = (session) =>
  (session.phase === 'planning' || session.phase === 'paused' || session.phase === 'running') && !session.helpOpen;

/** Is this destructive request armed (waiting for its confirming repeat)? */
export const isArmed = (session, action) => session.confirm.action === action && performance.now() < session.confirm.until;

/** Phases where time is stopped and the player is planning. */
export const isPlanningTime = (session) => session.phase === 'planning' || session.phase === 'paused';
