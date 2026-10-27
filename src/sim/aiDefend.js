// The defending side played by the AI (sim.controllers.defenders === 'ai'):
// a light commander over the per-unit watch behaviors of sim/ai.js. Each
// defender still holds, sweeps or patrols on his own and turns to what he
// hears; this module only decides when some of them leave their post to
// reinforce the bomb.
//
//   evidence  what the side's operators notice in a step: an enemy they are
//             shooting at, and every alert (gunfire, footsteps, pain, a
//             camera, a trap, a barricade being hit) — where it came from
//   threat    evidence within AI_DEFEND.threatRadius of the bomb: the site is
//             being hit. Fights far from the bomb are left to whoever is there
//   rotation  on a threat, up to AI_DEFEND.rotators defenders who are not the
//             site's anchors, not fighting and not already near the threat
//             walk to the bomb once and hold the angle the threat comes
//             through: their map-authored fallback when they have one
//             (`behavior.rotate`), else a spot by the bomb facing the path
//             toward the threat
//
// Like the attacking AI it uses no sim.rng, so an AI round replays exactly.
import { AI_DEFEND, NAV } from '../config/balance.js';
import { startRotation, pathAroundBarricades } from './ai.js';

const TEAM = 'defenders';

/** The commander's state (sim.defendAi), or null when the defenders are not AI. */
export function createDefendAi(sim) {
  if (sim.controllers.defenders !== 'ai') return null;
  for (const u of sim.teams[TEAM]) u.ai.commanded = true;
  return { threat: null, sent: 0 };
}

/** Every execution step, after the units have perceived and been alerted. */
export function defendAiTick(sim) {
  const ai = sim.defendAi;
  if (!ai) return;
  const bomb = sim.bomb;
  const r2 = AI_DEFEND.threatRadius * AI_DEFEND.threatRadius;
  let threat = null;
  let best = Infinity;
  for (const u of sim.teams[TEAM]) {
    const seen = u.alive && u.target >= 0 ? sim.units[u.target] : null;
    const e = seen ? { x: seen.x, y: seen.y } : u.ai.report;
    u.ai.report = null;
    if (!e) continue;
    const d2 = (e.x - bomb.x) ** 2 + (e.y - bomb.y) ** 2;
    if (d2 <= r2 && d2 < best) {
      best = d2;
      threat = e;
    }
  }
  if (!threat) return;
  ai.threat = { x: threat.x, y: threat.y, time: sim.time };
  if (ai.sent < AI_DEFEND.rotators) rotate(sim, ai, threat);
}

/** Sends the free defenders farthest from the threat to the bomb, one rotation each. */
function rotate(sim, ai, threat) {
  const near2 = AI_DEFEND.nearThreat * AI_DEFEND.nearThreat;
  const free = sim.teams[TEAM].filter((u) =>
    u.alive && u.role !== 'anchor' && u.target < 0 && !u.ai.rotated && !u.ai.rotating && (u.x - threat.x) ** 2 + (u.y - threat.y) ** 2 > near2);
  free.sort((a, b) => (b.x - threat.x) ** 2 + (b.y - threat.y) ** 2 - ((a.x - threat.x) ** 2 + (a.y - threat.y) ** 2) || a.id - b.id);
  for (const u of free) {
    if (ai.sent >= AI_DEFEND.rotators) return;
    const spot = (u.behavior && u.behavior.rotate) || coverSpot(sim, threat, ai.sent);
    if (!spot) continue;
    startRotation(u, spot);
    ai.sent++;
  }
}

/**
 * A spot by the bomb covering the threat: a few metres from the bomb along
 * the walking path toward the threat (so the rotator holds the way in, not a
 * wall), facing farther down that path. The second rotator stands a little
 * off the first so they do not stack on the same tile.
 */
function coverSpot(sim, threat, n) {
  const nav = sim.world.nav;
  const bomb = sim.bomb;
  const path = pathAroundBarricades(sim, bomb.x, bomb.y, threat.x, threat.y);
  if (!path || !path.length) return null;
  const at = pointAlong(bomb, path, AI_DEFEND.coverDistance);
  const ahead = pointAlong(bomb, path, AI_DEFEND.coverDistance + AI_DEFEND.lookAhead);
  let look = Math.atan2(ahead.y - at.y, ahead.x - at.x);
  if (ahead.x === at.x && ahead.y === at.y) look = Math.atan2(threat.y - bomb.y, threat.x - bomb.x);
  let x = at.x;
  let y = at.y;
  if (n > 0) {
    // Step sideways off the first rotator's line.
    const side = AI_DEFEND.spacing * (n % 2 ? 1 : -1);
    const sx = x - Math.sin(look) * side;
    const sy = y + Math.cos(look) * side;
    if (nav.walkable(sx, sy)) {
      x = sx;
      y = sy;
    }
  }
  if (!nav.walkable(x, y)) {
    const p = nav.nearestWalkable(x, y, NAV.snapRadius);
    if (!p) return null;
    x = p.x;
    y = p.y;
  }
  return { to: [x, y], look };
}

/** The point `dist` metres along a polyline that starts at `from`. */
function pointAlong(from, path, dist) {
  let px = from.x;
  let py = from.y;
  for (const p of path) {
    const len = Math.hypot(p.x - px, p.y - py);
    if (len >= dist) return { x: px + ((p.x - px) * dist) / (len || 1), y: py + ((p.y - py) * dist) / (len || 1) };
    dist -= len;
    px = p.x;
    py = p.y;
  }
  return { x: px, y: py };
}
