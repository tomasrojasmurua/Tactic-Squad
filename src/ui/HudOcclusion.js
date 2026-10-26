// Keeps the HUD off the action: plates (squad, feed, objective, banner, touch
// column) fade while an operator or a seen enemy stands under them, and world
// tags that fall under a plate are hidden. Plate rectangles are measured a
// couple of times per second at the start of the UI frame (layout is clean
// then), never per frame. Owner: visual (look); no flow decisions here.
import { HUD_OCCLUSION } from '../config/ui.js';
import { HEIGHTS } from '../config/render.js';
import { toggle } from './dom.js';

export class HudOcclusion {
  /** @param {HTMLElement[]} plates nodes that may fade */
  constructor(plates) {
    this.plates = plates;
    this.rects = plates.map(() => ({ l: 0, t: 0, r: 0, b: 0, on: false }));
    this.timer = 0;
    this.hits = new Uint8Array(plates.length);
  }

  measure() {
    for (let i = 0; i < this.plates.length; i++) {
      const n = this.plates[i];
      const q = this.rects[i];
      const r = n.getBoundingClientRect();
      q.on = r.width > 0 && r.height > 0;
      q.l = r.left;
      q.t = r.top;
      q.r = r.right;
      q.b = r.bottom;
    }
  }

  /** Index of the plate covering screen point (x, y) with margin m, or -1. */
  plateAt(x, y, m) {
    const rects = this.rects;
    for (let i = 0; i < rects.length; i++) {
      const q = rects[i];
      if (q.on && x > q.l - m && x < q.r + m && y > q.t - m && y < q.b + m) return i;
    }
    return -1;
  }

  update(sim, session, dt, camera) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = HUD_OCCLUSION.measureSeconds;
      this.measure();
    }
    const hits = this.hits;
    hits.fill(0);
    if (session.phase !== 'title') {
      const m = HUD_OCCLUSION.marginPx;
      for (const u of sim.units) {
        if (!u.alive || (u.team !== session.team && !u.seenByEnemy)) continue;
        const s = camera.worldToScreen(u.x, u.y, HEIGHTS.label * 0.5);
        const i = this.plateAt(s.x, s.y, m);
        if (i >= 0) hits[i] = 1;
      }
    }
    for (let i = 0; i < this.plates.length; i++) toggle(this.plates[i], 'occluding', hits[i] === 1);
  }
}
