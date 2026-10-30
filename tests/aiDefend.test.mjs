// La IA defensora (sim/aiDefend.js): cuando el sitio de la bomba está
// amenazado manda hasta AI_DEFEND.rotators defensores (nunca a los anclas) a
// cubrir la entrada por la que viene la amenaza; un tiroteo lejos de la bomba
// no les hace dejar su puesto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { alertAiUnit } from '../src/sim/ai.js';
import { AI_DEFEND, COMBAT } from '../src/config/balance.js';
import { ALL_MAPS, TRAINING_MAP } from '../src/data/maps/index.js';

const MAP = ALL_MAPS[TRAINING_MAP];

/** Defenders played by the AI, attackers by nobody (they stay at their entry). */
function assault(seed, site) {
  const sim = new Simulation(MAP, { seed, site, controllers: { attackers: 'human', defenders: 'ai' } });
  sim.skipToAssault();
  sim.advancePhase(); // plan -> exec
  return sim;
}

/** Gunfire heard by every defender at (x, y), then a few steps. */
function gunfireAt(sim, x, y, steps = 5) {
  for (const d of sim.teams.defenders) alertAiUnit(d, x, y, COMBAT.alertDuration, true);
  for (let i = 0; i < steps && sim.phase === 'exec'; i++) sim.step();
}

test('un tiroteo lejos de la bomba no hace rotar a la IA defensora', () => {
  for (const site of ['A', 'B']) {
    const sim = assault(4, site);
    const far = sim.compiled.sites.find((s) => s.id !== site);
    gunfireAt(sim, far.bombX, far.bombY);
    assert.equal(sim.defendAi.sent, 0, `sitio ${site}`);
    assert.ok(sim.teams.defenders.every((d) => !d.ai.rotated), `sitio ${site}: nadie deja su puesto`);
  }
});

test('con la bomba amenazada rotan hasta dos defensores, nunca los anclas, y van a cubrirla', () => {
  for (const site of ['A', 'B']) {
    const sim = assault(4, site);
    const planned = new Map(sim.teams.defenders.map((d) => [d, d.behavior && d.behavior.rotate]));
    gunfireAt(sim, sim.bomb.x + 1.5, sim.bomb.y);
    const rotated = sim.teams.defenders.filter((d) => d.ai.rotated);
    assert.ok(rotated.length >= 1 && rotated.length <= AI_DEFEND.rotators, `sitio ${site}: rotaron ${rotated.length}`);
    assert.ok(rotated.every((d) => d.role !== 'anchor'), `sitio ${site}: un ancla dejó su puesto`);
    for (let turn = 0; turn < 5; turn++) {
      while (sim.phase === 'exec') sim.step();
      if (sim.phase === 'plan') sim.advancePhase();
    }
    for (const d of rotated) {
      const [x, y] = d.ai.rotateTo.to;
      assert.ok(Math.hypot(d.x - x, d.y - y) < 0.6, `sitio ${site}: ${d.name} llegó a su puesto`);
      // His map fallback when he has one, else a spot by the bomb.
      if (planned.get(d)) assert.equal(d.ai.rotateTo, planned.get(d));
      else assert.ok(Math.hypot(x - sim.bomb.x, y - sim.bomb.y) < 5, `sitio ${site}: ${d.name} cubre la bomba`);
      assert.equal(d.ai.rotating, null);
    }
  }
});

test('los defensores de un jugador no se mueven solos: ni patrullas ni repliegues del mapa', () => {
  for (const site of ['A', 'B']) {
    const sim = new Simulation(MAP, { seed: 4, site, controllers: { attackers: 'human', defenders: 'human' } });
    sim.skipToAssault();
    assert.equal(sim.defendAi, null);
    for (const d of sim.teams.defenders) {
      assert.ok(!d.behavior || (d.behavior.type !== 'patrol' && !d.behavior.rotate), `sitio ${site}: ${d.name}`);
    }
    const start = sim.teams.defenders.map((d) => [d.x, d.y]);
    sim.advancePhase(); // plan -> exec
    gunfireAt(sim, sim.bomb.x + 1.5, sim.bomb.y, 600);
    sim.teams.defenders.forEach((d, i) => {
      assert.ok(Math.hypot(d.x - start[i][0], d.y - start[i][1]) < 0.3, `sitio ${site}: ${d.name} se movió solo`);
    });
  }
});

test('la IA defensora conserva las patrullas y repliegues del mapa', () => {
  const ai = new Simulation(MAP, { seed: 4, site: 'A', controllers: { attackers: 'human', defenders: 'ai' } });
  assert.ok(ai.teams.defenders.some((d) => d.behavior && (d.behavior.type === 'patrol' || d.behavior.rotate)));
});
