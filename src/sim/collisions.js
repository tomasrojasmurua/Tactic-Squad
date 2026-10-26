// Body collisions: soft rest spacing between allies (a stack lines up along
// the wall next to a door), hard separation (two bodies never overlap) and
// push-out from walls, props and closed doors.
import { MOVE } from '../config/balance.js';
import { circleAabbPush } from '../core/geom.js';
import { closedDoorBoxes } from './doors.js';
import { doorwayNear } from './queries.js';

const doorBoxes = [];

/**
 * Collisions: soft rest spacing between allies, then hard separation (no two
 * bodies ever overlap) alternated with pushing units out of walls, props and
 * closed doors.
 */
export function resolveCollisions(sim) {
  separateAllies(sim);
  const blockers = sim.world.moveBlockers;
  closedDoorBoxes(sim, doorBoxes);
  for (let pass = 0; pass < MOVE.collisionPasses; pass++) {
    separateUnits(sim);
    for (const u of sim.units) {
      if (!u.alive) continue;
      for (let i = 0; i < blockers.length; i++) pushOut(u, blockers[i]);
      for (let i = 0; i < doorBoxes.length; i++) pushOut(u, doorBoxes[i]);
    }
  }
}

const pushScratch = { x: 0, y: 0 };

function pushOut(u, box) {
  if (u.x + u.radius < box.minX || u.x - u.radius > box.maxX) return;
  if (u.y + u.radius < box.minY || u.y - u.radius > box.maxY) return;
  const push = circleAabbPush(u.x, u.y, u.radius, box, pushScratch);
  if (push) {
    u.x += push.x;
    u.y += push.y;
  }
}

/** Hard rule: bodies never overlap. A walking unit has way; idle ones (or two alike) give way. */
function separateUnits(sim) {
  const units = sim.units;
  for (let i = 0; i < units.length; i++) {
    const a = units[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j];
      if (!b.alive) continue;
      const min = a.radius + b.radius;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      if (d2 < 1e-8) {
        dx = 1e-3 * (b.id - a.id);
        dy = 0;
        d2 = dx * dx;
      }
      const d = Math.sqrt(d2);
      const k = (min - d) / d;
      const wa = a.moving === b.moving ? 0.5 : a.moving ? 0 : 1;
      a.x -= dx * k * wa;
      a.y -= dy * k * wa;
      b.x += dx * k * (1 - wa);
      b.y += dy * k * (1 - wa);
    }
  }
}

/** A resting unit (route done or waiting for GO) close to a doorway stacks along its wall. */
const isStacking = (u) => !u.moving && (u.waitingGo || !u.route.length);

/**
 * Soft rest spacing (MOVE.friendlySpacing): idle allies step aside. Near a
 * doorway a stacking operator slides along the wall (the doorway's tangent)
 * away from his neighbour, so a stack lines up beside the door instead of
 * in a clump in front of it.
 */
function separateAllies(sim) {
  const units = sim.units;
  const min = MOVE.friendlySpacing;
  const k0 = Math.min(1, MOVE.separationStrength * sim.dt);
  for (let i = 0; i < units.length; i++) {
    const a = units[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j];
      if (!b.alive || b.team !== a.team) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      if (d2 < 1e-8) {
        // Exactly stacked (same waypoint): split along a fixed, deterministic axis.
        dx = 1e-3 * (b.slot - a.slot || 1);
        dy = 0;
        d2 = dx * dx;
      }
      // Only idle units are nudged so a moving operator is never blocked;
      // a lone idle unit takes the whole push, two idle ones share it.
      const d = Math.sqrt(d2);
      const share = !a.moving && !b.moving ? 0.5 : 1;
      const k = ((min - d) / d) * k0 * share;
      if (isStacking(a) && isStacking(b)) {
        const door = doorwayNear(sim.world, (a.x + b.x) / 2, (a.y + b.y) / 2, MOVE.stackDoorRange);
        if (door) {
          // Tangent of the wall; the push keeps its side along it (ties: by slot).
          const tx = door.normalY;
          const ty = -door.normalX;
          const along = dx * tx + dy * ty;
          const sign = Math.abs(along) > 1e-6 ? Math.sign(along) : b.slot > a.slot ? 1 : -1;
          const push = (min - d) * k0 * share * sign;
          a.x -= tx * push;
          a.y -= ty * push;
          b.x += tx * push;
          b.y += ty * push;
          continue;
        }
      }
      if (!a.moving) {
        a.x -= dx * k;
        a.y -= dy * k;
      }
      if (!b.moving) {
        b.x += dx * k;
        b.y += dy * k;
      }
    }
  }
}
