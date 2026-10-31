// Supresión (sim/stress.js): las balas que pasan cerca, las explosiones y las bajas a la vista
// estresan; el estrés baja solo con calma; al tope el soldado se tira al piso un momento.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { ALL_MAPS, TRAINING_MAP, MAPS } from '../src/data/maps/index.js';
import { STRESS } from '../src/config/balance.js';
import { stressShot, stressBlast, updateStress, stressSpread, stressReaction } from '../src/sim/stress.js';
import { hashSim } from '../src/net/stateHash.js';

const fresh = () => new Simulation(ALL_MAPS[TRAINING_MAP], { seed: 4, phases: false });

test('una bala que pasa cerca estresa al rival, no a los del tirador', () => {
  const sim = fresh();
  const shooter = sim.teams.attackers[0];
  const mate = sim.teams.attackers[1];
  const enemy = sim.teams.defenders[0];
  // A line of fire from the shooter passing 0.5 m from the enemy (and from a teammate).
  const dx = enemy.x - shooter.x;
  const dy = enemy.y - shooter.y;
  const len = Math.hypot(dx, dy);
  const ox = shooter.x + (-dy / len) * 0.5;
  const oy = shooter.y + (dx / len) * 0.5;
  mate.x = shooter.x + dx / 2;
  mate.y = shooter.y + dy / 2;
  stressShot(sim, shooter, ox, oy, dx / len, dy / len, len + 5, null);
  assert.ok(enemy.stress > 0.15, `estrés del rival ${enemy.stress}`);
  assert.equal(mate.stress, 0, 'los compañeros del tirador no se estresan');
  const far = sim.teams.defenders[1];
  assert.equal(far.stress, 0, 'lejos de la línea, nada');
});

test('el estrés baja solo tras un momento de calma, y al tope se tira al piso', () => {
  const sim = fresh();
  const u = sim.teams.defenders[0];
  u.stress = 0.5;
  u.stressCalm = 0;
  updateStress(sim, 0.5);
  assert.equal(u.stress, 0.5, 'aún no hay calma');
  for (let i = 0; i < 60; i++) updateStress(sim, 0.05);
  assert.ok(u.stress < 0.5, 'baja con la calma');
  u.stress = STRESS.pinAt;
  u.stressCalm = 0;
  updateStress(sim, 1 / 60);
  assert.ok(u.pinned > 0, 'al tope, al piso');
  assert.ok(stressSpread(u) > 1 && stressReaction(u) > 1, 'apunta y reacciona peor');
});

test('una explosión estresa a quien la ve cerca', () => {
  const sim = fresh();
  const u = sim.teams.defenders[0];
  stressBlast(sim, u.x + 1, u.y, 3);
  assert.ok(u.stress > 0.3);
});

test('las rondas con supresión siguen siendo deterministas y la supresión ocurre', () => {
  const play = () => {
    const sim = new Simulation(MAPS.warehouse, { seed: 17, controllers: { attackers: 'ai', defenders: 'ai' } });
    let peak = 0;
    let pins = 0;
    for (let g = 0; sim.phase !== 'end' && g < 40000; g++) {
      if (sim.phase === 'buy' || sim.phase === 'prep' || sim.phase === 'plan') sim.advancePhase();
      else sim.step();
      for (const e of sim.drainEvents()) if (e.type === 'pinned') pins++;
      for (const u of sim.units) peak = Math.max(peak, u.stress);
    }
    return { h: hashSim(sim), peak, pins };
  };
  const a = play();
  const b = play();
  assert.equal(a.h, b.h);
  assert.ok(a.peak > 0.2, `hubo supresión (pico ${a.peak.toFixed(2)})`);
});
