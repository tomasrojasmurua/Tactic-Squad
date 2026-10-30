// El hash del estado de la sim: igual para la misma ronda, distinto en cuanto algo cambia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { ALL_MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { hashSim } from '../src/net/stateHash.js';

const both = { attackers: 'human', defenders: 'human' };
const make = (seed) => new Simulation(ALL_MAPS[DEFAULT_MAP], { seed, controllers: both });

function play(seed) {
  const sim = make(seed);
  sim.skipToAssault();
  const hashes = [hashSim(sim)];
  while (sim.phase !== 'end') {
    sim.advancePhase();
    while (sim.phase === 'exec') sim.step();
    hashes.push(hashSim(sim));
  }
  return hashes;
}

test('la misma ronda da los mismos hashes turno a turno', () => {
  assert.deepEqual(play(7), play(7));
});

test('otra semilla o un cambio mínimo cambian el hash', () => {
  assert.notEqual(hashSim(make(1)), hashSim(make(2)));
  const sim = make(1);
  const before = hashSim(sim);
  sim.units[0].x += 1e-12;
  assert.notEqual(hashSim(sim), before);
});
