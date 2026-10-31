// What of a Simulation changes during a round, and a snapshot of it that another phone restores
// (online, when the hashes of two phones differ: everyone takes the host's state and goes on).
//
// The rest — the compiled map, the world's grid, the frozen config objects (weapons, classes) —
// is rebuilt: the receiver builds a fresh Simulation with the round's options and pours the state
// into it. References to rebuilt objects travel as paths ({$c: 'doors.3'} into the compiled map,
// {$s: 'units.0.weapon'} to the frozen object a fresh sim has there); an object reached twice
// travels once ({$r: id}); a frozen constant a fresh sim lacks travels as a frozen copy ({$f});
// numbers keep their exact bits (-0, NaN and ±Infinity are tagged).
import { Rng } from '../core/rng.js';

const STATIC = new Set(['compiled', 'world', 'events', 'teams', 'site', 'entry']);
const CLASSES = { Rng };

/** The sim's dynamic state as plain data (references to static map data replaced by ids). */
export function stateOf(sim) {
  const s = {};
  for (const k of Object.keys(sim)) if (!STATIC.has(k)) s[k] = sim[k];
  s.siteId = sim.site.id;
  s.entryId = sim.entry.id;
  s.doors = sim.doors.map(({ def, ...d }) => d);
  return s;
}

/** Objects of `root` by path, for the ones that are rebuilt rather than copied. */
function indexPaths(root, prefix, keep, out = new Map(), seen = new Set()) {
  const walk = (v, path) => {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (keep(v) && !out.has(v)) out.set(v, path);
    if (v instanceof Map || v instanceof Set) return;
    for (const k of Object.keys(v)) walk(v[k], path ? `${path}.${k}` : k);
  };
  walk(root, prefix);
  return out;
}

function resolve(root, path) {
  let v = root;
  for (const k of path ? path.split('.') : []) {
    if (v === undefined || v === null) return undefined;
    v = v[k];
  }
  return v;
}

const plainProto = (v) => {
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};

/**
 * The snapshot of `sim` (plain JSON-able data). `fresh`: a new Simulation built with the round's
 * options (the frozen objects are found by where a fresh sim has them).
 */
export function encodeSim(sim, fresh) {
  const compiled = indexPaths(sim.compiled, '', () => true);
  const frozen = indexPaths(stateOf(fresh), '', (v) => Object.isFrozen(v));
  const state = stateOf(sim);
  // Objects reached more than once get an id.
  const count = new Map();
  const countRefs = (v) => {
    if (!v || typeof v !== 'object' || compiled.has(v) || frozen.has(v)) return;
    const n = (count.get(v) || 0) + 1;
    count.set(v, n);
    if (n > 1) return;
    if (v instanceof Map) for (const [k, x] of v) { countRefs(k); countRefs(x); }
    else if (v instanceof Set) for (const x of v) countRefs(x);
    else for (const k of Object.keys(v)) countRefs(v[k]);
  };
  countRefs(state);
  const ids = new Map();
  const enc = (v) => {
    if (v === undefined) return { $u: 1 };
    if (typeof v === 'number') {
      if (Object.is(v, -0)) return { $n: '-0' };
      if (!Number.isFinite(v)) return { $n: String(v) };
      return v;
    }
    if (typeof v !== 'object' || v === null) return v;
    if (compiled.has(v)) return { $c: compiled.get(v) };
    if (frozen.has(v)) return { $s: frozen.get(v) };
    if (ids.has(v)) return { $r: ids.get(v) };
    if (Object.isFrozen(v) && plainProto(v)) {
      // A frozen constant a fresh sim does not have (a module's private one): it travels as a frozen
      // copy, once: two units holding the same one (HOLD_AFTER_ROTATION) share the copy again, so the
      // restored state hashes the same (net/stateHash.js counts a shared object once).
      const id = ids.size;
      ids.set(v, id);
      const o = Array.isArray(v) ? v.map(enc) : Object.fromEntries(Object.keys(v).map((k) => [k, enc(v[k])]));
      return { $f: o, arr: Array.isArray(v), $i: id };
    }
    const shared = count.get(v) > 1;
    const id = ids.size;
    if (shared) ids.set(v, id);
    let out;
    if (Array.isArray(v)) out = { $a: v.map(enc) };
    else if (v instanceof Map) out = { $m: [...v].map(([k, x]) => [enc(k), enc(x)]) };
    else if (v instanceof Set) out = { $set: [...v].map(enc) };
    else {
      const o = {};
      for (const k of Object.keys(v)) o[k] = enc(v[k]);
      out = { $o: o };
      if (!plainProto(v)) {
        const name = Object.getPrototypeOf(v).constructor.name;
        if (CLASSES[name] !== Object.getPrototypeOf(v).constructor) throw new Error(`snapshot: clase ${name}`);
        out.$p = name;
      }
    }
    if (shared) out.$i = id;
    return out;
  };
  return enc(state);
}

/**
 * Pours a snapshot (encodeSim) into `sim`, a Simulation of the same round (fresh, or the one that
 * drifted). `reference`: a fresh one built with the round's options (where the frozen objects are).
 */
export function restoreSim(sim, data, reference = sim) {
  const fresh = stateOf(reference);
  const byId = new Map();
  const dec = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (v.$u) return undefined;
    if (v.$n !== undefined) return v.$n === '-0' ? -0 : Number(v.$n);
    if (v.$c !== undefined) return resolve(sim.compiled, v.$c);
    if (v.$s !== undefined) return resolve(fresh, v.$s);
    if (v.$r !== undefined) return byId.get(v.$r);
    if (v.$f !== undefined) {
      const f = Object.freeze(v.arr ? v.$f.map(dec) : Object.fromEntries(Object.keys(v.$f).map((k) => [k, dec(v.$f[k])])));
      if (v.$i !== undefined) byId.set(v.$i, f);
      return f;
    }
    let out;
    if (v.$a) {
      out = [];
      if (v.$i !== undefined) byId.set(v.$i, out);
      for (const x of v.$a) out.push(dec(x));
    } else if (v.$m) {
      out = new Map();
      if (v.$i !== undefined) byId.set(v.$i, out);
      for (const [k, x] of v.$m) out.set(dec(k), dec(x));
    } else if (v.$set) {
      out = new Set();
      if (v.$i !== undefined) byId.set(v.$i, out);
      for (const x of v.$set) out.add(dec(x));
    } else {
      out = v.$p ? Object.create(CLASSES[v.$p].prototype) : {};
      if (v.$i !== undefined) byId.set(v.$i, out);
      for (const k of Object.keys(v.$o)) out[k] = dec(v.$o[k]);
    }
    return out;
  };
  const state = dec(data);
  const { siteId, entryId, doors, ...rest } = state;
  for (const k of Object.keys(rest)) sim[k] = rest[k];
  sim.site = sim.compiled.sites.find((s) => s.id === siteId);
  sim.entry = sim.compiled.entries.find((e) => e.id === entryId);
  sim.doors = doors.map((d, i) => ({ def: sim.compiled.doors[i], ...d }));
  sim.teams = {};
  for (const t of ['attackers', 'defenders']) sim.teams[t] = sim.units.filter((u) => u.team === t);
  sim.events = [];
  // The world's moving parts follow the state (door slabs, smoke).
  sim.world.updateDoorSegments(sim.doors);
  sim.world.updateSmokeSegments(sim.smokes);
  return sim;
}
