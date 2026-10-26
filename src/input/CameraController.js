// Camera navigation: WASD/arrows, screen-edge scrolling, middle-mouse drag
// pan and wheel zoom toward the cursor.
import { KEYS, CAMERA_CONTROLS as CAMERA } from '../config/input.js';
import { matches } from './InputManager.js';

export class CameraController {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;
    this.drag = null;
    this.enabled = true;
  }

  onPointerDown(e) {
    if (e.button !== 1) return false;
    this.drag = { x: e.x, y: e.y };
    return true;
  }

  onPointerMove(e) {
    if (!this.drag) return false;
    const mpp = this.camera.metersPerPixel(0);
    this.camera.pan(-(e.x - this.drag.x) * mpp, -(e.y - this.drag.y) * mpp);
    this.drag = { x: e.x, y: e.y };
    return true;
  }

  onPointerUp(e) {
    if (e.button === 1 && this.drag) {
      this.drag = null;
      return true;
    }
    return false;
  }

  onWheel(e) {
    const factor = e.deltaY > 0 ? CAMERA.zoomStep : 1 / CAMERA.zoomStep;
    this.camera.zoomAt(factor, e.x, e.y);
    return true;
  }

  onKeyDown(e) {
    if (matches(KEYS.zoomIn, e.code)) {
      this.camera.zoomAt(1 / CAMERA.zoomStep, this.camera.width / 2, this.camera.heightPx / 2);
      return true;
    }
    if (matches(KEYS.zoomOut, e.code)) {
      this.camera.zoomAt(CAMERA.zoomStep, this.camera.width / 2, this.camera.heightPx / 2);
      return true;
    }
    return false;
  }

  update(dt) {
    if (!this.enabled) return;
    const cam = this.camera;
    const speed = CAMERA.panSpeed * cam.metersPerPixel(0) * cam.heightPx * dt;
    let dx = 0;
    let dy = 0;
    const down = (binding) => binding.some((c) => this.input.isDown(c));
    if (down(KEYS.panLeft)) dx -= 1;
    if (down(KEYS.panRight)) dx += 1;
    if (down(KEYS.panUp)) dy -= 1;
    if (down(KEYS.panDown)) dy += 1;
    const m = this.input.mouse;
    if (CAMERA.edgeScrollEnabled && m.inside && m.real && !this.drag) {
      const edge = CAMERA.edgeScrollPx;
      if (m.x < edge) dx -= 1;
      if (m.x > cam.width - edge) dx += 1;
      if (m.y < edge) dy -= 1;
      if (m.y > cam.heightPx - edge) dy += 1;
    }
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      cam.pan((dx / len) * speed, (dy / len) * speed);
    }
  }
}
