// Planning "blueprint" state: how much of the unseen map is drawn as a
// tactical plan (deciding: buy, preparation, a turn's planning) versus the
// black Redie fog (a turn's execution).
// Changes sweep as a circular wipe from the squad (config/render.js BLUEPRINT).
// Produces the vec4 the fog shaders read as uPlan: origin xy, radius, mode.
import { BLUEPRINT } from '../config/render.js';
import { teamUnits } from '../sim/queries.js';

const FAR = 1e5;

const wantsPlan = (phase) => phase === 'title' || phase === 'buy' || phase === 'prep' || phase === 'planning';
const ease = (t) => t * t * (3 - 2 * t);

export class PlanView {
  constructor() {
    this.uniform = new Float32Array([0, 0, FAR, 1]);
    this.on = null; // current target (true = blueprint)
    this.progress = 1; // 0..1 along the running wipe
    this.reach = 1; // m, wipe radius that covers the whole map
  }

  /** Advances the wipe. Returns true while the picture is changing (frame is dirty). */
  update(dt, sim, phase, team) {
    const on = wantsPlan(phase);
    const u = this.uniform;
    if (this.on === null) {
      this.on = on; // first frame: no wipe
      this.settle();
      return true;
    }
    if (on !== this.on) {
      this.on = on;
      this.progress = 0;
      this.origin(sim, team);
    }
    if (this.progress >= 1) return false;
    this.progress = Math.min(1, this.progress + dt / BLUEPRINT.wipeSeconds);
    if (this.progress >= 1) {
      this.settle();
      return true;
    }
    const band = BLUEPRINT.wipeBand;
    u[2] = -band + ease(this.progress) * (this.reach + 2 * band);
    u[3] = on ? 1 : -1; // entering: plan grows out of the squad; leaving: darkness does
    return true;
  }

  settle() {
    this.uniform[2] = this.on ? FAR : -FAR;
    this.uniform[3] = 1;
    this.progress = 1;
  }

  /** Wipe centre = squad centroid; reach = farthest map corner from it. */
  origin(sim, team) {
    let x = 0;
    let y = 0;
    let n = 0;
    for (const m of teamUnits(sim, team)) {
      if (!m.alive) continue;
      x += m.x;
      y += m.y;
      n++;
    }
    const W = sim.compiled.width;
    const H = sim.compiled.height;
    x = n ? x / n : W / 2;
    y = n ? y / n : H / 2;
    this.uniform[0] = x;
    this.uniform[1] = y;
    this.reach = Math.hypot(Math.max(x, W - x), Math.max(y, H - y));
  }
}
