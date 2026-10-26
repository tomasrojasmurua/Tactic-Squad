// Every order of an attempt, stamped with the sim tick it applies at: the
// ones given in planning (tick 0) AND the corrections given in tactical pause
// or while time runs. "Retry" re-issues the planning orders at once and the
// rest exactly at their ticks, with the same seed, so the same plan replays
// the same round — fail, understand, change ONE thing, try again. The same
// tick-stamped list is what a We-Go turn exchange or a replay needs.
//
// Orders apply at the start of the step whose tick they carry: a paused or
// running order is flushed before the next step (sim.tick at emission), and
// a scheduled one is enqueued right before that step — the same instant.

export class PlanRecorder {
  constructor() {
    this.log = []; // [{tick, cmd}] of the current attempt
    this.schedule = []; // [{tick, cmd}] still to re-issue (tick > 0), in order
    this.next = 0;
    this.replaying = false;
  }

  /** Recorded orders still to be re-issued in this attempt. */
  get pending() {
    return this.schedule.length - this.next;
  }

  /**
   * Logs an order. A new live order (tick > 0, not a replayed one) while
   * recorded orders are still pending means the plan has diverged: the rest
   * of the recording is dropped. Returns how many were dropped.
   */
  record(cmd, tick) {
    let dropped = 0;
    if (!this.replaying && tick > 0 && this.pending > 0) {
      dropped = this.pending;
      this.schedule.length = this.next;
    }
    this.log.push({ tick, cmd });
    return dropped;
  }

  /** Starts a new attempt from `log`: returns the tick-0 orders to issue now; later ones are scheduled. */
  beginAttempt(log) {
    this.log = [];
    this.schedule = [];
    this.next = 0;
    const now = [];
    for (const e of log) (e.tick > 0 ? this.schedule : now).push(e.tick > 0 ? e : e.cmd);
    return now;
  }

  /** Before each fixed step: re-issues (through `emit`) the recorded orders due at `tick`. */
  due(tick, emit) {
    if (this.next >= this.schedule.length || this.schedule[this.next].tick > tick) return;
    this.replaying = true;
    while (this.next < this.schedule.length && this.schedule[this.next].tick <= tick) emit(this.schedule[this.next++].cmd);
    this.replaying = false;
  }
}
