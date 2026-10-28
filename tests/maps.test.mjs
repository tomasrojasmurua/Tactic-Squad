// Cada mapa (data/maps): se compila, todo lo que pide está en el suelo y se
// puede caminar, sus nombres existen en los textos, y una ronda IA contra IA
// termina con resultados repartidos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { EV } from '../src/core/events.js';
import { NAV } from '../src/config/balance.js';
import { MAPS } from '../src/data/maps/index.js';
import { T } from '../src/ui/texts.js';

const AI_VS_AI = { attackers: 'ai', defenders: 'ai' };

function playRound(map, seed) {
  const sim = new Simulation(map, { seed, controllers: AI_VS_AI });
  const events = [];
  for (let guard = 0; sim.phase !== 'end' && guard < 40000; guard++) {
    if (sim.phase === 'buy' || sim.phase === 'prep' || sim.phase === 'plan') sim.advancePhase();
    else sim.step();
    events.push(...sim.drainEvents());
  }
  return { sim, events };
}

for (const [id, map] of Object.entries(MAPS)) {
  test(`${map.name}: cada entrada llega a cada bomba y cada puesto defensor está en el suelo`, () => {
    const sim = new Simulation(map, { seed: 1, controllers: AI_VS_AI });
    const nav = sim.world.nav;
    for (const e of sim.compiled.entries) {
      for (const s of e.spawns) assert.ok(nav.walkable(s.at[0], s.at[1]), `${e.id}: salida en ${s.at}`);
      for (const site of sim.compiled.sites) assert.ok(nav.findPath(e.spawns[0].at[0], e.spawns[0].at[1], site.bombX, site.bombY, NAV.snapRadius), `${e.id} → ${site.id}`);
    }
    for (const [site, posts] of Object.entries(map.defense)) for (const p of posts) assert.ok(nav.walkable(p.at[0], p.at[1]), `defensa ${site} en ${p.at}`);
    for (const [site, list] of Object.entries(map.aiTraps || {})) for (const p of list) assert.ok(nav.walkable(p[0], p[1]), `trampa ${site} en ${p}`);
  });

  test(`${map.name}: sus salas, puertas, entradas y barricadas tienen nombre en español`, () => {
    for (const r of map.rooms) assert.ok(T.places[r.id], `sala ${r.id}`);
    for (const d of [...map.doors, ...(map.openings || [])]) assert.ok(T.doors[d.id], `puerta ${d.id}`);
    for (const e of map.entries) assert.ok(T.prep.entries[e.id], `entrada ${e.id}`);
    const sim = new Simulation(map, { seed: 1, controllers: AI_VS_AI });
    for (const d of sim.compiled.barricadeSlots) assert.ok(T.setup.doors[d], `barricada ${d}`);
  });

  test(`${map.name}: IA contra IA, las rondas terminan sin órdenes imposibles y nadie gana siempre`, () => {
    let wins = 0;
    const N = 16;
    for (let seed = 1; seed <= N; seed++) {
      const { sim, events } = playRound(map, seed);
      assert.ok(sim.outcome, `semilla ${seed}: la ronda termina`);
      assert.deepEqual(events.filter((e) => e.type === EV.ORDER_REJECTED).map((e) => e.reason), [], `semilla ${seed}: órdenes rechazadas`);
      if (sim.outcome.winner === 'attackers') wins++;
    }
    assert.ok(wins >= 3 && wins <= N - 3, `${id}: los atacantes ganaron ${wins} de ${N}`);
  });
}
