// Immediate-mode batch of vertex-colored 2D triangles on a horizontal
// plane: lines, polylines, dashes, circles, rings, arcs, fans.
// Vertex = x, y, r, g, b, a. Colors are [r, g, b, a] arrays (0..1).
//
// Hot path (the tactical overlay rebuilds every frame): the primitives write
// straight into the float buffer instead of calling a per-vertex method —
// passing computed doubles to a non-inlined call boxes them (heap garbage).
import { Mesh, FloatBuffer } from './Mesh.js';

const FLOATS_PER_VERTEX = 6;
const TAU = Math.PI * 2;

/** Writes one vertex at d[i..i+5]; returns the next index. Small enough to inline. */
function put(d, i, x, y, c, alpha) {
  d[i] = x;
  d[i + 1] = y;
  d[i + 2] = c[0];
  d[i + 3] = c[1];
  d[i + 4] = c[2];
  d[i + 5] = alpha;
  return i + FLOATS_PER_VERTEX;
}

export class ShapeBatch {
  constructor(gl) {
    this.mesh = new Mesh(gl, [{ loc: 0, size: 2 }, { loc: 1, size: 4 }], { dynamic: true });
    this.buf = new FloatBuffer(1 << 14);
  }

  reset() {
    this.buf.reset();
  }

  /** Reserves room for n vertices; returns the write index. */
  reserve(n) {
    this.buf.ensure(n * FLOATS_PER_VERTEX);
    return this.buf.length;
  }

  vert(x, y, c, alphaMul = 1) {
    const i = this.reserve(1);
    this.buf.length = put(this.buf.data, i, x, y, c, c[3] * alphaMul);
  }

  tri(ax, ay, bx, by, cx, cy, c) {
    let i = this.reserve(3);
    const d = this.buf.data;
    const a = c[3];
    i = put(d, i, ax, ay, c, a);
    i = put(d, i, bx, by, c, a);
    this.buf.length = put(d, i, cx, cy, c, a);
  }

  quad(ax, ay, bx, by, cx, cy, dx, dy, c) {
    let i = this.reserve(6);
    const d = this.buf.data;
    const a = c[3];
    i = put(d, i, ax, ay, c, a);
    i = put(d, i, bx, by, c, a);
    i = put(d, i, cx, cy, c, a);
    i = put(d, i, ax, ay, c, a);
    i = put(d, i, cx, cy, c, a);
    this.buf.length = put(d, i, dx, dy, c, a);
  }

  /** Thick line segment; c2 optional end color (gradient). */
  line(x1, y1, x2, y2, width, c, c2 = c) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return;
    const k = (width * 0.5) / len;
    const nx = -dy * k;
    const ny = dx * k;
    let i = this.reserve(6);
    const d = this.buf.data;
    const a1 = c[3];
    const a2 = c2[3];
    i = put(d, i, x1 + nx, y1 + ny, c, a1);
    i = put(d, i, x2 + nx, y2 + ny, c2, a2);
    i = put(d, i, x2 - nx, y2 - ny, c2, a2);
    i = put(d, i, x1 + nx, y1 + ny, c, a1);
    i = put(d, i, x2 - nx, y2 - ny, c2, a2);
    this.buf.length = put(d, i, x1 - nx, y1 - ny, c, a1);
  }

  /** Polyline with round joints. pts = flat [x0, y0, x1, y1, ...]. */
  polyline(pts, width, c, joints = true) {
    for (let i = 0; i + 3 < pts.length; i += 2) {
      this.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], width, c);
      if (joints && i > 0) this.circle(pts[i], pts[i + 1], width * 0.5, c, 8);
    }
  }

  /** Dashed polyline; `offset` (m) animates the dash pattern along the path. */
  dashed(pts, width, dash, gap, offset, c) {
    const period = dash + gap;
    let walked = -(((offset % period) + period) % period);
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x1 = pts[i], y1 = pts[i + 1], x2 = pts[i + 2], y2 = pts[i + 3];
      const len = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
      if (len < 1e-6) continue;
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      let s = 0;
      while (s < len) {
        const phase = (((walked + s) % period) + period) % period;
        if (phase < dash) {
          const e = Math.min(len, s + Math.max(dash - phase, 1e-4)); // min advance avoids float stalls
          this.line(x1 + ux * s, y1 + uy * s, x1 + ux * e, y1 + uy * e, width, c);
          s = e;
        } else {
          s += Math.max(period - phase, 1e-4);
        }
      }
      walked += len;
    }
  }

  /** Direction chevrons (">") every `spacing` m along a polyline, scrolled by `offset` m. */
  chevrons(pts, spacing, offset, size, width, c) {
    let walked = -(((offset % spacing) + spacing) % spacing);
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x1 = pts[i], y1 = pts[i + 1], x2 = pts[i + 2], y2 = pts[i + 3];
      const len = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
      if (len < 1e-6) continue;
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      // first chevron position on this segment
      let s = (((spacing - (walked % spacing)) % spacing) + spacing) % spacing;
      for (; s < len; s += spacing) {
        if (s < size * 1.2 || len - s < size * 0.5) continue;
        const px = x1 + ux * s, py = y1 + uy * s;
        const bx = px - ux * size, by = py - uy * size;
        this.line(bx - uy * size * 0.8, by + ux * size * 0.8, px, py, width, c);
        this.line(bx + uy * size * 0.8, by - ux * size * 0.8, px, py, width, c);
      }
      walked += len;
    }
  }

  circle(x, y, r, c, segments = 20, edgeColor = c) {
    let i = this.reserve(segments * 3);
    const d = this.buf.data;
    const a = c[3];
    const ae = edgeColor[3];
    let px = x + r;
    let py = y;
    for (let s = 1; s <= segments; s++) {
      const t = (s / segments) * TAU;
      const nx = x + Math.cos(t) * r;
      const ny = y + Math.sin(t) * r;
      i = put(d, i, x, y, c, a);
      i = put(d, i, px, py, edgeColor, ae);
      i = put(d, i, nx, ny, edgeColor, ae);
      px = nx;
      py = ny;
    }
    this.buf.length = i;
  }

  ring(x, y, r, width, c, segments = 32) {
    this.arc(x, y, r, width, 0, TAU, c, segments);
  }

  arc(x, y, r, width, a0, a1, c, segments = 32) {
    const n = Math.max(2, Math.ceil((segments * Math.abs(a1 - a0)) / TAU));
    const ri = r - width / 2;
    const ro = r + width / 2;
    let i = this.reserve(n * 6);
    const d = this.buf.data;
    const a = c[3];
    let c0 = Math.cos(a0);
    let s0 = Math.sin(a0);
    for (let k = 1; k <= n; k++) {
      const t1 = a0 + ((a1 - a0) * k) / n;
      const c1 = Math.cos(t1);
      const s1 = Math.sin(t1);
      // quad (inner0, outer0, outer1, inner1) as two triangles
      i = put(d, i, x + c0 * ri, y + s0 * ri, c, a);
      i = put(d, i, x + c0 * ro, y + s0 * ro, c, a);
      i = put(d, i, x + c1 * ro, y + s1 * ro, c, a);
      i = put(d, i, x + c0 * ri, y + s0 * ri, c, a);
      i = put(d, i, x + c1 * ro, y + s1 * ro, c, a);
      i = put(d, i, x + c1 * ri, y + s1 * ri, c, a);
      c0 = c1;
      s0 = s1;
    }
    this.buf.length = i;
  }

  /** Filled wedge (pie slice) with optional radial gradient. */
  wedge(x, y, r, a0, a1, c, edgeColor = c, segments = 24) {
    const n = Math.max(2, Math.ceil((segments * Math.abs(a1 - a0)) / TAU));
    let i = this.reserve(n * 3);
    const d = this.buf.data;
    const a = c[3];
    const ae = edgeColor[3];
    let px = x + Math.cos(a0) * r;
    let py = y + Math.sin(a0) * r;
    for (let k = 1; k <= n; k++) {
      const t1 = a0 + ((a1 - a0) * k) / n;
      const nx = x + Math.cos(t1) * r;
      const ny = y + Math.sin(t1) * r;
      i = put(d, i, x, y, c, a);
      i = put(d, i, px, py, edgeColor, ae);
      i = put(d, i, nx, ny, edgeColor, ae);
      px = nx;
      py = ny;
    }
    this.buf.length = i;
  }

  /** Triangle fan from (cx, cy) through the flat polygon `pts` (`edge`: the polygon's color, a gradient from `c`). */
  fan(cx, cy, pts, c, closed = false, edge = c) {
    const n = pts.length / 2;
    const last = closed ? n : n - 1;
    if (last <= 0) return;
    let i = this.reserve(last * 3);
    const d = this.buf.data;
    const a = c[3];
    const ae = edge[3];
    for (let k = 0; k < last; k++) {
      const j = (k + 1) % n;
      i = put(d, i, cx, cy, c, a);
      i = put(d, i, pts[k * 2], pts[k * 2 + 1], edge, ae);
      i = put(d, i, pts[j * 2], pts[j * 2 + 1], edge, ae);
    }
    this.buf.length = i;
  }

  arrow(x1, y1, x2, y2, width, head, c) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return;
    const ux = dx / len, uy = dy / len;
    const bx = x2 - ux * head, by = y2 - uy * head;
    this.line(x1, y1, bx, by, width, c);
    this.tri(x2, y2, bx - uy * head * 0.6, by + ux * head * 0.6, bx + uy * head * 0.6, by - ux * head * 0.6, c);
  }

  upload() {
    this.mesh.upload(this.buf.data, this.buf.length);
  }

  draw() {
    this.mesh.draw();
  }
}
