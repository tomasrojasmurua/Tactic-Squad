// Objetivo de la ronda: la bomba que dejan los defensores, desactivarla en
// 7 s y las condiciones de victoria. También valida los datos del mapa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { kill } from '../src/sim/combat.js';
import { ROUND } from '../src/config/balance.js';
import { pointInBox } from '../src/core/geom.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';

const MAP = MAPS[DEFAULT_MAP];
// Ambos bandos por órdenes: los defensores, sin orden de vigilancia, se quedan donde se los pone.
// Sin fases (phases: false): la sim corre siempre y acepta órdenes en cualquier
// momento; las fases y los turnos se prueban en turns.test.mjs.
const STILL = { attackers: 'human', defenders: 'human' };

/** Ronda con los defensores encerrados en la oficina (no ven el sitio) y ÁGUILA junto a la bomba. */
function atTheBomb(site) {
  const sim = new Simulation(MAP, { seed: 7, site, controllers: STILL, phases: false });
  sim.teams.defenders.forEach((d, i) => {
    d.x = 11.5 + i * 0.8;
    d.y = 9.5;
    d.behavior = null; // no watch order: nobody rotates to the noise of the defuse
  });
  const u = sim.teams.attackers[0];
  u.x = sim.bomb.x + 0.5;
  u.y = sim.bomb.y;
  for (const o of sim.teams.attackers.slice(1)) {
    o.x = 3 + o.slot;
    o.y = 20;
  }
  return { sim, u };
}

const runFor = (sim, seconds) => {
  const end = sim.tick + Math.round(seconds / sim.dt);
  while (!sim.outcome && sim.tick < end) sim.step();
};

for (const site of ['A', 'B']) {
  test(`desactivar la bomba en ${site} toma ${ROUND.defuseTime} s y gana la ronda`, () => {
    const { sim } = atTheBomb(site);
    assert.equal(sim.bomb.site, site);
    runFor(sim, ROUND.defuseTime - 0.5);
    assert.equal(sim.outcome, null, 'aún no termina');
    assert.ok(sim.bomb.spotted && sim.bomb.progress > 0.8);
    runFor(sim, 1);
    assert.equal(sim.outcome?.winner, 'attackers');
    assert.equal(sim.outcome?.reason, 'defused');
  });
}

test('moverse pierde el progreso de la desactivación', () => {
  const { sim, u } = atTheBomb('A');
  runFor(sim, 3);
  assert.equal(sim.bomb.defuserId, u.id);
  sim.enqueue({ type: 'addWaypoint', unitId: u.id, x: sim.bomb.x + 4, y: sim.bomb.y, user: true, team: 'attackers' });
  sim.step();
  assert.equal(sim.bomb.progress, 0);
  assert.equal(sim.bomb.defuserId, -1);
  assert.equal(u.defusing, false);
});

test('morir pierde el progreso y otro atacante empieza de cero', () => {
  const { sim, u } = atTheBomb('B');
  runFor(sim, 3);
  kill(sim, u, null, 0);
  sim.step();
  assert.equal(sim.bomb.progress, 0);
  assert.equal(sim.bomb.defuserId, -1);
  const other = sim.teams.attackers[1];
  other.x = sim.bomb.x - 0.5;
  other.y = sim.bomb.y;
  sim.enqueue({ type: 'defuseNow', unitId: other.id, team: 'attackers' });
  runFor(sim, ROUND.defuseTime + 0.2);
  assert.equal(sim.outcome?.reason, 'defused');
});

test('quien desactiva no dispara', () => {
  const { sim, u } = atTheBomb('A');
  runFor(sim, 0.5);
  assert.ok(u.defusing);
  const d = sim.teams.defenders[0];
  d.x = sim.bomb.x + 3;
  d.y = sim.bomb.y;
  const shots = u.stats.shots;
  runFor(sim, 0.5);
  assert.ok(u.visibleEnemies.includes(d.id), 've al defensor');
  runFor(sim, 1.5);
  assert.equal(u.stats.shots, shots);
});

test('sin bomba desactivada, el tiempo da la ronda al defensor', () => {
  const sim = new Simulation(MAP, { seed: 3, controllers: STILL, phases: false });
  sim.timeLeft = 0.05;
  runFor(sim, 0.2);
  assert.equal(sim.outcome?.winner, 'defenders');
  assert.equal(sim.outcome?.reason, 'time');
  assert.ok(sim.outcome.notes.some((n) => n.code === 'bombHidden' && n.site === sim.bomb.site));
});

test('eliminar a todos gana para cualquier bando', () => {
  const a = new Simulation(MAP, { seed: 3, controllers: STILL, phases: false });
  for (const d of a.teams.defenders) kill(a, d, null, 0);
  a.step();
  assert.deepEqual([a.outcome?.winner, a.outcome?.reason], ['attackers', 'elimination']);
  const b = new Simulation(MAP, { seed: 3, controllers: STILL, phases: false });
  for (const u of b.teams.attackers) kill(b, u, null, 0);
  b.step();
  assert.deepEqual([b.outcome?.winner, b.outcome?.reason], ['defenders', 'wiped']);
});

test('el mapa declara sitios, entradas, despliegue y huecos de barricada coherentes', () => {
  const sim = new Simulation(MAP, { seed: 1 });
  const c = sim.compiled;
  const nav = sim.world.nav;
  assert.deepEqual(c.sites.map((s) => s.id), ['A', 'B']);
  for (const s of c.sites) {
    assert.ok(pointInBox(s.bombX, s.bombY, s.box), `la bomba de ${s.id} está dentro del sitio`);
    assert.ok(nav.walkable(s.bombX, s.bombY), `la bomba de ${s.id} es alcanzable`);
    for (const d of c.defense[s.id]) {
      assert.ok(nav.walkable(...d.at), `defensor de ${s.id} en ${d.at} pisa suelo libre`);
      assert.ok(c.deployment.defenders.some((b) => pointInBox(d.at[0], d.at[1], b)), `defensor de ${s.id} en ${d.at} dentro de su mitad`);
    }
  }
  assert.ok(c.entries.length >= 2 && c.entries.length <= 3);
  for (const e of c.entries) {
    assert.ok(c.doors.some((d) => d.id === e.door), `la entrada ${e.id} abre una puerta del mapa`);
    for (const s of e.spawns) {
      assert.ok(nav.walkable(...s.at), `inicio de ${e.id} en ${s.at} pisa suelo libre`);
      assert.ok(c.deployment.attackers.some((b) => pointInBox(s.at[0], s.at[1], b)), `inicio de ${e.id} dentro de la mitad atacante`);
    }
    const sim2 = new Simulation(MAP, { seed: 1, entry: e.id });
    for (const site of c.sites) {
      const u = sim2.teams.attackers[0];
      assert.ok(nav.findPath(u.x, u.y, site.bombX, site.bombY, 1.5), `desde ${e.id} se llega a ${site.id}`);
    }
  }
  assert.ok(c.barricadeSlots.length > 0);
  for (const id of c.barricadeSlots) assert.ok(c.doors.some((d) => d.id === id));
});
