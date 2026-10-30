// La IA atacante (sim/aiAttack.js): juega el lado atacante con las mismas
// órdenes que un jugador (compra, dron, entrada, rutas, puertas y GO), sin
// sim.rng, así que una ronda IA contra IA se repite igual con la misma semilla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { EV } from '../src/core/events.js';
import { ALL_MAPS, TRAINING_MAP } from '../src/data/maps/index.js';

const MAP = ALL_MAPS[TRAINING_MAP];
const AI_VS_AI = { attackers: 'ai', defenders: 'ai' };

/** A whole round with nobody pressing anything: decision phases end at once, live ones run. */
function playRound(seed, opts = {}) {
  const sim = new Simulation(MAP, { seed, controllers: AI_VS_AI, ...opts });
  const events = [];
  for (let guard = 0; sim.phase !== 'end' && guard < 20000; guard++) {
    if (sim.phase === 'buy' || sim.phase === 'prep' || sim.phase === 'plan') sim.advancePhase();
    else sim.step();
    events.push(...sim.drainEvents());
  }
  return { sim, events };
}

const count = (events, type) => events.filter((e) => e.type === type).length;

test('una ronda IA contra IA termina y se repite igual con la misma semilla', () => {
  const summary = (seed) => {
    const { sim } = playRound(seed);
    return { outcome: sim.outcome && [sim.outcome.winner, sim.outcome.reason], tick: sim.tick, entry: sim.entry.id, units: sim.units.map((u) => [u.alive, u.hp, +u.x.toFixed(5), +u.y.toFixed(5)]) };
  };
  const a = summary(11);
  assert.ok(a.outcome, 'la ronda debe terminar');
  assert.deepEqual(summary(11), a);
});

test('la IA atacante usa el dron, elige entrada, coordina las puertas con GO y nunca pide algo imposible', () => {
  for (const seed of [1, 4, 7]) {
    const { sim, events } = playRound(seed);
    assert.equal(count(events, EV.DRONE_LAUNCHED), 1, `semilla ${seed}: lanza el dron`);
    assert.ok(sim.bomb.spotted, `semilla ${seed}: encuentra la bomba`);
    assert.ok(count(events, EV.GO_CODE) >= 1, `semilla ${seed}: da GO`);
    assert.ok(count(events, EV.GRENADE_THROWN) + count(events, EV.CHARGE_FIRE) >= 1, `semilla ${seed}: entra con utilidad`);
    const rejected = events.filter((e) => e.type === EV.ORDER_REJECTED).map((e) => e.reason);
    assert.deepEqual(rejected, [], `semilla ${seed}: órdenes rechazadas`);
    assert.ok(sim.compiled.entries.some((e) => e.id === sim.entry.id));
  }
});

test('la IA atacante va por la entrada que el mapa le indica para el sitio', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { sim } = playRound(seed);
    assert.ok(Object.keys(MAP.aiEntries[sim.site.id]).includes(sim.entry.id), `semilla ${seed}: ${sim.site.id} por ${sim.entry.id}`);
  }
});

test('contra la defensa del mapa la IA atacante gana a veces, no siempre', () => {
  let wins = 0;
  const N = 24;
  for (let seed = 1; seed <= N; seed++) if (playRound(seed).sim.outcome.winner === 'attackers') wins++;
  assert.ok(wins >= 4 && wins <= N - 4, `ganó ${wins} de ${N}`);
});

test('las órdenes de un jugador no mueven a un bando que juega la IA', () => {
  const sim = new Simulation(MAP, { seed: 3, controllers: AI_VS_AI });
  sim.skipToAssault();
  const u = sim.teams.attackers[0];
  sim.enqueue({ team: 'attackers', type: 'addWaypoint', unitId: u.id, x: 8, y: 12, user: true });
  sim.enqueue({ type: 'addWaypoint', unitId: u.id, x: 8, y: 12, user: true });
  sim.flushCommands();
  assert.equal(u.route.length, 0);
});

test('un operador empujado contra una pared vuelve a buscar el camino a su punto', () => {
  const sim = new Simulation(MAP, { seed: 2, site: 'B', defenders: [0], controllers: { attackers: 'human', defenders: 'human' } });
  sim.skipToAssault();
  const d = sim.teams.defenders[0];
  d.x = 38.2;
  d.y = 25.2;
  d.facing = 0;
  // In the bathroom, right against the lounge wall, with his next point straight through it.
  const u = sim.teams.attackers[0];
  u.x = u.prevX = 15.6;
  u.y = u.prevY = 21.1;
  u.route.push({ x: 22.7, y: 21.1, user: true, look: null, hold: false, code: null, entry: null, entryDoor: -1, ask: false, door: -1 });
  for (let turn = 0; turn < 4 && u.route.length; turn++) {
    sim.advancePhase();
    while (sim.phase === 'exec') sim.step();
  }
  assert.equal(u.route.length, 0, 'llegó');
  assert.ok(Math.hypot(u.x - 22.7, u.y - 21.1) < 0.5);
});
