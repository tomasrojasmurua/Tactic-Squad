// Pooled RGBA colors for the overlay's immediate-mode batches (no per-frame
// allocation). A pooled color is valid until 16 more are requested, which is
// always enough because ShapeBatch consumes colors immediately.
const POOL_SIZE = 16;
const colorPool = Array.from({ length: POOL_SIZE }, () => [0, 0, 0, 0]);
let poolIndex = 0;
export function rgba(r, g, b, a) {
  const c = colorPool[poolIndex];
  poolIndex = (poolIndex + 1) % POOL_SIZE;
  c[0] = r;
  c[1] = g;
  c[2] = b;
  c[3] = a;
  return c;
}
export const BLACK = (a) => rgba(0, 0, 0, a);
export const WHITE = (a) => rgba(1, 1, 1, a);
export const RED = (a) => rgba(1, 0.22, 0.18, a);
export const ORANGE = (a) => rgba(1, 0.62, 0.12, a);
export const withAlpha = (rgb, a) => rgba(rgb[0], rgb[1], rgb[2], a);
