// Session state: everything about "this play session" that is NOT part of
// the deterministic simulation (phase, selection, transient UI state).
// Owned by session/SessionController; read by render, input and ui.
//
// Phases mirror the round's (sim/round.js) plus what only the screen has:
//   title              the menu: main, JUGAR, the lobby (session.lobby: session/Lobby.js)
//   buy, prep          the round's first decision phases (time stopped); a
//                      defender's prep has two steps: the recon (inRecon), then his operators
//   drone              the attackers drive their recon drone (real time, like a turn)
//   planning           a turn's planning: orders apply instantly (routes update live)
//   running            a turn's execution: the fixed-step simulation advances, no orders
//   paused             a running turn (or the drone) stopped by the system (help, page hidden, lost graphics)
//   ended              outcome shown; the sim runs SIM.postRoundSeconds more
// The deadlines of the decision phases are session/PhaseClock.js (session.clock).

import { PLAYER_TEAM } from '../config/squad.js';
import { lastUserIndex, controllableUnit } from '../sim/queries.js';

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
    mode: 'play', // 'play' (a single round against the AI) | 'match' (a series) | 'tutorial' (the guided round: config/ui.js TUTORIAL)
    team: PLAYER_TEAM, // the side this player commands (orders are stamped with it); the menu picks it, the AI plays the other
    selectedId: -1, // unit id of the player's side, -1 = none
    // The waypoint the player tapped ({unitId, index}: a "?" door, a tag, a waypoint): the door
    // picker shows for it; E / H / ESPERAR act on it. null = the selected operator's last waypoint.
    pointTarget: null,
    // Why a running turn stopped: 'help' | 'background' | 'graphics' | 'orientation' | null
    pauseReason: null,
    resumePhase: 'running', // what a pause goes back to: 'running' | 'drone'
    confirm: { action: null, until: 0 }, // destructive request armed until `until` (performance.now ms)
    lastKill: null, // the round's last EV.DEATH {tick, unitId, killerId} (the kill cam shows it again)
    killcam: null, // after the round, until its last kill was shown: {tick, unitId, killerId, playing}
    replay: { pending: 0, attempt: 0, exec: false }, // recorded phases still to replay; retries of this plan; this turn is a replayed one
    clock: { left: 0, total: 0, unlimited: false, auto: false }, // session/PhaseClock.js (decision phases)
    tutorial: { active: false, step: 0, id: null, info: false, card: false, count: 0, done: false }, // session/Tutorial.js
    // Per-device options (session/storage.js).
    progress: { stopOnContact: true },
    lobby: null, // the menu and the game's settings (session/Lobby.js), set by SessionController
    match: null, // a best of 3/5/7 against the AI (session/Match.js), mode 'match'
    locked: [], // round phases skipped in this attempt (the tutorial's 'buy' | 'prep' | 'drone'), set by SessionController
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
      camera: -1, // defending: the last of your cameras the view jumped to (CÁMARAS / O)
      trapMode: false, // defender set-up: taps lay (or pick up) the selected Trampero's traps
    },
  };
}

/** Clears the transient planning previews (new round). */
export function resetSessionPreviews(session) {
  Object.assign(session.ui, { hoverPath: null, drawing: false, lookPreview: null, movePreview: null, holdMenu: false, tossPick: null, wheelAt: null, camera: -1, trapMode: false });
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

/** Planning the assault as the defenders with one of them selected: his watch order can change (ui/PhasePanel.js 'watch'). */
export const watchInPlanning = (sim, session) =>
  session.phase === 'planning' && session.team === 'defenders' && sim.controllers.defenders === 'human' && !!controllableUnit(sim, session.selectedId, session.team);

/** The defender's recon, the first step of his set-up: site, barricades, cameras (fixed once it ends: sim/prep.js endRecon). */
export const inRecon = (sim, session) => isDefenderSetup(session) && !sim.reconDone;

/** The CÁMARAS button: defending, while deciding, with a camera still working. */
export const showCameras = (sim, session) => session.team === 'defenders' && isPlanningTime(session) && sim.cameras.some((c) => c.alive);

/** Phases where time is stopped and the player is planning. */
export const isPlanningTime = (session) => session.phase === 'prep' || session.phase === 'planning';
