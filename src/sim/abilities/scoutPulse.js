// Explorador: at the end of every turn (sim/round.js -> turnEndAbilities)
// he senses the defenders within SCOUT.radius, walls or not — heartbeat
// sensor style. They go into the attackers' memory (sim/view.js) as if seen,
// so the next plan shows where they were. Deterministic: no randomness.
import { SCOUT } from '../../config/balance.js';
import { EV } from '../../core/events.js';
import { found as trapFound } from '../traps.js';

export const scoutPulse = Object.freeze({
  id: 'scoutPulse',
  turnEnd(sim, u) {
    if (u.blind > 0) return;
    const r2 = SCOUT.radius * SCOUT.radius;
    const mem = sim.memory[u.team];
    let found = 0;
    for (const e of sim.units) {
      if (!e.alive || e.team === u.team) continue;
      if ((e.x - u.x) ** 2 + (e.y - u.y) ** 2 > r2) continue;
      let k = mem.get(e.id);
      if (!k) mem.set(e.id, (k = { id: e.id, x: 0, y: 0, tick: 0, alive: true }));
      k.x = e.x;
      k.y = e.y;
      k.tick = sim.tick;
      k.alive = true;
      found++;
    }
    for (const t of sim.traps) if (t.alive && !t.known && (t.x - u.x) ** 2 + (t.y - u.y) ** 2 <= r2) trapFound(sim, t, 'scout');
    sim.emit(EV.SCOUT_PULSE, { unitId: u.id, x: u.x, y: u.y, radius: SCOUT.radius, found });
  },
});
