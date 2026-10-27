// Jugar de defensor contra la IA atacante: la preparación del defensor con
// sus órdenes, la vigilancia que sigue sola en el asalto (también la de un
// defensor humano) y mover a un defensor entre turnos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { EV } from '../src/core/events.js';
import { controllersFor } from '../src/config/squad.js';
import { PREP } from '../src/config/balance.js';
import { watchOf, watchOrder } from '../src/session/watch.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';

const MAP = MAPS[DEFAULT_MAP];
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
  // A fallback from the map's layout survives a change of mode.
  const g = sim.teams.defenders.find((u) => u.behavior && u.behavior.rotate);
  const before = watchOf(g).fallback;
  cmd(sim, { type: 'setWatch', unitId: g.id, watch: watchOrder('fixed', 0, before) });
  assert.deepEqual(watchOf(g).fallback, before);
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

test('mover a un defensor en la planificación cambia su vigilancia a fija donde llega', () => {
  const sim = defending();
  sim.advancePhase();
  while (sim.phase === 'drone') sim.step();
  const d = sim.teams.defenders.find((u) => u.behavior && u.behavior.type !== 'hold');
  cmd(sim, { type: 'addWaypoint', unitId: d.id, x: 33, y: 12, user: true });
  assert.equal(d.behavior.type, 'hold');
  assert.ok(!d.behavior.rotate);
  assert.ok(d.route.length > 0);
});

test('una ronda completa de defensor contra la IA termina', () => {
  const sim = defending(9);
  playOut(sim);
  assert.ok(sim.outcome);
});
