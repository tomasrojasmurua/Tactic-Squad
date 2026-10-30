// La repetición de la última baja: la ronda se juega otra vez, fuera de
// pantalla, con la misma semilla y las órdenes grabadas por fase, y llega
// al mismo momento con todo igual.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { ALL_MAPS, TRAINING_MAP } from '../src/data/maps/index.js';
import { phaseTick } from '../src/sim/round.js';
import { replayTo, createKillCam, stepKillCam } from '../src/session/KillCam.js';
import { KILLCAM } from '../src/config/ui.js';
import { SIM } from '../src/config/balance.js';

const MAP = ALL_MAPS[TRAINING_MAP];
const snap = (sim) => sim.units.map((u) => [u.alive, u.hp, +u.x.toFixed(6), +u.y.toFixed(6), +u.facing.toFixed(6)]);

/** A round played like the session does: orders recorded per phase (PlanRecorder segments). */
function play(seed) {
  const args = { seed, controllers: { attackers: 'human', defenders: 'ai' }, stopOnContact: true };
  const sim = new Simulation(MAP, args);
  const segments = [[]];
  const give = (c) => {
    const cmd = { team: 'attackers', ...c };
    segments[segments.length - 1].push(cmd);
    sim.enqueue(cmd);
  };
  const snaps = new Map();
  let last = null;
  let turn = 0;
  for (let guard = 0; guard < 60000 && sim.phase !== 'end'; guard++) {
    const phase = sim.phase;
    if (phase === 'buy' || phase === 'prep' || phase === 'plan') {
      if (phase === 'plan') {
        // Each turn, everyone a bit deeper toward the sites.
        turn++;
        for (const u of sim.teams.attackers) if (u.alive) give({ type: 'addWaypoint', unitId: u.id, x: 14 + turn * 4, y: 12.7 + u.id, user: true });
        if (turn === 1) give({ type: 'setHold', unitId: 0, code: 'A' });
      }
      segments.push([]);
      sim.advancePhase();
      continue;
    }
    if (phase === 'drone' && phaseTick(sim) === 30) give({ type: 'droneRecall', atTick: 30 });
    if (phase === 'exec' && sim.round.execTick === 90) give({ type: 'go', code: 'A', atTick: 90 });
    sim.step();
    snaps.set(sim.tick, snap(sim));
    for (const e of sim.drainEvents()) if (e.type === 'death') last = { tick: e.tick, unitId: e.unitId, killerId: e.killerId };
    if (sim.phase !== phase && sim.phase !== 'end') segments.push([]);
  }
  return { args, segments, snaps, last, sim };
}

test('la ronda jugada otra vez con las órdenes grabadas llega igual al momento de la baja', () => {
  let checked = 0;
  for (const seed of [2, 5, 9]) {
    const { args, segments, snaps, last } = play(seed);
    if (!last) continue;
    const at = last.tick - 30;
    const copy = replayTo(MAP, args, segments, at);
    assert.equal(copy.tick, at, `semilla ${seed}: llegó al paso`);
    assert.deepEqual(snap(copy), snaps.get(at), `semilla ${seed}: todo igual`);
    checked++;
  }
  assert.ok(checked >= 2, 'hubo bajas que repetir');
});

test('la repetición arranca antes de la baja, la muestra en cámara lenta y termina después', () => {
  const { args, segments, last } = play(5);
  assert.ok(last, 'hubo una baja');
  const kc = createKillCam(MAP, args, segments, last);
  assert.equal(kc.sim.tick, Math.max(0, last.tick - Math.round(KILLCAM.before * SIM.tickRate)));
  let screenSteps = 0;
  let died = false;
  while (stepKillCam(kc, (sim) => (died ||= !sim.units[last.unitId].alive)) && screenSteps < 10000) screenSteps++;
  assert.ok(died, 'se ve la baja');
  const clip = kc.sim.tick - (last.tick - Math.round(KILLCAM.before * SIM.tickRate));
  assert.ok(screenSteps > clip, 'en cámara lenta dura más que en el juego');
});
