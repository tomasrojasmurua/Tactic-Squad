// Dynamic resolution policy (config/render.js DISPLAY.adaptive), pure and
// DOM-free so it can be simulated. Frame intervals are averaged over a window;
// slow windows step the pixel ratio down, sustained fast ones step it up.
// Hysteresis keeps it from oscillating (e.g. a 120 Hz phone that runs 8 ms at
// one ratio and drops to 30 fps at the next): a ratio that was too slow becomes
// a ceiling for `ceilingSeconds` (doubled each time the same ratio fails
// again, up to 8x), and raising needs `raiseAfterWindows` fast windows in a row.
export class AdaptiveResolution {
  constructor(config, ratio) {
    this.c = config;
    this.ratio = ratio;
    this.time = 0;
    this.frames = 0;
    this.fastWindows = 0;
    this.ceiling = Infinity; // highest ratio allowed right now
    this.ceilingAge = 0;
    this.ceilingFor = config.ceilingSeconds;
    this.lastFailed = -1; // ratio that last proved too slow
    this.failures = 0;
  }

  /** Feeds one frame interval (s); returns the pixel ratio to use. */
  update(dt, max) {
    const A = this.c;
    if (!A.enabled || dt > A.hitchSeconds) return Math.min(this.ratio, max); // ignore hitches (tab switches, loading)
    this.time += dt;
    this.frames++;
    this.ceilingAge += dt;
    if (this.ceilingAge >= this.ceilingFor) {
      this.ceiling = Infinity;
      this.ceilingAge = 0;
    }
    if (this.time < A.windowSeconds) return Math.min(this.ratio, max);
    const avgMs = (this.time / this.frames) * 1000;
    this.time = 0;
    this.frames = 0;
    const min = Math.min(max, A.minPixelRatio);
    if (avgMs > A.slowFrameMs) {
      if (this.ratio > min) {
        // The ratio that was too slow stays off-limits for a while (longer if it keeps failing).
        this.failures = this.ratio === this.lastFailed ? this.failures + 1 : 1;
        this.lastFailed = this.ratio;
        this.ceiling = this.ratio - A.step;
        this.ceilingAge = 0;
        this.ceilingFor = A.ceilingSeconds * 2 ** Math.min(this.failures - 1, 3);
      }
      this.ratio = Math.max(min, this.ratio - A.step);
      this.fastWindows = 0;
    } else if (avgMs < A.fastFrameMs) {
      this.fastWindows++;
      const next = Math.min(max, this.ceiling, this.ratio + A.step);
      if (this.fastWindows >= A.raiseAfterWindows && next > this.ratio) {
        this.ratio = next;
        this.fastWindows = 0;
      }
    } else {
      this.fastWindows = 0;
    }
    this.ratio = Math.min(this.ratio, max);
    return this.ratio;
  }
}
