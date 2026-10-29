// Trained ears (role flag sharpEars: the Explorador). Besides placing every
// noise his side hears exactly (sim/noise.js), he picks out footsteps nobody
// else would: an enemy walking within EARS.range of him, through walls (a
// sneaking one within MOVE.sneakHearing), however quiet his steps are (the
// Merodeador's soft soles do not fool him), makes him turn, for EARS.seconds,
// to the corner or doorway that enemy will come through (sim/ai.js
// watchPointToward), alerted (COMBAT.alertFactor: sim/perception.js). When the man comes round
// the corner he is already aimed at it. A reflex, like turning to pain: it
// needs no order and never moves him. Not while he fights, defuses or works a
// door. Deterministic: no randomness.
import { MOVE, EARS } from '../config/balance.js';
import { roleFlag } from '../config/operators.js';
import { enemyTeam } from './queries.js';
import { watchPointToward } from './ai.js';

export function updateEars(sim) {
  const far2 = EARS.range * EARS.range;
  const quiet2 = MOVE.sneakHearing * MOVE.sneakHearing;
  for (const u of sim.units) {
    if (!u.alive || !roleFlag(u.role, 'sharpEars') || u.target >= 0 || u.defusing || u.entry || u.blind > 0) continue;
    let best = null;
    let bestD = Infinity;
    for (const e of sim.teams[enemyTeam(u.team)]) {
      if (!e.alive || !e.moving) continue;
      const d2 = (e.x - u.x) ** 2 + (e.y - u.y) ** 2;
      if (d2 < (e.sneaking ? quiet2 : far2) && d2 < bestD) {
        best = e;
        bestD = d2;
      }
    }
    if (!best) continue;
    if (u.alertTimer <= 0 || sim.tick % EARS.repathTicks === 0) watchPointToward(sim, u, best.x, best.y, u);
    u.alertTimer = Math.max(u.alertTimer, EARS.seconds);
  }
}
