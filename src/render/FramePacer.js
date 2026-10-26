// Decides whether the canvas must be redrawn this frame (battery: a phone
// spends most of a session planning, where nothing moves). The canvas keeps
// its last picture when a frame is skipped.
//   full rate : the sim runs, the camera moves, input in the last moments,
//               a blueprint wipe, a resize, or something marked the frame dirty
//   idle rate : planning / pause / result — only cosmetic loops (route dash
//               flow, selection ticks, bomb LED) — at DISPLAY.idleFps
//   frozen    : the title (an opaque card covers the map) after a few frames
import { DISPLAY } from '../config/render.js';

export class FramePacer {
  constructor() {
    this.dirtyFrames = 2;
    this.inputUntil = 0;
    this.sinceDraw = Infinity;
    this.lastView = new Float32Array(16);
    this.drewLast = false;
    this.draws = 0; // drawn frames (tests compare idle vs. active rates)
    const poke = () => {
      this.inputUntil = performance.now() + DISPLAY.inputAwakeSeconds * 1000;
    };
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'keyup']) {
      window.addEventListener(type, poke, { passive: true, capture: true });
    }
  }

  /** Forces the next frames to draw (round reset, resize, context restored). */
  markDirty(frames = 2) {
    this.dirtyFrames = Math.max(this.dirtyFrames, frames);
  }

  /** True when the camera matrix moved since the last drawn frame. */
  viewChanged(viewProj) {
    const last = this.lastView;
    let changed = false;
    for (let i = 0; i < 16; i++) {
      if (last[i] !== viewProj[i]) {
        changed = true;
        last[i] = viewProj[i];
      }
    }
    return changed;
  }

  /** @returns {boolean} draw this frame */
  shouldDraw(dt, { simulating, phase, transitioning, viewProj }) {
    this.sinceDraw += dt;
    const moved = this.viewChanged(viewProj);
    let draw = simulating || moved || transitioning || this.dirtyFrames > 0 || performance.now() < this.inputUntil;
    if (!draw && phase !== 'title') draw = this.sinceDraw >= 1 / DISPLAY.idleFps;
    if (this.dirtyFrames > 0) this.dirtyFrames--;
    if (draw) {
      this.sinceDraw = 0;
      this.draws++;
    }
    this.drewLast = draw;
    return draw;
  }
}
