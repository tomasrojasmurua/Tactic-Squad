// Round debrief as text (flow, owner: gameplay): turns the facts recorded by
// sim/debrief.js (unit.deathCause, outcome.notes) into the sentences of the
// result screen — WHY the round was lost, and the one tip that would have
// changed it. Pure: no DOM.
import { teamUnits } from '../sim/queries.js';
import { T } from './texts.js';

const placeName = (id) => (id && T.places[id]) || T.places.nave;
const doorName = (id) => (id && T.doors[id]) || null;

/** {lines: string[], tip: string|null} for the finished round, told to the side `team` (session.team). */
export function buildDebrief(sim, team) {
  const D = T.debrief;
  const lines = [];
  let tipCode = null;
  const fallen = teamUnits(sim, team)
    .filter((u) => !u.alive && u.deathCause)
    .sort((a, b) => a.deathTime - b.deathTime);
  for (const u of fallen) {
    const c = u.deathCause;
    const killer = sim.units[c.killerId];
    const d = {
      name: u.name,
      killer: killer ? killer.name : '?',
      place: doorName(c.doorway) || placeName(c.room),
      killerPlace: placeName(c.killerRoom),
      side: T.side[c.from] || '',
    };
    lines.push(D.death[c.code](d));
    tipCode ??= c.code; // the first mistake is the one that broke the plan
  }
  const defending = team === 'defenders';
  for (const n of sim.outcome.notes || []) {
    if (defending && n.code !== 'bombHidden') continue; // the rest speak to the attackers' plan
    const u = n.unitId >= 0 ? sim.units[n.unitId] : null;
    lines.push(D.note[n.code]({ name: u ? u.name : '', place: placeName(n.room), site: n.site }));
  }
  const lost = sim.outcome.winner !== team;
  if (lost && sim.outcome.reason === 'time') tipCode ??= 'time';
  const tip = lost && tipCode ? (defending ? D.tipDefend : D.tip)[tipCode] || null : null;
  return { lines, tip };
}
