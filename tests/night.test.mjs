// Noche (config/balance.js NIGHT, sim/perception.js litFor): en una sala oscura solo se ve de cerca,
// con la linterna propia apuntando o a quien lleva la suya encendida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { NIGHT } from '../src/config/balance.js';
import { isDark } from '../src/sim/queries.js';
import { ALL_MAPS } from '../src/data/maps/index.js';
import { MAP_CHOICES } from '../src/session/Lobby.js';

const STILL = { attackers: 'human', defenders: 'human' };

test('cada mapa del lobby tiene salas oscuras', () => {
  for (const id of MAP_CHOICES.filter((m) => m !== 'random')) {
    const sim = new Simulation(ALL_MAPS[id], { seed: 1, site: 'A' });
    assert.ok(sim.compiled.dark.length >= 2, `${id}: ${sim.compiled.dark.length} salas oscuras`);
  }
});

/** ÁGUILA y un defensor frente a frente en el comedor del Almacén (oscuro), a `dist` m. */
function inTheDark(dist, { attackerLight, defenderLight, facingAway = false }) {
  const sim = new Simulation(ALL_MAPS.warehouse, { seed: 3, site: 'A', controllers: STILL, phases: false });
  const a = sim.teams.attackers[0];
  const d = sim.teams.defenders[0];
  for (const u of sim.units) if (u !== a && u !== d) u.alive = false;
  a.x = 11.2;
  a.y = 27.6;
  a.facing = 0;
  d.x = 11.2 + dist;
  d.y = 27.6;
  d.facing = Math.PI;
  a.light = attackerLight;
  d.light = defenderLight;
  if (facingAway) a.facing = 0.7; // 40° off: outside his flashlight's cone (25°), still in his field of view (56°)
  assert.ok(isDark(sim, d.x, d.y), 'el defensor está en una sala oscura');
  sim.step();
  return { sees: a.visibleEnemies.includes(d.id), seen: d.visibleEnemies.includes(a.id) };
}

test('en la oscuridad sin linterna solo se ve de cerca', () => {
  assert.equal(inTheDark(8, { attackerLight: false, defenderLight: false }).sees, false);
  assert.equal(inTheDark(NIGHT.range - 1, { attackerLight: false, defenderLight: false }).sees, true);
});

test('la linterna deja ver dentro de su cono y delata a quien la lleva', () => {
  const lit = inTheDark(8, { attackerLight: true, defenderLight: false });
  assert.equal(lit.sees, true, 'con la linterna lo ve');
  assert.equal(lit.seen, true, 'y el defensor, a oscuras, lo ve a él por su luz');
  assert.equal(inTheDark(8, { attackerLight: true, defenderLight: false, facingAway: true }).sees, false, 'fuera del cono no');
  assert.equal(inTheDark(8, { attackerLight: false, defenderLight: true }).sees, true, 'la linterna del defensor lo delata');
});
