// Cámaras de los defensores: avisan dónde vieron a un atacante, los
// atacantes las descubren y las rompen de un tiro, y el humo las ciega.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { spawnSmoke } from '../src/sim/smoke.js';

const MAP = MAPS[DEFAULT_MAP];
const T = 'attackers';

function round(site = 'A') {
  const sim = new Simulation(MAP, { seed: 3, site });
  sim.skipToAssault();
  const cmd = (c) => {
    sim.enqueue({ team: T, ...c });
    sim.flushCommands();
  };
  return { sim, cmd, squad: sim.teams.attackers };
}

function run(sim, ticks, each = () => {}) {
  const events = [];
  for (let i = 0; i < ticks && !sim.outcome; i++) {
    if (sim.phase !== 'exec') sim.advancePhase();
    sim.step();
    for (const e of sim.drainEvents()) events.push(e);
    each();
  }
  return events;
}

test('cada sitio trae su cámara', () => {
  assert.equal(round('A').sim.cameras.length, 1);
  assert.equal(round('B').sim.cameras.length, 1);
});

test('la cámara del pasillo ve entrar al atacante y avisa; él la descubre y la rompe', () => {
  const { sim, cmd, squad } = round('A');
  const [a] = squad;
  cmd({ type: 'addWaypoint', unitId: a.id, x: 18, y: 12.7, user: true });
  const ev = run(sim, 60 * 14);
  const types = ev.map((e) => e.type);
  assert.ok(types.includes('cameraFound'), 'la vio');
  assert.ok(types.includes('cameraDestroyed'), 'la rompió');
  assert.equal(sim.cameras[0].alive, false);
  const destroyed = ev.find((e) => e.type === 'cameraDestroyed');
  assert.equal(destroyed.unitId, a.id);
});

test('una cámara conocida de antes (dron) se rompe antes de que alcance a avisar', () => {
  const play = (known) => {
    const { sim, cmd, squad } = round('A');
    const [a] = squad;
    sim.cameras[0].known = known;
    cmd({ type: 'addWaypoint', unitId: a.id, x: 18, y: 12.7, user: true });
    const ev = run(sim, 60 * 14);
    return ev.filter((e) => e.type === 'cameraSpot').length;
  };
  assert.equal(play(true), 0, 'pre-apuntada: no avisa');
});

test('con humo delante la cámara no ve nada', () => {
  const { sim, cmd, squad } = round('A');
  const [a] = squad;
  const cam = sim.cameras[0];
  // Un atacante parado en el pasillo, en el cono de la cámara.
  a.x = 18;
  a.y = 12.7;
  a.facing = Math.PI / 2; // mirando a la pared: no la rompe
  let spots = run(sim, 60).filter((e) => e.type === 'cameraSpot').length;
  assert.ok(spots >= 1, 'sin humo lo ve');
  cam.lastAlert = -Infinity;
  cam.watch = 0;
  spawnSmoke(sim, 22.5, 12.7);
  sim.smokes[0].age = 2; // ya formada
  spots = run(sim, 60).filter((e) => e.type === 'cameraSpot').length;
  assert.equal(spots, 0, 'el humo la ciega');
});
