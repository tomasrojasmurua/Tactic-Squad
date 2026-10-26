// Playable onboarding (REVIEW-1 #23): a guided first round on the real map
// that asks for each gesture in order and only advances once it is done:
// select → draw a route → set a facing → WAIT (GO hold) → EXECUTE → GO.
// It can be skipped at any time and is remembered on the device once done.
// State lives in session.tutorial ({active, step}); ui/coach.js shows the step.
import { FLOW } from '../config/ui.js';
import { teamUnits, controllableUnit } from '../sim/queries.js';
import { loadPref, savePref } from './storage.js';

export const TUTORIAL_STEPS = Object.freeze(['select', 'route', 'look', 'hold', 'execute', 'go']);

const hasUserPoint = (u) => u.route.some((p) => p.user);

/** Is the gesture of step `id` done? */
function stepDone(id, sim, session) {
  const squad = teamUnits(sim, session.team);
  const sel = controllableUnit(sim, session.selectedId, session.team);
  switch (id) {
    case 'select':
      return !!sel;
    case 'route':
      return !!sel && hasUserPoint(sel);
    case 'look':
      return squad.some((u) => u.route.some((p) => p.user && p.look !== null));
    case 'hold':
      return squad.some((u) => u.route.some((p) => p.hold));
    case 'execute':
      return session.phase === 'running' || session.phase === 'paused';
    case 'go':
      return sim.goCount > 0;
    default:
      return true;
  }
}

export class Tutorial {
  constructor(session) {
    this.session = session;
    // id / count: what the UI shows (ui/coach.js reads the session, not this module)
    session.tutorial = { active: false, step: 0, id: null, count: TUTORIAL_STEPS.length, done: !!loadPref(FLOW.storageKeys.tutorialDone, false) };
  }

  get active() {
    return this.session.tutorial.active;
  }

  begin() {
    Object.assign(this.session.tutorial, { active: true, step: 0, id: TUTORIAL_STEPS[0] });
    this.session.selectedId = -1; // step 1 is choosing an operator
  }

  /** Ends the guided round (completed or skipped) and remembers it. Returns true if it was running. */
  finish() {
    const t = this.session.tutorial;
    if (!t.active) return false;
    t.active = false;
    t.id = null;
    t.done = true;
    savePref(FLOW.storageKeys.tutorialDone, true);
    return true;
  }

  /** Every frame: advance past the steps whose gesture is done. Returns 'step' | 'done' | null. */
  update(sim) {
    const t = this.session.tutorial;
    if (!t.active) return null;
    let advanced = false;
    while (t.step < TUTORIAL_STEPS.length && stepDone(TUTORIAL_STEPS[t.step], sim, this.session)) {
      // A later step may only count after the earlier ones (the order is the lesson).
      t.step++;
      advanced = true;
    }
    if (t.step >= TUTORIAL_STEPS.length) {
      this.finish();
      return 'done';
    }
    t.id = TUTORIAL_STEPS[t.step];
    return advanced ? 'step' : null;
  }

  /** While guided, EXECUTE waits until the planning gestures were made. */
  blocksExecute() {
    const t = this.session.tutorial;
    return t.active && t.step < TUTORIAL_STEPS.indexOf('execute');
  }

  /** The step the player must do now (id), or null. */
  current() {
    const t = this.session.tutorial;
    return t.active ? TUTORIAL_STEPS[t.step] : null;
  }
}
