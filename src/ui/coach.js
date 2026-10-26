// Onboarding coach (flow, owner: gameplay): picks the one next step a new
// player should take, shown in the phase banner's sub line. Pure: reads the
// sim/session, returns {text, strong} or null (= the phase's default line).
// Priority: guided tutorial step > why a turn stopped (system pause) > replay
// progress > GO prompts > planning steps.
import { teamUnits, controllableUnit, isGoReady } from '../sim/queries.js';
import { ENTRY } from '../config/balance.js';
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
  const tut = session.tutorial;
  if (tut.active && tut.id && session.phase !== 'ended') return say(F.tutorial.prefix(tut.step + 1, tut.count) + F.tutorial[tut.id][dev], true);
  if (session.phase === 'paused' && F.pause[session.pauseReason]) return say(F.pause[session.pauseReason][dev], true);
  if (session.replay.pending > 0 && session.phase !== 'ended') return say(F.replaying(session.replay.pending), false);
  if (session.phase === 'running' || session.phase === 'paused') {
    // A whole group in position: it is the player's call ("now!").
    const ready = ENTRY.goCodes.find((c) => isGoReady(sim, team, c));
    if (ready) return say(C.goNow[dev](ready), true);
    const w = teamUnits(sim, team).find((u) => u.alive && u.waitingGo);
    return w ? say(C.goWaiting[dev](w.name), false) : null;
  }
  if (session.phase !== 'planning') return null;
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
