// Bakes every recipe (audio/recipes/index.js) into mono sample arrays and
// wraps them in AudioBuffers when a context exists. Playback picks a
// variation without immediate repeats from a seeded RNG (no "machine-gun
// effect", same behaviour every session). Owner: audio.
//
// Mobile budget (docs/ARCHITECTURE.md "Rendimiento"): the bake runs in a
// Worker, one group per task, in two tiers: 'plan' (interface, music drums,
// ambience: what title and planning need) starts after the first frame has
// been drawn; 'combat' starts BAKE.combatDelaySeconds after 'plan' is done, or
// at once when a round starts running (startCombat). `lazy` groups (sounds of
// content a round may not have: other weapons) are baked only when a round
// asks for them. Wrapping into AudioBuffers (plus a one-time resample if the
// device rate differs) also runs in small slices, or on demand at the first
// play, so the first tap never stalls. stats() is the one memory metric (the
// sound lab and the game read the same numbers).
import { Rng } from '../core/rng.js';
import { BAKE } from '../config/audio.js';
import { SOUND_GROUPS } from './recipes/index.js';
import { SVF, len, dcBlock, finish, peakOf, hashString, resampleCubic } from './dsp.js';

export class SoundBank {
  /** keepData: keep the raw sample arrays after wrapping (sound lab / analysis only). */
  constructor({ groups = SOUND_GROUPS, keepData = false, rate = BAKE.sampleRate } = {}) {
    this.groups = groups;
    this.rate = rate; // native bake rate (groups without their own `sr`)
    this.keepData = keepData;
    this.byName = new Map(groups.map((g) => [g.name, g]));
    this.priority = new Map(groups.map((g, i) => [g.name, i])); // registry order = bake priority
    const eager = groups.filter((g) => !g.lazy);
    this.planNames = eager.filter((g) => g.tier === 'plan').map((g) => g.name);
    this.combatNames = eager.filter((g) => g.tier !== 'plan').map((g) => g.name);
    this.combatStarted = false;
    this.queue = []; // main-thread fallback queue (priority order)
    this.requested = new Set(); // names asked for (baked or queued)
    this.data = new Map(); // name -> {sr, native, variations, samples, count}
    this.buffers = new Map(); // name -> AudioBuffer[]
    this.unwrapped = []; // names received but not wrapped yet (context attached)
    this.last = new Map(); // name -> index of the last variation played
    this.rng = new Rng(BAKE.seed);
    this.ctx = null;
    this.worker = null;
    this.wrapping = false; // a wrap slice is scheduled
    this.bakeMs = 0; // CPU time spent baking (worker or main thread)
    this.doneAt = 0; // performance.now() when every non-lazy group was baked
    this.tierAt = { start: 0, plan: 0, combat: 0 }; // performance.now() marks (load-time probe)
    this.done = false;
    for (const n of eager) this.requested.add(n.name);
  }

  /** Renders one variation of a group (pure, deterministic). */
  static render(group, index, nativeRate = BAKE.sampleRate) {
    const sr = group.sr || nativeRate;
    const rng = new Rng((hashString(group.name) ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
    const kit = {
      sr,
      rng,
      index,
      vary: (base, rel) => base * (1 + (rng.next() * 2 - 1) * rel),
      buf: (seconds) => new Float32Array(len(sr, seconds)),
    };
    let out = group.render(kit);
    if (group.loop) {
      let mean = 0;
      for (let i = 0; i < out.length; i++) mean += out[i];
      mean /= out.length;
      for (let i = 0; i < out.length; i++) out[i] -= mean;
    } else {
      const lp = new SVF(sr).set(Math.min(BAKE.lowpassHz, sr * 0.45), 0.707);
      for (let i = 0; i < out.length; i++) out[i] = lp.tick(out[i]);
      out = finish(dcBlock(out, sr, BAKE.dcBlockHz), sr, BAKE.tailFloorDb, BAKE.edgeFadeSeconds);
    }
    return out;
  }

  /** Bakes a whole group, all variations normalized by one common factor (pure). */
  static renderGroup(group, nativeRate = BAKE.sampleRate) {
    const variations = [];
    for (let i = 0; i < group.variations; i++) variations.push(SoundBank.render(group, i, nativeRate));
    let peak = 0;
    for (const v of variations) peak = Math.max(peak, peakOf(v));
    const k = peak > 0 ? Math.pow(10, BAKE.peakDb / 20) / peak : 1;
    for (const v of variations) for (let i = 0; i < v.length; i++) v[i] *= k;
    return { sr: group.sr || nativeRate, variations };
  }

  /** Stores a baked group (from this thread or the bake worker). */
  receive(name, sr, variations) {
    const native = !this.byName.get(name)?.sr;
    const entry = { sr, native, variations, samples: variations.reduce((n, v) => n + v.length, 0), count: variations.length };
    this.data.set(name, entry);
    if (this.ctx) {
      this.unwrapped.push(name);
      this.scheduleWrap();
    }
  }

  /** Bakes one group on this thread. */
  bakeHere(name) {
    if (this.data.has(name)) return;
    const { sr, variations } = SoundBank.renderGroup(this.byName.get(name), this.rate);
    this.receive(name, sr, variations);
  }

  /** Synchronous bake of everything, lazy groups included (tests and the sound lab). */
  bakeAll() {
    const t0 = performance.now();
    for (const g of this.groups) this.bakeHere(g.name);
    this.bakeMs += performance.now() - t0;
    this.markDone();
    if (this.ctx) this.wrapPending(Infinity);
    return this;
  }

  /** Starts the background bake once the first frame is on screen (a worker, or main-thread slices). */
  bakeInBackground() {
    const go = () => {
      this.tierAt.start = performance.now();
      this.startWorker();
      this.send(this.planNames);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(go, 0));
    else go();
  }

  startWorker() {
    try {
      this.worker = new Worker(new URL('./bakeWorker.js', import.meta.url), { type: 'module' });
    } catch {
      this.worker = null;
      return;
    }
    this.worker.onerror = () => {
      // Module workers unsupported (older Safari): bake here instead.
      this.worker.terminate();
      this.worker = null;
      this.send([...this.requested].filter((n) => !this.data.has(n)));
    };
    this.worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'group') {
        this.bakeMs += m.ms;
        this.receive(m.name, m.sr, m.variations);
      } else if (m.type === 'idle') this.onIdle();
    };
  }

  /** Queues groups on the worker (or the main-thread fallback). */
  send(names) {
    if (!names.length) return;
    if (this.worker) {
      this.worker.postMessage({ type: 'bake', rate: this.rate, names });
      return;
    }
    const idle = !this.queue.length;
    this.queue.push(...names.filter((n) => !this.queue.includes(n)));
    this.queue.sort((a, b) => this.priority.get(a) - this.priority.get(b));
    if (idle) this.bakeSlices();
  }

  /** Everything queued so far is baked: 'plan' done -> 'combat' soon; 'combat' done -> done. */
  onIdle() {
    if (!this.combatStarted) {
      if (!this.tierAt.plan) this.tierAt.plan = performance.now();
      setTimeout(() => this.startCombat(), BAKE.combatDelaySeconds * 1000);
    } else if (!this.done && this.combatNames.every((n) => this.data.has(n))) {
      this.tierAt.combat = performance.now();
      this.markDone();
    }
  }

  /** Starts the combat tier now (idempotent): called when a round runs, or after the plan tier. */
  startCombat() {
    if (this.combatStarted) return;
    this.combatStarted = true;
    this.send([...this.combatNames, ...[...this.requested].filter((n) => this.byName.get(n)?.lazy && !this.data.has(n))]);
  }

  /** Main-thread fallback: at most BAKE.sliceMs of work per task, yielding in between. */
  bakeSlices() {
    const slice = () => {
      const t0 = performance.now();
      while (this.queue.length && performance.now() - t0 < BAKE.sliceMs) this.bakeHere(this.queue.shift());
      this.bakeMs += performance.now() - t0;
      if (this.queue.length) setTimeout(slice, 0);
      else this.onIdle();
    };
    setTimeout(slice, 0);
  }

  markDone() {
    [this.done, this.doneAt] = [true, performance.now()];
  }

  /** Adds these groups to the bake (lazy content of the current round), at their priority. */
  require(names) {
    const fresh = names.filter((n) => this.byName.has(n) && !this.requested.has(n));
    if (!fresh.length) return;
    for (const n of fresh) this.requested.add(n);
    if (this.combatStarted) this.send(fresh); // else they join the combat tier when it starts
  }

  /**
   * Binds the bank to an AudioContext. Native groups are baked at the
   * context's own rate from now on (the worker is told); what was already
   * baked is wrapped in slices, or on demand by pick().
   */
  attach(ctx) {
    this.ctx = ctx;
    if (ctx.sampleRate !== this.rate) {
      this.rate = ctx.sampleRate;
      if (this.worker) this.worker.postMessage({ type: 'rate', rate: this.rate });
    }
    for (const name of this.data.keys()) this.unwrapped.push(name);
    this.scheduleWrap();
  }

  /** Wraps what is pending in BAKE.sliceMs slices (one timer chain at a time). */
  scheduleWrap() {
    if (this.wrapping) return;
    this.wrapping = true;
    const slice = () => {
      this.wrapPending(BAKE.sliceMs);
      if (this.unwrapped.length) setTimeout(slice, 0);
      else this.wrapping = false;
    };
    setTimeout(slice, 0);
  }

  /** Wraps queued groups for at most `budgetMs`. */
  wrapPending(budgetMs) {
    const t0 = performance.now();
    while (this.unwrapped.length && performance.now() - t0 < budgetMs) this.wrap(this.unwrapped.shift());
  }

  /** AudioBuffers for one group; the raw arrays are then released (memory on phones). */
  wrap(name) {
    const entry = this.data.get(name);
    if (!entry || !entry.variations || this.buffers.has(name)) return;
    // Native groups must match the context rate exactly (cheap playback path).
    const target = entry.native ? this.ctx.sampleRate : entry.sr;
    const loop = !!this.byName.get(name)?.loop;
    const list = entry.variations.map((v) => {
      const data = target === entry.sr ? v : resampleCubic(v, entry.sr, target, loop);
      const b = this.ctx.createBuffer(1, data.length, target);
      b.copyToChannel(data, 0);
      return b;
    });
    this.buffers.set(name, list);
    if (!this.keepData) entry.variations = null;
  }

  /** Playable now (baked, and a context is attached)? */
  has(name) {
    return this.buffers.has(name) || (!!this.ctx && this.data.has(name));
  }

  /** A variation of `name`, never the same one twice in a row (or exactly `variation`). */
  pick(name, variation = -1) {
    let list = this.buffers.get(name);
    if (!list && this.ctx && this.data.has(name)) {
      this.wrap(name); // first play before its slice came: wrap now (one group, ~ms)
      list = this.buffers.get(name);
    }
    if (!list) return null;
    if (variation >= 0) return list[variation % list.length];
    if (list.length === 1) return list[0];
    const prev = this.last.get(name) ?? -1;
    let i = Math.floor(this.rng.next() * (prev < 0 ? list.length : list.length - 1));
    if (prev >= 0 && i >= prev) i++;
    this.last.set(name, i);
    return list[i];
  }

  /**
   * The memory metric (sound lab, game probe and docs read this same report): decoded PCM held
   * for the groups baked so far — what a round with these weapons keeps in memory — split by tier.
   * `extraBytes` adds buffers owned elsewhere (the engine's reverb impulses).
   */
  stats(extraBytes = 0) {
    let samples = 0;
    let seconds = 0;
    let count = 0;
    const tiers = { plan: 0, combat: 0 };
    for (const [name, e] of this.data) {
      // Wrapped groups are counted as the AudioBuffers really held (at the device rate), others as baked.
      const list = this.buffers.get(name);
      const n = list ? list.reduce((a, b) => a + b.length, 0) : e.samples;
      samples += n;
      seconds += list ? list.reduce((a, b) => a + b.duration, 0) : e.samples / e.sr;
      count += e.count;
      tiers[this.byName.get(name)?.tier === 'plan' ? 'plan' : 'combat'] += (n * 4) / 1048576;
    }
    const megabytes = (samples * 4) / 1048576;
    const { start, plan, combat } = this.tierAt;
    const extraMegabytes = extraBytes / 1048576;
    return { groups: this.data.size, buffers: count, seconds, megabytes, tiers, extraMegabytes, totalMegabytes: megabytes + extraMegabytes,
      bakeMs: this.bakeMs, planReadyMs: plan ? plan - start : null, combatReadyMs: combat ? combat - start : null };
  }
}
