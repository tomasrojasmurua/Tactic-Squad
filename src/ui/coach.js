// Onboarding coach (flow, owner: gameplay): picks the one next step a new
// player should take, shown in the phase banner's sub line. Pure: reads the
// sim/session, returns {text, strong} or null (= the phase's default line).
// The guided tutorial has its own card (ui/TutorialCard.js): while it runs the
// banner keeps the phase's line. Priority: why a turn stopped (system pause) >
// replay progress > GO prompts > planning steps.
import { teamUnits, controllableUnit, isGoReady, pendingDoors, ASK_CODE } from '../sim/queries.js';
import { ENTRY, PREP } from '../config/balance.js';
import { T } from './texts.js';

const hasUserPoint = (u) => u.route.some((p) => p.user);
const hasLook = (u) => u.idleLook !== null || u.route.some((p) => p.look !== null);

const hint = { text: '', strong: false }; // reused result (the HUD polls this)
const say = (text, strong) => {
  hint.text = text;
  hint.strong = strong;
  return hint;
};

export function coachHint(sim, session) {
  const dev = session.touch ? 'touch' : 'desk';
  const C = T.coach;
  const F = T.flow;
  const team = session.team;
  if (session.tutorial.active) return null;
  if (session.phase === 'paused' && F.pause[session.pauseReason]) return say(F.pause[session.pauseReason][dev], true);
  if (session.replay.pending > 0 && session.phase !== 'ended') return say(F.replaying(session.replay.pending), false);
  if (session.phase === 'drone' || (session.phase === 'paused' && session.resumePhase === 'drone')) return null;
  if (session.phase === 'running' || session.phase === 'paused') {
    // A whole group in position: it is the player's call ("now!").
    const ready = ENTRY.goCodes.find((c) => isGoReady(sim, team, c));
    if (ready) return say(C.goNow[dev](ready), true);
    // Stopped at a door nobody decided: there is no GO to give, the decision waits for the planning.
    const w = teamUnits(sim, team).find((u) => u.alive && u.waitingGo);
    if (!w) return null;
    return w.waitCode === ASK_CODE ? say(C.askWaiting(w.name), true) : say(C.goWaiting[dev](w.name), false);
  }
  if (session.phase !== 'planning' && session.phase !== 'prep') return null;
  if (team === 'defenders' && session.phase === 'prep') return defenderSetup(sim, session, dev);
  // A door nobody decided: its operator will stop there.
  const doors = pendingDoors(sim, team);
  if (doors > 0) return say(C.doors[dev](doors), true);
  if (session.phase !== 'planning' || team === 'defenders') return null; // a defender's plan is optional
  if (sim.turn > 1) return null; // the first planning teaches the steps; later ones are the player's
  const squad = teamUnits(sim, team);
  const sel = controllableUnit(sim, session.selectedId, team);
  if (!sel) return say(C.select[dev], true);
  if (!hasUserPoint(sel)) return say(C.route[dev](sel.name), true);
  if (!squad.some(hasLook)) return say(C.look[dev], true);
  const idle = squad.find((u) => u.alive && !hasUserPoint(u));
  if (idle) return say(C.next[dev](idle.name), false);
  return say(C.ready[dev], false);
}

/** Playing the defenders, preparation: pick one, place and aim him; the barricades still to put up. */
function defenderSetup(sim, session, dev) {
  const C = T.coach;
  const sel = controllableUnit(sim, session.selectedId, session.team);
  if (!sel) return say(C.defSelect[dev], true);
  const left = PREP.barricades - sim.doors.filter((d) => d.barricaded).length;
  if (left > 0) return say(C.defBarricades(left), false);
  return say(C.defPlace[dev](sel.name), false);
}
