// A match against the AI: rounds in a row until one side wins MATCH.toWin
// (best of 7). Pure data and rules (no DOM, no sim imports beyond reading a
// finished Simulation), so it is tested headless.
//
//   match = {round, score: {attackers, defenders}, lossStreak, slots, history, over}
//   slots[i] = {role, money, gear} for attacker slot i (null: the round-1 defaults)
//
// The Simulation of each round takes matchLoadout(match) as opts.loadout; when
// the round ends, endMatchRound(match, sim) pays everyone and carries class,
// money and (for the survivors) the gear they did not use.
import { MATCH, BUY } from '../config/balance.js';

export function createMatch() {
  return { round: 1, score: { attackers: 0, defenders: 0 }, lossStreak: 0, slots: null, history: [], over: null };
}

/** The attackers' loadout for the current round (null: the first round, defaults). */
export function matchLoadout(match) {
  return match.slots ? match.slots.map((s) => ({ role: s.role, money: s.money, gear: { ...s.gear } })) : null;
}

/** What each attacker earns for a round (before the cap). */
export function roundIncome(match, sim, u, won) {
  let n = won ? MATCH.win : MATCH.loss + MATCH.lossBonus * Math.min(match.lossStreak, MATCH.lossBonusMax);
  n += u.stats.kills * MATCH.kill;
  if (sim.bomb.defusedBy === u.id) n += MATCH.defuse;
  return n;
}

/** The round is over: score, pay, carry over. Returns the history entry. Call once per round. */
export function endMatchRound(match, sim) {
  const winner = sim.outcome.winner;
  const won = winner === 'attackers';
  const income = [];
  const slots = sim.teams.attackers.map((u) => {
    const pay = roundIncome(match, sim, u, won);
    income.push(pay);
    const gear = {};
    for (const item of BUY.items) gear[item] = u.alive ? u.gear[item] || 0 : 0; // the fallen lose what they carried
    return { role: u.role, money: Math.min(MATCH.cap, u.money + pay), gear };
  });
  match.score[winner]++;
  match.lossStreak = won ? 0 : match.lossStreak + 1;
  const entry = { round: match.round, winner, reason: sim.outcome.reason, income };
  match.history.push(entry);
  match.slots = slots;
  if (match.score[winner] >= MATCH.toWin) match.over = winner;
  else match.round++;
  return entry;
}
