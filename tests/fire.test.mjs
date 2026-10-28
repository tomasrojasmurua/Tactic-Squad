// Incendiaria (sim/fire.js): solo del defensor; quema a quien esté en el fuego,
// el humo la apaga y se consume sola.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { spawnFire, inFire, updateFires } from '../src/sim/fire.js';
import { spawnSmoke, updateSmokes } from '../src/sim/smoke.js';
import { EV } from '../src/core/events.js';
import { ENTRY, BUY, SIM } from '../src/config/balance.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';

const MAP = MAPS[DEFAULT_MAP];
const BOTH = { attackers: 'human', defenders: 'human' };
const M = ENTRY.molotov;
const rejects = (sim) => sim.drainEvents().filter((e) => e.type === EV.ORDER_REJECTED).map((e) => e.reason);

test('la incendiaria la compra solo el defensor, por 2 puntos', () => {
  const sim = new Simulation(MAP, { seed: 3, controllers: BOTH, site: 'A' });
  const [a] = sim.teams.attackers;
  const d = sim.teams.defenders[1];
  sim.enqueue({ team: 'attackers', type: 'buy', unitId: a.id, item: 'molotov', count: 1 });
  sim.enqueue({ team: 'defenders', type: 'buy', unitId: d.id, item: 'molotov', count: 1 });
  sim.flushCommands();
  assert.deepEqual(rejects(sim), ['badItem']);
  assert.deepEqual([d.gear.molotov, d.points], [1, BUY.points - BUY.prices.molotov]);
});

test('quema a quien esté adentro, de cualquier bando, y se consume', () => {
  const sim = new Simulation(MAP, { seed: 3, controllers: BOTH, site: 'A' });
  sim.skipToAssault();
  const [a] = sim.teams.attackers;
  const hp = a.hp;
  spawnFire(sim, a.x, a.y, sim.teams.defenders[0]);
  assert.ok(inFire(sim, a.x, a.y));
  const dt = 1 / SIM.tickRate;
  for (let t = 0; t < 1; t += dt) updateFires(sim, dt);
  assert.ok(a.hp < hp && hp - a.hp <= M.dps * 1.3, `quemó ${hp - a.hp}`);
  for (let t = 0; t < M.seconds; t += dt) updateFires(sim, dt);
  assert.equal(sim.fires.length, 0);
  assert.equal(inFire(sim, a.x, a.y), false);
});

test('el humo la apaga', () => {
  const sim = new Simulation(MAP, { seed: 3, controllers: BOTH, site: 'A' });
  sim.skipToAssault();
  const [a] = sim.teams.attackers;
  spawnFire(sim, a.x, a.y, null);
  spawnSmoke(sim, a.x + 0.5, a.y);
  sim.drainEvents();
  const dt = 1 / SIM.tickRate;
  for (let i = 0; i < SIM.tickRate; i++) {
    updateSmokes(sim, dt);
    updateFires(sim, dt);
  }
  assert.equal(sim.fires.length, 0);
  assert.ok(sim.drainEvents().some((e) => e.type === EV.FIRE_OUT && e.why === 'smoke'));
});

test('la IA defensora compra una y la lanza', () => {
  let thrown = 0;
  for (let seed = 1; seed <= 10 && !thrown; seed++) {
    const sim = new Simulation(MAP, { seed, controllers: { attackers: 'ai', defenders: 'ai' } });
    for (let g = 0; sim.phase !== 'end' && g < 40000; g++) {
      if (sim.phase === 'buy' || sim.phase === 'prep' || sim.phase === 'plan') sim.advancePhase();
      else sim.step();
      if (sim.phase === 'prep') assert.equal(sim.teams.defenders.filter((u) => u.gear.molotov > 0).length, 1);
      for (const e of sim.drainEvents()) if (e.type === EV.FIRE_START) thrown++;
    }
  }
  assert.ok(thrown > 0);
});
