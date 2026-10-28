// The tutorial's lessons (menu TUTORIAL; config/lessons.js has them as
// data): each a round on the real map set up to teach one thing. Lesson 1,
// "Básico", teaches the assault: planning, doors, GO groups, the turn; then
// doors and throws, two groups with their GOs, and the defender's set-up. Phases
// a lesson skips get an intro card the first time a later round reaches them
// (PHASE_INTROS). Two kinds of step:
//   info  a card that explains (ui/TutorialCard.js); ENTENDIDO / LISTO / Enter
//         closes it. One shown during a live phase (the drone) pauses it.
//   do    asks for one gesture and advances by itself once it is done (STEP_DONE).
// A step with `phase` waits until the round reaches that phase. LISTO only
// works on the steps that ask for it (`ready`), so nobody skips a lesson by
// accident. After the last step the round goes on freely, and a few one-off
// tips (barricade, bomb in reach) still pop up when they first apply.
// A lesson can be skipped at any time; done (or skipped) it is remembered on
// the device. State lives in session.tutorial; ui/TutorialCard.js shows it.
import { FLOW } from '../config/ui.js';
import { LESSONS, lessonById } from '../config/lessons.js';
import { ENTRY } from '../config/balance.js';
import { teamUnits, controllableUnit, canOrderDefuse } from '../sim/queries.js';
import { barricadedDoors } from '../sim/prep.js';
import { watchOf } from './watch.js';
import { loadPref, savePref } from './storage.js';

/**
 * The phases before the assault are not in the guided round: each one is
 * explained by a card the first time a round on this device reaches it
 * (every game from the lobby has them all from its first round).
 */
export const PHASE_INTROS = Object.freeze({ buy: 'introBuy', prep: 'introPrep', drone: 'introDrone' });

/** One-off tips after the guided part (each shown once, at a planning, when it first applies). */
export const TUTORIAL_TIPS = Object.freeze(['barricade', 'defuse']);

const hasUserPoint = (u) => u.route.some((p) => p.user);
const anyPoint = (squad, test) => squad.some((u) => u.route.some(test));

/** A defender's spot and watch in the map's layout for this site (where the set-up started). */
function layoutOf(sim, u) {
  const layout = sim.compiled.defense[sim.site.id];
  return layout[sim.defenderSlots ? sim.defenderSlots[u.slot] : u.slot] || null;
}

/** Did the player move this defender off his layout spot? */
function placed(sim, u) {
  const s = layoutOf(sim, u);
  return !!s && Math.hypot(u.x - s.at[0], u.y - s.at[1]) > 0.3;
}

/** Did the player change this defender's watch (mode or facing)? */
function watchChanged(sim, u) {
  const s = layoutOf(sim, u);
  if (!s) return false;
  const was = watchOf({ behavior: s.behavior, facing: s.facing, ai: { baseFacing: s.facing } });
  const now = watchOf(u);
  return now.mode !== was.mode || Math.abs(Math.atan2(Math.sin(now.facing - was.facing), Math.cos(now.facing - was.facing))) > 0.05;
}

/** Lessons done on this device (the old single tutorial counts as the first). */
function loadDone() {
  const done = loadPref(FLOW.storageKeys.lessonsDone, null);
  if (Array.isArray(done)) return done.filter((id) => lessonById(id));
  return loadPref(FLOW.storageKeys.tutorialDone, false) ? [LESSONS[0].id] : [];
}

/** Is gesture `id` (a `do` step's check) done? */
function stepDone(id, sim, session) {
  const squad = teamUnits(sim, session.team);
  const sel = controllableUnit(sim, session.selectedId, session.team);
  switch (id) {
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
    case 'ask':
      // A route crosses a door (its "?"), or that door already got a decision.
      return anyPoint(squad, (p) => p.ask || (p.user && p.entryDoor >= 0));
    case 'beside':
      return anyPoint(squad, (p) => p.user && ENTRY.beside.modes.includes(p.entry));
    case 'waitDoor':
      return anyPoint(squad, (p) => p.waitDoor >= 0);
    case 'toss':
      return anyPoint(squad, (p) => p.toss);
    case 'follow':
      return squad.some((u) => u.follow);
    case 'groups':
      // Holds on two GO colors: two groups that go each on its own GO.
      return new Set(squad.flatMap((u) => u.route.filter((p) => p.hold).map((p) => p.code))).size >= 2;
    case 'sneak':
      return anyPoint(squad, (p) => p.pace === 'sneak');
    case 'barricade':
      return barricadedDoors(sim).length > 0;
    case 'recon':
      return sim.reconDone;
    case 'place':
      return squad.some((u) => placed(sim, u));
    case 'watch':
      return squad.some((u) => watchChanged(sim, u));
    case 'setupDone':
      return sim.phase !== 'prep';
    default:
      return true;
  }
}

/** Does tip `id` apply now? */
function tipApplies(id, sim, session) {
  if (session.phase !== 'planning' || session.team === 'defenders') return false; // the tips speak to the attacker
  if (id === 'barricade') return sim.intel.barricades.size > 0;
  if (id === 'defuse') return canOrderDefuse(sim);
  return false;
}

export class Tutorial {
  constructor(session) {
    this.session = session;
    // What the UI shows (ui/TutorialCard.js reads the session, not this module):
    //   id: the current step or tip; info: it is a card to close; card: the card is up now
    //   lesson: the lesson being taken (config/lessons.js id); lessonsDone: done on this device
    const lessonsDone = loadDone();
    session.tutorial = {
      active: false,
      lesson: null,
      step: 0,
      id: null,
      info: false,
      card: false,
      count: 0,
      lessonsDone,
      done: lessonsDone.length > 0, // the first lesson at least (the menu stops recommending it)
      entryChosen: false,
      tips: [], // tips already shown
      tip: null, // the tip on screen
      introsSeen: loadPref(FLOW.storageKeys.introsSeen, []) || [], // PHASE_INTROS already shown on this device
    };
  }

  get active() {
    return this.session.tutorial.active;
  }

  get steps() {
    const l = lessonById(this.session.tutorial.lesson);
    return l ? l.steps : [];
  }

  /** Starts lesson `id` (the session's sim is its round, in its first phase); omitted: the same one again. */
  begin(sim, id = this.session.tutorial.lesson) {
    const steps = lessonById(id).steps;
    Object.assign(this.session.tutorial, { active: true, lesson: id, step: 0, count: steps.length, id: steps[0].id, info: !!steps[0].info, card: false, entryChosen: false, tips: [], tip: null });
  }

  /** Ends the guided part (completed or skipped) and remembers it. Returns true if it was running. */
  finish() {
    const t = this.session.tutorial;
    if (!t.active) return false;
    Object.assign(t, { active: false, id: null, info: false, card: false });
    if (!t.lessonsDone.includes(t.lesson)) t.lessonsDone.push(t.lesson);
    t.done = true;
    savePref(FLOW.storageKeys.lessonsDone, t.lessonsDone);
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
    const steps = this.steps;
    t.step = step + 1;
    if (t.step >= steps.length) return;
    const s = steps[t.step];
    t.id = s.id;
    t.info = !!s.info;
    if ((s.check || s.id) === 'select') this.session.selectedId = -1; // the lesson is choosing one
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
      if (t.card || phase === 'ended') return null;
      // A phase before the assault, reached for the first time on this device: its intro card
      // (they explain the attacker's side; the defender's set-up has its own panel and hints).
      const intro = this.session.team === 'defenders' ? null : PHASE_INTROS[phase];
      if (intro && !t.introsSeen.includes(intro)) {
        t.introsSeen.push(intro);
        savePref(FLOW.storageKeys.introsSeen, t.introsSeen);
        Object.assign(t, { tip: intro, card: true });
        return 'card';
      }
      if (!tips) return null;
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
    const steps = this.steps;
    // A later step only counts after the earlier ones (the order is the lesson).
    while (t.step < steps.length) {
      const s = steps[t.step];
      if (s.phase && phase !== s.phase && !(phase === 'paused' && this.session.resumePhase === s.phase)) break;
      if (s.info) {
        if (t.card) break;
        t.card = true;
        // A lesson's card that is a phase's intro counts as seen (no second one in a later round).
        if (Object.values(PHASE_INTROS).includes(s.id) && !t.introsSeen.includes(s.id)) {
          t.introsSeen.push(s.id);
          savePref(FLOW.storageKeys.introsSeen, t.introsSeen);
        }
        return 'card';
      }
      if (!stepDone(s.check || s.id, sim, this.session)) break;
      this.advanceFrom(t.step);
      advanced = true;
    }
    if (t.step >= steps.length) {
      this.finish();
      return 'done';
    }
    return advanced ? 'step' : null;
  }

  /** LISTO / Space waits until the step asks for it (an info card takes it as ENTENDIDO). */
  blocksReady() {
    const t = this.session.tutorial;
    return t.active && !this.steps[t.step].ready;
  }

  /** The step the player must do now (id), or null. */
  current() {
    const t = this.session.tutorial;
    return t.active ? this.steps[t.step].id : null;
  }
}
