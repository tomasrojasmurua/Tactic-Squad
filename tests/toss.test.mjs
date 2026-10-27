// Lanzar en cualquier punto (flash / granada / humo hacia donde elige el
// jugador) y el humo: tapa la vista, no las balas, y se disipa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { ENTRY } from '../src/config/balance.js';
import { lineOfSight, solidLineOfSight } from '../src/sim/vision.js';
import { gearLeft } from '../src/sim/queries.js';

const MAP = MAPS[DEFAULT_MAP];
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
