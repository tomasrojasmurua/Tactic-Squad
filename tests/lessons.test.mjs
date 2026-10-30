// Lecciones 2 a 4 (config/lessons.js): cada paso avanza con su gesto y la
// lección termina al volver a planificar tras el primer turno. Sin pantalla:
// la sesión se mueve a mano como lo haría session/SessionController.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { createSession } from '../src/session/Session.js';
import { Tutorial } from '../src/session/Tutorial.js';
import { lessonById } from '../src/config/lessons.js';
import { controllersFor } from '../src/config/squad.js';
import { watchOrder } from '../src/session/watch.js';
import { HERE } from '../src/sim/queries.js';
import { T as TEXTS } from '../src/ui/texts.js';
import { ALL_MAPS, TRAINING_MAP } from '../src/data/maps/index.js';

const MAP = ALL_MAPS[TRAINING_MAP];
const PHASE = { buy: 'buy', prep: 'prep', drone: 'drone', plan: 'planning', exec: 'running', end: 'ended' };

/** The lesson's round, its skipped phases gone by, the lesson begun. */
function setup(id) {
  const l = lessonById(id);
  const sc = l.scenario;
  const team = sc.team;
  const sim = new Simulation(MAP, { seed: sc.seed, site: sc.site, defenders: sc.defenders, controllers: controllersFor(team) });
  const session = createSession({ touch: false });
  session.team = team;
  const tut = new Tutorial(session);
  const sync = () => {
    while (sc.skip.includes(sim.phase)) sim.advancePhase();
    session.phase = PHASE[sim.phase];
  };
  sync();
  tut.begin(sim, id);
  const cmd = (c) => {
    sim.enqueue({ team, ...c });
    sim.flushCommands();
  };
  // Closes the info cards that come up; returns the step the player must do now.
  const step = () => {
    while (tut.update(sim) === 'card') assert.ok(tut.ack());
    return session.tutorial.id;
  };
  // LISTO: the next phase; a turn runs to its end. Returns what the lesson does then.
  const ready = () => {
    sim.advancePhase();
    sync();
    step();
    while (sim.phase === 'exec') sim.step();
    sync();
    return tut.update(sim);
  };
  return { sim, session, tut, cmd, step, ready };
}

test('cada paso de las lecciones tiene su tarjeta', () => {
  for (const id of ['doors', 'squad', 'defend']) {
    const l = lessonById(id);
    assert.ok(l.ready, id);
    for (const s of l.steps) assert.ok(TEXTS.flow.tutorial[s.id] && TEXTS.flow.tutorial[s.id].title, `${id}: ${s.id}`);
  }
});

test('lección 2, puertas: granada desde el costado, el compañero espera y otro lanza sin moverse', () => {
  const { sim, session, tut, cmd, step, ready } = setup('doors');
  const [a, b, c] = sim.teams.attackers;
  assert.equal(step(), 'doorAsk');
  assert.ok(tut.blocksReady());
  cmd({ type: 'addWaypoint', unitId: a.id, x: 13.5, y: 12.7, user: true });
  assert.equal(step(), 'doorBeside');
  cmd({ type: 'setEntry', unitId: a.id, mode: 'kick', index: a.route.findIndex((p) => p.ask) });
  assert.equal(step(), 'doorBeside', 'la patada no se hace desde el costado');
  cmd({ type: 'setEntry', unitId: a.id, mode: 'frag', index: a.route.findIndex((p) => p.entryDoor >= 0) });
  assert.equal(step(), 'doorWait');
  cmd({ type: 'addWaypoint', unitId: b.id, x: 13.5, y: 13.2, user: true });
  assert.equal(step(), 'doorHere');
  cmd({ type: 'setToss', unitId: c.id, index: HERE, item: 'flash', x: 8, y: 12 });
  assert.equal(step(), 'doorsExecute');
  assert.ok(!tut.blocksReady());
  assert.equal(ready(), 'card');
  assert.equal(session.tutorial.id, 'doorsEnd');
  tut.ack();
  assert.equal(tut.update(sim), 'done');
  assert.ok(session.tutorial.lessonsDone.includes('doors'));
});

test('lección 3, escuadra: fila, dos grupos con su GO, sigilo y el GO', () => {
  const { sim, session, tut, cmd, step } = setup('squad');
  const [a, b, c] = sim.teams.attackers;
  assert.equal(step(), 'squadFile');
  cmd({ type: 'follow', unitId: b.id, leaderId: a.id, rank: 1 });
  cmd({ type: 'follow', unitId: c.id, leaderId: a.id, rank: 2 });
  assert.equal(step(), 'squadGroups');
  cmd({ type: 'addWaypoint', unitId: a.id, x: 9.2, y: 12.7, user: true });
  cmd({ type: 'setHold', unitId: a.id, code: 'A', index: a.route.length - 1 });
  assert.equal(step(), 'squadGroups', 'un solo color todavía');
  cmd({ type: 'addWaypoint', unitId: c.id, x: 9.2, y: 9.3, user: true });
  assert.equal(c.follow, null, 'con su propia ruta sale de la fila');
  cmd({ type: 'setHold', unitId: c.id, code: 'B', index: c.route.length - 1 });
  assert.equal(step(), 'squadSneak');
  cmd({ type: 'setPace', unitId: c.id, index: c.route.length - 1, pace: 'sneak' });
  assert.equal(step(), 'squadExecute');
  sim.advancePhase();
  sim.enqueue({ team: 'attackers', type: 'go', code: 'A', atTick: sim.round.execTick });
  session.phase = 'running';
  assert.equal(step(), 'squadGo');
  while (sim.phase === 'exec') sim.step();
  session.phase = PHASE[sim.phase];
  assert.equal(tut.update(sim), 'card');
  assert.equal(session.tutorial.id, 'squadEnd');
  tut.ack();
  assert.equal(tut.update(sim), 'done');
  assert.ok(session.tutorial.lessonsDone.includes('squad'));
});

test('lección 4, defender: barricada, cámaras, colocar, vigilancia y un turno del asalto', () => {
  const { sim, session, tut, cmd, step, ready } = setup('defend');
  assert.equal(sim.phase, 'prep', 'sin compra');
  assert.equal(step(), 'defBarricade');
  assert.ok(tut.blocksReady(), 'CONFIRMAR espera la barricada');
  cmd({ type: 'barricade', door: 'sala', on: true });
  assert.equal(step(), 'defRecon');
  assert.ok(!tut.blocksReady());
  cmd({ type: 'endRecon' });
  assert.equal(step(), 'defSelect');
  assert.equal(session.selectedId, -1);
  const d = sim.teams.defenders[1];
  session.selectedId = d.id;
  assert.equal(step(), 'defPlace');
  assert.ok(tut.blocksReady());
  cmd({ type: 'placeUnit', unitId: d.id, x: d.x + 1.5, y: d.y });
  assert.equal(step(), 'defWatch');
  cmd({ type: 'setWatch', unitId: d.id, watch: watchOrder('sweep', d.facing) });
  assert.equal(step(), 'defReady');
  assert.ok(!tut.blocksReady());
  ready();
  assert.equal(sim.phase, 'plan', 'sin dron: de la preparación al asalto');
  assert.equal(session.tutorial.id, 'defExecute');
  assert.equal(ready(), 'card');
  assert.equal(session.tutorial.id, 'defEnd');
  tut.ack();
  assert.equal(tut.update(sim), 'done');
  assert.ok(session.tutorial.lessonsDone.includes('defend'));
});
