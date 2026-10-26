// Voice allocation: per-category limits and a global cap, with priority-based
// stealing (the victim fades out in a few ms — no clicks). Keeps firefights
// from turning into mush or saturating the master, and keeps CPU bounded on
// phones. Also counts what happened, for tests and the sound lab. Owner: audio.
import { VOICES } from '../config/audio.js';

export class VoicePool {
  constructor() {
    this.active = [];
    this.stats = { started: 0, stolen: 0, dropped: 0, peak: 0 };
  }

  /** Forgets voices that have finished (compacted in place). */
  sweep(now) {
    let w = 0;
    for (let r = 0; r < this.active.length; r++) {
      const v = this.active[r];
      if (v.end > now) this.active[w++] = v;
    }
    this.active.length = w;
  }

  count(category) {
    let n = 0;
    for (const v of this.active) if (v.category === category) n++;
    return n;
  }

  /**
   * Makes room for a new voice. Returns false if it should not play
   * (everything playing matters more).
   */
  admit(category, now) {
    this.sweep(now);
    const cfg = VOICES.categories[category];
    if (this.count(category) >= cfg.limit) this.steal(this.oldest((v) => v.category === category), now);
    if (this.active.length >= VOICES.max) {
      const victim = this.oldest((v) => VOICES.categories[v.category].priority <= cfg.priority, true);
      if (!victim) {
        this.stats.dropped++;
        return false;
      }
      this.steal(victim, now);
    }
    return true;
  }

  add(voice) {
    this.active.push(voice);
    this.stats.started++;
    if (this.active.length > this.stats.peak) this.stats.peak = this.active.length;
  }

  /** Oldest voice matching `pred`; with `byPriority`, lowest priority first. */
  oldest(pred, byPriority = false) {
    let best = null;
    for (const v of this.active) {
      if (!pred(v)) continue;
      if (!best) best = v;
      else if (byPriority && VOICES.categories[v.category].priority !== VOICES.categories[best.category].priority) {
        if (VOICES.categories[v.category].priority < VOICES.categories[best.category].priority) best = v;
      } else if (v.start < best.start) best = v;
    }
    return best;
  }

  steal(v, now) {
    if (!v) return;
    const fade = VOICES.stealFadeSeconds;
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(v.gain.gain.value, now);
      v.gain.gain.linearRampToValueAtTime(0, now + fade);
      v.src.stop(now + fade + 0.005);
    } catch {
      // Already stopped: nothing to fade.
    }
    v.end = now;
    this.active.splice(this.active.indexOf(v), 1);
    this.stats.stolen++;
  }
}
