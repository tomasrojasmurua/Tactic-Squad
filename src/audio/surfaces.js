// What the world sounds like at a point: floor surface (footsteps, casings,
// drops) and acoustic space (which reverb, how wet), plus the impact sound
// of a struck material and near-miss detection. Reads the simulation only
// through sim/queries.js (read-only, no allocation). Owner: audio.
import { FLOORS } from '../config/materials.js';
import { FLOOR_ACOUSTICS, DEFAULT_ACOUSTICS, IMPACT_SOUNDS } from '../config/audio.js';
import { floorMaterialAt, teamUnits } from '../sim/queries.js';

/** {surface, zone} at a world point (config/audio.js FLOOR_ACOUSTICS). */
export function acousticsAt(sim, x, y) {
  if (!sim) return DEFAULT_ACOUSTICS;
  const floor = FLOORS[floorMaterialAt(sim, x, y)];
  return (floor && FLOOR_ACOUSTICS[floor.pattern]) || DEFAULT_ACOUSTICS;
}

/** Impact sound group suffix for a struck surface (EV.SHOT.material): 'wall' | 'wood' | 'metal'. */
export const impactSoundFor = (material) => IMPACT_SOUNDS[material] || IMPACT_SOUNDS.plaster;

/**
 * Closest pass of a bullet (shot event) by one of `team`'s living units,
 * excluding the victim: writes {x, y, d} into `out` and returns it, or null.
 */
export function nearMiss(sim, ev, team, radius, minTravel, out) {
  if (!sim) return null;
  let best = radius * radius;
  let found = false;
  const dx = ev.toX - ev.x;
  const dy = ev.toY - ev.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < minTravel * minTravel) return null;
  const travel = Math.sqrt(l2);
  for (const u of teamUnits(sim, team)) {
    if (!u.alive || u.id === ev.victimId) continue;
    const t = Math.max(0, Math.min(1, ((u.x - ev.x) * dx + (u.y - ev.y) * dy) / l2));
    if (t * travel < minTravel) continue;
    const px = ev.x + dx * t;
    const py = ev.y + dy * t;
    const d2 = (u.x - px) ** 2 + (u.y - py) ** 2;
    if (d2 < best) {
      best = d2;
      out.x = px;
      out.y = py;
      found = true;
    }
  }
  if (!found) return null;
  out.d = Math.sqrt(best);
  return out;
}
