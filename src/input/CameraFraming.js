// Camera shots that respect the HUD (REVIEW-1 #9): the first shot of a round,
// "see all" (whole map inside the screen area the HUD leaves free — the HUD
// margins come from config/ui.js HUD_SAFE, kept by the visual specialist)
// and centering on an operator. The "see all" height may exceed
// CAMERA.maxHeight: pinch zoom (zoomImmediate) and the mouse wheel (Camera.zoomOutLimit) reach it.
import { CAMERA } from '../config/render.js';
import { HUD_SAFE, FLOW, KILLCAM } from '../config/ui.js';
import { clamp } from '../core/math.js';

export class CameraFraming {
  constructor({ camera, session, mapDef }) {
    this.camera = camera;
    this.session = session;
    this.mapDef = mapDef;
    this.saved = null; // view to return to when "see all" is toggled off
    camera.zoomOutLimit = () => this.maxHeight; // the wheel also zooms out to the whole map
  }

  insets() {
    return this.session.touch ? HUD_SAFE.phone : HUD_SAFE.desktop;
  }

  /** Height (m) at which a world rect w×h fits the free screen area (`m`: its margins in px). */
  fitHeight(w, h, m = this.insets()) {
    const cam = this.camera;
    const freeW = Math.max(1, cam.width - m.left - m.right);
    const freeH = Math.max(1, cam.heightPx - m.top - m.bottom);
    const mpp = Math.max(w / freeW, h / freeH); // meters per pixel needed
    return (mpp * cam.heightPx) / (2 * cam.tanHalf);
  }

  /** Tallest allowed height: the configured maximum or the whole-map shot, whichever is higher. */
  get maxHeight() {
    const s = this.mapDef.size;
    const pad = 2 * FLOW.framePaddingM;
    return Math.max(CAMERA.maxHeight, this.fitHeight(s.w + pad, s.h + pad));
  }

  /** Puts world point (x, y) at the center of the free area, at height h. */
  placeAt(x, y, h, m = this.insets()) {
    const cam = this.camera;
    const mpp = (2 * cam.tanHalf * h) / cam.heightPx;
    cam.jumpTo(x - ((m.left - m.right) / 2) * mpp, y - ((m.top - m.bottom) / 2) * mpp, h);
  }

  /** Frames a world rect [x, y, w, h] (padded) inside the free area. */
  frameRect(r) {
    const pad = FLOW.framePaddingM;
    this.placeAt(r[0] + r[2] / 2, r[1] + r[3] / 2, this.fitHeight(r[2] + 2 * pad, r[3] + 2 * pad));
  }

  /** First shot of a round: the map's `camera.frame` rect (squad + first rooms; a defender: `defendFrame`, their half), never under the HUD. */
  frameStart() {
    this.saved = null;
    const c = this.mapDef.camera;
    const frame = this.session.team === 'defenders' && c.defendFrame ? c.defendFrame : c.frame;
    if (frame) this.frameRect(frame);
    else this.placeAt(c.start[0], c.start[1], c.height);
  }

  /** "See all": the whole map (site A included) inside the free area; again = back to the previous view. */
  toggleOverview() {
    const cam = this.camera;
    if (this.saved) {
      cam.jumpTo(this.saved.x, this.saved.y, this.saved.h);
      this.saved = null;
      return;
    }
    this.saved = { x: cam.x, y: cam.y, h: cam.targetHeight };
    const s = this.mapDef.size;
    this.frameRect([0, 0, s.w, s.h]);
  }

  /** Is world point (x, y) on screen and outside the HUD margins (with `marginPx` to spare)? */
  inFreeArea(x, y, marginPx = 40) {
    const cam = this.camera;
    const m = this.insets();
    const p = cam.worldToScreen(x, y, 0);
    return p.x >= m.left + marginPx && p.x <= cam.width - m.right - marginPx && p.y >= m.top + marginPx && p.y <= cam.heightPx - m.bottom - marginPx;
  }

  /** Brings a point into the free area (keeps the zoom) unless it is already well inside it. */
  reveal(x, y) {
    if (!this.inFreeArea(x, y)) this.centerOn(x, y);
  }

  /** Drone phase: keeps the drone in the middle of the free area (snap: at once). The zoom stays the player's. */
  followDrone(sim, dt, snap = false) {
    const d = sim.drone;
    if (!d) return;
    const cam = this.camera;
    if (snap) {
      this.saved = null;
      this.placeAt(d.x, d.y, FLOW.droneCameraHeight);
      return;
    }
    const m = this.insets();
    const mpp = (2 * cam.tanHalf * cam.height) / cam.heightPx;
    const tx = d.x - ((m.left - m.right) / 2) * mpp;
    const ty = d.y - ((m.top - m.bottom) / 2) * mpp;
    const k = 1 - Math.exp(-FLOW.droneFollow * dt);
    cam.pan((tx - cam.x) * k, (ty - cam.y) * k);
  }

  /**
   * Kill cam: eases toward the shot that keeps every point ([x, y]) inside
   * the screen (KILLCAM.insets: the HUD is hidden but for the clip's bar),
   * KILLCAM.padM m to spare, never closer than KILLCAM.height. snap: at once.
   */
  followPoints(points, dt, snap = false) {
    if (!points.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of points) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const cam = this.camera;
    const m = KILLCAM.insets;
    const pad = 2 * KILLCAM.padM;
    const h = clamp(this.fitHeight(x1 - x0 + pad, y1 - y0 + pad, m), KILLCAM.height, this.maxHeight);
    const mpp = (2 * cam.tanHalf * h) / cam.heightPx;
    const tx = (x0 + x1) / 2 - ((m.left - m.right) / 2) * mpp;
    const ty = (y0 + y1) / 2 - ((m.top - m.bottom) / 2) * mpp;
    this.saved = null;
    if (snap) {
      cam.jumpTo(tx, ty, h);
      return;
    }
    const k = 1 - Math.exp(-KILLCAM.follow * dt);
    cam.jumpTo(cam.x + (tx - cam.x) * k, cam.y + (ty - cam.y) * k, cam.height + (h - cam.height) * k);
  }

  centerOn(x, y) {
    this.saved = null;
    this.placeAt(x, y, this.camera.targetHeight);
  }

  /** Pinch zoom keeping the point under (px, py) fixed, limited to [minHeight, maxHeight]. */
  zoomImmediate(factor, px, py) {
    const cam = this.camera;
    const before = cam.screenToWorld(px, py, 0);
    cam.jumpTo(cam.x, cam.y, clamp(cam.height * factor, CAMERA.minHeight, this.maxHeight));
    const after = cam.screenToWorld(px, py, 0);
    cam.pan(before.x - after.x, before.y - after.y);
    if (factor < 1) this.saved = null; // zooming in leaves the overview
  }
}
