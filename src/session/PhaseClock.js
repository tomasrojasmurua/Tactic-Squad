// Wall-clock deadlines of the decision phases (buy, prep, plan): how long
// each side has to decide (ROUND.phaseSeconds). The sim never sees this
// clock — a phase lasting 3 s or 15 s cannot change the result; online, the
// server keeps it instead. A phase ends when every human side is ready (the
// LISTO button; AI sides always are) or when its time runs out.
//
// The clock stops counting while the player cannot plan: help open, page
// hidden, phone in portrait (covered by the "rotate" screen), and during the
// guided tutorial (no time limit while learning). A replayed phase (retry)
// ends by itself after FLOW.replayPhaseSeconds.
import { ROUND } from '../config/balance.js';
import { FLOW } from '../config/ui.js';

export class PhaseClock {
  /** @param advance () => void — ends the current decision phase */
  constructor({ session, advance }) {
    this.session = session;
    this.advance = advance;
    session.clock = { left: 0, total: 0, unlimited: false, auto: false };
  }

  /** A decision phase of the sim (sim/round.js PHASE) starts. */
  start(simPhase, auto) {
    const c = this.session.clock;
    c.total = c.left = ROUND.phaseSeconds[simPhase] ?? 0;
    c.auto = auto;
    this.autoLeft = FLOW.replayPhaseSeconds;
  }

  /** The player changed a replayed phase: from now on it waits for LISTO like any other. */
  takeOver() {
    this.session.clock.auto = false;
  }

  frozen() {
    const s = this.session;
    return s.helpOpen || document.visibilityState === 'hidden' || (s.touch && window.innerHeight > window.innerWidth);
  }

  /** Every frame while a decision phase lasts. */
  update(dt) {
    const s = this.session;
    const c = s.clock;
    c.unlimited = s.tutorial.active;
    if (this.frozen()) return;
    if (c.auto) {
      this.autoLeft -= dt;
      if (this.autoLeft <= 0) this.advance();
      return;
    }
    if (c.unlimited) return;
    c.left = Math.max(0, c.left - dt);
    if (c.left <= 0) this.advance();
  }
}
