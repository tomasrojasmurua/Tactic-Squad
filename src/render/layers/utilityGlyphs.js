// Pictograms drawn with the overlay's shapes (render/gl/ShapeBatch.js): a grenade of each kind
// (a dark badge with its outline in the item's color, so it reads at a glance on any floor) and a
// boarded-up doorway. Sizes are in metres; the callers scale them by metres per pixel so they keep
// their size on screen whatever the zoom.
import { OVERLAY } from '../../config/render.js';
import { rgba, BLACK } from './overlayColors.js';

const OLIVE = [0.4, 0.48, 0.24];
const STEEL = [0.72, 0.74, 0.76];
const DARK = [0.08, 0.09, 0.1];
const WOOD = [0.58, 0.38, 0.19];
const WOOD_LIGHT = [0.8, 0.58, 0.32];
const NAIL = [0.85, 0.86, 0.88];

const col = (c, a) => rgba(c[0], c[1], c[2], a);

/** A box between (x0, y0) and (x1, y1) in the glyph's unit square, scaled by s around (x, y). */
function box(t, x, y, s, x0, y0, x1, y1, c) {
  t.quad(x + x0 * s, y + y0 * s, x + x1 * s, y + y0 * s, x + x1 * s, y + y1 * s, x + x0 * s, y + y1 * s, c);
}

/**
 * A grenade of `kind` ('frag' | 'flash' | 'smoke' | 'molotov' | 'gas') at (x, y): a badge of radius
 * ~1.25 s with the item's pictogram inside. `badge` false: the pictogram alone (a grenade in flight).
 */
export function grenadeGlyph(t, x, y, kind, s, alpha = 1, badge = true) {
  const c = OVERLAY.entryColors[kind] || [1, 1, 1];
  if (badge) {
    t.circle(x, y, s * 1.3, BLACK(0.8 * alpha), 20);
    t.ring(x, y, s * 1.18, s * 0.16, col(c, 0.95 * alpha), 24);
  }
  const ink = BLACK(0.85 * alpha);
  if (kind === 'frag') {
    // The classic pineapple: a ridged oval body, the fuse on top, the lever and the pin's ring.
    t.circle(x, y + s * 0.15, s * 0.6, ink, 16);
    t.circle(x, y + s * 0.15, s * 0.5, col(OLIVE, alpha), 16);
    t.line(x - s * 0.5, y + s * 0.15, x + s * 0.5, y + s * 0.15, s * 0.09, ink);
    t.line(x, y - s * 0.32, x, y + s * 0.62, s * 0.09, ink);
    box(t, x, y, s, -0.18, -0.62, 0.18, -0.36, col(STEEL, alpha));
    t.line(x + s * 0.16, y - s * 0.56, x + s * 0.52, y - s * 0.08, s * 0.12, col(STEEL, alpha));
    t.ring(x - s * 0.38, y - s * 0.62, s * 0.17, s * 0.08, col(STEEL, alpha), 12);
  } else if (kind === 'flash') {
    // A pale canister with its vent holes, and the burst it makes.
    for (const a of [-0.6, 0, 0.6]) {
      const dx = Math.sin(a) * s;
      const dy = -Math.cos(a) * s;
      t.line(x + dx * 0.72, y + dy * 0.72, x + dx * 1.02, y + dy * 1.02, s * 0.1, col(c, alpha));
    }
    box(t, x, y, s, -0.32, -0.4, 0.32, 0.66, ink);
    box(t, x, y, s, -0.24, -0.32, 0.24, 0.58, col([0.94, 0.94, 0.86], alpha));
    box(t, x, y, s, -0.24, -0.5, 0.24, -0.32, col(STEEL, alpha));
    for (const hy of [-0.08, 0.16, 0.4]) t.circle(x, y + hy * s, s * 0.07, ink, 8);
  } else if (kind === 'smoke') {
    // A grey can with its band, a puff rising from it.
    box(t, x, y, s, -0.3, -0.3, 0.3, 0.66, ink);
    box(t, x, y, s, -0.22, -0.22, 0.22, 0.58, col([0.62, 0.64, 0.66], alpha));
    box(t, x, y, s, -0.22, 0.1, 0.22, 0.22, col([0.9, 0.9, 0.9], alpha));
    t.circle(x + s * 0.12, y - s * 0.48, s * 0.2, col([0.88, 0.9, 0.92], 0.9 * alpha), 10);
    t.circle(x - s * 0.18, y - s * 0.62, s * 0.15, col([0.88, 0.9, 0.92], 0.8 * alpha), 10);
  } else if (kind === 'molotov') {
    // A bottle with its rag aflame.
    t.circle(x, y + s * 0.28, s * 0.42, ink, 14);
    t.circle(x, y + s * 0.28, s * 0.34, col([0.55, 0.36, 0.16], alpha), 14);
    box(t, x, y, s, -0.12, -0.42, 0.12, 0.0, col([0.55, 0.36, 0.16], alpha));
    t.tri(x - s * 0.22, y - s * 0.4, x + s * 0.22, y - s * 0.4, x, y - s * 0.95, col(c, alpha));
  } else if (kind === 'gas') {
    // A 40 mm round: the shell, its nose and its band.
    box(t, x, y, s, -0.26, -0.18, 0.26, 0.66, ink);
    box(t, x, y, s, -0.18, -0.12, 0.18, 0.58, col([0.78, 0.8, 0.5], alpha));
    t.tri(x - s * 0.22, y - s * 0.16, x + s * 0.22, y - s * 0.16, x, y - s * 0.62, col([0.78, 0.8, 0.5], alpha));
    box(t, x, y, s, -0.18, 0.18, 0.18, 0.3, ink);
  } else {
    t.circle(x, y, s * 0.4, col(c, alpha), 12);
  }
}

/**
 * A boarded-up doorway (`d`: the compiled doorway): wooden planks nailed across it, one along it and
 * two crossed, each outlined so it reads on any floor. `w`: plank width (m).
 */
export function barricadeBoards(t, d, w, alpha = 1) {
  const tx = d.normalY; // along the wall
  const ty = -d.normalX;
  const h = d.length / 2 + 0.1;
  const n = 0.2; // how far the crossed planks reach into the rooms on either side
  const planks = [
    [-h, 0, h, 0],
    [-h * 0.9, -n, h * 0.9, n],
    [-h * 0.9, n, h * 0.9, -n],
  ];
  const at = (a, b) => [d.cx + tx * a + d.normalX * b, d.cy + ty * a + d.normalY * b];
  for (const [a0, b0, a1, b1] of planks) {
    const [x0, y0] = at(a0, b0);
    const [x1, y1] = at(a1, b1);
    t.line(x0, y0, x1, y1, w * 1.7, BLACK(0.75 * alpha));
  }
  for (const [a0, b0, a1, b1] of planks) {
    const [x0, y0] = at(a0, b0);
    const [x1, y1] = at(a1, b1);
    t.line(x0, y0, x1, y1, w, col(WOOD, alpha));
    t.line(x0, y0, x1, y1, w * 0.3, col(WOOD_LIGHT, 0.8 * alpha)); // the grain catching the light
    for (const [nx, ny] of [[x0, y0], [x1, y1]]) {
      const k = 0.12 / Math.hypot(x1 - x0, y1 - y0);
      const px = nx + (nx === x0 ? 1 : -1) * (x1 - x0) * k;
      const py = ny + (ny === y0 ? 1 : -1) * (y1 - y0) * k;
      t.circle(px, py, w * 0.22, col(NAIL, alpha), 6);
    }
  }
}
