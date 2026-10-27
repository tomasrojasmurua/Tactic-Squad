// Two-step confirmation for requests that wipe the plan (REVIEW-1 #3; leaving
// for the menu too), and
// for LISTO while some door is still undecided ("?"): the first press arms
// it (the button says so, a toast explains), a second press within
// FLOW.confirmSeconds does it. With nothing at stake it acts at once.
import { FLOW } from '../config/ui.js';
import { isArmed } from './Session.js';

/** Requests that need a confirming repeat, and the phases where they do. */
const IN_ROUND = ['buy', 'prep', 'drone', 'planning', 'running', 'paused'];
const DESTRUCTIVE = Object.freeze({ restart: IN_ROUND, newPlan: IN_ROUND, menu: IN_ROUND, ready: ['prep', 'planning'] });

/** 'go' (act now) | 'armed' (wait for the repeat). */
export function armOrConfirm(session, action, atStake) {
  const c = session.confirm;
  if (!DESTRUCTIVE[action]?.includes(session.phase) || !atStake) return 'go';
  if (isArmed(session, action)) {
    c.action = null;
    return 'go';
  }
  c.action = action;
  c.until = performance.now() + FLOW.confirmSeconds * 1000;
  return 'armed';
}
