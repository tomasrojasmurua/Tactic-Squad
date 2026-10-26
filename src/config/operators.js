// Operator ROLES as data (owner: gameplay). A role bundles everything that
// makes one kind of operator different: base stats, default weapon,
// multiplicative modifiers and the id of its ability (gadget / passive).
// The simulation reads ONLY these values (sim/units.js resolves them per
// unit), so a new role = one entry here + (optionally) one ability module
// in sim/abilities/ registered by its id. Modifiers multiply the global
// numbers of config/balance.js; 1 = unchanged.
//
// Planned classes (NOT implemented yet, see docs/BRIEF.md "Clases de operador"):
// attackers asaltante / brecha / explorador, defenders ancla / merodeador /
// trampero — each one = an entry here + a module in sim/abilities/.

/** Neutral modifiers: every role starts from these. */
export const BASE_MODIFIERS = Object.freeze({
  speed: 1, // MOVE.speed / patrolSpeed
  turnRate: 1, // MOVE.turnRate / combatTurnRate
  reaction: 1, // COMBAT.reaction (time to first shot)
  spread: 1, // weapon spread (accuracy)
  visionRange: 1, // VISION[team].range
  visionFov: 1, // VISION[team].fov
});

/**
 * Role fields: label (UI), weapon (config/weapons.js id), ability (id in
 * sim/abilities/index.js or null), modifiers (subset of BASE_MODIFIERS),
 * maxHp (optional, default UNIT.maxHp), gear (door-entry utility carried:
 * {flash, frag, breach} counts, sim/entries.js; the round economy will buy it later).
 */
export const ROLES = Object.freeze({
  // Player squad (attackers).
  assault: { label: 'Asaltante', weapon: 'rifle', ability: null, modifiers: {}, gear: { flash: 1, frag: 1 } },
  entry: { label: 'Entrada', weapon: 'smg', ability: null, modifiers: {}, gear: { flash: 1, frag: 1, breach: 1 } },
  // AI defenders (their weapon comes from each map spawn).
  defender: { label: 'Defensor', weapon: 'rifle', ability: null, modifiers: {} },
});

export const DEFAULT_DEFENDER_ROLE = 'defender';
