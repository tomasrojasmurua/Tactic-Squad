// Lanzar en cualquier punto (flash / granada / humo hacia donde elige el
// jugador) y el humo: tapa la vista, no las balas, y se disipa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { ALL_MAPS, TRAINING_MAP } from '../src/data/maps/index.js';
import { ENTRY } from '../src/config/balance.js';
import { lineOfSight, solidLineOfSight } from '../src/sim/vision.js';
import { gearLeft, tossDoorway, tossLanding } from '../src/sim/queries.js';

const MAP = ALL_MAPS[TRAINING_MAP];
const T = 'attackers';

function round() {
  const sim = new Simulation(MAP, { seed: 3, site: 'B' });
  sim.skipToAssault();
  const cmd = (c) => {
    sim.enqueue({ team: T, ...c });
    sim.flushCommands();
  };
  return { sim, cmd, squad: sim.teams.attackers };
}
const rejects = (sim) => sim.drainEvents().filter((e) => e.type === 'orderRejected').map((e) => e.reason);

test('humo lanzado desde un punto: sale al llegar, tapa la vista y no las balas, y se va', () => {
  const { sim, cmd, squad } = round();
  const [a] = squad;
  a.gear.smoke = 1;
  cmd({ type: 'addWaypoint', unitId: a.id, x: 4.6, y: 20, user: true });
  cmd({ type: 'setToss', unitId: a.id, item: 'smoke', x: 4.6, y: 26 });
  assert.deepEqual(rejects(sim), []);
  assert.equal(gearLeft(a, 'smoke'), 0, 'el humo ya está comprometido');
  cmd({ type: 'setToss', unitId: a.id, item: 'flash', x: 4.6, y: 26 });
  assert.deepEqual(rejects(sim), a.gear.flash ? [] : ['noGear']);
  cmd({ type: 'setToss', unitId: a.id, item: 'smoke', x: 4.6, y: 26 });
  sim.advancePhase();
  let cloud = null;
  for (let i = 0; i < 900 && !cloud; i++) {
    if (sim.phase !== 'exec') sim.advancePhase();
    sim.step();
    if (sim.smokes.length && sim.smokes[0].r >= ENTRY.smoke.radius * 0.9) cloud = sim.smokes[0];
  }
  assert.ok(cloud, 'se formó la nube');
  assert.equal(a.gear.smoke, 0);
  const { x, y } = cloud;
  const r = ENTRY.smoke.radius + 1;
  assert.equal(lineOfSight(sim.world, x, y - r, x, y + r), false, 'no se ve a través');
  const solid = solidLineOfSight(sim.world, x, y - r, x, y + r);
  sim.world.updateSmokeSegments([]);
  assert.equal(lineOfSight(sim.world, x, y - r, x, y + r), solid, 'para las balas el humo no existe');
  sim.world.updateSmokeSegments(sim.smokes);
  // Pasa el tiempo: se disipa.
  for (let i = 0; i < 60 * (ENTRY.smoke.seconds + 1); i++) {
    if (sim.phase !== 'exec') sim.advancePhase();
    if (sim.outcome) break;
    sim.step();
  }
  assert.equal(sim.smokes.length, 0, 'se disipó');
});

test('una puerta y un lanzamiento no conviven en el mismo punto', () => {
  const { sim, cmd, squad } = round();
  const [a] = squad;
  a.gear.frag = 1;
  cmd({ type: 'addWaypoint', unitId: a.id, x: 14, y: 12.7, user: true });
  const i = a.route.findIndex((p) => p.ask);
  cmd({ type: 'setEntry', unitId: a.id, mode: 'kick', index: i });
  cmd({ type: 'setToss', unitId: a.id, item: 'frag', x: 18, y: 12.7, index: i });
  assert.equal(a.route[i].entry, null);
  assert.equal(a.route[i].toss.item, 'frag');
  cmd({ type: 'setEntry', unitId: a.id, mode: 'kick', index: i });
  assert.equal(a.route[i].toss, null);
  cmd({ type: 'setToss', unitId: a.id, item: 'rock', x: 1, y: 1, index: i });
  assert.deepEqual(rejects(sim), ['badItem']);
});

test('lanzar desde una puerta cerrada: la abre, lanza adentro, no se hiere y espera la explosión', () => {
  const { sim, cmd, squad } = round();
  const [a] = squad;
  a.gear.frag = 1;
  cmd({ type: 'addWaypoint', unitId: a.id, x: 14, y: 12.7, user: true });
  const i = a.route.findIndex((p) => p.ask);
  cmd({ type: 'setToss', unitId: a.id, item: 'frag', x: 13, y: 12.7, index: i });
  const p = a.route[i];
  const k = tossDoorway(sim.world, p, 13, 12.7);
  assert.ok(k >= 0, 'el lanzamiento pasa por la puerta del punto');
  const land = tossLanding(sim.world, p.x, p.y, 13, 12.7, {}, k);
  assert.ok(land.reach > 3, `cae adentro, no contra la puerta (${land.reach.toFixed(2)} m)`);
  sim.drainEvents();
  sim.advancePhase();
  let thrownAt = -1;
  let boomAt = -1;
  let movedAt = -1;
  let stand = null;
  for (let n = 0; n < 900 && movedAt < 0; n++) {
    if (sim.phase !== 'exec') sim.advancePhase();
    sim.step();
    for (const e of sim.drainEvents()) {
      if (e.type === 'grenadeThrown') {
        thrownAt = n;
        stand = { x: a.x, y: a.y };
      }
      if (e.type === 'grenadeDetonate') boomAt = n;
    }
    if (stand && movedAt < 0 && Math.hypot(a.x - stand.x, a.y - stand.y) > 0.05) movedAt = n;
  }
  assert.ok(thrownAt >= 0 && boomAt > thrownAt, 'lanzó y explotó');
  assert.ok(sim.doors[k].open, 'abrió la puerta para lanzar');
  assert.ok(movedAt >= boomAt, 'no se movió antes de la explosión');
  assert.ok(a.alive && a.hp === a.maxHp, 'el que lanza queda detrás del marco');
});

test('lanzar desde donde está: sin moverse lanza, espera la explosión y después sigue su ruta', () => {
  const { sim, cmd, squad } = round();
  const [a] = squad;
  a.gear.smoke = 1;
  const start = { x: a.x, y: a.y };
  cmd({ type: 'setToss', unitId: a.id, item: 'smoke', x: a.x, y: a.y + 5, index: 'here' });
  assert.deepEqual(rejects(sim), []);
  assert.equal(a.route.length, 1, 'un punto donde está');
  assert.ok(a.route[0].user && a.route[0].toss && Math.hypot(a.route[0].x - start.x, a.route[0].y - start.y) < 1e-9);
  // Con la ruta ya trazada, el lanzamiento queda antes de lo que camina.
  cmd({ type: 'addWaypoint', unitId: a.id, x: 4.6, y: 20, user: true });
  cmd({ type: 'setToss', unitId: a.id, item: 'smoke', x: a.x, y: a.y + 5, index: 'here' });
  assert.equal(a.route.filter((p) => p.toss).length, 1, 'el mismo punto, no otro');
  assert.ok(a.route[0].toss);
  sim.drainEvents();
  sim.advancePhase();
  let thrownAt = -1;
  let boomAt = -1;
  let movedAt = -1;
  for (let n = 0; n < 900 && movedAt < 0; n++) {
    if (sim.phase !== 'exec') sim.advancePhase();
    sim.step();
    for (const e of sim.drainEvents()) {
      if (e.type === 'grenadeThrown') thrownAt = n;
      if (e.type === 'grenadeDetonate') boomAt = n;
    }
    if (movedAt < 0 && Math.hypot(a.x - start.x, a.y - start.y) > 0.05) movedAt = n;
  }
  assert.ok(thrownAt >= 0, 'lanzó');
  assert.ok(boomAt > thrownAt && movedAt >= boomAt, 'lanzó sin moverse y avanzó después de que saliera');
});
