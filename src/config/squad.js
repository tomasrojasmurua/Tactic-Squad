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

/** The side this device's player commands (session.team): input and HUD use it, never a literal. */
export const PLAYER_TEAM = 'attackers';

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

export const DEFENDER_NAME = 'Defensor';
export const DEFENDER_COLOR = '#e0443a';
