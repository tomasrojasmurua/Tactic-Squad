// Scalar / angle helpers shared by every layer. Pure functions, no state.
import { datan2 } from './dmath.js';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Wraps an angle into [-PI, PI). */
export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Signed shortest rotation from `from` to `to`. */
export const angleDiff = (from, to) => wrapAngle(to - from);

export const lerpAngle = (a, b, t) => a + angleDiff(a, b) * t;

/** Rotates `cur` toward `target` by at most `maxDelta` radians. */
export function approachAngle(cur, target, maxDelta) {
  const d = angleDiff(cur, target);
  if (Math.abs(d) <= maxDelta) return wrapAngle(target);
  return wrapAngle(cur + Math.sign(d) * maxDelta);
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

export const angleTo = (ax, ay, bx, by) => datan2(by - ay, bx - ax);

/** '#rrggbb' -> [r, g, b] in 0..1 */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

