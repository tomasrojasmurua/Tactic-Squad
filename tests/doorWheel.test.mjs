// Rueda de la puerta: tocar una puerta apila al operador del lado cercano y
// abre la rueda en ese punto; tocar lejos de la puerta sigue siendo un punto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { ALL_MAPS, TRAINING_MAP } from '../src/data/maps/index.js';
import { ENTRY } from '../src/config/balance.js';
import { EV } from '../src/core/events.js';
import { EventBus } from '../src/core/EventBus.js';
import { createSession } from '../src/session/Session.js';
import { PlanningController } from '../src/input/PlanningController.js';

// A flat camera, 50 px per meter; tap(x, y) below takes meters.
const PX = 50;
const camera = { screenToWorld: (x, y) => ({ x: x / PX, y: y / PX }), worldToScreen: (x, y) => ({ x: x * PX, y: y * PX }), metersPerPixel: () => 1 / PX };

function setup() {
  const sim = new Simulation(ALL_MAPS[TRAINING_MAP], { seed: 3, site: 'B' });
  sim.skipToAssault();
  const bus = new EventBus();
  const session = createSession({ touch: false });
  session.phase = 'planning';
  session.team = 'attackers';
  const u = sim.teams.attackers[0];
  session.selectedId = u.id;
  const commands = [];
  bus.on(EV.COMMAND, (c) => {
    commands.push(c);
    sim.enqueue(c);
    sim.flushCommands();
  });
  const planning = new PlanningController({ bus, camera, session, getSim: () => sim });
  const tap = (x, y) => planning.tap(x * PX, y * PX);
  return { sim, session, tap, u, commands };
}

test('tocar una puerta: se apila del lado cercano y pide la rueda en ese punto', () => {
  const { sim, session, tap, u, commands } = setup();
  const d = sim.world.doorways[0];
  tap(d.cx + 0.1, d.cy + 0.2);
  const add = commands.find((c) => c.type === 'addWaypoint');
  assert.ok(add, 'agregó un punto');
  const across = (add.x - d.cx) * d.normalX + (add.y - d.cy) * d.normalY;
  const sideOfUnit = Math.sign((u.x - d.cx) * d.normalX + (u.y - d.cy) * d.normalY);
  assert.ok(Math.abs(Math.abs(across) - ENTRY.askDistance) < 1e-6, 'pegado a la puerta');
  assert.equal(Math.sign(across), sideOfUnit, 'del lado por donde llega');
  assert.deepEqual(session.ui.wheelAt, { unitId: u.id, x: add.x, y: add.y });
  const last = u.route.at(-1);
  assert.ok(Math.hypot(last.x - add.x, last.y - add.y) < 0.3, 'la ruta termina en ese punto');
});

test('tocar lejos de la puerta sigue agregando un punto común', () => {
  const { sim, session, tap, commands } = setup();
  const d = sim.world.doorways[0];
  tap(d.cx + d.normalX * 3, d.cy + d.normalY * 3);
  assert.equal(commands.filter((c) => c.type === 'addWaypoint').length, 1);
  assert.equal(session.ui.wheelAt, null);
});
