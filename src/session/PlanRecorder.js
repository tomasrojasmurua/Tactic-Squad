// Every order of an attempt, grouped by round phase: segment 0 is the buy,
// 1 the preparation, 2 the first turn's planning, 3 its execution (the GO
// codes called during it, stamped with their step), 4 the second planning,
// and so on (sim/round.js). This is exactly a list of We-Go turn packets —
// what an online match sends and a replay needs.
//
// "Retry" starts a new round on the same seed and, on entering each phase,
// re-issues that phase's orders; a decision phase then ends by itself (the
// same plan replays the same round — fail, understand, change ONE thing,
// try again). A new order in a replayed phase means the plan has diverged:
// the rest of the recording is dropped and the player takes over from there.

export class PlanRecorder {
  constructor() {
    this.segments = [[]]; // orders of each decision phase of the current attempt
    this.replay = []; // segments of the attempt being replayed
    this.replaying = false; // re-issuing (those orders are not a divergence)
  }

  /** Recorded phases still to replay after the current one. */
  get pending() {
    return Math.max(0, this.replay.length - this.segments.length);
  }

  /** Is the current phase a replayed one (it ends by itself)? */
  get replayingPhase() {
    return this.segments.length <= this.replay.length && this.closedInReplay(this.segments.length - 1);
  }

  /** Is the current phase in the recording being replayed (a replayed turn: its GOs are already queued)? */
  get inReplay() {
    return this.segments.length <= this.replay.length;
  }

  closedInReplay(i) {
    // The last recorded segment was never closed (the round ended in its execution).
    return i < this.replay.length - 1;
  }

  /** Logs an order of the current phase. A new one in a replayed phase drops the rest: returns how many phases. */
  record(cmd) {
    let dropped = 0;
    if (!this.replaying && this.replayingPhase) {
      dropped = this.replay.length - this.segments.length + 1;
      this.replay.length = this.segments.length - 1;
    }
    this.segments[this.segments.length - 1].push(cmd);
    return dropped;
  }

  /** The current phase ended: the next orders belong to the next one. */
  advance() {
    this.segments.push([]);
  }

  /** New attempt replaying `segments` (empty: a fresh plan). */
  beginAttempt(segments) {
    this.replay = segments.map((s) => s.slice());
    this.segments = [[]];
  }

  /** On entering a phase: re-issues (through `emit`) its recorded orders. Returns true if a decision phase should end by itself. */
  enterPhase(emit) {
    const i = this.segments.length - 1;
    const seg = this.replay[i];
    if (seg) {
      this.replaying = true;
      for (const cmd of seg) emit(cmd);
      this.replaying = false;
    }
    return this.closedInReplay(i);
  }
}
