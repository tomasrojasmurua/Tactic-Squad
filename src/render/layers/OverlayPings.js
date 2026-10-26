// Short-lived feedback rings on the tactical overlay (real time, so they
// also play while planning/paused): selection, waypoint placed, facing set,
// GO hold, route cleared, GO released, door breached, enemy down.
// Pooled records, drawn into the overlay's top ShapeBatch.
import { PINGS } from '../../config/render.js';

const POOL = 48;
const SIDES = [-1, 1];

export class OverlayPings {
  constructor() {
    this.list = [];
    this.free = [];
    for (let i = 0; i < POOL; i++) this.free.push({ x: 0, y: 0, kind: '', unitId: -1, t0: 0 });
  }

  clear() {
    while (this.list.length) this.free.push(this.list.pop());
  }

  add(x, y, kind, unitId, time) {
    const p = this.free.pop() || this.list.shift();
    p.x = x;
    p.y = y;
    p.kind = kind;
    p.unitId = unitId;
    p.t0 = time;
    this.list.push(p);
  }

  /**
   * @param t ShapeBatch, time real seconds, mpp meters per pixel,
   * colorOf(unitId) -> rgb or null, posOf(unitId) -> {x, y} or null (follow the unit),
   * rgba(r, g, b, a) pooled color factory.
   */
  draw(t, time, mpp, colorOf, posOf, rgba) {
    let n = 0;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      const spec = PINGS[p.kind];
      const age = time - p.t0;
      if (!spec || age > spec.life || age < 0) {
        this.free.push(p);
        continue;
      }
      this.list[n++] = p;
      const k = age / spec.life;
      const e = 1 - (1 - k) * (1 - k); // ease out
      const fade = 1 - k;
      const c = colorOf(p.unitId) || spec.color;
      let x = p.x;
      let y = p.y;
      if (spec.follow) {
        const pos = posOf(p.unitId);
        if (pos) {
          x = pos.x;
          y = pos.y;
        }
      }
      const r = spec.r0 + (spec.r1 - spec.r0) * e;
      const w = spec.widthPx * mpp * (1 - 0.5 * k);
      t.ring(x, y, r, w + 1.5 * mpp, rgba(0, 0, 0, 0.35 * fade), 40);
      t.ring(x, y, r, w, rgba(c[0], c[1], c[2], fade), 40);
      if (p.kind === 'select') this.brackets(t, x, y, r + 0.12, mpp, c, fade, rgba);
      else if (p.kind === 'kill' || p.kind === 'clear') this.cross(t, x, y, 0.22, 3 * mpp, c, fade, rgba);
      else if (p.kind === 'go') t.ring(x, y, r * 0.6, w * 0.7, rgba(1, 1, 1, fade * 0.9), 32);
    }
    this.list.length = n;
  }

  /** Four inward-pointing corner ticks that close in on the unit. */
  brackets(t, x, y, r, mpp, c, a, rgba) {
    const w = 3 * mpp;
    for (let i = 0; i < 4; i++) {
      const ang = Math.PI / 4 + (i * Math.PI) / 2;
      const cx = x + Math.cos(ang) * r;
      const cy = y + Math.sin(ang) * r;
      for (const s of SIDES) {
        const a2 = ang + Math.PI + s * 0.75;
        t.line(cx, cy, cx + Math.cos(a2) * 0.16, cy + Math.sin(a2) * 0.16, w, rgba(c[0], c[1], c[2], a));
      }
    }
  }

  cross(t, x, y, r, w, c, a, rgba) {
    t.line(x - r, y - r, x + r, y + r, w, rgba(c[0], c[1], c[2], a));
    t.line(x - r, y + r, x + r, y - r, w, rgba(c[0], c[1], c[2], a));
  }
}
