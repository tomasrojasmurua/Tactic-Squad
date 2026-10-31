// Munición y recarga: la orden RECARGAR pone un cargador nuevo en el próximo paso (a cubierto, antes
// de entrar) y la recarga hace un ruido corto que el rival cercano oye.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { ALL_MAPS, TRAINING_MAP } from '../src/data/maps/index.js';
import { NOISE } from '../src/config/balance.js';

test('RECARGAR: con el cargador a medias recarga en el próximo paso; lleno, no hace nada', () => {
  const sim = new Simulation(ALL_MAPS[TRAINING_MAP], { seed: 3 });
  sim.skipToAssault();
  const u = sim.teams.attackers[0];
  sim.enqueue({ type: 'reload', unitId: u.id, team: 'attackers' });
  sim.flushCommands();
  assert.equal(u.reloadNow, false, 'lleno: nada');
  u.mag = 10;
  sim.enqueue({ type: 'reload', unitId: u.id, team: 'attackers' });
  sim.flushCommands();
  assert.equal(u.reloadNow, true);
  sim.advancePhase();
  let reloaded = false;
  for (let i = 0; i < 400 && sim.phase === 'exec'; i++) {
    sim.step();
    for (const e of sim.drainEvents()) if (e.type === 'reload' && e.unitId === u.id) reloaded = true;
  }
  assert.ok(reloaded, 'recargó');
  assert.equal(u.mag, u.weapon.magazine, 'cargador lleno');
});

test('la recarga se oye de cerca (ruido corto en el sistema de ruido)', () => {
  assert.ok(NOISE.radius.reload > NOISE.radius.sneak && NOISE.radius.reload < NOISE.radius.step);
  assert.ok(NOISE.rank.includes('reload'));
});
