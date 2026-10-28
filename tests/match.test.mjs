// Partida al mejor de 7: marcador, punto extra para el que pierde y clases que se conservan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { BUY } from '../src/config/balance.js';
import { createMatch, matchLoadout, endMatchRound } from '../src/session/Match.js';
import { controllersFor } from '../src/config/squad.js';

const MAP = MAPS[DEFAULT_MAP];

function finished(match, winner, setup = () => {}) {
  const sim = new Simulation(MAP, { seed: 10 + match.round, loadout: matchLoadout(match), lossBonus: match.lossBonus });
  setup(sim);
  sim.outcome = { winner, reason: winner === 'attackers' ? 'elimination' : 'wiped' };
  return endMatchRound(match, sim);
}

test('el bando que pierde la ronda tiene un punto más de utilidad en la siguiente', () => {
  const m = createMatch();
  assert.equal(m.lossBonus, null);
  const e1 = finished(m, 'defenders');
  assert.equal(e1.bonus, 'attackers');
  const sim = new Simulation(MAP, { seed: 5, loadout: matchLoadout(m), lossBonus: m.lossBonus });
  assert.ok(sim.teams.attackers.every((u) => u.points === BUY.points + BUY.lossBonus));
  assert.ok(sim.teams.defenders.every((u) => u.points === BUY.points));
  finished(m, 'attackers');
  assert.equal(m.lossBonus, 'defenders');
  assert.deepEqual(m.score, { player: 1, ai: 1 });
});

test('pasa la clase; el equipo vuelve completo, también para el que cayó, y lo que no se gastó se pierde', () => {
  const m = createMatch();
  finished(m, 'attackers', (sim) => {
    const [a, b, c] = sim.teams.attackers;
    a.points = 1; // le sobró un punto
    b.alive = false; // la Brecha cae con sus cargas
    c.gear.smoke = 0; // el Explorador usó el humo
  });
  const sim = new Simulation(MAP, { seed: 99, loadout: matchLoadout(m), lossBonus: m.lossBonus });
  const [a, b, c] = sim.teams.attackers;
  assert.equal(a.points, BUY.points, 'los puntos no se acumulan');
  assert.equal(b.role, 'entry');
  assert.equal(b.gear.breach, 2, 'su clase le repone las cargas');
  assert.equal(c.gear.smoke, 1);
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
  assert.equal(m.lossBonus, null, 'el punto extra no cruza el cambio de bando');
  assert.equal(matchLoadout(m), null);
  // La ronda siguiente la ataca la IA como en una primera ronda.
  const sim = new Simulation(MAP, { seed: 7, controllers: controllersFor(m.team), loadout: matchLoadout(m), lossBonus: m.lossBonus });
  assert.equal(sim.controllers.attackers, 'ai');
  assert.equal(sim.controllers.defenders, 'human');
  const fresh = new Simulation(MAP, { seed: 7 });
  assert.deepEqual(sim.teams.attackers.map((u) => u.points), fresh.teams.attackers.map((u) => u.points));
  // Ganar defendiendo suma para el jugador; el cambio pasa una sola vez.
  const e = finished(m, 'defenders');
  assert.ok(e.playerWon);
  assert.equal(e.switched, false);
  assert.equal(m.team, 'defenders');
  assert.deepEqual(m.score, { player: 3, ai: 1 });
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
