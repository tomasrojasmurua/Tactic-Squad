// Player squad roster and team labels. Owner: gameplay (who/what), with
// `color` shared with visual: it drives route lines, selection rings,
// shoulder patches and HUD accents.

/** The two sides, in spawn order. */
export const TEAMS = Object.freeze(['attackers', 'defenders']);

/**
 * Who gives the orders of each side: 'human' (orders arrive as commands) or
 * 'ai' (sim/ai.js drives the side's behaviors). We-Go 1v1 = both 'human';
 * playing as defender = swap. The sim never assumes which side is the player.
 */
export const CONTROLLERS = Object.freeze({ attackers: 'human', defenders: 'ai' });

/** The side this device's player commands by default (session.team): input and HUD use it, never a literal. */
export const PLAYER_TEAM = 'attackers';

/** Controllers for a round against the AI where the player takes `team` (the menu's side choice). */
export const controllersFor = (team) => (team === 'defenders' ? Object.freeze({ attackers: 'ai', defenders: 'human' }) : CONTROLLERS);

export const TEAM_LABEL = Object.freeze({
  attackers: 'Atacantes',
  defenders: 'Defensores',
});

/** Squad slots in spawn order. `role` -> config/operators.js ROLES (stats, weapon, ability); `weapon` overrides the role's. */
export const SQUAD = Object.freeze([
  { callsign: 'ÁGUILA', color: '#38c6ff', role: 'assault' },
  { callsign: 'LOBO', color: '#ffab2e', role: 'entry' },
  { callsign: 'ZORRO', color: '#9be15d', role: 'scout' },
]);

/** The 4th operator of a squad of four (online 2v2: two per player). */
export const SQUAD_FOURTH = Object.freeze({ callsign: 'HALCÓN', color: '#ff6fd8', role: 'assault' });

/** Slot i of a squad of any size (3 against the AI, 4 in a 2v2). */
export const squadSlot = (i) => (i < SQUAD.length ? SQUAD[i] : SQUAD_FOURTH);

/** Operators per side in a 2v2 (each player commands half). */
export const SQUAD_2V2 = 4;

/**
 * Defenders per round: as many as attackers (3 vs 3), so neither side starts
 * ahead. A map's `defense` layout may list more posts: the first DEFENDERS
 * are used (Simulation opts.defenders picks others).
 */
export const DEFENDERS = 3;

export const DEFENDER_NAME = 'Defensor';
export const DEFENDER_COLOR = '#e0443a';
