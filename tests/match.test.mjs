// Partida al mejor de 7: marcador, dinero entre rondas y equipo que se conserva.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { MATCH, BUY } from '../src/config/balance.js';
import { createMatch, matchLoadout, endMatchRound } from '../src/session/Match.js';
import { controllersFor } from '../src/config/squad.js';

const MAP = MAPS[DEFAULT_MAP];

function finished(match, winner, setup = () => {}) {
  const sim = new Simulation(MAP, { seed: 10 + match.round, loadout: matchLoadout(match) });
  setup(sim);
  sim.outcome = { winner, reason: winner === 'attackers' ? 'elimination' : 'wiped' };
  return endMatchRound(match, sim);
}

test('perder da menos que ganar, pero más cuanto más seguidas; las bajas pagan', () => {
  const m = createMatch();
  const e1 = finished(m, 'defenders');
  const e2 = finished(m, 'defenders');
  assert.equal(e1.income[0], MATCH.loss);
  assert.equal(e2.income[0], MATCH.loss + MATCH.lossBonus);
  const e3 = finished(m, 'attackers', (sim) => (sim.teams.attackers[0].stats.kills = 2));
  assert.equal(e3.income[0], MATCH.win + 2 * MATCH.kill);
  assert.equal(e3.income[1], MATCH.win);
  assert.equal(m.lossStreak, 0);
  assert.deepEqual(m.score, { player: 1, ai: 2 });
});

test('el dinero, la clase y el equipo de los vivos pasan a la ronda siguiente; el caído lo pierde', () => {
  const m = createMatch();
  finished(m, 'attackers', (sim) => {
    const [a, b, c] = sim.teams.attackers;
    a.money = 100;
    b.alive = false; // la Brecha cae con sus cargas
    c.gear.smoke = 0; // el Explorador usó el humo
  });
  const sim = new Simulation(MAP, { seed: 99, loadout: matchLoadout(m) });
  const [a, b, c] = sim.teams.attackers;
  assert.equal(a.money, 100 + MATCH.win);
  assert.equal(b.role, 'entry');
  assert.equal(b.gear.breach, 0, 'tiene que volver a comprar cargas');
  assert.equal(c.gear.smoke, 0);
  assert.equal(c.gear.flash, 1);
  // Lo que se lleva se puede usar: compra con su dinero.
  sim.enqueue({ team: 'attackers', type: 'buy', unitId: b.id, item: 'breach', count: 1 });
  sim.flushCommands();
  assert.equal(b.gear.breach, 1);
  assert.equal(b.money, m.slots[1].money - BUY.prices.breach);
});

test('gana el primero en llegar a 4, contando las rondas del jugador en los dos bandos', () => {
  const m = createMatch();
  // Rondas 1-3 ataca el jugador; desde la 4 defiende.
  for (const w of ['attackers', 'defenders', 'attackers', 'defenders', 'attackers']) finished(m, w);
  assert.equal(m.over, null);
  assert.deepEqual(m.score, { player: 3, ai: 2 });
  finished(m, 'defenders');
  assert.equal(m.over, 'player');
  assert.deepEqual(m.score, { player: 4, ai: 2 });
  assert.equal(m.history.length, 6);
});

test('al mejor de 3 gana el que llega a 2 y se cambia de bando tras la primera; al mejor de 5, a 3 y tras la segunda', () => {
  const m3 = createMatch('defenders', 3);
  assert.equal(m3.toWin, 2);
  assert.ok(finished(m3, 'defenders').switched, 'empezó defendiendo: ahora ataca');
  assert.equal(m3.team, 'attackers');
  finished(m3, 'attackers');
  assert.equal(m3.over, 'player');
  const m5 = createMatch('attackers', 5);
  assert.equal(m5.toWin, 3);
  assert.equal(finished(m5, 'attackers').switched, false);
  assert.ok(finished(m5, 'attackers').switched);
});

test('cambio de bando tras la ronda 3: el jugador defiende y los atacantes empiezan de cero', () => {
  const m = createMatch();
  for (let i = 0; i < m.switchAfter - 1; i++) assert.equal(finished(m, 'attackers').switched, false);
  assert.equal(m.team, 'attackers');
  const half = finished(m, 'defenders');
  assert.ok(half.switched);
  assert.equal(half.team, 'attackers', 'la ronda jugada fue de atacante');
  assert.equal(m.team, 'defenders');
  assert.equal(m.round, m.switchAfter + 1);
  assert.equal(m.slots, null);
  assert.equal(m.lossStreak, 0);
  assert.equal(matchLoadout(m), null);
  // La ronda siguiente la ataca la IA con el dinero de una primera ronda.
  const sim = new Simulation(MAP, { seed: 7, controllers: controllersFor(m.team), loadout: matchLoadout(m) });
  assert.equal(sim.controllers.attackers, 'ai');
  assert.equal(sim.controllers.defenders, 'human');
  const fresh = new Simulation(MAP, { seed: 7 });
  assert.deepEqual(sim.teams.attackers.map((u) => u.money), fresh.teams.attackers.map((u) => u.money));
  // Ganar defendiendo suma para el jugador; el cambio pasa una sola vez.
  const e = finished(m, 'defenders');
  assert.ok(e.playerWon);
  assert.equal(e.switched, false);
  assert.equal(m.team, 'defenders');
  assert.deepEqual(m.score, { player: 3, ai: 1 });
});

test('el tope de dinero', () => {
  const m = createMatch();
  finished(m, 'attackers');
  for (const sl of m.slots) sl.money = MATCH.cap - 10;
  finished(m, 'attackers');
  assert.ok(m.slots.every((sl) => sl.money === MATCH.cap));
});

test('las clases del lobby: cada puesto con la suya, también al cambiar de sitio; una elección imposible queda en la del puesto', () => {
  const roles = { attackers: ['assault', 'assault', 'scout'], defenders: ['roamer', 'defender', 'anchor'] };
  const sim = new Simulation(MAP, { seed: 3, site: 'A', controllers: controllersFor('defenders'), roles });
  assert.deepEqual(sim.teams.attackers.map((u) => u.role), ['assault', 'assault', 'scout']);
  assert.deepEqual(sim.teams.defenders.map((u) => u.role), ['roamer', 'defender', 'anchor']);
  assert.equal(sim.traps.length, 0, 'sin Trampero no hay trampas');
  sim.advancePhase(); // compra -> preparación
  sim.enqueue({ team: 'defenders', type: 'chooseSite', site: 'B' });
  sim.flushCommands();
  assert.equal(sim.site.id, 'B');
  assert.deepEqual(sim.teams.defenders.map((u) => u.role), ['roamer', 'defender', 'anchor']);
  const bad = new Simulation(MAP, { seed: 3, roles: { attackers: ['scout', 'scout', 'anchor'] } });
  assert.deepEqual(bad.teams.attackers.map((u) => u.role), ['assault', 'entry', 'scout'], 'los de siempre');
});
