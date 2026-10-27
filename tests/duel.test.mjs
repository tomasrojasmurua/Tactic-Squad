// Paridad (decisión de diseño, 27 oct 2026): los dos bandos reaccionan con las
// mismas reglas; decide la postura. El que sostiene un ángulo gana el primer
// cruce, salvo que el que entra use utilidad. Y el equilibrio IA contra IA se
// mide: ningún bando gana por naturaleza.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { measure } from '../scripts/balance.mjs';

const MAP = MAPS[DEFAULT_MAP];
const STILL = { attackers: 'human', defenders: 'human' };
const T = 'attackers';

/** ÁGUILA entra por la puerta del patio (x = 10) al pasillo; un defensor sostiene esa puerta desde x = 15. */
function duel(mode) {
  const sim = new Simulation(MAP, { seed: 11, site: 'A', controllers: STILL, phases: false });
  const [d0, ...others] = sim.teams.defenders;
  d0.x = d0.prevX = 15;
  d0.y = d0.prevY = 12.7;
  d0.facing = d0.prevFacing = d0.ai.baseFacing = Math.PI;
  d0.behavior = { type: 'hold', reactsToNoise: false };
  others.forEach((d, i) => {
    d.x = d.prevX = 36 + i * 0.8;
    d.y = d.prevY = 24;
  });
  const [a, ...rest] = sim.teams.attackers;
  a.x = a.prevX = 8.2;
  a.y = a.prevY = 12.0;
  a.gear.flash = 1;
  rest.forEach((u, i) => {
    u.x = u.prevX = 3;
    u.y = u.prevY = 20 + i;
  });
  const cmd = (c) => sim.enqueue({ team: T, ...c });
  cmd({ type: 'addWaypoint', unitId: a.id, x: 9.25, y: 12.7, user: true });
  cmd({ type: 'setHold', unitId: a.id, code: 'A' });
  cmd({ type: 'setEntry', unitId: a.id, mode });
  cmd({ type: 'addWaypoint', unitId: a.id, x: 13, y: 12.7, user: true });
  for (let i = 0; i < 150; i++) sim.step();
  cmd({ type: 'go', code: 'A' });
  for (let i = 0; i < 400 && a.alive && d0.alive; i++) sim.step();
  return { a, d0 };
}

test('el que sostiene la puerta gana a quien entra de una patada', () => {
  const { a, d0 } = duel('kick');
  assert.ok(d0.alive && !a.alive, `defensor ${d0.hp} hp, atacante ${a.hp} hp`);
});

test('con un flash por la puerta, gana el que entra', () => {
  const { a, d0 } = duel('flash');
  assert.ok(a.alive && !d0.alive, `defensor ${d0.hp} hp, atacante ${a.hp} hp`);
});

test('IA contra IA, ningún bando gana por naturaleza', () => {
  const r = measure(60);
  const part = r.attackers / r.rounds;
  assert.ok(part >= 0.35 && part <= 0.65, `los atacantes ganan ${(part * 100).toFixed(0)} %`);
});
