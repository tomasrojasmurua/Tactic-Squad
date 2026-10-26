// Two-step confirmation for requests that wipe the plan (REVIEW-1 #3): the
// first press arms it (the button says so, a toast explains), a second press
// within FLOW.confirmSeconds does it. With nothing to lose it acts at once.
import { FLOW } from '../config/ui.js';
import { isArmed } from './Session.js';

/** Requests that wipe the plan, and the phases where they do. */
const DESTRUCTIVE = Object.freeze({ restart: ['planning'], newPlan: ['planning', 'running', 'paused'] });

/** 'go' (act now) | 'armed' (wait for the repeat). */
export function armOrConfirm(session, action, hasPlan) {
  const c = session.confirm;
  if (!DESTRUCTIVE[action]?.includes(session.phase) || !hasPlan) return 'go';
  if (isArmed(session, action)) {
    c.action = null;
    return 'go';
  }
  c.action = action;
  c.until = performance.now() + FLOW.confirmSeconds * 1000;
  return 'armed';
}
