// Builds flat-shaded low-poly geometry for the `lit` shader.
// Vertex = position(3) normal(3) color(3) edgeDistance(1).
// Each convex face is emitted as a fan from its centroid; the centroid
// vertex carries its perpendicular distance to that triangle's outer edge,
// so the interpolated value is the exact distance to the face border —
// the fragment shader turns it into crisp "comic" outlines.
import { hexToRgb } from '../../core/math.js';

export const LIT_LAYOUT = [
  { loc: 0, size: 3 },
  { loc: 1, size: 3 },
  { loc: 2, size: 3 },
  { loc: 3, size: 1 },
];

const toRgb = (c) => (typeof c === 'string' ? hexToRgb(c) : c);

export class MeshBuilder {
  constructor() {
    this.v = [];
    this.tx = 0;
    this.ty = 0;
    this.tz = 0;
    this.cos = 1;
    this.sin = 0;
  }

  /** Subsequent primitives are rotated by yaw then translated. */
  setTransform(x = 0, y = 0, yaw = 0, z = 0) {
    this.tx = x;
    this.ty = y;
    this.tz = z;
    this.cos = Math.cos(yaw);
    this.sin = Math.sin(yaw);
    return this;
  }

  xf(p) {
    return [this.tx + p[0] * this.cos - p[1] * this.sin, this.ty + p[0] * this.sin + p[1] * this.cos, this.tz + p[2]];
  }

  xn(n) {
    return [n[0] * this.cos - n[1] * this.sin, n[0] * this.sin + n[1] * this.cos, n[2]];
  }

  /** Convex polygon in local space (any winding) with explicit normal. */
  face(points, normal, color) {
    const rgb = toRgb(color);
    const pts = points.map((p) => this.xf(p));
    const n = this.xn(normal);
    let cx = 0, cy = 0, cz = 0;
    for (const p of pts) {
      cx += p[0];
      cy += p[1];
      cz += p[2];
    }
    cx /= pts.length;
    cy /= pts.length;
    cz /= pts.length;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const d = distToLine([cx, cy, cz], a, b);
      this.vertex([cx, cy, cz], n, rgb, d);
      this.vertex(a, n, rgb, 0);
      this.vertex(b, n, rgb, 0);
    }
    return this;
  }

  vertex(p, n, c, e) {
    this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], e);
  }

  /** Box centered at (x, y) in local space, from z0 to z0 + h. */
  box(x, y, z0, w, d, h, color, { top = color, sides = color, yaw = 0 } = {}) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const corner = (lx, ly) => [x + lx * c - ly * s, y + lx * s + ly * c];
    const hw = w / 2, hd = d / 2;
    const q = [corner(-hw, -hd), corner(hw, -hd), corner(hw, hd), corner(-hw, hd)];
    const z1 = z0 + h;
    this.face(q.map((p) => [p[0], p[1], z1]), [0, 0, 1], top);
    for (let i = 0; i < 4; i++) {
      const a = q[i];
      const b = q[(i + 1) % 4];
      const nx = b[1] - a[1];
      const ny = -(b[0] - a[0]);
      const len = Math.hypot(nx, ny);
      this.face([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], [nx / len, ny / len, 0], sides);
    }
    return this;
  }

  /** Extruded convex polygon (local 2D points) from z0 to z1. */
  prism(poly, z0, z1, color, { top = color } = {}) {
    this.face(poly.map((p) => [p[0], p[1], z1]), [0, 0, 1], top);
    const ccw = signedArea(poly) > 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      let nx = b[1] - a[1];
      let ny = -(b[0] - a[0]);
      if (!ccw) {
        nx = -nx;
        ny = -ny;
      }
      const len = Math.hypot(nx, ny) || 1;
      this.face([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], [nx / len, ny / len, 0], color);
    }
    return this;
  }

  cylinder(x, y, z0, r, h, color, { sides = 10, top = color, phase = 0 } = {}) {
    return this.prism(ngon(x, y, r, sides, phase), z0, z0 + h, color, { top });
  }

  /** Tapered n-gon (bottom radius r0, top radius r1): bushes, pots, helmets. */
  frustum(x, y, z0, r0, r1, h, color, { sides = 8, top = color, phase = 0, sx = 1, sy = 1 } = {}) {
    const lo = ngon(0, 0, r0, sides, phase).map(([px, py]) => [x + px * sx, y + py * sy]);
    const hi = ngon(0, 0, r1, sides, phase).map(([px, py]) => [x + px * sx, y + py * sy]);
    const z1 = z0 + h;
    this.face(hi.map((p) => [p[0], p[1], z1]), [0, 0, 1], top);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const a = [lo[i][0], lo[i][1], z0];
      const b = [lo[j][0], lo[j][1], z0];
      const c = [hi[j][0], hi[j][1], z1];
      const d = [hi[i][0], hi[i][1], z1];
      const n = faceNormal(a, b, c, x, y);
      this.face([a, b, c, d], n, color);
    }
    return this;
  }

  /** Flat polygon lying at height z (no sides). */
  flat(poly, z, color) {
    return this.face(poly.map((p) => [p[0], p[1], z]), [0, 0, 1], color);
  }

  toFloat32() {
    return new Float32Array(this.v);
  }
}

export function ngon(x, y, r, sides, phase = 0) {
  const out = [];
  for (let i = 0; i < sides; i++) {
    const a = phase + (i / sides) * Math.PI * 2;
    out.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return out;
}

/** Outward-ish normal of a face (a, b, c counter-clockwise seen from outside, z up). */
function faceNormal(a, b, c, ox, oy) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const mx = (a[0] + c[0]) / 2 - ox, my = (a[1] + c[1]) / 2 - oy;
  // ngon() winds counter-clockwise; flip so the normal points away from the axis.
  if (nx * mx + ny * my < 0 && Math.hypot(nx, ny) > 1e-6) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

function signedArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

function distToLine(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const cx = ab[1] * ap[2] - ab[2] * ap[1];
  const cy = ab[2] * ap[0] - ab[0] * ap[2];
  const cz = ab[0] * ap[1] - ab[1] * ap[0];
  return Math.hypot(cx, cy, cz) / (Math.hypot(ab[0], ab[1], ab[2]) || 1);
}
