// Tear gas (gas lacrimógeno), fired by the Granadero's 40 mm launcher (role
// ability 'launcher', a thrown 'gas' in sim/entries.js): a cloud that grows
// to ENTRY.gas.radius and lasts ENTRY.gas.seconds. It hides nobody and kills
// nobody: it drives people out. An enemy of the thrower inside it (in its
// radius, with no wall between him and its center) chokes: unit.gassed keeps
// him impaired a moment after he leaves — he sees only ENTRY.gas.vision m
// (sim/perception.js), aims ENTRY.gas.spread times worse (sim/combat.js),
// reacts ENTRY.gas.reaction times slower, and coughs every
// ENTRY.gas.coughEvery s (EV.COUGH: heard, sim/noise.js). The attackers wear
// masks: it never hurts the side that fires it. An AI defender who gets a
// lungful reacts as to gunfire (sim/ai.js alertAiUnit loud): he falls back
// if his orders have somewhere to go. Deterministic: no randomness.
//
//   sim.gases = [{id, x, y, r, age, team}]
import { ENTRY, COMBAT } from '../config/balance.js';
import { EV } from '../core/events.js';
import { solidLineOfSight } from './vision.js';
import { isAiControlled } from './queries.js';
import { alertAiUnit } from './ai.js';

/** s a unit stays impaired after he leaves the cloud. */
const LINGER = 1.2;

export function spawnGas(sim, x, y, owner) {
  const g = { id: sim.gases.length ? sim.gases[sim.gases.length - 1].id + 1 : 0, x, y, r: 0, age: 0, team: owner ? owner.team : null };
  sim.gases.push(g);
  sim.emit(EV.GAS_START, { id: g.id, x, y, unitId: owner ? owner.id : -1 });
}

/** The cloud's radius `age` s after it burst (grows, then thins out over the last `fade` s). */
export function gasRadius(age) {
  const G = ENTRY.gas;
  if (age >= G.seconds) return 0;
  const grow = Math.min(1, age / G.grow);
  const fade = age > G.seconds - G.fade ? (G.seconds - age) / G.fade : 1;
  return G.radius * grow * (0.6 + 0.4 * fade);
}

/** Once per tick: clouds grow and thin out; whoever breathes one chokes. */
export function updateGas(sim, dt) {
  const G = ENTRY.gas;
  for (const u of sim.units) if (u.gassed > 0) u.gassed = Math.max(0, u.gassed - dt);
  let n = 0;
  for (const g of sim.gases) {
    g.age += dt;
    g.r = gasRadius(g.age);
    if (g.age >= G.seconds) {
      sim.emit(EV.GAS_END, { id: g.id, x: g.x, y: g.y });
      continue;
    }
    sim.gases[n++] = g;
    for (const u of sim.units) {
      if (!u.alive || u.team === g.team) continue;
      if ((u.x - g.x) ** 2 + (u.y - g.y) ** 2 > g.r * g.r || !solidLineOfSight(sim.world, g.x, g.y, u.x, u.y)) continue;
      if (u.gassed <= 0) {
        u.coughIn = 0.3; // the first cough comes quickly
        if (isAiControlled(sim, u)) alertAiUnit(u, g.x, g.y, COMBAT.alertDuration, true);
      }
      u.gassed = Math.max(u.gassed, LINGER);
    }
  }
  sim.gases.length = n;
  for (const u of sim.units) {
    if (!u.alive || u.gassed <= 0) continue;
    u.coughIn -= dt;
    if (u.coughIn > 0) continue;
    u.coughIn = G.coughEvery;
    sim.emit(EV.COUGH, { unitId: u.id, team: u.team, x: u.x, y: u.y });
  }
}
