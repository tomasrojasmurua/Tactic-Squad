// Operator ROLES as data (owner: gameplay). A role bundles everything that
// makes one kind of operator different: base stats, default weapon,
// multiplicative modifiers and the id of its ability (gadget / passive).
// The simulation reads ONLY these values (sim/units.js resolves them per
// unit), so a new role = one entry here + (optionally) one ability module
// in sim/abilities/ registered by its id. Modifiers multiply the global
// numbers of config/balance.js; 1 = unchanged.
//
// Classes: attackers Asaltante / Brecha / Explorador (chosen in the buy phase,
// order setRole; Brecha and Explorador one each), defenders Defensor / Ancla /
// Merodeador / Trampero (the map layout gives the AI's; a human defender picks
// them in the preparation, order setDefenderRole, at most `max` of each). Each
// side picks blind: neither sees the other's classes.

/** Neutral modifiers: every role starts from these. */
export const BASE_MODIFIERS = Object.freeze({
  speed: 1, // MOVE.speed / patrolSpeed
  turnRate: 1, // MOVE.turnRate / combatTurnRate
  reaction: 1, // COMBAT.reaction (time to first shot)
  spread: 1, // weapon spread (accuracy)
  visionRange: 1, // VISION[team].range
  visionFov: 1, // VISION[team].fov
  breachPrep: 1, // ENTRY.breach.prepTime (planting a charge)
  bash: 1, // BARRICADE.breakTime (breaking a barricade by hand)
  stepNoise: 1, // NOISE.radius.step (how far his footsteps are heard)
});

/**
 * Role fields: label (UI), weapon (config/weapons.js id), ability (id in
 * sim/abilities/index.js or null), modifiers (subset of BASE_MODIFIERS),
 * maxHp (optional, default UNIT.maxHp), gear (door-entry utility carried:
 * {flash, frag, smoke, breach} counts: the class's kit, free and full again
 * every round; utility points add to it, config/balance.js BUY).
 */
export const ROLES = Object.freeze({
  // Player squad (attackers). `pick`: offered in the buy phase; `unique`: one per squad.
  assault: {
    label: 'Asaltante', pick: true, unique: false, weapon: 'rifle', ability: null, modifiers: {}, gear: { flash: 1, frag: 1 },
    blurb: 'Rifle, flash y granada. El que gana los duelos.',
  },
  entry: {
    label: 'Brecha', pick: true, unique: true, weapon: 'smg', ability: null, modifiers: { breachPrep: 0.5, bash: 0.6 }, gear: { flash: 1, breach: 2 },
    blurb: 'Dos cargas, las planta en la mitad de tiempo y rompe barricadas rápido.',
  },
  scout: {
    label: 'Explorador', pick: true, unique: true, weapon: 'rifle', ability: 'scoutPulse', modifiers: { speed: 1.08, visionRange: 1.1 }, gear: { flash: 1, smoke: 1 },
    blurb: 'Al final de cada turno detecta a los defensores cerca (8 m), aun tras las paredes.',
  },
  // Defenders (their weapon comes from each map spawn). `defPick`: offered in the defender's
  // preparation; `max`: how many a side may have.
  defender: {
    label: 'Defensor', defPick: true, max: 4, weapon: 'rifle', ability: null, modifiers: {}, gear: { flash: 1 },
    blurb: 'El de siempre. Lleva una flash.',
  },
  // Site anchor: holds his angle; tougher and quicker to shoot first.
  anchor: {
    label: 'Ancla', defPick: true, max: 2, weapon: 'rifle', ability: null, modifiers: { reaction: 0.85 }, maxHp: 120, gear: { frag: 1 },
    blurb: 'Sostiene el sitio: 120 de vida, dispara antes y lleva una granada para la puerta.',
  },
  // Roamer: off the site, hunting the attackers' flank; quick and quiet. The Explorador's pulse finds him.
  roamer: {
    label: 'Merodeador', defPick: true, max: 1, weapon: 'smg', ability: null, modifiers: { speed: 1.12, stepNoise: 0.35 }, gear: { flash: 1 },
    blurb: 'Fuera del sitio: más rápido, sus pasos casi no se oyen y lleva una flash.',
  },
  // Trapper: lays TRAP.perTrapper traps in the preparation (sim/traps.js).
  trapper: {
    label: 'Trampero', defPick: true, max: 1, weapon: 'rifle', ability: null, modifiers: {}, gear: { smoke: 1 },
    blurb: 'Pone 2 trampas (atrapan al que las pisa y lo delatan) y lleva un humo.',
  },
});

/** The attacker classes offered in the buy phase, in panel order. */
export const PICK_ROLES = Object.freeze(Object.keys(ROLES).filter((id) => ROLES[id].pick));

/** The defender classes offered in the preparation, in panel order. */
export const DEF_PICK_ROLES = Object.freeze(Object.keys(ROLES).filter((id) => ROLES[id].defPick));

export const DEFAULT_DEFENDER_ROLE = 'defender';
