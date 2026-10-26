// Fases de la ronda y asalto We-Go por turnos (sim/round.js), ruido
// (sim/noise.js) y la vista de cada bando (sim/view.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { TURN_TICKS } from '../src/sim/round.js';
import { teamView } from '../src/sim/view.js';
import { EV } from '../src/core/events.js';
import { ROUND } from '../src/config/balance.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';

const MAP = MAPS[DEFAULT_MAP];
const STILL = { attackers: 'human', defenders: 'human' };
const T = 'attackers';

const cmd = (sim, c) => sim.enqueue({ team: T, ...c });
const wp = (sim, u, x, y) => cmd(sim, { type: 'addWaypoint', unitId: u.id, x, y, user: true });
const rejects = (sim) => sim.drainEvents().filter((e) => e.type === EV.ORDER_REJECTED).map((e) => e.reason);

/** Ejecuta el turno planificado (5 s) y vuelve a planificar (o termina). */
function playTurn(sim) {
  sim.advancePhase();
  while (sim.phase === 'exec') sim.step();
}

test('la ronda pasa por compra, preparación y planificación sin que corra el tiempo', () => {
  const sim = new Simulation(MAP, { seed: 5 });
  assert.equal(sim.phase, 'buy');
  const u = sim.teams.attackers[0];
  wp(sim, u, 10, 12.7);
  sim.flushCommands();
  assert.deepEqual(rejects(sim), ['notNow'], 'en la compra no se dan órdenes');
  sim.step();
  assert.equal(sim.tick, 0, 'una fase de decisión no avanza la simulación');
  sim.advancePhase();
  assert.equal(sim.phase, 'prep');
  sim.advancePhase();
  assert.deepEqual([sim.phase, sim.turn], ['plan', 1]);
  for (let i = 0; i < 30; i++) sim.step();
  assert.equal(sim.tick, 0);
});

test('cada turno ejecuta exactamente 5 s y vuelve a planificar; durante la ejecución no hay órdenes', () => {
  const sim = new Simulation(MAP, { seed: 5 });
  sim.skipToAssault();
  const u = sim.teams.attackers[0];
  wp(sim, u, 8.5, 12.7);
  sim.advancePhase();
  assert.equal(sim.phase, 'exec');
  sim.step();
  wp(sim, u, 4, 20);
  sim.step();
  assert.ok(rejects(sim).includes('notNow'), 'la orden en plena ejecución se rechaza');
  while (sim.phase === 'exec') sim.step();
  assert.equal(sim.tick, TURN_TICKS);
  assert.deepEqual([sim.phase, sim.turn], ['plan', 2]);
  assert.equal(sim.timeLeft, ROUND.timeLimit - ROUND.turnSeconds);
});

test('las rutas sin terminar siguen al turno siguiente y se pueden cambiar al planificar', () => {
  const sim = new Simulation(MAP, { seed: 5, controllers: STILL });
  sim.skipToAssault();
  const u = sim.teams.attackers[0];
  wp(sim, u, 10.6, 21.55); // lejos: más de 5 s de camino
  wp(sim, u, 15.4, 19.5);
  playTurn(sim);
  assert.ok(u.route.length > 0, 'la ruta sigue');
  const y = u.y;
  cmd(sim, { type: 'clearRoute', unitId: u.id });
  wp(sim, u, u.x, y - 3);
  playTurn(sim);
  assert.ok(u.y < y, 'el nuevo plan manda en el turno siguiente');
});

test('tras el turno 18 sin resultado ganan los defensores por tiempo', () => {
  const sim = new Simulation(MAP, { seed: 9 });
  sim.skipToAssault();
  while (sim.phase === 'plan') playTurn(sim);
  assert.equal(sim.phase, 'end');
  assert.deepEqual([sim.outcome?.winner, sim.outcome?.reason, sim.turn], ['defenders', 'time', ROUND.maxTurns]);
  assert.equal(sim.tick, ROUND.maxTurns * TURN_TICKS);
  assert.equal(sim.timeLeft, 0);
});

test('la desactivación de 7 s cruza el turno: el progreso se congela al planificar y sigue', () => {
  const sim = new Simulation(MAP, { seed: 7, site: 'A', controllers: STILL });
  sim.teams.defenders.forEach((d, i) => {
    d.x = 11.5 + i * 0.8;
    d.y = 9.5;
  });
  const [u, ...rest] = sim.teams.attackers;
  u.x = sim.bomb.x + 0.5;
  u.y = sim.bomb.y;
  rest.forEach((o) => {
    o.x = 3 + o.slot;
    o.y = 20;
  });
  sim.skipToAssault();
  playTurn(sim);
  const p = sim.bomb.progress;
  assert.ok(p > 0.6 && p < 1, `avanza ${ROUND.turnSeconds} de ${ROUND.defuseTime} s`);
  assert.equal(sim.bomb.defuserId, u.id);
  sim.step();
  assert.equal(sim.bomb.progress, p, 'planificar no avanza el progreso');
  playTurn(sim);
  assert.deepEqual([sim.outcome?.reason, sim.turn], ['defused', 2]);
});

test('un GO agendado espera a que todos los de su código estén en posición, aunque pase al turno siguiente', () => {
  const sim = new Simulation(MAP, { seed: 11, site: 'A', entry: 'principal', controllers: STILL });
  sim.skipToAssault();
  const [a, b] = sim.teams.attackers;
  wp(sim, a, 8.2, 12.0);
  cmd(sim, { type: 'setHold', unitId: a.id, code: 'A' });
  wp(sim, a, 12, 12.4);
  wp(sim, b, 6.2, 22.4); // lejos de su espera: llega en el segundo turno
  wp(sim, b, 8.2, 13.4);
  cmd(sim, { type: 'setHold', unitId: b.id, code: 'A' });
  wp(sim, b, 12, 13.1);
  cmd(sim, { type: 'go', code: 'A' });
  sim.flushCommands();
  assert.deepEqual(sim.round.gos.map((g) => g.code), ['A']);
  playTurn(sim);
  assert.equal(sim.goCount, 0, 'aún falta uno: el GO no se da');
  assert.ok(a.waitingGo);
  assert.equal(sim.round.gos.length, 1, 'sigue agendado para el turno siguiente');
  for (let k = 0; k < 4 && sim.goCount === 0; k++) playTurn(sim);
  assert.equal(sim.goCount, 1, 'con los dos en posición, sale');
  assert.equal(sim.round.gos.length, 0);
});

test('un GO agendado no sale antes de su segundo dentro del turno', () => {
  const sim = new Simulation(MAP, { seed: 11, site: 'A', entry: 'principal', controllers: STILL });
  sim.skipToAssault();
  const a = sim.teams.attackers[0];
  wp(sim, a, a.x + 0.5, a.y);
  cmd(sim, { type: 'setHold', unitId: a.id, code: 'B' });
  cmd(sim, { type: 'go', code: 'B', at: 3.2 }); // se redondea a 3 s
  sim.flushCommands();
  assert.equal(sim.round.gos[0].at, 3);
  sim.advancePhase();
  let at = -1;
  while (sim.phase === 'exec') {
    sim.step();
    if (at < 0 && sim.goCount > 0) at = sim.round.execTick;
  }
  assert.equal(at, 3 * 60 + 1, 'sale en el primer paso a partir de los 3 s');
});

test('en la preparación el atacante elige entrada; luego ya no puede', () => {
  const sim = new Simulation(MAP, { seed: 3, entry: 'principal' });
  sim.advancePhase();
  cmd(sim, { type: 'chooseEntry', entry: 'sur' });
  sim.flushCommands();
  assert.equal(sim.entry.id, 'sur');
  const spawn = sim.entry.spawns[0].at;
  assert.deepEqual([sim.teams.attackers[0].x, sim.teams.attackers[0].y], spawn);
  sim.advancePhase();
  cmd(sim, { type: 'chooseEntry', entry: 'norte' });
  sim.flushCommands();
  assert.equal(sim.entry.id, 'sur');
  assert.ok(rejects(sim).includes('notNow'));
});

/** Ronda completa por turnos con un plan dado en el primero y otro en el tercero. */
function playPlanned(seed) {
  const sim = new Simulation(MAP, { seed, site: 'B' });
  sim.advancePhase();
  cmd(sim, { type: 'chooseEntry', entry: 'sur' });
  sim.advancePhase();
  for (const u of sim.teams.attackers) {
    for (const [x, y] of [[10.6, 21.55], [15.4, 19.5]]) wp(sim, u, x, y + (u.slot - 1) * 0.6);
  }
  playTurn(sim);
  playTurn(sim);
  for (const u of sim.teams.attackers) if (u.alive) wp(sim, u, 21.4, 21.0 + (u.slot - 1) * 0.5);
  while (sim.phase === 'plan') playTurn(sim);
  return {
    tick: sim.tick,
    turn: sim.turn,
    outcome: sim.outcome && { winner: sim.outcome.winner, reason: sim.outcome.reason },
    units: sim.units.map((u) => [u.alive, u.hp, +u.x.toFixed(6), +u.y.toFixed(6)]),
    pulses: JSON.stringify(sim.noise.pulses),
  };
}

test('misma semilla y mismos paquetes de turno = misma ronda, ruido incluido', () => {
  const a = playPlanned(2468);
  const b = playPlanned(2468);
  assert.ok(a.outcome, 'la ronda debe terminar');
  assert.deepEqual(a, b);
});

test('lo que planifica un bando no cambia nada de lo que ve el otro', () => {
  const sim = new Simulation(MAP, { seed: 21, site: 'A' });
  sim.skipToAssault();
  const before = JSON.stringify(teamView(sim, 'defenders'));
  const defenders = JSON.stringify(sim.teams.defenders.map((d) => [d.x, d.y, d.facing, d.route.length]));
  for (const u of sim.teams.attackers) wp(sim, u, 27.4, 12.7);
  cmd(sim, { type: 'setHold', unitId: sim.teams.attackers[0].id, code: 'A' });
  sim.flushCommands();
  assert.equal(JSON.stringify(teamView(sim, 'defenders')), before);
  assert.equal(JSON.stringify(sim.teams.defenders.map((d) => [d.x, d.y, d.facing, d.route.length])), defenders);
});

test('el ruido llega como pulso aproximado solo al bando que lo oye', () => {
  const sim = new Simulation(MAP, { seed: 13, site: 'A', entry: 'principal', controllers: STILL });
  sim.skipToAssault();
  const [d0, ...others] = sim.teams.defenders;
  d0.x = 13;
  d0.y = 12.7;
  d0.facing = 0; // de espaldas a la puerta
  others.forEach((d, i) => {
    d.x = 36 + i * 0.8;
    d.y = 24;
  });
  const a = sim.teams.attackers[0];
  wp(sim, a, 8.6, 12.7); // camina hasta la puerta, a 4-5 m del defensor
  playTurn(sim);
  const heard = teamView(sim, 'defenders').pulses;
  assert.ok(heard.length > 0, 'los defensores oyen los pasos');
  assert.ok(heard.every((p) => p.turn === 1 && p.kind === 'step'));
  assert.ok(heard.every((p) => Math.hypot(p.x - a.x, p.y - a.y) < 6), 'cerca de donde caminó, no exacto');
  assert.equal(teamView(sim, 'attackers').pulses.length, 0, 'nadie oye sus propios pasos');
  for (let k = 0; k < 3; k++) playTurn(sim);
  assert.equal(teamView(sim, 'defenders').pulses.length, 0, `el pulso se apaga en ${3} turnos`);
});

test('la vista de un bando no incluye a los enemigos que no ve', () => {
  const sim = new Simulation(MAP, { seed: 21, site: 'A' });
  sim.skipToAssault();
  playTurn(sim);
  const v = teamView(sim, 'attackers');
  const seen = new Set(sim.teams.attackers.flatMap((u) => u.visibleEnemies));
  assert.equal(v.enemies.length, seen.size);
  assert.ok(v.enemies.every((e) => seen.has(e.id)));
  assert.equal(v.bomb, sim.bomb.spotted ? v.bomb : null, 'la bomba solo si la encontraron');
  assert.ok(teamView(sim, 'defenders').bomb, 'el defensor sabe dónde la dejó');
});
