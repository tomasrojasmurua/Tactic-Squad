// Hash of a Simulation's state: every client of an online match computes it at the end of each
// turn and the server compares them (a difference = the clocks of two phones drifted apart, and
// the match resyncs from a snapshot). Walks the sim's plain data and hashes the exact bits of
// every number, so two engines that round differently give different hashes.
// Skips what is static or derived: the compiled map, the world's grid, the event queue.
import { stateOf } from './snapshot.js';

const buf = new DataView(new ArrayBuffer(8));

/** FNV-1a over 32-bit words (cheap, stable, no dependencies). */
class Hasher {
  constructor() {
    this.h = 0x811c9dc5;
  }

  word(w) {
    this.h = Math.imul(this.h ^ (w >>> 0), 0x01000193) >>> 0;
  }

  number(n) {
    buf.setFloat64(0, n);
    this.word(buf.getUint32(0));
    this.word(buf.getUint32(4));
  }

  string(s) {
    for (let i = 0; i < s.length; i++) this.word(s.charCodeAt(i));
    this.word(0x2f);
  }
}

function walk(h, v, seen = new Set()) {
  switch (typeof v) {
    case 'number': return h.number(v);
    case 'string': return h.string(v);
    case 'boolean': return h.word(v ? 1 : 2);
    case 'undefined': return h.word(3);
    case 'object': break;
    default: return h.word(4);
  }
  if (v === null) return h.word(5);
  if (seen.has(v)) return h.word(10); // a cycle (an object pointing back at the sim)
  seen.add(v);
  if (Array.isArray(v)) {
    h.word(6 + v.length * 16);
    for (const x of v) walk(h, x, seen);
    return;
  }
  if (v instanceof Set) {
    h.word(7 + v.size * 16);
    for (const x of [...v].sort()) walk(h, x, seen);
    return;
  }
  if (v instanceof Map) {
    h.word(8 + v.size * 16);
    for (const [k, x] of v) {
      walk(h, k, seen);
      walk(h, x, seen);
    }
    return;
  }
  const keys = Object.keys(v);
  h.word(9 + keys.length * 16);
  for (const k of keys) {
    h.string(k);
    walk(h, v[k], seen);
  }
}

/** 32-bit hash (hex) of the sim's state. */
export function hashSim(sim) {
  const h = new Hasher();
  walk(h, stateOf(sim));
  return h.h.toString(16).padStart(8, '0');
}
