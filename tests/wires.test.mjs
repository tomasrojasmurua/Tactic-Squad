// Alambre de púas (sim/wires.js): el defensor lo pone en la preparación, frena
// y delata al atacante que lo cruza, y una granada o una carga lo quita.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { teamView } from '../src/sim/view.js';
import { wireFactor, updateWires, cutWiresNear } from '../src/sim/wires.js';
import { EV } from '../src/core/events.js';
import { WIRE, PREP } from '../src/config/balance.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';

const MAP = MAPS[DEFAULT_MAP];
const BOTH = { attackers: 'human', defenders: 'human' };
const rejects = (sim) => sim.drainEvents().filter((e) => e.type === EV.ORDER_REJECTED).map((e) => e.reason);
const order = (sim, team, c) => {
  sim.enqueue({ team, ...c });
  sim.flushCommands();
};

function inPrep() {
  const sim = new Simulation(MAP, { seed: 3, controllers: BOTH, site: 'A' });
  sim.advancePhase(); // compra -> preparación
  sim.drainEvents();
  return sim;
}

test('el defensor pone alambre en su preparación: uno por ronda, nunca junto a una barricada', () => {
  const sim = inPrep();
  const [a, b, c] = sim.compiled.barricadeSlots;
  order(sim, 'attackers', { type: 'wire', door: a, on: true });
  assert.equal(sim.doors.find((d) => d.def.id === a).wired, false, 'el atacante no pone alambre');
  rejects(sim);
  order(sim, 'defenders', { type: 'wire', door: a, on: true });
  order(sim, 'defenders', { type: 'wire', door: b, on: true });
  assert.deepEqual(rejects(sim), ['tooManyWires']);
  assert.equal(PREP.wires, 1);
  order(sim, 'defenders', { type: 'barricade', door: a, on: true });
  assert.deepEqual(rejects(sim), ['doorTaken']);
  order(sim, 'defenders', { type: 'barricade', door: c, on: true });
  order(sim, 'defenders', { type: 'wire', door: c, on: true });
  assert.ok(rejects(sim).includes('doorTaken'));
  assert.ok(sim.doors.find((d) => d.def.id === a).wired);
});

test('frena y delata al atacante que lo cruza; el defensor pasa libre; una granada lo corta', () => {
  const sim = inPrep();
  const id = sim.compiled.barricadeSlots[0];
  order(sim, 'defenders', { type: 'wire', door: id, on: true });
  const door = sim.doors.find((d) => d.def.id === id);
  sim.skipToAssault();
  sim.drainEvents();
  const [att] = sim.teams.attackers;
  const [def] = sim.teams.defenders;
  assert.equal(teamView(sim, 'attackers').wires.length, 0, 'el atacante no lo conoce todavía');
  assert.equal(teamView(sim, 'defenders').wires.length, 1);
  att.x = door.def.cx;
  att.y = door.def.cy;
  def.x = door.def.cx;
  def.y = door.def.cy;
  assert.equal(wireFactor(sim, att), WIRE.slow);
  assert.equal(wireFactor(sim, def), 1);
  updateWires(sim);
  updateWires(sim);
  assert.equal(sim.drainEvents().filter((e) => e.type === EV.WIRE_CROSSED).length, 1, 'suena al entrar, una vez');
  assert.equal(teamView(sim, 'attackers').wires.length, 1, 'ahora lo conoce');
  cutWiresNear(sim, door.def.cx + 1, door.def.cy, WIRE.fragCut, att);
  assert.equal(door.wired, false);
  assert.equal(wireFactor(sim, att), 1);
});

test('la IA defensora pone su alambre en una puerta sin barricada', () => {
  const sim = new Simulation(MAP, { seed: 4, site: 'A' });
  sim.advancePhase();
  const wired = sim.doors.filter((d) => d.wired);
  assert.equal(wired.length, PREP.wires);
  assert.ok(wired.every((d) => !d.barricaded));
});
