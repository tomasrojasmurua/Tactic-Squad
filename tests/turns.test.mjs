// Fases de la ronda y asalto We-Go por turnos (sim/round.js), ruido
// (sim/noise.js) y la vista de cada bando (sim/view.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { TURN_TICKS } from '../src/sim/round.js';
import { isGoReady } from '../src/sim/queries.js';
import { teamView } from '../src/sim/view.js';
import { EV } from '../src/core/events.js';
import { ROUND } from '../src/config/balance.js';
import { ALL_MAPS, TRAINING_MAP } from '../src/data/maps/index.js';

const MAP = ALL_MAPS[TRAINING_MAP];
const STILL = { attackers: 'human', defenders: 'human' };
const T = 'attackers';

const cmd = (sim, c) => sim.enqueue({ team: T, ...c });
const wp = (sim, u, x, y) => cmd(sim, { type: 'addWaypoint', unitId: u.id, x, y, user: true });
const rejects = (sim) => sim.drainEvents().filter((e) => e.type === EV.ORDER_REJECTED).map((e) => e.reason);

/** Ejecuta el turno planificado (ROUND.turnSeconds) y vuelve a planificar (o termina). */
function playTurn(sim) {
  sim.advancePhase();
  while (sim.phase === 'exec') sim.step();
}

test('la ronda pasa por compra, preparación, dron y planificación; solo el dron hace correr el tiempo', () => {
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
  assert.deepEqual([sim.phase, sim.turn], ['drone', 0]);
  sim.advancePhase(); // LISTO durante el dron: se retira
  assert.deepEqual([sim.phase, sim.turn], ['plan', 1]);
  for (let i = 0; i < 30; i++) sim.step();
  assert.equal(sim.tick, 0);
  assert.equal(sim.timeLeft, ROUND.timeLimit, 'la preparación no gasta el tiempo de la bomba');
});

test('cada turno ejecuta exactamente ROUND.turnSeconds y vuelve a planificar; durante la ejecución no hay órdenes de ruta', () => {
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
  wp(sim, u, 10.6, 21.55); // lejos: más de un turno de camino
  wp(sim, u, 15.4, 19.5);
  wp(sim, u, 6.2, 22.4); // y de vuelta
  playTurn(sim);
  assert.ok(u.route.length > 0, 'la ruta sigue');
  const y = u.y;
  cmd(sim, { type: 'clearRoute', unitId: u.id });
  wp(sim, u, u.x, y - 3);
  playTurn(sim);
  assert.ok(u.y < y, 'el nuevo plan manda en el turno siguiente');
});

test('la bomba explota al acabar su tiempo de ejecución (planificar no gasta su tiempo): ganan los defensores', () => {
  const sim = new Simulation(MAP, { seed: 9 });
  sim.skipToAssault();
  let exploded = 0;
  while (sim.phase === 'plan') {
    playTurn(sim);
    exploded += sim.drainEvents().filter((e) => e.type === EV.BOMB_EXPLODED).length;
  }
  assert.equal(sim.phase, 'end');
  assert.deepEqual([sim.outcome?.winner, sim.outcome?.reason], ['defenders', 'time']);
  assert.equal(exploded, 1);
  assert.equal(sim.tick, ROUND.timeLimit * 60, 'explota en el paso exacto, aunque sea a mitad de turno');
  assert.equal(sim.turn, Math.ceil(ROUND.timeLimit / ROUND.turnSeconds));
  assert.equal(sim.timeLeft, 0);
});

/** Un atacante junto a la bomba (sitio A), con los defensores lejos y quietos. */
function atTheBomb(seed) {
  const sim = new Simulation(MAP, { seed, site: 'A', controllers: STILL });
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
  return { sim, u };
}

test('la desactivación de 7 s cruza el turno: el progreso se congela al planificar y sigue', () => {
  const { sim, u } = atTheBomb(7);
  // Empieza a desactivar a los 3 s del turno: le quedan 5 de los 7 s.
  sim.advancePhase();
  sim.round.execTick = TURN_TICKS - 5 * 60;
  sim.bomb.progress = 0;
  while (sim.phase === 'exec') sim.step();
  const p = sim.bomb.progress;
  assert.ok(p > 0.6 && p < 1, `avanzó ${p.toFixed(2)} de 1`);
  assert.equal(sim.bomb.defuserId, u.id);
  sim.step();
  assert.equal(sim.bomb.progress, p, 'planificar no avanza el progreso');
  playTurn(sim);
  assert.deepEqual([sim.outcome?.reason, sim.turn], ['defused', 2]);
});

test('la bomba explota aunque estén a mitad de la desactivación', () => {
  const { sim } = atTheBomb(7);
  sim.round.execTotal = (ROUND.timeLimit - 3) * 60; // quedan 3 s en el temporizador
  playTurn(sim);
  assert.ok(sim.bomb.progress > 0 && !sim.bomb.defused);
  assert.deepEqual([sim.outcome?.winner, sim.outcome?.reason], ['defenders', 'time']);
});

test('los GO no se dan al planificar: son del turno', () => {
  const sim = new Simulation(MAP, { seed: 11, controllers: STILL });
  sim.skipToAssault();
  const a = sim.teams.attackers[0];
  wp(sim, a, a.x + 0.5, a.y);
  cmd(sim, { type: 'setHold', unitId: a.id, code: 'A' });
  cmd(sim, { type: 'go', code: 'A' });
  sim.flushCommands();
  assert.deepEqual(rejects(sim), ['notNow']);
});

test('el GO de un grupo suelta a los que esperan; el que viene atrasado sigue de largo al llegar', () => {
  const sim = new Simulation(MAP, { seed: 11, site: 'A', entry: 'principal', controllers: STILL });
  sim.skipToAssault();
  const [a, b] = sim.teams.attackers;
  wp(sim, a, 9.0, 12.2); // pegado a la puerta: la espera es la decisión de esa puerta
  cmd(sim, { type: 'setHold', unitId: a.id, code: 'A' });
  wp(sim, a, 12, 12.4);
  wp(sim, b, 6.2, 22.4); // lejos de su espera
  wp(sim, b, 9.0, 13.2);
  cmd(sim, { type: 'setHold', unitId: b.id, code: 'A' });
  wp(sim, b, 12, 13.1);
  sim.advancePhase();
  while (!a.waitingGo) sim.step();
  assert.ok(!b.waitingGo && b.route.some((p) => p.hold), 'b todavía va de camino a su espera');
  cmd(sim, { type: 'go', code: 'A', atTick: sim.round.execTick });
  sim.step();
  assert.equal(sim.goCount, 1);
  assert.ok(!a.waitingGo, 'a sale');
  assert.ok(!b.route.some((p) => p.hold), 'b ya no se detendrá: el GO se dio');
  while (sim.phase === 'exec') sim.step();
  for (let k = 0; k < 3 && sim.phase === 'plan'; k++) playTurn(sim);
  assert.ok(!b.waitingGo && Math.hypot(b.x - 12, b.y - 13.1) < 1, 'b llegó al final sin esperar');
});

test('un GO marcado con su paso se aplica en ese paso del turno (repeticiones, servidor)', () => {
  const sim = new Simulation(MAP, { seed: 11, controllers: STILL });
  sim.skipToAssault();
  const a = sim.teams.attackers[0];
  wp(sim, a, a.x + 0.5, a.y);
  cmd(sim, { type: 'setHold', unitId: a.id, code: 'B' });
  sim.advancePhase();
  cmd(sim, { type: 'go', code: 'B', atTick: 180 });
  let at = -1;
  while (sim.phase === 'exec') {
    sim.step();
    if (at < 0 && sim.goCount > 0) at = sim.round.execTick;
  }
  assert.equal(at, 181, 'se aplica al empezar el paso 180 (execTick cuenta los pasos ya hechos)');
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
