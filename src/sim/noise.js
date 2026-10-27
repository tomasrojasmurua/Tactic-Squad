// Noise: what each side hears of the other during a turn. Loud things are
// read from the events the tick emitted (footsteps, doors, shots, grenades,
// charges, the defuse tools), so no system needs to know about it. A noise
// is heard by the enemy side if one of them is within its radius (through
// walls). At the end of every execution turn the heard noises become pulses
// on the listener's map: one per NOISE.cell grid cell, named by its loudest
// kind and shifted a little (a hash of seed, turn and cell: no sim.rng, so
// the rest of the round is untouched). Where, roughly — never who.
//
// sim.noise.pulses[team] = [{turn, kind, x, y}] heard BY that side, newest
// last, kept NOISE.keepTurns turns. Read through sim/view.js teamView.
// (The AI's own ears — sim/ai.js — are unchanged for now.)
import { NOISE } from '../config/balance.js';
import { EV } from '../core/events.js';
import { TEAMS } from '../config/squad.js';
import { enemyTeam } from './queries.js';

export function createNoise() {
  const pulses = {};
  for (const t of TEAMS) pulses[t] = [];
  return { heard: [], pulses };
}

/** Kind of noise an event makes, or null. */
function kindOf(ev) {
  switch (ev.type) {
    case EV.FOOTSTEP:
      return 'step';
    case EV.SHOT:
      return 'shot';
    case EV.DOOR_OPEN:
      return ev.mode === 'kick' ? 'kick' : ev.mode === 'crack' ? 'crack' : 'door';
    case EV.CHARGE_PLANT:
      return 'plant';
    case EV.CHARGE_BLAST:
      return 'breach';
    case EV.GRENADE_DETONATE:
      return ev.kind === 'flash' ? 'flash' : 'frag';
    case EV.DEFUSE_START:
      return 'defuse';
    case EV.BARRICADE_HIT:
      return 'bash';
    default:
      return null;
  }
}

/** After a tick: the events from index `from` on that the enemy side hears. */
export function collectNoise(sim, from) {
  const events = sim.events;
  for (let i = from; i < events.length; i++) {
    const ev = events[i];
    const kind = kindOf(ev);
    if (!kind) continue;
    const src = sim.units[ev.unitId];
    if (!src) continue;
    const listener = enemyTeam(src.team);
    const r2 = NOISE.radius[kind] ** 2;
    let heard = false;
    for (const u of sim.teams[listener]) {
      if (u.alive && (u.x - ev.x) ** 2 + (u.y - ev.y) ** 2 <= r2) {
        heard = true;
        break;
      }
    }
    if (heard) sim.noise.heard.push({ team: listener, kind, x: ev.x, y: ev.y });
  }
}

/** End of an execution turn: heard noises -> pulses per listening side. */
export function summarizeNoise(sim) {
  const n = sim.noise;
  const turn = sim.round.turn;
  const cells = new Map(); // `${team}:${cx}:${cy}` -> pulse
  for (const h of n.heard) {
    const cx = Math.floor(h.x / NOISE.cell);
    const cy = Math.floor(h.y / NOISE.cell);
    const key = `${h.team}:${cx}:${cy}`;
    const p = cells.get(key);
    if (!p) cells.set(key, { team: h.team, kind: h.kind, cx, cy });
    else if (NOISE.rank.indexOf(h.kind) > NOISE.rank.indexOf(p.kind)) p.kind = h.kind;
  }
  n.heard.length = 0;
  for (const t of TEAMS) {
    const list = n.pulses[t];
    let k = 0;
    for (const p of list) if (turn - p.turn < NOISE.keepTurns) list[k++] = p;
    list.length = k;
  }
  for (const p of cells.values()) {
    const a = hash01(sim.seed, turn, p.cx, p.cy, 1);
    const d = hash01(sim.seed, turn, p.cx, p.cy, 2);
    const x = (p.cx + 0.5) * NOISE.cell + Math.cos(a * Math.PI * 2) * d * NOISE.jitter;
    const y = (p.cy + 0.5) * NOISE.cell + Math.sin(a * Math.PI * 2) * d * NOISE.jitter;
    n.pulses[p.team].push({ turn, kind: p.kind, x, y });
  }
}

/** Deterministic value in [0, 1) from a few integers (no shared RNG state). */
function hash01(...ints) {
  let h = 0x811c9dc5;
  for (const v of ints) {
    h = Math.imul(h ^ (v | 0), 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return (h >>> 0) / 4294967296;
}
