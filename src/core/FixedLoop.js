// Fixed-timestep loop: the simulation advances in exact `stepSeconds`
// increments (deterministic), rendering happens once per animation frame
// with an interpolation factor `alpha` between the last two sim states.

export class FixedLoop {
  constructor({ stepSeconds, maxFrameSeconds = 0.25, onStep, onFrame }) {
    this.step = stepSeconds;
    this.maxFrame = maxFrameSeconds;
    this.onStep = onStep;
    this.onFrame = onFrame;
    this.accumulator = 0;
    this.simulating = false;
    this.last = 0;
    this.rafId = 0;
    this.tick = this.tick.bind(this);
  }

  start() {
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
  }

  /** When false, time does not advance the simulation (tactical pause). */
  setSimulating(on) {
    this.simulating = on;
  }

  tick(now) {
    const frameDt = Math.min((now - this.last) / 1000, this.maxFrame);
    this.last = now;
    if (this.simulating) {
      this.accumulator += frameDt;
      while (this.accumulator >= this.step) {
        this.onStep(this.step);
        this.accumulator -= this.step;
        if (!this.simulating) {
          this.accumulator = 0;
          break;
        }
      }
    }
    const alpha = this.simulating ? this.accumulator / this.step : 1;
    this.onFrame(frameDt, alpha);
    this.rafId = requestAnimationFrame(this.tick);
  }
}
