// Snapshot de la sim (resincronización online): restaurarlo en una sim nueva da el mismo hash y,
// con las mismas órdenes, la misma continuación.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { ALL_MAPS } from '../src/data/maps/index.js';
import { encodeSim, restoreSim } from '../src/net/snapshot.js';
import { hashSim } from '../src/net/stateHash.js';

const HUMANS = { attackers: 'human', defenders: 'human' };

/** A round where both sides are played by the AI (the attackers' and defenders' commanders). */
function args(seed, map) {
  return { map: ALL_MAPS[map], options: { seed, controllers: { attackers: 'ai', defenders: 'ai' } } };
}

function roundTrip(sim, { map, options }) {
  const data = JSON.parse(JSON.stringify(encodeSim(sim, new Simulation(map, options))));
  return restoreSim(new Simulation(map, options), data);
}

for (const [map, seed] of [['warehouse', 3], ['hotel', 8], ['port', 21]]) {
  test(`snapshot en cada turno: mismo hash y misma continuación (${map})`, () => {
    const a = args(seed, map);
    const sim = new Simulation(a.map, a.options);
    sim.skipToAssault();
    let copy = null;
    let checks = 0;
    for (let turn = 0; turn < 30 && sim.phase !== 'end'; turn++) {
      const restored = roundTrip(sim, a);
      assert.equal(hashSim(restored), hashSim(sim), `turno ${sim.turn}: el snapshot restaurado tiene el mismo hash`);
      checks++;
      if (turn === 2) copy = restored; // from here on the copy plays alongside
      for (const s of copy ? [sim, copy] : [sim]) {
        s.advancePhase();
        while (s.phase === 'exec') s.step();
      }
      if (copy) assert.equal(hashSim(copy), hashSim(sim), `turno ${sim.turn}: la copia sigue igual`);
      // Mid-turn as well: a snapshot taken during the execution.
    }
    assert.ok(checks >= 3);
    assert.ok(copy, 'la ronda duró lo suficiente');
    assert.equal(sim.phase, copy.phase);
  });
}

test('snapshot a mitad de un turno (granadas, humo, puertas moviéndose)', () => {
  const a = args(5, 'warehouse');
  const sim = new Simulation(a.map, a.options);
  sim.skipToAssault();
  let tested = 0;
  for (let turn = 0; turn < 30 && sim.phase !== 'end'; turn++) {
    sim.advancePhase();
    let k = 0;
    while (sim.phase === 'exec') {
      sim.step();
      if (++k % 97 === 0 && sim.phase === 'exec') {
        const copy = roundTrip(sim, a);
        assert.equal(hashSim(copy), hashSim(sim));
        for (let i = 0; i < 40 && sim.phase === 'exec'; i++) {
          sim.step();
          copy.step();
        }
        assert.equal(hashSim(copy), hashSim(sim), 'sigue igual 40 pasos después');
        tested++;
      }
    }
  }
  assert.ok(tested > 3);
});

test('dos jugadores humanos: el snapshot del lobby online también vale', () => {
  const map = ALL_MAPS.warehouse;
  const options = { seed: 9, controllers: HUMANS };
  const sim = new Simulation(map, options);
  const copy = roundTrip(sim, { map, options });
  assert.equal(hashSim(copy), hashSim(sim));
});

test('una constante congelada que comparten dos soldados vuelve compartida (mismo hash)', () => {
  const a = args(4, 'warehouse');
  const sim = new Simulation(a.map, a.options);
  sim.skipToAssault();
  const hold = Object.freeze({ type: 'hold', reactsToNoise: true }); // like sim/ai.js HOLD_AFTER_ROTATION
  const [d1, d2] = sim.teams.defenders;
  d1.behavior = hold;
  d2.behavior = hold;
  const restored = roundTrip(sim, a);
  assert.equal(restored.teams.defenders[0].behavior, restored.teams.defenders[1].behavior, 'la misma copia');
  assert.ok(Object.isFrozen(restored.teams.defenders[0].behavior));
  assert.equal(hashSim(restored), hashSim(sim));
});
