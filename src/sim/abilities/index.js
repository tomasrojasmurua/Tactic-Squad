// Ability registry: one module per operator gadget / passive, looked up by
// the `ability` id of a role (config/operators.js ROLES). Pure sim code like
// every other system: deterministic, only sim.rng, reports via sim.emit.
//
// An ability module is a plain object:
//   {
//     id: 'breachCharge',
//     init(sim, unit)        // optional: called once at spawn, may set unit.abilityState
//     update(sim, unit, dt)  // optional: called every tick while the unit is alive
//   }
// and is activated by an order (sim/orders.js, e.g. {type:'useAbility', unitId})
// when it has an active part. None exist yet: add the file, then list it below.

export const ABILITIES = Object.freeze({
  // breachCharge, shield, scoutDrone ... (next phase)
});

export function initAbilities(sim) {
  for (const u of sim.units) {
    if (!u.ability) continue;
    const a = ABILITIES[u.ability];
    if (!a) throw new Error(`Habilidad desconocida: ${u.ability}`);
    if (a.init) a.init(sim, u);
  }
}

export function updateAbilities(sim, dt) {
  for (const u of sim.units) {
    if (!u.alive || !u.ability) continue;
    const a = ABILITIES[u.ability];
    if (a.update) a.update(sim, u, dt);
  }
}
