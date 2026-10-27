// A match against the AI: rounds in a row until the player or the AI wins
// MATCH.toWin (best of 7). The player attacks first and defends after
// MATCH.switchAfter rounds. Pure data and rules (no DOM, no sim imports beyond
// reading a finished Simulation), so it is tested headless.
//
//   match = {round, team, score: {player, ai}, lossStreak, slots, history, over}
//   team: the player's side this round; over: null | 'player' | 'ai'
//   slots[i] = {role, money, gear} for attacker slot i (null: the defaults of a first round)
//
// The Simulation of each round takes matchLoadout(match) as opts.loadout; when
// the round ends, endMatchRound(match, sim) pays the attackers and carries class,
// money and (for the survivors) the gear they did not use. The sides switch like
// a half-time: the new attackers start over from the first round's money.
import { MATCH, BUY } from '../config/balance.js';

export function createMatch(team = 'attackers') {
  return { round: 1, team, score: { player: 0, ai: 0 }, lossStreak: 0, slots: null, history: [], over: null };
}

const OTHER_SIDE = Object.freeze({ attackers: 'defenders', defenders: 'attackers' });

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
  const side = winner === match.team ? 'player' : 'ai';
  match.score[side]++;
  match.lossStreak = won ? 0 : match.lossStreak + 1;
  const entry = { round: match.round, team: match.team, winner, playerWon: side === 'player', reason: sim.outcome.reason, income, switched: false };
  match.history.push(entry);
  match.slots = slots;
  if (match.score[side] >= MATCH.toWin) match.over = side;
  else {
    match.round++;
    if (match.round === MATCH.switchAfter + 1) {
      // Half-time: the player takes the other side and the new attackers start from scratch.
      entry.switched = true;
      match.team = OTHER_SIDE[match.team];
      match.slots = null;
      match.lossStreak = 0;
    }
  }
  return entry;
}
