// Arreglos de jugabilidad de la revisión: operadores que van al mismo punto
// no se traban, el que lanza el flash no se ciega solo, y la ronda del
// tutorial (menos defensores) se arma con los datos del mapa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { EV } from '../src/core/events.js';
import { lessonById } from '../src/config/lessons.js';
import { ALL_MAPS, TRAINING_MAP } from '../src/data/maps/index.js';

const MAP = ALL_MAPS[TRAINING_MAP];
const TUTORIAL = lessonById('basic').scenario;
const T = 'attackers';
const cmd = (sim, c) => {
  sim.enqueue({ team: T, ...c });
  sim.flushCommands();
};

/** No fight: a single defender (by orders, he stays put) far away in a corner, facing the wall. */
function quietRound(seed) {
  const sim = new Simulation(MAP, { seed, site: 'B', defenders: [0], controllers: { attackers: 'human', defenders: 'human' } });
  sim.skipToAssault();
  const d = sim.teams.defenders[0];
  d.x = 38.2;
  d.y = 25.2;
  d.facing = 0;
  return sim;
}

function playTurn(sim, onStep = () => {}) {
  sim.advancePhase();
  while (sim.phase === 'exec') {
    sim.step();
    onStep();
  }
}

/** Every "?" door on the squad's routes: "Abrir, de inmediato". */
function openAllDoors(sim) {
  for (const u of sim.teams.attackers) {
    for (let i = 0; i < u.route.length; i++) if (u.route[i].ask) cmd(sim, { type: 'setEntry', unitId: u.id, mode: null, index: i });
  }
}

test('tres operadores con ruta al mismo punto llegan y no se quedan empujándose', () => {
  const sim = quietRound(2);
  for (const u of sim.teams.attackers) cmd(sim, { type: 'addWaypoint', unitId: u.id, x: 22, y: 21.3, user: true });
  for (let turn = 0; turn < 6 && sim.teams.attackers.some((u) => u.route.length); turn++) {
    openAllDoors(sim);
    playTurn(sim);
  }
  for (const u of sim.teams.attackers) {
    assert.equal(u.route.length, 0, `${u.name} terminó su ruta`);
    assert.ok(Math.hypot(u.x - 22, u.y - 21.3) < 1.6, `${u.name} quedó junto al destino`);
  }
});

test('el que lanza el flash (y quien espera su estallido) no queda cegado', () => {
  const sim = quietRound(1);
  const [a] = sim.teams.attackers;
  cmd(sim, { type: 'addWaypoint', unitId: a.id, x: 13.5, y: 12.7, user: true });
  const i = a.route.findIndex((p) => p.ask);
  assert.ok(i >= 0, 'la ruta cruza la puerta de entrada');
  cmd(sim, { type: 'setEntry', unitId: a.id, mode: 'flash', index: i });
  cmd(sim, { type: 'setHold', unitId: a.id, code: 'A', index: i });
  sim.drainEvents();
  let given = false;
  const blinded = [];
  playTurn(sim, () => {
    if (!given && a.waitingGo) {
      sim.enqueue({ team: T, type: 'go', code: 'A', atTick: sim.round.execTick });
      given = true;
    }
    for (const e of sim.drainEvents()) {
      if (e.type === EV.GRENADE_THROWN) blinded.push('thrown');
      if (e.type === EV.BLINDED && e.unitId === a.id) blinded.push('blind');
    }
  });
  assert.deepEqual(blinded, ['thrown'], 'lanzó el flash y no se cegó');
});

test('la ronda del tutorial: sitio fijo y solo los defensores elegidos', () => {
  const sim = new Simulation(MAP, { seed: TUTORIAL.seed, site: TUTORIAL.site, defenders: TUTORIAL.defenders });
  assert.equal(sim.site.id, TUTORIAL.site);
  assert.equal(sim.teams.defenders.length, TUTORIAL.defenders.length);
  const layout = MAP.defense[TUTORIAL.site];
  sim.teams.defenders.forEach((d, i) => assert.deepEqual([d.x, d.y], layout[TUTORIAL.defenders[i]].at));
  sim.advancePhase(); // la IA defensora se prepara igual (sus 2 barricadas)
  assert.equal(sim.doors.filter((d) => d.barricaded).length, 2);
});
