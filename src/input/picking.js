// Screen-point picking for the planning actions (pure: camera + sim in,
// answer out). Radii never shrink below a finger / cursor size on screen.
import { POINTER, TOUCH } from '../config/input.js';
import { routeTail, teamUnits } from '../sim/queries.js';

/** World radius covering at least `px` screen pixels (generous picking when zoomed out). */
export const pickRadius = (camera, meters, px) => Math.max(meters, px * camera.metersPerPixel(0));

/** Living unit of `team` under a screen point (nearest within the pick radius), or null. */
export function unitAt(camera, sim, team, px, py, touch = false) {
  const radius = touch ? pickRadius(camera, TOUCH.unitPickRadius, TOUCH.unitPickPx) : pickRadius(camera, POINTER.unitPickRadius, POINTER.unitPickPx);
  const w = camera.screenToWorld(px, py, POINTER.unitPickHeight);
  let best = null;
  let bestD = radius;
  for (const u of teamUnits(sim, team)) {
    if (!u.alive) continue;
    const d = Math.hypot(u.x - w.x, u.y - w.y);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

/** Index of the unit's user waypoint nearest to a world point within `radius` (m), or -1. */
export function waypointAt(unit, wx, wy, radius) {
  let best = -1;
  let bestD = radius;
  const r = unit.route;
  for (let i = 0; i < r.length; i++) {
    if (!r[i].user) continue;
    const d = Math.hypot(r[i].x - wx, r[i].y - wy);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Is a world point within `pickPx` screen pixels of the end of the unit's route (or of him, with no route)? */
export function nearTail(camera, unit, wx, wy, pickPx) {
  const tail = routeTail(unit);
  return Math.hypot(tail.x - wx, tail.y - wy) <= pickRadius(camera, 0, pickPx);
}
