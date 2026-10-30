// Tutorial guiado (session/Tutorial.js): recorre la ronda en orden, cada
// tarjeta espera su fase, LISTO solo sirve en los pasos que lo piden y los
// consejos salen una sola vez. Sin pantalla: la sesión se mueve a mano como
// lo haría session/SessionController.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { createSession } from '../src/session/Session.js';
import { Tutorial } from '../src/session/Tutorial.js';
import { LESSONS, lessonById, nextLesson } from '../src/config/lessons.js';

const BASIC = lessonById('basic');
const TUTORIAL = BASIC.scenario;
import { ALL_MAPS, TRAINING_MAP } from '../src/data/maps/index.js';

const MAP = ALL_MAPS[TRAINING_MAP];
const T = 'attackers';
const PHASE = { buy: 'buy', prep: 'prep', drone: 'drone', plan: 'planning', exec: 'running', end: 'ended' };

function setup() {
  const sim = new Simulation(MAP, { seed: TUTORIAL.seed, site: TUTORIAL.site, defenders: TUTORIAL.defenders });
  const session = createSession({ touch: false });
  session.phase = 'buy';
  const tut = new Tutorial(session);
  tut.begin(sim, 'basic');
  const sync = () => (session.phase = PHASE[sim.phase]);
  const cmd = (c) => {
    sim.enqueue({ team: T, ...c });
    sim.flushCommands();
  };
  return { sim, session, tut, sync, cmd };
}

test('el tutorial enseña el asalto: planificar, puerta, GO de color y el primer turno', () => {
  const { sim, session, tut, sync, cmd } = setup();
  const t = session.tutorial;
  const [a] = sim.teams.attackers;
  // El tutorial salta compra, entrada y dron (SessionController lockedPhases): empieza planificando.
  sim.skipToAssault();
  sync();

  assert.equal(tut.update(sim), 'card', 'la bienvenida sale como tarjeta');
  assert.equal(t.id, 'welcome');
  assert.ok(tut.blocksReady(), 'LISTO no sirve con la tarjeta (la cierra)');
  assert.ok(tut.ack());
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
  assert.equal(t.id, 'door', 'la ruta cruza una puerta: se enseña a decidirla');
  const i = a.route.findIndex((p) => p.ask);
  cmd({ type: 'setEntry', unitId: a.id, mode: 'flash', index: i });
  tut.update(sim);
  assert.equal(t.id, 'hold');
  cmd({ type: 'setHold', unitId: a.id, code: 'A', index: a.route.findIndex((p) => p.entry) }); // beside the frame now
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
  assert.equal(BASIC.steps.length, t.count);
  assert.deepEqual(t.lessonsDone, ['basic'], 'la lección queda hecha');
});

test('compra, entrada y dron se presentan con una tarjeta la primera vez que llegan', () => {
  const { sim, session, tut, sync } = setup();
  tut.finish();
  sync();
  assert.equal(session.phase, 'buy');
  assert.equal(tut.update(sim, false), 'card', 'la compra se presenta');
  assert.equal(session.tutorial.tip, 'introBuy');
  tut.ack();
  assert.equal(tut.update(sim, false), null, 'una sola vez');
  sim.advancePhase();
  sync();
  assert.equal(tut.update(sim, false), 'card');
  assert.equal(session.tutorial.tip, 'introPrep');
  tut.ack();
  sim.advancePhase();
  sync();
  assert.equal(session.phase, 'drone');
  assert.equal(tut.update(sim, false), 'card');
  assert.equal(session.tutorial.tip, 'introDrone');
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

test('las lecciones son datos: cada una con su escenario y sus pasos; la siguiente es la primera sin hacer', () => {
  for (const l of LESSONS.filter((x) => x.ready)) {
    assert.ok(l.scenario && l.steps.length > 0, l.id);
    assert.ok(l.steps.every((s) => typeof s.id === 'string'));
  }
  assert.equal(nextLesson([]).id, 'basic');
  assert.equal(nextLesson(['basic']), LESSONS.find((l) => l.ready && l.id !== 'basic') || null);
});

test('lección 5, ronda completa: cada fase con su tarjeta, de la compra al asalto', () => {
  const sc = lessonById('round').scenario;
  const sim = new Simulation(MAP, { seed: sc.seed, site: sc.site });
  const session = createSession({ touch: false });
  const tut = new Tutorial(session);
  const sync = () => (session.phase = PHASE[sim.phase]);
  sync();
  tut.begin(sim, 'round');
  const t = session.tutorial;
  const seen = [];
  for (let guard = 0; t.active && guard < 4000; guard++) {
    const r = tut.update(sim, true);
    if (r === 'card') {
      seen.push(t.id);
      assert.ok(tut.ack());
      continue;
    }
    if (!t.active) break;
    assert.ok(!tut.blocksReady(), `LISTO sirve tras ${t.id}`);
    if (sim.phase === 'drone' || sim.phase === 'exec') sim.step();
    else sim.advancePhase();
    sync();
  }
  assert.deepEqual(seen, ['roundWelcome', 'introBuy', 'introPrep', 'introDrone', 'roundPlan']);
  assert.ok(t.lessonsDone.includes('round'));
  assert.equal(sim.phase, 'plan', 'termina al planificar el primer turno');
});
