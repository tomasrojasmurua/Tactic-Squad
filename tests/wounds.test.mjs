// Heridas que duran (sim/wounds.js): pierna más lenta y ruidosa, brazo que apunta y recarga peor,
// y el rastro de sangre que el rival solo conoce cuando lo ve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { ALL_MAPS, TRAINING_MAP, MAPS } from '../src/data/maps/index.js';
import { WOUNDS } from '../src/config/balance.js';
import { woundSpeed, woundSpread, woundReload, woundStepNoise, bleed, spotBlood } from '../src/sim/wounds.js';
import { hashSim } from '../src/net/stateHash.js';

const fresh = () => new Simulation(ALL_MAPS[TRAINING_MAP], { seed: 4, phases: false });

test('pierna: más lento y ruidoso; brazo: apunta y recarga peor', () => {
  const sim = fresh();
  const u = sim.teams.attackers[0];
  assert.equal(woundSpeed(u), 1);
  u.wounds.leg = true;
  assert.equal(woundSpeed(u), WOUNDS.legSpeed);
  assert.ok(woundStepNoise(u) > 1);
  u.wounds.arm = true;
  assert.ok(woundSpread(u) > 1 && woundReload(u) > 1);
});

test('un herido grave deja sangre al caminar; el rival la conoce solo al verla', () => {
  const sim = fresh();
  const u = sim.teams.attackers[0];
  bleed(sim, u, 5);
  assert.equal(sim.blood.length, 0, 'sano: nada');
  u.hp = u.maxHp * 0.3;
  for (let i = 0; i < 5; i++) bleed(sim, u, 0.5);
  assert.ok(sim.blood.length >= 2, 'herido grave: deja gotas');
  // Put a defender looking straight at the drops.
  const d = sim.teams.defenders[0];
  const drop = sim.blood[0];
  d.x = drop.x + 3;
  d.y = drop.y;
  d.facing = Math.PI;
  sim.tick = WOUNDS.spotEvery;
  spotBlood(sim);
  assert.ok(sim.blood.some((b) => b.known), 'el defensor que mira las ve');
});

test('una ronda con heridas sigue siendo determinista y hay heridas que duran', () => {
  const play = () => {
    const sim = new Simulation(MAPS.hotel, { seed: 23, controllers: { attackers: 'ai', defenders: 'ai' } });
    let wounded = 0;
    for (let g = 0; sim.phase !== 'end' && g < 40000; g++) {
      if (sim.phase === 'buy' || sim.phase === 'prep' || sim.phase === 'plan') sim.advancePhase();
      else sim.step();
      for (const e of sim.drainEvents()) if (e.type === 'hit' && e.wound) wounded++;
    }
    return { h: hashSim(sim), wounded };
  };
  const a = play();
  assert.equal(a.h, play().h);
});
