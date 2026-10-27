// The bomb (placed by the defenders on site A or B, it never moves), finding
// it, defusing it and the round outcome.
//
// Defusing: an attacker standing next to a bomb his side has found, with no
// route and no enemy in sight, starts on his own (or at once with the
// "defuse now" order). It takes ROUND.defuseTime standing still and he does
// not shoot meanwhile; walking off or dying loses the progress. The tools are
// loud: AI defenders within earshot turn to the bomb (and rotate, like gunfire).
import { ROUND, COMBAT } from '../config/balance.js';
import { EV } from '../core/events.js';
import { canSee } from './vision.js';
import { nearBomb, isAiControlled, peekEye } from './queries.js';
import { ENTRY } from '../config/balance.js';
import { alertAiUnit } from './ai.js';
import { buildNotes } from './debrief.js';

export function createBomb(site) {
  return {
    site: site.id,
    x: site.bombX,
    y: site.bombY,
    spotted: false, // the attackers have seen it (until then they do not know the site)
    progress: 0, // 0..1 while defusing
    defuserId: -1,
    defused: false,
  };
}

export function updateObjectives(sim, dt) {
  if (sim.outcome) return;
  spotBomb(sim);
  updateDefuse(sim, dt);
  // With phases the turns count the time (sim/round.js); without, the clock does.
  if (!sim.round.enabled) sim.timeLeft = Math.max(0, sim.timeLeft - dt);

  const attackersAlive = sim.units.some((u) => u.team === 'attackers' && u.alive);
  const defendersAlive = sim.units.some((u) => u.team === 'defenders' && u.alive);
  if (sim.bomb.defused) return endRound(sim, 'attackers', 'defused');
  if (!defendersAlive) return endRound(sim, 'attackers', 'elimination');
  if (!attackersAlive) return endRound(sim, 'defenders', 'wiped');
  if (!sim.round.enabled && sim.timeLeft <= 0) {
    sim.emit(EV.BOMB_EXPLODED, { x: sim.bomb.x, y: sim.bomb.y });
    return endRound(sim, 'defenders', 'time');
  }
}

const eye = { x: 0, y: 0, facing: 0 };

function spotBomb(sim) {
  const bomb = sim.bomb;
  if (bomb.spotted) return;
  for (const u of sim.teams.attackers) {
    const seen = u.alive && (canSee(sim.world, u, bomb.x, bomb.y, u.vision) || (peekEye(sim, u, eye) && canSee(sim.world, eye, bomb.x, bomb.y, { fov: ENTRY.slow.peekFov, range: u.vision.range })));
    if (seen) {
      bomb.spotted = true;
      sim.emit(EV.BOMB_SPOTTED, { unitId: u.id, site: bomb.site, x: bomb.x, y: bomb.y });
      return;
    }
  }
}

/** Standing still next to the bomb with nothing else to do (the automatic start). */
function readyToDefuse(sim, u) {
  return u.alive && !u.route.length && !u.moving && !u.waitingGo && u.target < 0 && u.reloadTimer <= 0 && nearBomb(sim, u);
}

function updateDefuse(sim, dt) {
  const bomb = sim.bomb;
  if (bomb.defused || !bomb.spotted) return;
  let defuser = bomb.defuserId >= 0 ? sim.units[bomb.defuserId] : null;

  if (defuser && (!defuser.alive || defuser.route.length || !nearBomb(sim, defuser))) {
    abortDefuse(sim, defuser);
    defuser = null;
  }
  if (!defuser) {
    defuser = sim.teams.attackers.find((u) => readyToDefuse(sim, u));
    if (!defuser) return;
    startDefuse(sim, defuser);
  }

  bomb.progress = Math.min(1, bomb.progress + dt / ROUND.defuseTime);
  if (bomb.progress >= 1) {
    bomb.defused = true;
    bomb.defusedBy = defuser.id; // the match economy pays him (session/Match.js)
    defuser.defusing = false;
    bomb.defuserId = -1;
    sim.emit(EV.BOMB_DEFUSED, { unitId: defuser.id, x: bomb.x, y: bomb.y });
  }
}

/** Starts (or restarts from zero) a defuse by this unit. Used by the "defuse now" order too. */
export function startDefuse(sim, u) {
  const bomb = sim.bomb;
  const previous = bomb.defuserId >= 0 ? sim.units[bomb.defuserId] : null;
  if (previous) previous.defusing = false;
  u.defusing = true;
  bomb.defuserId = u.id;
  bomb.progress = 0;
  sim.emit(EV.DEFUSE_START, { unitId: u.id, x: bomb.x, y: bomb.y });
  const r2 = COMBAT.hearingRadius * COMBAT.hearingRadius;
  for (const d of sim.teams.defenders) {
    if (isAiControlled(sim, d) && (d.x - bomb.x) ** 2 + (d.y - bomb.y) ** 2 <= r2) alertAiUnit(d, bomb.x, bomb.y, COMBAT.alertDuration, true);
  }
}

function abortDefuse(sim, u) {
  u.defusing = false;
  sim.bomb.progress = 0;
  sim.bomb.defuserId = -1;
  sim.emit(EV.DEFUSE_ABORT, { unitId: u.id });
}

export function endRound(sim, winner, reason) {
  sim.outcome = { winner, reason, time: sim.time, notes: buildNotes(sim, winner, reason) };
  sim.emit(EV.ROUND_END, { winner, reason });
}
