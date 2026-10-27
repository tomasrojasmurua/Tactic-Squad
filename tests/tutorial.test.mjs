// Tutorial guiado (session/Tutorial.js): recorre la ronda en orden, cada
// tarjeta espera su fase, LISTO solo sirve en los pasos que lo piden y los
// consejos salen una sola vez. Sin pantalla: la sesión se mueve a mano como
// lo haría session/SessionController.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { createSession } from '../src/session/Session.js';
import { Tutorial, TUTORIAL_STEPS } from '../src/session/Tutorial.js';
import { TUTORIAL } from '../src/config/ui.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';

const MAP = MAPS[DEFAULT_MAP];
const T = 'attackers';
const PHASE = { buy: 'buy', prep: 'prep', drone: 'drone', plan: 'planning', exec: 'running', end: 'ended' };

function setup() {
  const sim = new Simulation(MAP, { seed: TUTORIAL.seed, site: TUTORIAL.site, defenders: TUTORIAL.defenders });
  const session = createSession({ touch: false });
  session.phase = 'buy';
  const tut = new Tutorial(session);
  tut.begin(sim);
  const sync = () => (session.phase = PHASE[sim.phase]);
  const cmd = (c) => {
    sim.enqueue({ team: T, ...c });
    sim.flushCommands();
  };
  return { sim, session, tut, sync, cmd };
}

test('el tutorial recorre compra, preparación, dron y el primer turno en orden', () => {
  const { sim, session, tut, sync, cmd } = setup();
  const t = session.tutorial;
  const [a] = sim.teams.attackers;

  assert.equal(tut.update(sim), 'card', 'la bienvenida sale como tarjeta');
  assert.equal(t.id, 'welcome');
  assert.ok(tut.blocksReady(), 'LISTO no sirve con la tarjeta (la cierra)');
  assert.ok(tut.ack());
  tut.update(sim);
  assert.equal(t.id, 'buy');
  assert.ok(tut.blocksReady(), 'en el paso de comprar, LISTO espera');
  cmd({ type: 'buy', unitId: a.id, item: 'breach', count: 1 });
  tut.update(sim);
  assert.equal(t.id, 'buyReady');
  assert.ok(!tut.blocksReady());

  sim.advancePhase();
  sync();
  assert.equal(tut.update(sim), 'card');
  assert.equal(t.id, 'prep');
  tut.ack();
  tut.update(sim);
  assert.equal(t.id, 'entry');
  cmd({ type: 'chooseEntry', entry: 'sur' });
  tut.noteEntry();
  tut.update(sim);
  assert.equal(t.id, 'prepReady');

  sim.advancePhase();
  sync();
  assert.equal(session.phase, 'drone');
  assert.equal(tut.update(sim), 'card', 'la tarjeta del dron sale antes de manejarlo');
  tut.ack();
  tut.update(sim);
  assert.equal(t.id, 'droneFly');
  sim.advancePhase(); // retirarlo
  sync();
  assert.equal(tut.update(sim), 'card');
  assert.equal(t.id, 'plan');
  tut.ack();
  tut.update(sim);
  assert.equal(t.id, 'select');
  assert.equal(session.selectedId, -1, 'empieza sin nadie elegido');

  session.selectedId = a.id;
  tut.update(sim);
  assert.equal(t.id, 'route');
  cmd({ type: 'addWaypoint', unitId: a.id, x: 13.5, y: 21.5, user: true }); // por la puerta del baño
  tut.update(sim);
  assert.equal(t.id, 'door', 'la ruta cruza una puerta: hay que decidirla');
  const i = a.route.findIndex((p) => p.ask);
  cmd({ type: 'setEntry', unitId: a.id, mode: 'flash', index: i });
  tut.update(sim);
  assert.equal(t.id, 'hold');
  cmd({ type: 'setHold', unitId: a.id, code: 'A', index: i });
  tut.update(sim);
  assert.equal(t.id, 'look');
  assert.ok(tut.blocksReady());
  cmd({ type: 'setLook', unitId: a.id, angle: 0 });
  tut.update(sim);
  assert.equal(t.id, 'execute');
  assert.ok(!tut.blocksReady());

  sim.advancePhase();
  sync();
  tut.update(sim);
  assert.equal(t.id, 'go');
  sim.enqueue({ team: T, type: 'go', code: 'A', atTick: sim.round.execTick });
  while (sim.phase === 'exec') sim.step();
  sync();
  tut.update(sim);
  assert.equal(t.id, 'turnEnd');
  assert.ok(t.card, 'el fin del turno se explica al volver a planificar');
  tut.ack();
  assert.equal(tut.update(sim), 'done');
  assert.ok(!t.active && t.done);
  assert.equal(TUTORIAL_STEPS.length, t.count);
});

test('los consejos salen una vez, al planificar, solo en la ronda del tutorial', () => {
  const { sim, session, tut, sync } = setup();
  tut.finish();
  sim.skipToAssault();
  sync();
  sim.intel.barricades.add(sim.doors.findIndex((d) => d.barricaded));
  assert.equal(tut.update(sim, false), null, 'fuera del tutorial no hay consejos');
  assert.equal(tut.update(sim, true), 'card');
  assert.equal(session.tutorial.tip, 'barricade');
  tut.ack();
  assert.equal(tut.update(sim, true), null, 'no se repite');
});

test('volver al menú a mitad del tutorial no lo marca como hecho', () => {
  const { session, tut } = setup();
  tut.stop();
  assert.ok(!session.tutorial.active);
  assert.ok(!session.tutorial.done);
});
