// Cada mapa (data/maps): se compila, todo lo que pide está en el suelo y se
// puede caminar, sus nombres existen en los textos, y una ronda IA contra IA
// termina con resultados repartidos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { EV } from '../src/core/events.js';
import { NAV } from '../src/config/balance.js';
import { MAPS, ALL_MAPS, TRAINING_MAP, DEFAULT_MAP } from '../src/data/maps/index.js';
import { MAP_CHOICES } from '../src/session/Lobby.js';
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

for (const [id, map] of Object.entries(ALL_MAPS)) {
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

  test(`${map.name}: ningún mueble dentro de una pared ni fuera del mapa, y ninguno en el barrido de una puerta`, () => {
    const sim = new Simulation(map, { seed: 1, controllers: AI_VS_AI });
    const c = sim.compiled;
    const overlap = (a, b, e) => a.minX < b.maxX - e && a.maxX > b.minX + e && a.minY < b.maxY - e && a.maxY > b.minY + e;
    for (const p of c.props) {
      const b = p.box;
      assert.ok(b.minX >= 0 && b.minY >= 0 && b.maxX <= c.width && b.maxY <= c.height, `${p.type} en ${p.x},${p.y} fuera del mapa`);
      if (id === TRAINING_MAP) continue; // the original map, kept as it was
      for (const w of [...c.walls.map((x) => x.box), ...c.windows.map((x) => x.box)]) assert.ok(!overlap(b, w, 0.02), `${p.type} en ${p.x},${p.y} dentro de una pared`);
      if (!p.blocksMove || p.h <= 0.5) continue;
      for (const d of c.doors) {
        const dx = Math.max(b.minX - d.hingeX, 0, d.hingeX - b.maxX);
        const dy = Math.max(b.minY - d.hingeY, 0, d.hingeY - b.maxY);
        assert.ok(Math.hypot(dx, dy) >= d.length * 0.95, `${p.type} en ${p.x},${p.y} no deja abrir ${d.id}`);
      }
    }
  });

  test(`${map.name}: siete soportes de cámara, y la IA usa dos de ellos en cada sitio`, () => {
    assert.equal(map.cameraMounts.length, 7);
    for (const s of map.sites) assert.equal(map.aiCameras[s.id].length, 2);
  });

  test(`${map.name}: su ficha trae tres rasgos y la lectura de cada sitio, sin nombrar clases`, () => {
    assert.equal(map.traits.length, 3);
    const classes = /asaltante|brecha|explorador|escudo|tirador|granadero|ancla|merodeador|trampero|vig[ií]a/i;
    for (const s of map.sites) {
      assert.ok(map.siteTraits[s.id]?.length >= 2, `sitio ${s.id}`);
      assert.ok(map.siteNames[s.id], `nombre del sitio ${s.id}`);
    }
    for (const t of [...map.traits, ...Object.values(map.siteTraits).flat()]) assert.doesNotMatch(t, classes, t);
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

// Los mapas del lobby (v2, docs/diseno/mapas-v2.md): más grandes que el de entrenamiento,
// apaisados para el celular horizontal, con las entradas del atacante separadas.
for (const [id, map] of Object.entries(MAPS)) {
  test(`${map.name}: mide entre 52 × 32 y 60 × 40 m, más ancho que alto`, () => {
    assert.ok(map.size.w >= 52 && map.size.w <= 60 && map.size.h >= 32 && map.size.h <= 40, `${map.size.w} × ${map.size.h}`);
    assert.ok(map.size.w / map.size.h >= 1.4);
  });

  test(`${map.name}: las tres entradas están a más de 10 m una de otra y cada una trae su encuadre`, () => {
    const at = map.entries.map((e) => e.spawns[0].at);
    for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) assert.ok(Math.hypot(at[i][0] - at[j][0], at[i][1] - at[j][1]) > 10, `${map.entries[i].id}–${map.entries[j].id}`);
    for (const e of map.entries) {
      assert.equal(e.frame.length, 4, e.id);
      const [x, y, w, h] = e.frame;
      for (const s of e.spawns) assert.ok(s.at[0] >= x && s.at[0] <= x + w && s.at[1] >= y && s.at[1] <= y + h, `${e.id}: su escuadra queda en el encuadre`);
    }
  });

  test(`${map.name}: cada sitio queda a más de 20 m de cada entrada, y la rotación del defensor es más corta que la llegada del atacante`, () => {
    const sim = new Simulation(map, { seed: 1, controllers: AI_VS_AI });
    const nav = sim.world.nav;
    const len = (ax, ay, bx, by) => {
      let L = 0, px = ax, py = ay;
      for (const q of nav.findPath(ax, ay, bx, by, NAV.snapRadius)) {
        L += Math.hypot(q.x - px, q.y - py);
        px = q.x;
        py = q.y;
      }
      return L;
    };
    const [A, B] = sim.compiled.sites;
    const rotation = len(A.bombX, A.bombY, B.bombX, B.bombY);
    for (const e of map.entries) for (const s of sim.compiled.sites) {
      const d = len(e.spawns[0].at[0], e.spawns[0].at[1], s.bombX, s.bombY);
      assert.ok(d > 20, `${e.id} → ${s.id}: ${d.toFixed(0)} m`);
      assert.ok(rotation < d, `rotación ${rotation.toFixed(0)} m, ${e.id} → ${s.id} ${d.toFixed(0)} m`);
    }
  });
}

test('el lobby ofrece los tres mapas; el de entrenamiento queda para el tutorial', () => {
  assert.deepEqual(MAP_CHOICES.filter((m) => m !== 'random').sort(), ['hotel', 'port', 'warehouse']);
  assert.ok(!MAP_CHOICES.includes(TRAINING_MAP));
  assert.ok(ALL_MAPS[TRAINING_MAP] && ALL_MAPS[DEFAULT_MAP]);
  assert.deepEqual(ALL_MAPS[TRAINING_MAP].size, { w: 40, h: 28 });
});
