// 2D geometry used by simulation (LOS, bullets, collisions) and render.
// Segment lists are flat Float64Array/Array: [x1, y1, x2, y2, ...].

/** Ray o + d·t vs segment. Returns t >= 0 or Infinity. d need not be unit. */
export function raySegment(ox, oy, dx, dy, x1, y1, x2, y2) {
  const sx = x2 - x1;
  const sy = y2 - y1;
  const den = dx * sy - dy * sx;
  if (den > -1e-12 && den < 1e-12) return Infinity;
  const qx = x1 - ox;
  const qy = y1 - oy;
  const t = (qx * sy - qy * sx) / den;
  if (t < 0) return Infinity;
  const u = (qx * dy - qy * dx) / den;
  if (u < 0 || u > 1) return Infinity;
  return t;
}

/** Closest hit parameter along the ray among all segments, capped at maxT. */
export function rayCast(segs, count, ox, oy, dx, dy, maxT) {
  let best = maxT;
  for (let i = 0; i < count; i += 4) {
    const t = raySegment(ox, oy, dx, dy, segs[i], segs[i + 1], segs[i + 2], segs[i + 3]);
    if (t < best) best = t;
  }
  return best;
}

/**
 * True if the straight segment a->b crosses any segment. Same answer as
 * `rayCast(...) < 1 - 1e-6`, but stops at the first blocker (LOS hot path).
 */
export function segmentBlocked(segs, count, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const limit = 1 - 1e-6;
  for (let i = 0; i < count; i += 4) {
    if (raySegment(ax, ay, dx, dy, segs[i], segs[i + 1], segs[i + 2], segs[i + 3]) < limit) return true;
  }
  return false;
}

/** Ray (unit direction) vs circle. Returns entry t or Infinity. */
export function rayCircle(ox, oy, dx, dy, cx, cy, r) {
  const fx = ox - cx;
  const fy = oy - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const s = Math.sqrt(disc);
  const t0 = -b - s;
  if (t0 >= 0) return t0;
  const t1 = -b + s;
  return t1 >= 0 ? 0 : Infinity;
}

/** Push vector that moves a circle out of an AABB, or null if no overlap. */
export function circleAabbPush(cx, cy, r, box, out = { x: 0, y: 0 }) {
  const nx = cx < box.minX ? box.minX : cx > box.maxX ? box.maxX : cx;
  const ny = cy < box.minY ? box.minY : cy > box.maxY ? box.maxY : cy;
  const dx = cx - nx;
  const dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    const k = (r - d) / d;
    out.x = dx * k;
    out.y = dy * k;
    return out;
  }
  // Center inside the box: push out along the shallowest axis.
  const left = cx - box.minX + r;
  const right = box.maxX - cx + r;
  const up = cy - box.minY + r;
  const down = box.maxY - cy + r;
  const m = Math.min(left, right, up, down);
  out.x = m === left ? -left : m === right ? right : 0;
  out.y = m === left || m === right ? 0 : m === up ? -up : down;
  return out;
}

/** Distance from a point to an AABB (0 if inside). */
export function pointAabbDistance(x, y, box) {
  const dx = Math.max(box.minX - x, 0, x - box.maxX);
  const dy = Math.max(box.minY - y, 0, y - box.maxY);
  return Math.sqrt(dx * dx + dy * dy);
}

export const pointInBox = (x, y, b) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;

export function boxFromRect([x, y, w, h]) {
  return { minX: x, minY: y, maxX: x + w, maxY: y + h };
}

/** Appends the 4 edges of a box to a flat segment array. */
export function pushBoxEdges(out, b) {
  out.push(b.minX, b.minY, b.maxX, b.minY);
  out.push(b.maxX, b.minY, b.maxX, b.maxY);
  out.push(b.maxX, b.maxY, b.minX, b.maxY);
  out.push(b.minX, b.maxY, b.minX, b.minY);
}

/** Squared distance from point to segment. */
export function pointSegDist2(px, py, x1, y1, x2, y2) {
  const sx = x2 - x1;
  const sy = y2 - y1;
  const l2 = sx * sx + sy * sy;
  let t = l2 > 0 ? ((px - x1) * sx + (py - y1) * sy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = x1 + sx * t - px;
  const dy = y1 + sy * t - py;
  return dx * dx + dy * dy;
}
