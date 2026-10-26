// La simulación debe ser determinista: misma semilla + mismas órdenes = mismo resultado.
// Juega rondas completas sin pantalla dos veces y compara el estado final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';

// Planes por sitio: los atacantes cruzan el pasillo hacia A, o entran por el baño hacia B.
const PLANS = {
  A: { entry: 'principal', points: [[10.6, 12.7], [27.4, 12.7], [33.5, 12.7]] },
  B: { entry: 'sur', points: [[10.6, 21.55], [15.4, 19.5], [16.6, 19.5], [21.4, 21.0]] },
};

function playRound(seed, site) {
  const plan = PLANS[site];
  const sim = new Simulation(MAPS[DEFAULT_MAP], { seed, site, entry: plan.entry });
  sim.skipToAssault();
  for (const u of sim.teams.attackers) {
    for (const [x, y] of plan.points) sim.enqueue({ type: 'addWaypoint', unitId: u.id, x, y: y + (u.slot - 1) * 0.6, user: true, team: 'attackers' });
  }
  // Turnos We-Go: el plan se da en el primer turno; los demás se ejecutan sin cambios.
  while (sim.phase === 'plan') {
    sim.advancePhase();
    while (sim.phase === 'exec') sim.step();
  }
  return {
    tick: sim.tick,
    turn: sim.turn,
    outcome: sim.outcome && { winner: sim.outcome.winner, reason: sim.outcome.reason },
    bomb: { ...sim.bomb },
    units: sim.units.map((u) => [u.alive, u.hp, +u.x.toFixed(6), +u.y.toFixed(6)]),
  };
}

for (const site of ['A', 'B']) {
  test(`la misma semilla y las mismas órdenes dan la misma ronda (sitio ${site})`, () => {
    const a = playRound(1234, site);
    const b = playRound(1234, site);
    assert.ok(a.outcome, 'la ronda debe terminar');
    assert.deepEqual(a, b);
  });
}

test('el sitio que elige el defensor depende solo de la semilla', () => {
  const map = MAPS[DEFAULT_MAP];
  const picks = { A: 0, B: 0 };
  for (let seed = 0; seed < 100; seed++) {
    const site = new Simulation(map, { seed }).site.id;
    assert.equal(new Simulation(map, { seed }).site.id, site);
    picks[site]++;
  }
  assert.ok(picks.A > 20 && picks.B > 20, `ambos sitios deben salir: ${JSON.stringify(picks)}`);
});
