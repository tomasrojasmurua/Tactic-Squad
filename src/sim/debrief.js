// Round debrief: WHY things happened, as facts and codes (never text — the
// UI turns them into sentences in ui/texts.js T.debrief). Each death records
// what the victim was doing when he fell; the round end adds notes that
// explain a defeat by time or celebrate a clean win.
//
// victim.deathCause = {
//   code: 'reloading' | 'outnumbered' | 'blindside' | 'preaimed' | 'moving' | 'duel' | 'explosive' | 'friendly',
//   killerId, room, killerRoom, doorway (id or null), from: 'N'|'S'|'E'|'W' (killer's side), defusing
// }
// sim.outcome.notes = [{code, unitId?, room?, site?}]  codes: 'waitingGo' | 'noRoute' |
//   'bombHidden' | 'bombNotDefused' | 'flawless' | 'synced'
import { DEBRIEF } from '../config/balance.js';
import { roomAt, doorwayNear } from './queries.js';

/** Called by combat.kill BEFORE the victim's state is cleared. `forced`: cause decided by the caller (explosions). */
export function recordDeath(sim, victim, killer, forced = null) {
  const w = sim.world;
  const door = doorwayNear(w, victim.x, victim.y, DEBRIEF.doorwayRadius);
  const cause = {
    code: 'duel',
    killerId: killer ? killer.id : -1,
    room: roomAt(w, victim.x, victim.y),
    killerRoom: killer ? roomAt(w, killer.x, killer.y) : null,
    doorway: door ? door.id : null,
    from: killer ? compass(killer.x - victim.x, killer.y - victim.y) : null,
    defusing: victim.defusing,
  };
  if (forced) {
    cause.code = killer && killer.team === victim.team ? 'friendly' : forced;
  } else if (killer) {
    let shooters = 0;
    for (const e of sim.teams[killer.team]) if (e.alive && e.target === victim.id) shooters++;
    const sawKiller = victim.target === killer.id || victim.visibleEnemies.includes(killer.id);
    if (victim.reloadTimer > 0) cause.code = 'reloading';
    else if (shooters >= 2) cause.code = 'outnumbered';
    else if (!sawKiller) cause.code = 'blindside';
    else if (killer.focused && !killer.moving) cause.code = 'preaimed';
    else if (victim.moving && !killer.moving) cause.code = 'moving';
  }
  victim.deathCause = cause;
}

/** Compass side of a direction (map y grows southward). */
function compass(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'E' : 'W';
  return dy >= 0 ? 'S' : 'N';
}

/** Notes explaining the outcome, attached to sim.outcome at the end of the round. */
export function buildNotes(sim, winner, reason) {
  const notes = [];
  const squad = sim.teams.attackers;
  if (winner === 'attackers') {
    if (squad.every((u) => u.alive)) notes.push({ code: 'flawless' });
    if (sim.goCount > 0) notes.push({ code: 'synced' });
    return notes;
  }
  if (reason !== 'time') return notes;
  for (const u of squad) {
    if (!u.alive) continue;
    if (u.waitingGo) notes.push({ code: 'waitingGo', unitId: u.id, room: roomAt(sim.world, u.x, u.y) });
    else if (!u.route.length && !u.distanceWalked) notes.push({ code: 'noRoute', unitId: u.id });
  }
  const bomb = sim.bomb;
  if (!bomb.spotted) notes.push({ code: 'bombHidden', site: bomb.site });
  else notes.push({ code: 'bombNotDefused', site: bomb.site });
  return notes;
}
