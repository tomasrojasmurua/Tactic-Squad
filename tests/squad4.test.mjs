// Escuadras de 4 (2v2 online): el 4.º punto de aparición de cada entrada y el 4.º puesto de cada
// sitio son válidos, y una ronda de 4 contra 4 se juega entera. El 3 contra 3 no cambia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { ALL_MAPS, MAPS } from '../src/data/maps/index.js';
import { SQUAD_2V2 } from '../src/config/squad.js';

test('cada entrada tiene 4 puntos de aparición caminables y separados', () => {
  for (const [id, map] of Object.entries(ALL_MAPS)) {
    const sim = new Simulation(map, { seed: 1 });
    for (const e of map.entries) {
      assert.ok(e.spawns.length >= SQUAD_2V2, `${id}/${e.id}: ${e.spawns.length} puntos`);
      for (const [i, s] of e.spawns.entries()) {
        assert.ok(sim.world.nav.walkable(s.at[0], s.at[1]), `${id}/${e.id} #${i + 1} caminable`);
        for (const o of e.spawns.slice(i + 1)) assert.ok(Math.hypot(o.at[0] - s.at[0], o.at[1] - s.at[1]) >= 1.1, `${id}/${e.id}: puntos separados`);
      }
    }
  }
});

test('los mapas del lobby tienen 4 puestos de defensa por sitio', () => {
  for (const [id, map] of Object.entries(MAPS)) for (const [site, posts] of Object.entries(map.defense)) assert.ok(posts.length >= SQUAD_2V2, `${id} sitio ${site}`);
});

test('contra la IA siguen siendo 3 por bando', () => {
  const sim = new Simulation(MAPS.warehouse, { seed: 2 });
  assert.equal(sim.teams.attackers.length, 3);
  assert.equal(sim.teams.defenders.length, 3);
});

for (const id of Object.keys(MAPS)) {
  test(`una ronda de 4 contra 4 se juega entera (${id})`, () => {
    for (const entry of MAPS[id].entries) {
      const sim = new Simulation(MAPS[id], { seed: 7, squad: SQUAD_2V2, entry: entry.id, controllers: { attackers: 'ai', defenders: 'ai' }, roles: { attackers: ['assault', 'entry', 'scout', 'assault'], defenders: ['anchor', 'shotgunner', 'trapper', 'roamer'] } });
      assert.equal(sim.teams.attackers.length, 4);
      assert.equal(sim.teams.defenders.length, 4);
      assert.equal(sim.teams.attackers[3].role, 'assault');
      assert.equal(sim.teams.defenders[3].role, 'roamer');
      sim.skipToAssault();
      for (let i = 0; i < 40 && sim.phase !== 'end'; i++) {
        sim.advancePhase();
        while (sim.phase === 'exec') sim.step();
      }
      assert.equal(sim.phase, 'end', `${id}/${entry.id}: la ronda termina`);
    }
  });
}
