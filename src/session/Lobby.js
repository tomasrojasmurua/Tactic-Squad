// The menu before a game (pure data and rules, tested headless; ui/Menu.js
// draws it, SessionController applies its requests):
//
//   main    JUGAR · TUTORIAL
//   play    CONTRA LA IA · MULTIJUGADOR (coming soon)
//   lobby   the game's settings, then LISTO: it starts once everyone is ready
//           (against the AI only the player; the AI always is)
//
//   lobby = {view, bestOf, side, map, roles: {attackers: [roleId x3], defenders: [roleId x3]}, ready}
//   bestOf  1 = a single round (retries allowed), else MATCH.formats (3, 5, 7)
//   side    the side the player starts on (a match switches at half-time)
//   roles   the player's classes per slot (Simulation opts.roles); the buy and
//           the preparation can still change them each round
//
// The choices last on the device (session/storage.js), except `view` and `ready`.
import { MATCH } from '../config/balance.js';
import { ROLES, PICK_ROLES, DEF_PICK_ROLES } from '../config/operators.js';
import { SQUAD, DEFENDERS } from '../config/squad.js';
import { DEFAULT_MAP } from '../data/maps/index.js';

export const BEST_OF = Object.freeze([1, ...MATCH.formats]);
export const DEFAULT_ROLES = Object.freeze({
  attackers: Object.freeze(SQUAD.map((s) => s.role)),
  defenders: Object.freeze(['anchor', 'defender', 'trapper'].slice(0, DEFENDERS)),
});

/** A lobby from what was saved on the device (anything missing or stale: the defaults). */
export function createLobby(saved = null) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const lobby = {
    view: 'main',
    bestOf: BEST_OF.includes(s.bestOf) ? s.bestOf : 3,
    side: s.side === 'defenders' ? 'defenders' : 'attackers',
    map: DEFAULT_MAP,
    roles: { attackers: [...DEFAULT_ROLES.attackers], defenders: [...DEFAULT_ROLES.defenders] },
    ready: false,
  };
  for (const team of ['attackers', 'defenders']) {
    const ids = s.roles && s.roles[team];
    if (Array.isArray(ids) && ids.length === lobby.roles[team].length && ids.every((id, i) => canPick(lobby, team, i, id, ids))) lobby.roles[team] = [...ids];
  }
  return lobby;
}

/** What the device keeps. */
export const savedLobby = (lobby) => ({ bestOf: lobby.bestOf, side: lobby.side, roles: lobby.roles });

/** The classes a slot of that side may take. */
export const pickRoles = (team) => (team === 'attackers' ? PICK_ROLES : DEF_PICK_ROLES);

/** May slot i of `team` take `id`, the other slots keeping theirs (in `ids`)? */
export function canPick(lobby, team, i, id, ids = lobby.roles[team]) {
  const r = ROLES[id];
  if (!r || !pickRoles(team).includes(id)) return false;
  const others = ids.filter((o, j) => j !== i && o === id).length;
  return team === 'attackers' ? !r.unique || others === 0 : others < r.max;
}

/**
 * One lobby request ('bestOf_<n>' | 'side_<team>' | 'role_<team>_<i>_<id>').
 * Returns true when it changed something (to save it).
 */
export function lobbySet(lobby, what) {
  const [key, ...rest] = what.split('_');
  if (key === 'bestOf') {
    const n = +rest[0];
    if (!BEST_OF.includes(n) || lobby.bestOf === n) return false;
    lobby.bestOf = n;
  } else if (key === 'side') {
    if (rest[0] !== 'attackers' && rest[0] !== 'defenders') return false;
    lobby.side = rest[0];
  } else if (key === 'role') {
    const [team, i, id] = [rest[0], +rest[1], rest[2]];
    const ids = lobby.roles[team];
    if (!ids || !(i >= 0 && i < ids.length) || ids[i] === id || !canPick(lobby, team, i, id)) return false;
    ids[i] = id;
  } else return false;
  lobby.ready = false; // a change takes the "ready" back, as in any lobby
  return true;
}

/** The mode and side the game starts in, and the match format. */
export function lobbyStart(lobby) {
  return { mode: lobby.bestOf === 1 ? 'play' : 'match', team: lobby.side, bestOf: lobby.bestOf };
}
