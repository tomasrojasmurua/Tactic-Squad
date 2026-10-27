// Guided tutorial (menu "Tutorial guiado"): a whole round on the real map,
// easier than a normal one (config/ui.js TUTORIAL: fixed seed, site B, two
// defenders), that walks through every phase in order. Two kinds of step:
//   info  a card that explains (ui/TutorialCard.js); ENTENDIDO / LISTO / Enter
//         closes it. One shown during a live phase (the drone) pauses it.
//   do    asks for one gesture and advances by itself once it is done.
// A step with `phase` waits until the round reaches that phase. LISTO only
// works on the steps that ask for it (`ready`), so nobody skips a lesson by
// accident. After the last step the round goes on freely, and a few one-off
// tips (barricade, bomb in reach) still pop up when they first apply.
// It can be skipped at any time and is remembered on the device once done.
// State lives in session.tutorial; ui/TutorialCard.js shows it.
import { FLOW } from '../config/ui.js';
import { teamUnits, controllableUnit, canOrderDefuse } from '../sim/queries.js';
import { loadPref, savePref } from './storage.js';

/**
 * The steps, in order. info: a card to close; phase: shown only in that session phase;
 * ready: LISTO is allowed (it is what the step asks for, or the lesson is past that point).
 */
export const TUTORIAL_STEPS = Object.freeze([
  { id: 'welcome', info: true, phase: 'buy' },
  { id: 'buy', phase: 'buy' },
  { id: 'buyReady', ready: true },
  { id: 'prep', info: true, phase: 'prep' },
  { id: 'entry', phase: 'prep' },
  { id: 'prepReady', ready: true },
  { id: 'drone', info: true, phase: 'drone' },
  { id: 'droneFly', ready: true },
  { id: 'plan', info: true, phase: 'planning' },
  { id: 'select', phase: 'planning' },
  { id: 'route', phase: 'planning' },
  { id: 'door', phase: 'planning' },
  { id: 'hold', phase: 'planning' },
  { id: 'look', phase: 'planning' },
  { id: 'execute', ready: true },
  { id: 'go', ready: true },
  { id: 'turnEnd', info: true, phase: 'planning', ready: true },
]);

/** One-off tips after the guided part (each shown once, at a planning, when it first applies). */
export const TUTORIAL_TIPS = Object.freeze(['barricade', 'defuse']);

const hasUserPoint = (u) => u.route.some((p) => p.user);
const moneyOf = (sim, team) => teamUnits(sim, team).reduce((s, u) => s + (u.money || 0), 0);

/** Is the gesture of `do` step `id` done? */
function stepDone(id, sim, session, t) {
  const squad = teamUnits(sim, session.team);
  const sel = controllableUnit(sim, session.selectedId, session.team);
  switch (id) {
    case 'buy':
      return moneyOf(sim, session.team) < t.money;
    case 'buyReady':
      return session.phase !== 'buy';
    case 'entry':
      return t.entryChosen;
    case 'prepReady':
      return session.phase !== 'prep';
    case 'droneFly':
      return session.phase !== 'drone' && session.phase !== 'paused'; // the drone's card pauses it
    case 'select':
      return !!sel;
    case 'route':
      return !!sel && hasUserPoint(sel);
    case 'door':
      // A door on the route got its decision (a mode, or "Abrir" on its "?" point).
      return squad.some((u) => u.route.some((p) => p.user && !p.ask && (p.entry || p.door >= 0)));
    case 'hold':
      return squad.some((u) => u.route.some((p) => p.hold));
    case 'look':
      return squad.some((u) => u.route.some((p) => p.user && p.look !== null));
    case 'execute':
      return sim.turn > 1 || session.phase === 'running' || session.phase === 'paused';
    case 'go':
      return sim.goCount > 0;
    default:
      return true;
  }
}

/** Does tip `id` apply now? */
function tipApplies(id, sim, session) {
  if (session.phase !== 'planning') return false;
  if (id === 'barricade') return sim.intel.barricades.size > 0;
  if (id === 'defuse') return canOrderDefuse(sim);
  return false;
}

export class Tutorial {
  constructor(session) {
    this.session = session;
    // What the UI shows (ui/TutorialCard.js reads the session, not this module):
    //   id: the current step or tip; info: it is a card to close; card: the card is up now
    session.tutorial = {
      active: false,
      step: 0,
      id: null,
      info: false,
      card: false,
      count: TUTORIAL_STEPS.length,
      done: !!loadPref(FLOW.storageKeys.tutorialDone, false),
      money: 0, // the squad's money when the buy step began
      entryChosen: false,
      tips: [], // tips already shown
      tip: null, // the tip on screen
    };
  }

  get active() {
    return this.session.tutorial.active;
  }

  /** Starts the guided round (the session's sim is the tutorial one, in its buy phase). */
  begin(sim) {
    Object.assign(this.session.tutorial, { active: true, step: 0, id: TUTORIAL_STEPS[0].id, info: true, card: false, entryChosen: false, tips: [], tip: null });
    this.session.tutorial.money = moneyOf(sim, this.session.team);
  }

  /** Ends the guided part (completed or skipped) and remembers it. Returns true if it was running. */
  finish() {
    const t = this.session.tutorial;
    if (!t.active) return false;
    Object.assign(t, { active: false, id: null, info: false, card: false });
    t.done = true;
    savePref(FLOW.storageKeys.tutorialDone, true);
    return true;
  }

  /** Leaves the tutorial altogether (back to the menu; not counted as done): no guided step, no tips. */
  stop() {
    Object.assign(this.session.tutorial, { active: false, id: null, info: false, card: false, tip: null, tips: TUTORIAL_TIPS.slice() });
  }

  /** A new tutorial round, nothing shown yet (tips start over). */
  reset() {
    Object.assign(this.session.tutorial, { tip: null, tips: [], card: false });
  }

  /** The player chose an entry (preparation). */
  noteEntry() {
    this.session.tutorial.entryChosen = true;
  }

  /** ENTENDIDO on the card on screen (a step or a tip). Returns true if there was one. */
  ack() {
    const t = this.session.tutorial;
    if (!t.card) return false;
    if (t.tip) {
      t.tip = null;
      t.card = false;
      return true;
    }
    t.card = false;
    this.advanceFrom(t.step);
    return true;
  }

  advanceFrom(step) {
    const t = this.session.tutorial;
    t.step = step + 1;
    if (t.step >= TUTORIAL_STEPS.length) return;
    const s = TUTORIAL_STEPS[t.step];
    t.id = s.id;
    t.info = !!s.info;
    if (s.id === 'select') this.session.selectedId = -1; // the lesson is choosing one
  }

  /**
   * Every frame: advance past the `do` steps whose gesture is done and raise
   * the card of an info step (or a tip) once its phase comes.
   * Returns 'step' (a new step) | 'card' (a card just went up) | 'done' | null.
   */
  update(sim, tips) {
    const t = this.session.tutorial;
    const phase = this.session.phase;
    if (!t.active) {
      if (!tips || t.card || phase === 'ended') return null;
      const tip = TUTORIAL_TIPS.find((id) => !t.tips.includes(id) && tipApplies(id, sim, this.session));
      if (!tip) return null;
      t.tips.push(tip);
      Object.assign(t, { tip, card: true });
      return 'card';
    }
    if (phase === 'ended') {
      this.finish();
      return 'done';
    }
    let advanced = false;
    // A later step only counts after the earlier ones (the order is the lesson).
    while (t.step < TUTORIAL_STEPS.length) {
      const s = TUTORIAL_STEPS[t.step];
      if (s.phase && phase !== s.phase && !(phase === 'paused' && this.session.resumePhase === s.phase)) break;
      if (s.info) {
        if (t.card) break;
        t.card = true;
        return 'card';
      }
      if (!stepDone(s.id, sim, this.session, t)) break;
      this.advanceFrom(t.step);
      advanced = true;
    }
    if (t.step >= TUTORIAL_STEPS.length) {
      this.finish();
      return 'done';
    }
    return advanced ? 'step' : null;
  }

  /** LISTO / Space waits until the step asks for it (an info card takes it as ENTENDIDO). */
  blocksReady() {
    const t = this.session.tutorial;
    return t.active && !TUTORIAL_STEPS[t.step].ready;
  }

  /** The step the player must do now (id), or null. */
  current() {
    const t = this.session.tutorial;
    return t.active ? TUTORIAL_STEPS[t.step].id : null;
  }
}
