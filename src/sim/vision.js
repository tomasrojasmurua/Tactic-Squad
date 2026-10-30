// Line-of-sight and visibility polygons. Pure geometry over the world's
// segment list; shared by perception (sim) and the fog-of-war renderer so
// what you see on screen is exactly what the simulation considers visible.
import { TAU, angleDiff } from '../core/math.js';
import { segmentBlocked } from '../core/geom.js';
import { VISION } from '../config/balance.js';
import { datan2, dcos, dsin } from '../core/dmath.js';

const scratchSegs = new Float64Array(8192); // segments rays are cast against
const scratchAngles = new Float64Array(8192); // candidate ray angles (offsets from `start`)

/**
 * Visibility polygon for an eye at (ox, oy) looking along `facing` with a
 * field of view `fov` (use TAU for a full circle) up to `range` meters.
 * Returns a flat array [x0, y0, x1, y1, ...] ordered by angle; together with
 * the eye it forms a triangle fan. Pass `out` (a Float32Array, reused when
 * large enough) to avoid allocating: the result is then a view into it.
 *
 * Hot path (fog of war, every frame). Two exact culls keep it cheap without
 * changing the result:
 *  - segments farther than `range` are ignored;
 *  - for cones (< 180°), segments entirely outside the (slightly widened)
 *    wedge can neither be hit nor contribute a candidate angle.
 * Duplicate candidate angles (box corners shared by two edges) are cast once
 * (the original duplicates only produced zero-area fan triangles).
 * (Back-face culling was evaluated and rejected: ~1.5x faster but rays that
 * graze a box corner can differ by float noise — not bit-exact.)
 */
export function visibilityPolygon(world, ox, oy, facing, fov, range, out = null) {
  const full = fov >= TAU - 1e-6;
  const span = full ? TAU : fov;
  const start = full ? facing - Math.PI : facing - fov / 2;
  const eps = VISION.endpointEpsilon;

  // Wedge half-planes, widened by 2·eps so every candidate angle stays inside.
  const wedge = !full && span < Math.PI - 4 * eps;
  const lx = dcos(start - 2 * eps);
  const ly = dsin(start - 2 * eps);
  const rx = dcos(start + span + 2 * eps);
  const ry = dsin(start + span + 2 * eps);

  // Arc samples first, then segment endpoints.
  let count = 0;
  const steps = Math.max(2, Math.ceil(span / VISION.arcStep));
  for (let i = 0; i <= steps; i++) scratchAngles[count++] = (span * i) / steps;

  const segs = world.segments;
  const r2 = (range + 0.5) * (range + 0.5);
  let n = 0;
  for (let i = 0; i < world.segmentCount; i += 4) {
    const x1 = segs[i];
    const y1 = segs[i + 1];
    const x2 = segs[i + 2];
    const y2 = segs[i + 3];
    // core/geom.js pointSegDist2 (same arithmetic), inlined: calls with double arguments box them.
    const sx = x2 - x1;
    const sy = y2 - y1;
    const l2 = sx * sx + sy * sy;
    let st = l2 > 0 ? ((ox - x1) * sx + (oy - y1) * sy) / l2 : 0;
    st = st < 0 ? 0 : st > 1 ? 1 : st;
    const cx = x1 + sx * st - ox;
    const cy = y1 + sy * st - oy;
    if (cx * cx + cy * cy > r2) continue;
    const ax = x1 - ox;
    const ay = y1 - oy;
    const bx = x2 - ox;
    const by = y2 - oy;
    if (wedge) {
      if (lx * ay - ly * ax < 0 && lx * by - ly * bx < 0) continue; // clockwise of the start edge
      if (ax * ry - ay * rx < 0 && bx * ry - by * rx < 0) continue; // counter-clockwise of the end edge
    }
    // The 3 candidate angles (exact ± eps) of each endpoint in range, as offsets from `start`.
    for (let e = 0; e < 2; e++) {
      const px = e === 0 ? ax : bx;
      const py = e === 0 ? ay : by;
      if (px * px + py * py > r2) continue;
      let off = datan2(py, px) - start;
      off = ((off % TAU) + TAU) % TAU;
      for (let k = -1; k <= 1; k++) {
        const o = off + k * eps;
        if (o >= 0 && o <= span && count < scratchAngles.length) scratchAngles[count++] = o;
      }
    }
    if (n + 4 > scratchSegs.length) break;
    scratchSegs[n++] = x1;
    scratchSegs[n++] = y1;
    scratchSegs[n++] = x2;
    scratchSegs[n++] = y2;
  }
  // In-place ascending sort (TypedArray#sort boxes every element into a temporary array: per-frame garbage).
  const angles = scratchAngles;
  sortAscending(angles, 0, count - 1);

  let unique = 0;
  for (let i = 0; i < count; i++) if (i === 0 || angles[i] !== angles[i - 1]) angles[unique++] = angles[i];
  const result = out && out.length >= unique * 2 ? (out.length === unique * 2 ? out : out.subarray(0, unique * 2)) : new Float32Array(unique * 2);
  castRays(angles, unique, start, ox, oy, range, n, result);
  return result;
}

/**
 * One ray per unique angle against the culled segments (rayCast inlined with
 * identical arithmetic: a call with double arguments boxes them).
 * Allocation note (measured in Chromium, where this runs in the Maglev tier):
 * a variable that may hold either a parameter (tagged) or a computed double
 * is re-boxed on every assignment. `range * 1.0` is bit-identical to `range`
 * but makes it a raw double, so the loops allocate nothing (was ~20 KB per
 * full-circle polygon).
 */
function castRays(angles, unique, start, ox, oy, range, n, result) {
  const extend = VISION.rayExtend;
  for (let i = 0; i < unique; i++) {
    const a = start + angles[i];
    const dx = dcos(a);
    const dy = dsin(a);
    let t = range * 1.0; // see the note above: keeps the loop value a raw double
    for (let k = 0; k < n; k += 4) {
      const x1 = scratchSegs[k];
      const y1 = scratchSegs[k + 1];
      const sx = scratchSegs[k + 2] - x1;
      const sy = scratchSegs[k + 3] - y1;
      const den = dx * sy - dy * sx;
      if (den > -1e-12 && den < 1e-12) continue;
      const qx = x1 - ox;
      const qy = y1 - oy;
      const tt = (qx * sy - qy * sx) / den;
      if (tt < 0) continue;
      const uu = (qx * dy - qy * dx) / den;
      if (uu < 0 || uu > 1) continue;
      if (tt < t) t = tt;
    }
    const d = t < range ? Math.min(t + extend, range) : range * 1.0;
    result[i * 2] = ox + dx * d;
    result[i * 2 + 1] = oy + dy * d;
  }
}

/**
 * Ascending in-place quicksort of a[lo..hi] (median of three, insertion sort
 * for short runs). Angles are finite and >= 0, so the order equals
 * Float64Array#sort's exactly.
 */
function sortAscending(a, lo, hi) {
  while (hi - lo > 16) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < a[lo]) swap(a, mid, lo);
    if (a[hi] < a[lo]) swap(a, hi, lo);
    if (a[hi] < a[mid]) swap(a, hi, mid);
    const pivot = a[mid];
    let i = lo;
    let j = hi;
    while (i <= j) {
      while (a[i] < pivot) i++;
      while (a[j] > pivot) j--;
      if (i <= j) swap(a, i++, j--);
    }
    // Recurse into the smaller half, loop on the larger (bounded stack).
    if (j - lo < hi - i) {
      sortAscending(a, lo, j);
      lo = i;
    } else {
      sortAscending(a, i, hi);
      hi = j;
    }
  }
  for (let i = lo + 1; i <= hi; i++) {
    const v = a[i];
    let j = i - 1;
    while (j >= lo && a[j] > v) {
      a[j + 1] = a[j];
      j--;
    }
    a[j + 1] = v;
  }
}

function swap(a, i, j) {
  const t = a[i];
  a[i] = a[j];
  a[j] = t;
}

/**
 * Can `viewer` (unit) see a body at (tx, ty)? Bodies have shoulders: besides
 * center-to-center, LOS also counts from the viewer's center to the target's
 * shoulders AND from the viewer's shoulders to the target's center. That set
 * of rays is the same seen from either side, so sight is symmetric: if a
 * shoulder pokes out of a corner, both men can see each other (the fair
 * "peek"); only the field of view differs.
 */
export function canSee(world, viewer, tx, ty, cfg) {
  const dx = tx - viewer.x;
  const dy = ty - viewer.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > cfg.range * cfg.range) return false;
  const aware = VISION.awarenessRadius;
  if (d2 > aware * aware) {
    const off = Math.abs(angleDiff(viewer.facing, datan2(dy, dx)));
    if (off > cfg.fov / 2) return false;
  }
  const len = Math.sqrt(d2) || 1;
  const px = (-dy / len) * VISION.probeOffset;
  const py = (dx / len) * VISION.probeOffset;
  const segs = world.segments;
  const c = world.segmentCount;
  const vx = viewer.x;
  const vy = viewer.y;
  if (!segmentBlocked(segs, c, vx, vy, tx, ty)) return true;
  if (!segmentBlocked(segs, c, vx, vy, tx + px, ty + py)) return true;
  if (!segmentBlocked(segs, c, vx, vy, tx - px, ty - py)) return true;
  if (!segmentBlocked(segs, c, vx + px, vy + py, tx, ty)) return true;
  return !segmentBlocked(segs, c, vx - px, vy - py, tx, ty);
}

/** Plain LOS between two points (no FOV). */
export function lineOfSight(world, ax, ay, bx, by) {
  return !segmentBlocked(world.segments, world.segmentCount, ax, ay, bx, by);
}

/** Line of sight through walls, props and doors only (smoke ignored): blasts and flashes reach through a cloud. */
export function solidLineOfSight(world, ax, ay, bx, by) {
  return !segmentBlocked(world.segments, world.solidCount, ax, ay, bx, by);
}
