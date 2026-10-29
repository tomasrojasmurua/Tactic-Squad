// Ability registry: one module per operator gadget / passive that needs its
// own per-tick or per-turn logic, looked up by the `ability` id of a role
// (config/operators.js ROLES). Pure sim code like every other system:
// deterministic, only sim.rng, reports via sim.emit. Signatures that live in
// an existing system (the Explorador's 'fiberCam' in sim/entries.js, the
// Escudo's 'shield' and the Ancla's 'prepared' in sim/combat.js, the
// Granadero's 'launcher' in sim/gas.js, the Vigía's 'monitor' in
// sim/cameras.js) need no module here.
//
// An ability module is a plain object:
//   {
//     id: 'breachCharge',
//     init(sim, unit)        // optional: called once at spawn, may set unit.abilityState
//     update(sim, unit, dt)  // optional: called every tick while the unit is alive
//     turnEnd(sim, unit)     // optional: called when a turn ends (exec -> plan, sim/round.js)
//   }
// and is activated by an order (sim/orders.js, e.g. {type:'useAbility', unitId})
// when it has an active part. Add the file, then list it below.

export const ABILITIES = Object.freeze({});

export function initAbilities(sim) {
  for (const u of sim.units) {
    const a = u.ability && ABILITIES[u.ability];
    if (a && a.init) a.init(sim, u);
  }
}

export function updateAbilities(sim, dt) {
  for (const u of sim.units) {
    if (!u.alive || !u.ability) continue;
    const a = ABILITIES[u.ability];
    if (a && a.update) a.update(sim, u, dt);
  }
}

/** A turn just ended (sim/round.js afterTick): passives that act once per turn. */
export function turnEndAbilities(sim) {
  for (const u of sim.units) {
    if (!u.alive || !u.ability) continue;
    const a = ABILITIES[u.ability];
    if (a && a.turnEnd) a.turnEnd(sim, u);
  }
}
