// Deterministic seeded RNG (mulberry32). The simulation must only use an
// instance of this class (never Math.random) so rounds are reproducible —
// the foundation for We-Go turns and lockstep multiplayer later.

export class Rng {
  constructor(seed = 1) {
    this.state = (seed >>> 0) || 1;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max] inclusive. */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p) {
    return this.next() < p;
  }

  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }

  /** Approximate standard normal (Irwin–Hall, 4 samples). */
  gauss() {
    return (this.next() + this.next() + this.next() + this.next() - 2) * 1.732;
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
}
