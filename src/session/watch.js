// A defender's watch order as the panel shows it (ui/PhasePanel.js: in the
// set-up and again while planning each turn of the assault) and the order
// that sets it (sim/prep.js setWatch). Three modes:
//   fixed   ángulo fijo: holds his facing, deaf to noise
//   sweep   barrer: sweeps PREP.sweepArc around his facing, turns to noise
//   alert   atento: holds his facing, turns to noise
// A fallback from the map's layout ("replegarse": on the first firefight he
// moves to a planned spot) is kept whatever the mode.
import { PREP } from '../config/balance.js';

export const WATCH_MODES = Object.freeze(['fixed', 'sweep', 'alert']);

/** {mode, facing, fallback} of a defender's current watch (behavior). */
export function watchOf(u) {
  const b = u.behavior;
  const fallback = b && b.rotate ? { to: [b.rotate.to[0], b.rotate.to[1]], look: b.rotate.look } : null;
  // Where he looks once still: the look he was given there (sim/orders.js setLook), else the order's.
  const look = u.idleLook ?? null;
  if (b && b.type === 'scan') return { mode: 'sweep', facing: look ?? (b.from + b.to) / 2, fallback };
  if (b && b.type === 'patrol') return { mode: 'patrol', facing: u.facing, fallback }; // the map's; any mode replaces it
  const facing = look ?? (u.ai ? u.ai.baseFacing : u.facing);
  return { mode: b && b.reactsToNoise === false ? 'fixed' : 'alert', facing, fallback };
}

/** The setWatch order's `watch` for a mode, facing and (optional) fallback. */
export function watchOrder(mode, facing, fallback = null) {
  const w = { facing, react: mode !== 'fixed' };
  if (mode === 'sweep') w.sweep = [facing - PREP.sweepArc / 2, facing + PREP.sweepArc / 2];
  if (fallback) w.fallback = fallback;
  return w;
}
