// Operator ROLES as data (owner: gameplay). A role bundles everything that
// makes one kind of operator different: base stats, default weapon,
// multiplicative modifiers and the id of its ability (gadget / passive).
// The simulation reads ONLY these values (sim/units.js resolves them per
// unit), so a new role = one entry here + (optionally) one ability module
// in sim/abilities/ registered by its id. Modifiers multiply the global
// numbers of config/balance.js; 1 = unchanged.
//
// Classes (each one changes a decision of the plan, with real close-quarters
// gear: nothing futuristic). Attackers: Asaltante, Brecha, Explorador, Escudo,
// Tirador, Granadero; defenders: Defensor, Ancla, Merodeador, Trampero, Vigía,
// Tirador (at most `max` of each; the map layout gives the AI's). A player
// picks his before the game (the menu's class pick: session/Lobby.js,
// Simulation opts.roles; the rules are sim/prep.js setRole / setDefenderRole)
// and keeps them all game. Each side picks blind: neither sees the other's.
//
// Counters (the design's): Brecha > Ancla (his charge stuns whoever waits
// behind the door), Explorador > Merodeador (he hears him exactly), Escudo >
// Tirador (the shield stops the precise shot), Granadero > Vigía (gas and
// smoke blind cameras and drive him off his monitor).

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
  shotNoise: 1, // how far his shots are heard (NOISE.radius.shot, COMBAT.hearingRadius): a suppressor
  doorwayReaction: 1, // reaction multiplier for a while after he comes through a doorway (COMBAT.doorwayTime), no doorway penalty if < 1
  holdReaction: 1, // extra reaction multiplier when he holds the angle (focused, still: COMBAT.holdFactor)
  closeReaction: 1, // reaction multiplier against an enemy within COMBAT.closeRange
  breachStun: 1, // ENTRY.breach.stun: how long his charge freezes whoever is behind the door
  breachConcussion: 1, // > 1: his charge's overpressure leaves reeling whoever is in the room beyond, out to ENTRY.breach.radius × this (ENTRY.breach.concussion)
  trapSpot: 1, // TRAP.spot: how far he notices a trap (he also notices them walking normally if > 1)
  tossRange: 1, // ENTRY.tossRange: how far he throws (a launcher)
});

/**
 * Role fields: label (UI), weapon (config/weapons.js id), ability (id in
 * sim/abilities/index.js or a signature the systems read, or null),
 * modifiers (subset of BASE_MODIFIERS), maxHp (optional, default
 * UNIT.maxHp), gear (utility carried: {flash, frag, smoke, breach, gas}
 * counts: the class's kit, free and full again every round; utility points
 * add to it, config/balance.js BUY). Optional flags: sharpEars (the noises
 * he hears are exact: sim/noise.js), cutsWire (crosses barbed wire without
 * slowing: sim/wires.js), ownWeapon (a defender keeps the class's weapon,
 * not his post's), cameras (extra cameras his side mounts), wires (extra
 * barbed wire his side lays).
 *
 * Signature abilities: 'fiberCam' (Explorador: the 'cam' door entry,
 * sim/entries.js), 'shield' (Escudo: sim/combat.js), 'launcher' (Granadero:
 * gas, sim/gas.js), 'monitor' (Vigía: sim/cameras.js), 'prepared' (Ancla:
 * sim/combat.js preparedPosition).
 */
export const ROLES = Object.freeze({
  // Player squad (attackers). `pick`: offered in the buy phase; `unique`: one per squad.
  assault: {
    label: 'Asaltante', pick: true, unique: false, weapon: 'rifle', ability: null, modifiers: { doorwayReaction: 0.5 }, gear: { flash: 1, frag: 1 },
    blurb: 'El primero en cruzar la puerta. Corta el ángulo al entrar: justo después de pasar una puerta reacciona mucho más rápido.',
  },
  entry: {
    label: 'Brecha', pick: true, unique: true, weapon: 'smg', ability: null, modifiers: { breachPrep: 0.5, bash: 0.6, breachStun: 2.5, breachConcussion: 2.2 }, cutsWire: true, gear: { flash: 1, breach: 2 },
    blurb: 'Abre lo cerrado y castiga al que espera detrás: su carga deja inmóvil a quien esté tras la puerta. Corta el alambre con alicate.',
  },
  scout: {
    label: 'Explorador', pick: true, unique: true, weapon: 'rifle', ability: 'fiberCam', modifiers: { speed: 1.08, trapSpot: 1.6 }, sharpEars: true, gear: { flash: 1, smoke: 1 },
    blurb: 'Sabe antes de entrar: pasa una cámara de fibra óptica bajo la puerta, oye con precisión y ve las trampas de lejos.',
  },
  shield: {
    label: 'Escudo', pick: true, unique: true, weapon: 'pistol', ability: 'shield', modifiers: { speed: 0.82, turnRate: 0.8, spread: 1.25, bash: 1.4 }, gear: { flash: 1 },
    blurb: 'Escudo balístico y pistola. Las balas de frente no le pasan, y cubre al que va pegado detrás. Lento, y vulnerable por los lados.',
  },
  marksman: {
    label: 'Tirador', pick: true, unique: true, weapon: 'dmr', ability: null, modifiers: { holdReaction: 0.55, turnRate: 0.75, speed: 0.97 }, gear: { smoke: 1 },
    blurb: 'Fusil de tirador. Quieto cubriendo una zona, dispara primero a quien aparezca. Lento girando y malo de cerca.',
  },
  grenadier: {
    label: 'Granadero', pick: true, unique: true, weapon: 'smg', ability: 'launcher', modifiers: { tossRange: 2, spread: 1.15 }, gear: { gas: 2, flash: 1 },
    blurb: 'Lanzagranadas de 40 mm con gas lacrimógeno: saca a la gente de las salas sin entrar. Lanza el doble de lejos.',
  },
  // Defenders (their weapon comes from each map spawn, unless `ownWeapon`). `defPick`: offered in the
  // defender's preparation; `max`: how many a side may have.
  // The plain defender: the tutorial's and a post's without a class. `hidden`: not offered in the roster.
  defender: {
    label: 'Defensor', defPick: true, hidden: true, max: 4, weapon: 'rifle', ability: null, modifiers: {}, gear: { flash: 1 },
    blurb: 'El de siempre. Lleva una flash.',
  },
  // Shotgunner: waits beside a door for whoever comes through it; deadly up close, little past 10 m.
  shotgunner: {
    label: 'Escopetero', defPick: true, max: 2, weapon: 'shotgun', ability: null, modifiers: { closeReaction: 0.72 }, ownWeapon: true, gear: { flash: 1, frag: 1 },
    blurb: 'Espera pegado a la puerta al que entra: escopeta que tumba de un tiro a quemarropa y reacción más rápida de cerca. Lejos, pierde.',
  },
  // Site anchor: holds his angle from a prepared position; tougher and quicker to shoot first.
  anchor: {
    label: 'Ancla', defPick: true, max: 2, weapon: 'rifle', ability: 'prepared', modifiers: { reaction: 0.9 }, maxHp: 120, gear: { frag: 1 },
    blurb: 'Sostiene el sitio: chaleco pesado (120 de vida) y una posición preparada con parapeto. Mientras no se mueva de ella, le cuesta más caer.',
  },
  // Roamer: off the site, hunting the attackers' flank; quick and quiet. The Explorador hears him.
  roamer: {
    label: 'Merodeador', defPick: true, max: 1, weapon: 'smg', ability: null, modifiers: { speed: 1.12, stepNoise: 0.35, shotNoise: 0.3, reaction: 0.93 }, ownWeapon: true, gear: { flash: 1 },
    blurb: 'Caza fuera del sitio: rápido, pasos que casi no se oyen y subfusil con supresor (oyen que hubo tiros, no de dónde).',
  },
  // Trapper: lays TRAP.perTrapper traps in the preparation (sim/traps.js) and one more barbed wire.
  trapper: {
    label: 'Trampero', defPick: true, max: 1, weapon: 'rifle', ability: null, modifiers: {}, wires: 1, gear: { smoke: 1 },
    blurb: 'Decide por dónde se pasa: 2 cepos (atrapan y delatan), un alambre de púas más para el equipo y un humo.',
  },
  // Lookout: one more camera and the monitor (sim/cameras.js).
  lookout: {
    label: 'Vigía', defPick: true, max: 1, weapon: 'rifle', ability: 'monitor', modifiers: {}, cameras: 1, gear: { flash: 1 },
    blurb: 'Los ojos del equipo: una cámara más y el monitor. Mirándolo, las cámaras avisan al instante de todo lo que ven, pero él no cuida su ángulo.',
  },
  // Defending marksman: a sniper rifle on one long lane.
  sniper: {
    label: 'Tirador', defPick: true, max: 1, weapon: 'sniper', ability: null, modifiers: { holdReaction: 0.55, turnRate: 0.8 }, ownWeapon: true, gear: { flash: 1 },
    blurb: 'Fusil de precisión en una línea larga: quien la cruza recibe un disparo casi letal. Fuera de ese ángulo, lento.',
  },
});

/**
 * Archetypal compositions (docs/diseno/composiciones.md): three classes and
 * the game plan they enable, as data the AI reads (sim/aiAttack.js,
 * sim/aiDefend.js). An AI side picks one blind (AI_SQUADS); a squad that is
 * none of them (a player's) gets the plan its classes suggest (planFor).
 *
 * Attack plan fields: `lead` (the class on point: he takes the bomb spot,
 * throws the first flash at each door and goes through it first, soaking
 * the first shots on his shield), `split` (one operator comes in through another
 * door of the site, when it is not a long detour: a pinch), `overwatch` (that
 * class stops short of the site and holds the way in; a turn later he joins),
 * `buy` (what each operator buys with his points, in order: AI_ATTACK.buy if
 * none).
 * Defense plan fields: `rotators` (how many leave their posts for the bomb
 * when it is threatened), `threat` (m from the bomb that counts as a threat:
 * farther = earlier rotation).
 */
export const COMPOSITIONS = Object.freeze({
  attackers: Object.freeze([
    Object.freeze({ id: 'hardBreach', roles: Object.freeze(['shield', 'entry', 'assault']), plan: Object.freeze({ lead: 'shield' }) }),
    Object.freeze({ id: 'infoFlank', roles: Object.freeze(['scout', 'assault', 'entry']), plan: Object.freeze({ split: true }) }),
    Object.freeze({ id: 'utility', roles: Object.freeze(['grenadier', 'entry', 'scout']), plan: Object.freeze({ buy: Object.freeze(['flash', 'smoke']) }) }),
    Object.freeze({ id: 'longPick', roles: Object.freeze(['marksman', 'shield', 'assault']), plan: Object.freeze({ overwatch: 'marksman' }) }),
    Object.freeze({ id: 'rush', roles: Object.freeze(['assault', 'grenadier', 'assault']), plan: Object.freeze({ split: true, buy: Object.freeze(['flash', 'flash']) }) }),
  ]),
  defenders: Object.freeze([
    Object.freeze({ id: 'fortress', roles: Object.freeze(['anchor', 'shotgunner', 'trapper']), plan: Object.freeze({ rotators: 1, threat: 8 }) }),
    Object.freeze({ id: 'retake', roles: Object.freeze(['anchor', 'roamer', 'sniper']), plan: Object.freeze({ rotators: 2, threat: 12 }) }),
    Object.freeze({ id: 'infoNet', roles: Object.freeze(['lookout', 'trapper', 'anchor']), plan: Object.freeze({ rotators: 2, threat: 10 }) }),
    Object.freeze({ id: 'ambush', roles: Object.freeze(['shotgunner', 'roamer', 'lookout']), plan: Object.freeze({ rotators: 2, threat: 6 }) }),
    Object.freeze({ id: 'longLine', roles: Object.freeze(['sniper', 'lookout', 'anchor']), plan: Object.freeze({ rotators: 2, threat: 10 }) }),
  ]),
});

/**
 * The squads an AI side picks from, blind (session/Lobby.js aiRoles: one per
 * round, from its seed): the archetypal compositions. Defenders by post of the map's layout.
 */
export const AI_SQUADS = Object.freeze({
  attackers: Object.freeze(COMPOSITIONS.attackers.map((c) => c.roles)),
  defenders: Object.freeze(COMPOSITIONS.defenders.map((c) => c.roles)),
});

const sameClasses = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/**
 * The plan of a side's squad (`roles`: its classes): its archetype's when it
 * is one, else the one its classes suggest (the Tirador covers, a Brecha with
 * an Escudo breaks in, an Explorador moves quiet...). Always a fresh object.
 */
export function planFor(team, roles) {
  const own = COMPOSITIONS[team].find((c) => sameClasses(c.roles, roles));
  if (own) return { id: own.id, ...own.plan };
  const has = (r) => roles.includes(r);
  if (team === 'attackers') {
    return { id: null, lead: has('shield') ? 'shield' : null, split: has('scout') && !has('grenadier'), overwatch: has('marksman') ? 'marksman' : null };
  }
  const near = roles.filter((r) => r === 'anchor' || r === 'shotgunner').length;
  return { id: null, rotators: near >= 2 ? 1 : 2, threat: has('roamer') || has('sniper') ? 12 : 8 };
}

/** A role's flag (ROLES[id][key]), false for an unknown role. */
export const roleFlag = (roleId, key) => !!(ROLES[roleId] && ROLES[roleId][key]);

/** The attacker classes offered in the buy phase, in panel order. */
export const PICK_ROLES = Object.freeze(Object.keys(ROLES).filter((id) => ROLES[id].pick));

/** The defender classes offered in the preparation, in panel order. */
export const DEF_PICK_ROLES = Object.freeze(Object.keys(ROLES).filter((id) => ROLES[id].defPick && !ROLES[id].hidden));

export const DEFAULT_DEFENDER_ROLE = 'defender';
