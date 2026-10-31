// A match against the AI: rounds in a row until the player or the AI wins
// toWin of them (best of `bestOf`: 3, 5 or 7, chosen in the lobby). The player
// starts on the side he picked and switches after switchAfter rounds (half of
// the series). Pure data and rules (no DOM, no sim imports beyond reading a
// finished Simulation), so it is tested headless.
//
//   match = {bestOf, toWin, switchAfter, round, team, score: {player, ai}, lossBonus, slots, history, over}
//   team: the player's side this round; over: null | 'player' | 'ai'
//   lossBonus: the side that lost the last round ('attackers' | 'defenders' | null): BUY.lossBonus more points each
//   slots[i] = {role} for attacker slot i (null: the defaults of a first round)
//
// The Simulation of each round takes matchLoadout(match) as opts.loadout and
// match.lossBonus as opts.lossBonus. Nothing but the attackers' classes carries
// over: every round each operator has his class's kit and his utility points
// (config/balance.js BUY). The sides switch like a half-time: the classes and
// the bonus start over.
import { MATCH } from '../config/balance.js';

/** `switchSides` false: the player keeps his side the whole match (an online coop always attacks). */
export function createMatch(team = 'attackers', bestOf = MATCH.bestOf, { switchSides = true } = {}) {
  const toWin = Math.floor(bestOf / 2) + 1;
  return { bestOf, toWin, switchAfter: switchSides ? toWin - 1 : Infinity, round: 1, team, score: { player: 0, ai: 0 }, lossBonus: null, slots: null, history: [], over: null };
}

const OTHER_SIDE = Object.freeze({ attackers: 'defenders', defenders: 'attackers' });

/** The attackers' classes for the current round (null: the first round, defaults). */
export function matchLoadout(match) {
  return match.slots ? match.slots.map((s) => ({ role: s.role })) : null;
}

/** The round is over: score, the loser's bonus, carry the classes over. Returns the history entry. Call once per round. */
export function endMatchRound(match, sim) {
  const winner = sim.outcome.winner;
  const side = winner === match.team ? 'player' : 'ai';
  match.score[side]++;
  match.lossBonus = OTHER_SIDE[winner];
  const entry = { round: match.round, team: match.team, winner, playerWon: side === 'player', reason: sim.outcome.reason, bonus: match.lossBonus, switched: false };
  match.history.push(entry);
  match.slots = sim.teams.attackers.map((u) => ({ role: u.role }));
  if (match.score[side] >= match.toWin) match.over = side;
  else {
    match.round++;
    if (match.round === match.switchAfter + 1) {
      // Half-time: the player takes the other side and both start from scratch.
      entry.switched = true;
      match.team = OTHER_SIDE[match.team];
      match.slots = null;
      match.lossBonus = null;
    }
  }
  return entry;
}
