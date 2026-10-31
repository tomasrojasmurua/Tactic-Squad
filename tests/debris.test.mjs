// Suelo ruidoso (vidrio, chapa, grava): un paso ahí se oye aunque se vaya en sigilo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { MAPS } from '../src/data/maps/index.js';
import { NOISE } from '../src/config/balance.js';
import { debrisAt } from '../src/sim/queries.js';

test('cada mapa del lobby tiene suelo ruidoso, sobre suelo caminable', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    const sim = new Simulation(map, { seed: 1 });
    assert.ok(sim.compiled.debris.length >= 3, id);
    for (const d of sim.compiled.debris) {
      const [x, y, w, h] = d.rect;
      assert.equal(debrisAt(sim, x + w / 2, y + h / 2), d.kind);
      assert.ok(sim.world.nav.walkable(x + w / 2, y + h / 2), `${id} ${d.kind} en ${x},${y}`);
    }
  }
});

test('pisar vidrio en sigilo se oye más que un paso normal', () => {
  const sim = new Simulation(MAPS.warehouse, { seed: 1, phases: false });
  const glass = sim.compiled.debris.find((d) => d.kind === 'glass');
  const u = sim.teams.attackers[0];
  const [x, y, w, h] = glass.rect;
  u.x = x + w / 2;
  u.y = y + h / 2;
  const ev = { type: 'footstep', unitId: u.id, team: u.team, x: u.x, y: u.y, sneak: true, debris: debrisAt(sim, u.x, u.y) };
  assert.equal(ev.debris, 'glass');
  assert.ok(NOISE.radius.glass > NOISE.radius.step && NOISE.radius.glass > NOISE.radius.sneak);
});
