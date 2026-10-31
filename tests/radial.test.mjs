// La rueda táctil (session/radial.js): qué ofrece en una puerta, en un punto y sobre el soldado,
// cada opción siempre en su lugar, y qué elige el dedo según hacia dónde se desliza.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { ALL_MAPS, TRAINING_MAP } from '../src/data/maps/index.js';
import { radialOptions, radialHover, slotOffset, RADIAL } from '../src/session/radial.js';
import { HERE, lastUserIndex } from '../src/sim/queries.js';

const session = { team: 'attackers' };

function planned() {
  const sim = new Simulation(ALL_MAPS[TRAINING_MAP], { seed: 3, entry: 'principal' });
  sim.skipToAssault();
  const u = sim.teams.attackers[0];
  sim.enqueue({ type: 'addWaypoint', unitId: u.id, x: 10.6, y: 12.7, user: true, team: 'attackers' });
  sim.enqueue({ type: 'addWaypoint', unitId: u.id, x: 27.4, y: 12.7, user: true, team: 'attackers' });
  sim.flushCommands();
  return { sim, u };
}

test('sobre el soldado: escuadra arriba, flash a la derecha, granada abajo a la derecha', () => {
  const { sim, u } = planned();
  const m = radialOptions(sim, session, u.id, HERE);
  assert.equal(m.kind, 'here');
  const slot = Object.fromEntries(m.options.map((o) => [o.id, o.slot]));
  assert.equal(slot.squad, 0);
  assert.equal(slot.toss_flash, 2);
  assert.equal(slot.toss_frag, 3);
  assert.equal(new Set(m.options.map((o) => o.slot)).size, m.options.length, 'cada opción en su lugar');
});

test('en un punto de la ruta: sigilo, lanzar, asomarse en el último y mirada', () => {
  const { sim, u } = planned();
  sim.enqueue({ type: 'addWaypoint', unitId: u.id, x: 30.5, y: 12.7, user: true, team: 'attackers' }); // inside the room, off the door
  sim.flushCommands();
  const last = lastUserIndex(u);
  const m = radialOptions(sim, session, u.id, last);
  assert.equal(m.kind, 'point');
  const ids = m.options.map((o) => o.id);
  for (const id of ['pace', 'toss_flash', 'toss_frag', 'peek', 'look']) assert.ok(ids.includes(id), id);
  assert.equal(new Set(m.options.map((o) => o.slot)).size, m.options.length);
});

test('en una puerta: las entradas, cada una en su lugar fijo', () => {
  const { sim, u } = planned();
  const door = u.route.findIndex((p) => p.ask);
  assert.ok(door >= 0, 'la ruta cruza una puerta cerrada');
  const m = radialOptions(sim, session, u.id, door);
  assert.equal(m.kind, 'door');
  const slot = Object.fromEntries(m.options.map((o) => [o.id, o.slot]));
  assert.equal(slot.entry_none, 0);
  assert.equal(slot.entry_flash, 2);
  assert.equal(slot.entry_frag, 3);
  assert.equal(slot.entry_breach, 4);
});

test('el dedo elige por dirección; el centro, lejos o una opción apagada no eligen nada', () => {
  const options = [{ slot: 0, enabled: true }, { slot: 2, enabled: true }, { slot: 4, enabled: false }];
  const at = (slot, r = RADIAL.radiusPx) => slotOffset(slot, r);
  let p = at(0);
  assert.equal(radialHover(options, p.x, p.y), 0);
  p = at(2);
  assert.equal(radialHover(options, p.x, p.y), 1);
  p = at(2.4);
  assert.equal(radialHover(options, p.x, p.y), 1, 'cerca de su ángulo vale');
  p = at(4);
  assert.equal(radialHover(options, p.x, p.y), -1, 'apagada');
  p = at(6);
  assert.equal(radialHover(options, p.x, p.y), -1, 'hueco');
  assert.equal(radialHover(options, 5, 5), -1, 'centro');
  p = at(0, RADIAL.maxPx + 10);
  assert.equal(radialHover(options, p.x, p.y), -1, 'demasiado lejos');
});
