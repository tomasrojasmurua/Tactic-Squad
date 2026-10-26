// Straight-down perspective camera ("cenital con perspectiva leve"): wall
// sides become visible toward the screen edges, like the reference.
// World: x right, y DOWN (map convention), z up toward the camera.
import * as mat4 from '../core/mat4.js';
import { CAMERA } from '../config/render.js';
import { clamp } from '../core/math.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.height = CAMERA.startHeight;
    this.targetHeight = this.height;
    this.zoomAnchor = null; // world point kept under the cursor while zooming
    this.width = 1;
    this.heightPx = 1;
    this.aspect = 1;
    this.fovY = CAMERA.fovY;
    this.tanHalf = Math.tan(CAMERA.fovY / 2);
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.bounds = { w: 40, h: 28 };
    this.view = mat4.create();
    this.proj = mat4.create();
    this.viewProj = mat4.create();
    this.time = 0;
    /** () => tallest height (m) the wheel may reach; set by input/CameraFraming (whole-map shot). Null = CAMERA.maxHeight. */
    this.zoomOutLimit = null;
  }

  setViewport(w, h) {
    this.width = w;
    this.heightPx = h;
    this.aspect = w / Math.max(1, h);
    // Short (phone landscape) screens see a narrower field: same camera
    // heights, but operators keep a thumb-friendly size on screen.
    const k = h < CAMERA.shortScreenPx ? CAMERA.shortScreenZoom : 1;
    this.fovY = 2 * Math.atan(Math.tan(CAMERA.fovY / 2) * k);
    this.tanHalf = Math.tan(this.fovY / 2);
  }

  setBounds(w, h) {
    this.bounds = { w, h };
  }

  jumpTo(x, y, height = this.height) {
    this.x = x;
    this.y = y;
    this.height = this.targetHeight = height;
  }

  addShake(amount) {
    this.shake = Math.min(CAMERA.maxShake, this.shake + amount);
  }

  pan(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.clampToBounds();
  }

  /** Zoom by factor, keeping the world point under (px, py) fixed. */
  zoomAt(factor, px, py) {
    const max = this.zoomOutLimit ? this.zoomOutLimit() : CAMERA.maxHeight;
    this.targetHeight = clamp(this.targetHeight * factor, CAMERA.minHeight, max);
    this.zoomAnchor = { px, py, world: this.screenToWorld(px, py, 0) };
  }

  clampToBounds() {
    const m = CAMERA.mapMargin;
    this.x = clamp(this.x, -m, this.bounds.w + m);
    this.y = clamp(this.y, -m, this.bounds.h + m);
  }

  update(dt) {
    this.time += dt;
    if (Math.abs(this.targetHeight - this.height) > 1e-3) {
      const k = 1 - Math.exp(-CAMERA.zoomSmoothing * dt);
      this.height += (this.targetHeight - this.height) * k;
      if (this.zoomAnchor) {
        const a = this.zoomAnchor;
        const now = this.screenToWorld(a.px, a.py, 0);
        this.x += a.world.x - now.x;
        this.y += a.world.y - now.y;
        this.clampToBounds();
      }
    } else {
      this.zoomAnchor = null;
    }
    this.shake = Math.max(0, this.shake - CAMERA.shakeDecay * this.shake * dt - CAMERA.shakeFloorDecay * dt);
    const s = this.shake * this.shake * CAMERA.shakeGain;
    this.shakeX = (Math.sin(this.time * 71.3) + Math.sin(this.time * 33.1)) * 0.5 * s;
    this.shakeY = (Math.cos(this.time * 63.7) + Math.sin(this.time * 41.9)) * 0.5 * s;
    this.updateMatrices();
  }

  updateMatrices() {
    const cx = this.x + this.shakeX;
    const cy = this.y + this.shakeY;
    const v = this.view;
    v.fill(0);
    // Mirror y so that map +y points down the screen.
    v[0] = 1;
    v[5] = -1;
    v[10] = 1;
    v[12] = -cx;
    v[13] = cy;
    v[14] = -this.height;
    v[15] = 1;
    mat4.perspective(this.proj, this.fovY, this.aspect, CAMERA.nearPlane, this.height + CAMERA.farPadding);
    mat4.multiply(this.viewProj, this.proj, v);
  }

  /** Screen pixel -> world point on the horizontal plane at height z. */
  screenToWorld(px, py, z = 0) {
    const ndcX = (px / this.width) * 2 - 1;
    const ndcY = 1 - (py / this.heightPx) * 2;
    const d = this.height - z;
    return {
      x: this.x + this.shakeX + ndcX * this.tanHalf * this.aspect * d,
      y: this.y + this.shakeY - ndcY * this.tanHalf * d,
    };
  }

  /** World point -> screen pixel. */
  worldToScreen(x, y, z = 0) {
    const d = this.height - z;
    const ndcX = (x - this.x - this.shakeX) / (this.tanHalf * this.aspect * d);
    const ndcY = -(y - this.y - this.shakeY) / (this.tanHalf * d);
    return { x: (ndcX + 1) * 0.5 * this.width, y: (1 - ndcY) * 0.5 * this.heightPx };
  }

  /** Size of one screen pixel in meters at height z. */
  metersPerPixel(z = 0) {
    return (2 * this.tanHalf * (this.height - z)) / this.heightPx;
  }

  /** Visible world rectangle at floor level. */
  visibleRect() {
    const a = this.screenToWorld(0, 0, 0);
    const b = this.screenToWorld(this.width, this.heightPx, 0);
    return { minX: a.x, minY: a.y, maxX: b.x, maxY: b.y };
  }
}
