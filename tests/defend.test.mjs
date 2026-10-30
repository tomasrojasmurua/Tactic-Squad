// Jugar de defensor contra la IA atacante: la preparación del defensor con
// sus órdenes, la vigilancia que sigue sola en el asalto (también la de un
// defensor humano) y mover a un defensor entre turnos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { EV } from '../src/core/events.js';
import { controllersFor } from '../src/config/squad.js';
import { PREP, MOVE } from '../src/config/balance.js';
import { watchOf, watchOrder } from '../src/session/watch.js';
import { ALL_MAPS, TRAINING_MAP } from '../src/data/maps/index.js';

const MAP = ALL_MAPS[TRAINING_MAP];
const DEF = 'defenders';
const cmd = (sim, c) => {
  sim.enqueue({ team: DEF, ...c });
  sim.flushCommands();
};
const rejects = (sim) => sim.drainEvents().filter((e) => e.type === EV.ORDER_REJECTED).map((e) => e.reason);

/** A round where the player defends, at the start of the preparation (the AI's squad bought when the buy ended). */
function defending(seed = 5) {
  const sim = new Simulation(MAP, { seed, controllers: controllersFor(DEF) });
  sim.advancePhase(); // buy -> prep
  return sim;
}

function playOut(sim) {
  for (let guard = 0; sim.phase !== 'end' && guard < 20000; guard++) {
    if (sim.phase === 'prep' || sim.phase === 'plan') sim.advancePhase();
    else sim.step();
  }
}

test('de defensor, la IA juega a los atacantes y el jugador a los defensores', () => {
  const sim = defending();
  assert.deepEqual(sim.controllers, { attackers: 'ai', defenders: 'human' });
  assert.ok(sim.teams.attackers.some((u) => (u.gear.flash || 0) > 1), 'la IA atacante compró');
  // His orders reach only his side.
  const a = sim.teams.attackers[0];
  cmd(sim, { type: 'addWaypoint', unitId: a.id, x: 8, y: 12, user: true });
  assert.equal(a.route.length, 0);
});

test('la preparación del defensor: sitio, posición, vigilancia y barricadas', () => {
  const sim = defending();
  const other = sim.site.id === 'A' ? 'B' : 'A';
  cmd(sim, { type: 'chooseSite', site: other });
  assert.equal(sim.site.id, other);
  const d = sim.teams.defenders[0];
  cmd(sim, { type: 'placeUnit', unitId: d.id, x: 30, y: 20 });
  assert.deepEqual([d.x, d.y], [30, 20]);
  cmd(sim, { type: 'placeUnit', unitId: d.id, x: 24, y: 18 }); // on the lounge's furniture: next to it
  assert.ok(sim.world.nav.walkable(d.x, d.y) && Math.hypot(d.x - 24, d.y - 18) < 1.6);
  cmd(sim, { type: 'placeUnit', unitId: d.id, x: 5, y: 12 }); // the attackers' yard
  assert.deepEqual(rejects(sim), ['outsideHalf']);
  cmd(sim, { type: 'setWatch', unitId: d.id, watch: watchOrder('sweep', Math.PI, null) });
  const w = watchOf(d);
  assert.equal(w.mode, 'sweep');
  assert.ok(Math.abs(w.facing - Math.PI) < 1e-9);
  assert.ok(Math.abs(d.behavior.to - d.behavior.from - PREP.sweepArc) < 1e-9);
  cmd(sim, { type: 'barricade', door: 'sala', on: true });
  cmd(sim, { type: 'barricade', door: 'cocina', on: true });
  cmd(sim, { type: 'barricade', door: 'banio-sala', on: true });
  assert.deepEqual(rejects(sim), ['tooManyBarricades']);
  assert.deepEqual(sim.doors.filter((x) => x.barricaded).map((x) => x.def.id).sort(), ['cocina', 'sala']);
});

test('los modos de vigilancia del panel se leen como se dieron', () => {
  const sim = defending();
  const d = sim.teams.defenders[0];
  for (const mode of ['fixed', 'sweep', 'alert']) {
    cmd(sim, { type: 'setWatch', unitId: d.id, watch: watchOrder(mode, 1, null) });
    assert.equal(watchOf(d).mode, mode);
  }
  // A player's defenders bring no fallback of the map's: they move only when sent.
  assert.ok(sim.teams.defenders.every((u) => watchOf(u).fallback === null && watchOf(u).mode !== 'patrol'));
});

test('la vigilancia de un defensor humano sigue sola en el asalto (barrer gira)', () => {
  const sim = defending();
  const d = sim.teams.defenders[0];
  cmd(sim, { type: 'setWatch', unitId: d.id, watch: watchOrder('sweep', Math.PI, null) });
  sim.advancePhase(); // prep -> drone
  while (sim.phase === 'drone') sim.step();
  const seen = new Set();
  sim.advancePhase(); // first turn
  for (let i = 0; i < 120 && sim.phase === 'exec'; i++) {
    sim.step();
    seen.add(d.facing.toFixed(2));
  }
  assert.ok(seen.size > 10, 'su mirada barre');
});

test('mover a un defensor en la planificación deja su modo de vigilancia y quita su repliegue', () => {
  const sim = defending();
  sim.advancePhase();
  while (sim.phase === 'drone') sim.step();
  const d = sim.teams.defenders.find((u) => u.behavior && u.behavior.type === 'scan');
  cmd(sim, { type: 'addWaypoint', unitId: d.id, x: 33, y: 12, user: true });
  assert.equal(d.behavior.type, 'scan');
  assert.ok(!d.behavior.rotate);
  assert.ok(d.route.length > 0);
  const p = sim.teams.defenders.find((u) => u.behavior && u.behavior.type === 'patrol');
  if (p) {
    cmd(sim, { type: 'addWaypoint', unitId: p.id, x: p.x + 1, y: p.y, user: true });
    assert.equal(p.behavior.type, 'hold');
  }
});

/** Where his watch has a defender look over `steps` of turns (plannings passed through; a noise may turn him away for a while). */
function facings(sim, d, steps) {
  const seen = [];
  for (let i = 0; i < steps; i++) {
    if (sim.phase === 'plan') sim.advancePhase();
    sim.step();
    seen.push(d.ai.baseFacing);
  }
  return seen;
}
const spread = (xs) => Math.max(...xs) - Math.min(...xs);

test('la vigilancia se cambia en cada planificación del asalto: barrer y dejar de barrer', () => {
  const sim = defending();
  sim.advancePhase();
  while (sim.phase === 'drone') sim.step();
  assert.equal(sim.phase, 'plan');
  const d = sim.teams.defenders.find((u) => u.behavior && u.behavior.type === 'hold');
  const w = watchOf(d);
  cmd(sim, { type: 'setWatch', unitId: d.id, watch: watchOrder('sweep', w.facing, w.fallback) });
  assert.deepEqual(rejects(sim), []);
  assert.equal(watchOf(d).mode, 'sweep');
  assert.ok(spread(facings(sim, d, 240)) > PREP.sweepArc * 0.5, 'ahora barre');

  while (sim.phase !== 'plan') sim.step();
  cmd(sim, { type: 'setWatch', unitId: d.id, watch: watchOrder('fixed', w.facing, null) });
  assert.equal(watchOf(d).mode, 'fixed');
  const late = facings(sim, d, 240).slice(120);
  assert.ok(spread(late) < 0.01, 'ya no barre');
  assert.ok(Math.abs(Math.atan2(Math.sin(late[0] - w.facing), Math.cos(late[0] - w.facing))) < 0.05, 'mira donde miraba');
});

test('un defensor que barre y se mueve barre alrededor de la mirada que se le dio al llegar', () => {
  const sim = defending();
  for (const a of sim.teams.attackers) a.alive = false;
  sim.advancePhase();
  while (sim.phase === 'drone') sim.step();
  const d = sim.teams.defenders.find((u) => u.behavior && u.behavior.type === 'scan');
  cmd(sim, { type: 'addWaypoint', unitId: d.id, x: 33, y: 12, user: true });
  cmd(sim, { type: 'setLook', unitId: d.id, angle: Math.PI / 2 });
  for (let i = 0; i < 60 * 12 && d.route.length; i++) {
    if (sim.phase !== 'exec') sim.advancePhase();
    sim.step();
  }
  assert.equal(d.route.length, 0);
  assert.equal(watchOf(d).mode, 'sweep');
  const half = (d.behavior.to - d.behavior.from) / 2; // the arc he had (the map's)
  const seen = facings(sim, d, 360);
  assert.ok(spread(seen) > half, 'barre');
  for (const f of seen) assert.ok(Math.abs(Math.atan2(Math.sin(f - Math.PI / 2), Math.cos(f - Math.PI / 2))) <= half + 0.01);
});

test('una ronda completa de defensor contra la IA termina', () => {
  const sim = defending(9);
  playOut(sim);
  assert.ok(sim.outcome);
});

test('asomarse y volver: va al punto, mira ahí un momento y vuelve a su lugar mirando como antes', () => {
  const sim = defending();
  sim.advancePhase();
  while (sim.phase === 'drone') sim.step();
  for (const a of sim.teams.attackers) a.alive = false; // nadie que lo interrumpa (la ronda termina sola al final)
  const d = sim.teams.defenders.find((u) => u.behavior && u.behavior.type !== 'hold');
  cmd(sim, { type: 'setWatch', unitId: d.id, watch: watchOrder('alert', d.facing, null) }); // que no barra al volver
  const home = { x: d.x, y: d.y, facing: d.facing };
  cmd(sim, { type: 'addWaypoint', unitId: d.id, x: 33, y: 12, user: true });
  cmd(sim, { type: 'setLook', unitId: d.id, angle: Math.PI });
  const peek = d.route.length - 1;
  cmd(sim, { type: 'setPeek', unitId: d.id, on: true });
  assert.equal(d.route[peek].pause, MOVE.peekTime);
  const end = d.route[d.route.length - 1];
  assert.ok(end.back && end.user);
  assert.ok(Math.hypot(end.x - home.x, end.y - home.y) < 0.3, 'vuelve a donde estaba');

  // Quitarlo deja la ruta como estaba.
  cmd(sim, { type: 'setPeek', unitId: d.id, on: false });
  assert.equal(d.route.length, peek + 1);
  assert.equal(d.route[peek].pause, 0);
  cmd(sim, { type: 'setPeek', unitId: d.id, on: true });

  let still = 0;
  let looked = false;
  for (let i = 0; i < 60 * 12 && d.route.length; i++) {
    if (sim.phase !== 'exec') sim.advancePhase();
    sim.step();
    if (Math.hypot(d.x - 33, d.y - 12) < 0.05) {
      still += 1 / 60;
      if (Math.abs(Math.cos(d.facing) + 1) < 0.01) looked = true;
    }
  }
  assert.equal(d.route.length, 0, 'terminó el recorrido');
  assert.ok(still >= MOVE.peekTime - 0.05, `se quedó ${still.toFixed(2)} s asomado`);
  assert.ok(looked, 'mirando hacia donde se le dijo');
  assert.ok(Math.hypot(d.x - home.x, d.y - home.y) < 0.3, 'volvió');
  for (let i = 0; i < 60; i++) sim.step();
  assert.ok(Math.abs(Math.atan2(Math.sin(d.facing - home.facing), Math.cos(d.facing - home.facing))) < 0.05, 'mirando como antes');
});
