// The menu before a game (pure data and rules, tested headless; ui/Menu.js
// draws it, SessionController applies its requests):
//
//   main    JUGAR · TUTORIAL
//   lessons the tutorial's lessons (config/lessons.js)
//   play    CONTRA LA IA · MULTIJUGADOR (coming soon)
//   lobby   the game's conditions (format, starting side, map), then LISTO
//   pick    the roster (like a MOBA's pick phase): a pool of characters per
//           side, 3 of them make the squad for the whole game; CONFIRMAR
//           starts once every slot is filled and everyone is ready (against
//           the AI only the player; the AI picks its own, blind)
//
//   lobby = {view, bestOf, side, map, drawn, roles: {attackers: [roleId|null x3], defenders: [roleId|null x3]}, inspect, pickSide, ready}
//   bestOf  1 = a single round (retries allowed), else MATCH.formats (3, 5, 7)
//   side    the side the player starts on (a match switches at half-time)
//   map     a map id (data/maps) or 'random'; `drawn` is the map a 'random'
//           drew, on the way to the class pick (the squad is chosen knowing it)
//   roles   the player's classes per slot (Simulation opts.roles), null =
//           an empty slot; they are not changed inside the game
//   inspect the character each side's roster shows in detail (screen only)
//   pickSide the side the pick screen shows (a match picks both)
//
// The choices last on the device (session/storage.js), except `view`, `inspect`, `pickSide` and `ready`
// (a squad left incomplete comes back as the defaults).
import { MATCH } from '../config/balance.js';
import { ROLES, PICK_ROLES, DEF_PICK_ROLES } from '../config/operators.js';
import { SQUAD, DEFENDERS } from '../config/squad.js';
import { MAPS, DEFAULT_MAP } from '../data/maps/index.js';

export const BEST_OF = Object.freeze([1, ...MATCH.formats]);
/** The lobby's map choices: every map, then "al azar". */
export const MAP_CHOICES = Object.freeze([...Object.keys(MAPS), 'random']);
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
    map: MAP_CHOICES.includes(s.map) ? s.map : DEFAULT_MAP,
    drawn: null,
    roles: { attackers: [...DEFAULT_ROLES.attackers], defenders: [...DEFAULT_ROLES.defenders] },
    inspect: { attackers: PICK_ROLES[0], defenders: DEF_PICK_ROLES[0] },
    pickSide: 'attackers',
    ready: false,
  };
  for (const team of ['attackers', 'defenders']) {
    const ids = s.roles && s.roles[team];
    if (Array.isArray(ids) && ids.length === lobby.roles[team].length && ids.every((id, i) => canPick(lobby, team, i, id, ids))) lobby.roles[team] = [...ids];
    lobby.inspect[team] = lobby.roles[team][0];
  }
  return lobby;
}

/** What the device keeps. */
export const savedLobby = (lobby) => ({ bestOf: lobby.bestOf, side: lobby.side, map: lobby.map, roles: lobby.roles });

/** The classes a slot of that side may take. */
export const pickRoles = (team) => (team === 'attackers' ? PICK_ROLES : DEF_PICK_ROLES);

/** May slot i of `team` take `id`, the other slots keeping theirs (in `ids`)? */
export function canPick(lobby, team, i, id, ids = lobby.roles[team]) {
  const r = ROLES[id];
  if (!r || !pickRoles(team).includes(id)) return false;
  const others = ids.filter((o, j) => j !== i && o === id).length;
  return team === 'attackers' ? !r.unique || others === 0 : others < r.max;
}

/** The sides the player picks classes for: both in a match (it switches at half-time), else his own. */
export const pickSides = (lobby) => (lobby.bestOf === 1 ? [lobby.side] : lobby.side === 'attackers' ? ['attackers', 'defenders'] : ['defenders', 'attackers']);

/** The first empty slot of `team`'s squad, or -1 when it is full. */
export const freeSlot = (lobby, team) => lobby.roles[team].indexOf(null);

/** May `id` join `team`'s squad now (a free slot and the class's limit)? */
export function canAdd(lobby, team, id) {
  const i = freeSlot(lobby, team);
  return i >= 0 && canPick(lobby, team, i, id);
}

/** Every side the player picks for has its 3 (CONFIRMAR needs it); else the first side still missing some. */
export const pickMissing = (lobby) => pickSides(lobby).find((t) => freeSlot(lobby, t) >= 0) || null;

/** From the lobby to the class pick: it opens on the side he starts on; "al azar" draws the map now (`rand`: 0..1). */
export function openPick(lobby, rand = Math.random) {
  const ids = MAP_CHOICES.filter((id) => id !== 'random');
  lobby.drawn = lobby.map === 'random' ? ids[Math.min(ids.length - 1, Math.floor(rand() * ids.length))] : lobby.map;
  lobby.view = 'pick';
  lobby.pickSide = lobby.side;
  lobby.ready = false;
}

/**
 * One lobby request ('bestOf_<n>' | 'side_<team>' | 'map_<id | random>' | 'pickSide_<team>' | the roster's
 * 'inspect_<team>_<id>' (show it in detail) | 'add_<team>_<id>' (to the first empty slot) |
 * 'remove_<team>_<i>' (empty that slot) | 'role_<team>_<i>_<id>' (set a slot directly)).
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
  } else if (key === 'map') {
    const id = rest.join('_');
    if (!MAP_CHOICES.includes(id) || lobby.map === id) return false;
    lobby.map = id;
  } else if (key === 'pickSide') {
    if (!pickSides(lobby).includes(rest[0]) || lobby.pickSide === rest[0]) return false;
    lobby.pickSide = rest[0];
    return false; // only the screen: nothing to save
  } else if (key === 'inspect') {
    if (!lobby.inspect[rest[0]] || !pickRoles(rest[0]).includes(rest[1]) || lobby.inspect[rest[0]] === rest[1]) return false;
    lobby.inspect[rest[0]] = rest[1];
    return false; // only the screen
  } else if (key === 'add') {
    const [team, id] = rest;
    if (!lobby.roles[team] || !canAdd(lobby, team, id)) return false;
    lobby.roles[team][freeSlot(lobby, team)] = id;
  } else if (key === 'remove') {
    const [team, i] = [rest[0], +rest[1]];
    const ids = lobby.roles[team];
    if (!ids || !(i >= 0 && i < ids.length) || ids[i] === null) return false;
    ids[i] = null;
  } else if (key === 'role') {
    const [team, i, id] = [rest[0], +rest[1], rest[2]];
    const ids = lobby.roles[team];
    if (!ids || !(i >= 0 && i < ids.length) || ids[i] === id || !canPick(lobby, team, i, id)) return false;
    ids[i] = id;
  } else return false;
  lobby.ready = false; // a change takes the "ready" back, as in any lobby
  return true;
}

/** The mode and side the game starts in, the match format and the map (the one drawn when it was "al azar"). */
export function lobbyStart(lobby) {
  const map = lobby.map === 'random' ? lobby.drawn ?? DEFAULT_MAP : lobby.map;
  return { mode: lobby.bestOf === 1 ? 'play' : 'match', team: lobby.side, bestOf: lobby.bestOf, map };
}
