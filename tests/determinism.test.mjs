// La simulación debe ser determinista: misma semilla + mismas órdenes = mismo resultado.
// Juega una ronda completa sin pantalla dos veces y compara el estado final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';

// Todos los atacantes cruzan el pasillo hacia el sitio A.
const PLAN = [
  [10.6, 12.7],
  [27.4, 12.7],
  [33.5, 12.7],
];

function playRound(seed) {
  const sim = new Simulation(MAPS[DEFAULT_MAP], { seed });
  for (const u of sim.teams.attackers) {
    for (const [x, y] of PLAN) sim.enqueue({ type: 'addWaypoint', unitId: u.id, x, y: y + (u.slot - 1) * 0.6, user: true, team: 'attackers' });
  }
  const maxTicks = 60 * 150;
  while (!sim.outcome && sim.tick < maxTicks) sim.step();
  return {
    tick: sim.tick,
    outcome: sim.outcome && { winner: sim.outcome.winner, reason: sim.outcome.reason },
    units: sim.units.map((u) => [u.alive, u.hp, +u.x.toFixed(6), +u.y.toFixed(6)]),
  };
}

test('la misma semilla y las mismas órdenes dan la misma ronda', () => {
  const a = playRound(1234);
  const b = playRound(1234);
  assert.ok(a.outcome, 'la ronda debe terminar');
  assert.deepEqual(a, b);
});
