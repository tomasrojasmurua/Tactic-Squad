// Hito 3: compra (sim/prep.js), preparación del defensor (sitio, posiciones,
// órdenes de vigilancia, barricadas), barricadas en el asalto
// (sim/barricades.js) y el dron de reconocimiento (sim/drone.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { teamView } from '../src/sim/view.js';
import { EV } from '../src/core/events.js';
import { BUY, PREP, DRONE, BARRICADE, ROUND, SIM } from '../src/config/balance.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';

const MAP = MAPS[DEFAULT_MAP];
const BOTH = { attackers: 'human', defenders: 'human' };
const ATK = 'attackers';
const DEF = 'defenders';
const DEG = Math.PI / 180;

const cmd = (sim, team, c) => sim.enqueue({ team, ...c });
const rejects = (sim) => sim.drainEvents().filter((e) => e.type === EV.ORDER_REJECTED).map((e) => e.reason);
const events = (sim, type) => sim.drainEvents().filter((e) => e.type === type);
const door = (sim, id) => sim.doors.find((d) => d.def.id === id);
const run = (sim, seconds) => {
  for (let i = 0; i < Math.round(seconds * SIM.tickRate); i++) sim.step();
};

/** Al dron, con el defensor quieto (humano) salvo que se diga otra cosa. */
function toDrone(opts = {}) {
  const sim = new Simulation(MAP, { seed: 3, controllers: BOTH, site: 'A', ...opts });
  sim.advancePhase(); // compra -> preparación
  sim.advancePhase(); // -> dron
  assert.equal(sim.phase, 'drone');
  return sim;
}

function putDrone(sim, x, y, facing = 0) {
  const d = sim.drone;
  d.x = d.prevX = x;
  d.y = d.prevY = y;
  d.facing = d.prevFacing = facing;
}

// ------------------------------------------------------------ compra

test('cada operador lleva el equipo de su clase gratis y suma utilidad con sus puntos', () => {
  const sim = new Simulation(MAP, { seed: 1 });
  const [aguila, lobo] = sim.teams.attackers;
  assert.deepEqual([aguila.points, lobo.points], [BUY.points, BUY.points], 'el equipo de la clase no se descuenta');
  assert.deepEqual([lobo.gear.flash, lobo.gear.breach], [1, 2]);
  // El equipo de la clase no se devuelve.
  cmd(sim, ATK, { type: 'buy', unitId: lobo.id, item: 'breach', count: -1 });
  sim.flushCommands();
  assert.deepEqual(rejects(sim), ['noGear']);
  cmd(sim, ATK, { type: 'buy', unitId: lobo.id, item: 'flash', count: 1 });
  cmd(sim, ATK, { type: 'buy', unitId: lobo.id, item: 'smoke', count: 1 });
  cmd(sim, ATK, { type: 'buy', unitId: lobo.id, item: 'frag', count: 1 });
  sim.flushCommands();
  assert.deepEqual(rejects(sim), ['noPoints']);
  assert.deepEqual([lobo.gear.flash, lobo.gear.smoke, lobo.points], [2, 1, 0]);
  // Lo comprado sí se devuelve, por sus puntos.
  cmd(sim, ATK, { type: 'buy', unitId: lobo.id, item: 'smoke', count: -1 });
  cmd(sim, ATK, { type: 'buy', unitId: lobo.id, item: 'flash', count: 1 });
  sim.flushCommands();
  assert.deepEqual(rejects(sim), ['gearFull']);
  assert.deepEqual([lobo.gear.smoke, lobo.points], [0, BUY.prices.smoke]);
  // Fuera de la compra no se compra.
  sim.advancePhase();
  cmd(sim, ATK, { type: 'buy', unitId: aguila.id, item: 'flash', count: 1 });
  sim.flushCommands();
  assert.ok(rejects(sim).length === 1);
});

test('lo que se lleva es lo que se usa en el asalto (sin carga no hay brecha)', () => {
  const sim = new Simulation(MAP, { seed: 1 });
  const aguila = sim.teams.attackers[0]; // Asaltante: su clase no trae cargas
  sim.skipToAssault();
  cmd(sim, ATK, { type: 'addWaypoint', unitId: aguila.id, x: 8.6, y: 12.7 });
  cmd(sim, ATK, { type: 'setEntry', unitId: aguila.id, mode: 'breach' });
  sim.flushCommands();
  assert.ok(rejects(sim).includes('noGear'));
});

test('el defensor compra granada, humo o flash en su preparación (cargas no); la IA defensora gasta sus puntos', () => {
  const sim = new Simulation(MAP, { seed: 2, controllers: BOTH, site: 'A' });
  const d = sim.teams.defenders[1]; // Defensor: su clase trae una flash
  // En la compra del atacante, el defensor todavía no compra.
  cmd(sim, DEF, { type: 'buy', unitId: d.id, item: 'frag', count: 1 });
  sim.flushCommands();
  assert.equal(rejects(sim).length, 1);
  sim.advancePhase(); // -> preparación
  const kit = { ...d.gear };
  cmd(sim, DEF, { type: 'buy', unitId: d.id, item: 'breach', count: 1 });
  cmd(sim, DEF, { type: 'buy', unitId: d.id, item: 'smoke', count: 1 });
  sim.flushCommands();
  assert.deepEqual(rejects(sim), ['badItem']);
  assert.equal(d.gear.smoke, kit.smoke + 1);
  assert.equal(d.points, BUY.points - BUY.prices.smoke);
  // Un cambio de clase le da el equipo de la nueva y le devuelve los puntos.
  cmd(sim, DEF, { type: 'setDefenderRole', unitId: d.id, role: 'anchor' });
  sim.flushCommands();
  assert.deepEqual([d.role, d.gear.flash, d.gear.frag, d.gear.smoke, d.points], ['anchor', 0, 1, 0, BUY.points]);
  // La IA defensora compra al entrar en la preparación.
  const ai = new Simulation(MAP, { seed: 2, site: 'A' });
  ai.advancePhase();
  assert.ok(ai.teams.defenders.every((u) => u.points < BUY.points), 'gasta sus puntos');
  assert.ok(ai.teams.defenders.some((u) => u.gear.frag > 0), 'el Ancla trae su granada');
});

// ------------------------------------------------------------ preparación del defensor

test('el defensor elige sitio: la bomba va allí y su despliegue parte del del mapa', () => {
  const sim = new Simulation(MAP, { seed: 2, controllers: BOTH, site: 'A' });
  sim.advancePhase();
  cmd(sim, DEF, { type: 'chooseSite', site: 'B' });
  sim.flushCommands();
  const site = MAP.sites.find((s) => s.id === 'B');
  assert.deepEqual([sim.site.id, sim.bomb.site, sim.bomb.x, sim.bomb.y], ['B', 'B', site.bomb[0], site.bomb[1]]);
  sim.teams.defenders.forEach((u, i) => assert.deepEqual([u.x, u.y], MAP.defense.B[i].at));
  // El atacante no puede dar órdenes del defensor, ni saber el sitio.
  cmd(sim, ATK, { type: 'chooseSite', site: 'A' });
  sim.flushCommands();
  assert.equal(sim.site.id, 'B');
  assert.equal(teamView(sim, ATK).bomb, null);
  cmd(sim, DEF, { type: 'chooseSite', site: 'Z' });
  sim.flushCommands();
  assert.deepEqual(rejects(sim), ['badSite']);
});

test('los defensores se colocan solo en su mitad, sin encimarse', () => {
  const sim = new Simulation(MAP, { seed: 2, controllers: BOTH, site: 'A' });
  sim.advancePhase();
  const [a, b] = sim.teams.defenders;
  cmd(sim, DEF, { type: 'placeUnit', unitId: a.id, x: 24, y: 6, facing: Math.PI });
  sim.flushCommands();
  assert.deepEqual([a.x, a.y, a.facing], [24, 6, Math.PI]);
  cmd(sim, DEF, { type: 'placeUnit', unitId: a.id, x: 5, y: 12 }); // patio de los atacantes
  cmd(sim, DEF, { type: 'placeUnit', unitId: b.id, x: 24.3, y: 6 }); // encima de otro
  cmd(sim, ATK, { type: 'placeUnit', unitId: b.id, x: 30, y: 20 }); // no es su bando: se ignora
  sim.flushCommands();
  assert.deepEqual(rejects(sim), ['outsideHalf', 'tooClose']);
  assert.deepEqual([a.x, a.y], [24, 6]);
  assert.notDeepEqual([b.x, b.y], [30, 20]);
  // En la planificación ya no se mueve nadie a mano.
  sim.advancePhase();
  sim.advancePhase();
  cmd(sim, DEF, { type: 'placeUnit', unitId: a.id, x: 25, y: 6 });
  sim.flushCommands();
  assert.deepEqual(rejects(sim), ['notNow']);
});

test('las cuatro órdenes de vigilancia se vuelven comportamientos de la IA', () => {
  const sim = new Simulation(MAP, { seed: 2, controllers: BOTH, site: 'A', defenders: [0, 1, 2, 3] }); // un defensor por orden
  sim.advancePhase();
  const [a, b, c, d] = sim.teams.defenders;
  const watch = (u, w) => cmd(sim, DEF, { type: 'setWatch', unitId: u.id, watch: w });
  watch(a, { facing: 0 });
  watch(b, { facing: 0, sweep: [-30 * DEG, 30 * DEG] });
  watch(c, { facing: Math.PI, react: true });
  watch(d, { facing: Math.PI, react: true, fallback: { to: [33, 20], look: -Math.PI / 2 } });
  sim.flushCommands();
  assert.deepEqual(a.behavior, { type: 'hold', reactsToNoise: false, rotate: undefined });
  assert.deepEqual(b.behavior, { type: 'scan', from: -30 * DEG, to: 30 * DEG, period: PREP.sweepPeriod, reactsToNoise: false, rotate: undefined });
  assert.equal(c.behavior.reactsToNoise, true);
  assert.deepEqual(d.behavior.rotate, { to: [33, 20], look: -Math.PI / 2 });
  watch(d, { facing: 0, fallback: { to: [5, 12], look: 0 } });
  sim.flushCommands();
  assert.deepEqual(rejects(sim), ['outsideHalf'], 'replegarse también es dentro de su mitad');
});

test('hasta 2 barricadas, solo en puertas de la mitad defensora', () => {
  const sim = new Simulation(MAP, { seed: 2, controllers: BOTH });
  sim.advancePhase();
  const bar = (id, on = true) => cmd(sim, DEF, { type: 'barricade', door: id, on });
  bar('sala');
  bar('cocina');
  bar('sitio-sala');
  bar('entrada'); // puerta exterior: lado atacante
  sim.flushCommands();
  assert.deepEqual(rejects(sim), ['tooManyBarricades', 'badDoor']);
  bar('cocina', false);
  bar('sitio-sala');
  sim.flushCommands();
  assert.deepEqual(rejects(sim), []);
  assert.deepEqual(sim.doors.filter((d) => d.barricaded).map((d) => d.def.id).sort(), ['sala', 'sitio-sala']);
  assert.equal(PREP.barricades, 2);
});

test('la IA defensora se prepara al empezar la preparación: 2 barricadas de las de su sitio, fijas por semilla', () => {
  const pick = (seed) => {
    const sim = new Simulation(MAP, { seed });
    sim.advancePhase();
    return sim.doors.filter((d) => d.barricaded).map((d) => d.def.id);
  };
  const sim = new Simulation(MAP, { seed: 11 });
  sim.advancePhase();
  const ids = sim.doors.filter((d) => d.barricaded).map((d) => d.def.id);
  assert.equal(ids.length, PREP.barricades);
  for (const id of ids) assert.ok(MAP.aiBarricades[sim.site.id].includes(id));
  assert.deepEqual(pick(11), ids);
  const seen = new Set();
  for (let seed = 0; seed < 40; seed++) seen.add(pick(seed).join());
  assert.ok(seen.size > 2, 'la elección varía con la semilla');
});

// ------------------------------------------------------------ barricadas en el asalto

/** Un atacante frente a 'sala' (pasillo -> sala), con la barricada puesta y una ruta que la cruza. */
function atBarricade(mode = null) {
  const sim = new Simulation(MAP, { seed: 4, controllers: BOTH, site: 'A' });
  sim.advancePhase();
  cmd(sim, DEF, { type: 'barricade', door: 'sala' });
  sim.skipToAssault();
  const u = sim.teams.attackers[1];
  u.x = u.prevX = 20.55;
  u.y = u.prevY = 12.7;
  u.hp = 1000; // lo que se prueba es la barricada, no el tiroteo con el ancla de la sala
  cmd(sim, ATK, { type: 'addWaypoint', unitId: u.id, x: 20.55, y: 16 });
  sim.flushCommands();
  // La ruta cruza una puerta cerrada: "?" antes de ella. Se decide cómo.
  cmd(sim, ATK, { type: 'setEntry', unitId: u.id, mode, index: 0 });
  sim.flushCommands();
  sim.drainEvents();
  return { sim, u };
}

test('una barricada no se abre: el atacante la rompe a golpes (3 s; la Brecha antes), ruidosa, y luego pasa', () => {
  const { sim, u } = atBarricade(null);
  assert.equal(teamView(sim, ATK).barricades.length, 0, 'el atacante aún no la conoce');
  sim.advancePhase();
  const seen = [];
  while (sim.phase === 'exec') {
    sim.step();
    seen.push(...sim.drainEvents());
  }
  assert.ok(seen.some((e) => e.type === EV.BARRICADE_SPOTTED), 'la ve al llegar');
  const hits = seen.filter((e) => e.type === EV.BARRICADE_HIT);
  const broken = seen.find((e) => e.type === EV.BARRICADE_BROKEN);
  assert.ok(hits.length >= Math.floor((BARRICADE.breakTime * u.mods.bash) / BARRICADE.hitEvery));
  assert.equal(broken.how, 'bash');
  assert.ok(broken.tick - hits[0].tick >= BARRICADE.breakTime * u.mods.bash * SIM.tickRate - 1);
  assert.ok(u.y > 14.5, 'pasó por el hueco');
  // Los defensores lo oyen (el pulso lleva el ruido más fuerte de su celda: puede ser un disparo).
  assert.ok(sim.noise.pulses.defenders.some((p) => Math.hypot(p.x - 20.55, p.y - 14) < 3), 'los defensores lo oyen');
});

test('la patada también se vuelve romper; la carga la vuela al instante', () => {
  const kick = atBarricade('kick');
  kick.sim.advancePhase();
  run(kick.sim, 1.5);
  assert.ok(kick.u.bash, 'patear una barricada = empezar a romperla');
  assert.ok(door(kick.sim, 'sala').barricaded);
  const charge = atBarricade('breach');
  charge.sim.advancePhase();
  let blown = null;
  while (charge.sim.phase === 'exec' && !blown) {
    charge.sim.step();
    blown = charge.sim.drainEvents().find((e) => e.type === EV.BARRICADE_BROKEN);
  }
  assert.equal(blown.how, 'breach');
  assert.ok(blown.tick < 4 * SIM.tickRate, 'colocar y volar, sin golpes');
});

// ------------------------------------------------------------ dron

test('el dron se maneja en tiempo real: pasa bajo una puerta, no por una barricada; no gasta el tiempo de la bomba', () => {
  const sim = new Simulation(MAP, { seed: 3, controllers: BOTH, site: 'A' });
  sim.advancePhase();
  cmd(sim, DEF, { type: 'barricade', door: 'sala' });
  sim.advancePhase();
  putDrone(sim, 8.6, 12.7);
  cmd(sim, ATK, { type: 'drone', dir: 0, atTick: 0 }); // hacia el este: la puerta de entrada
  run(sim, 1.5);
  assert.ok(sim.drone.x > 11, 'pasó bajo la puerta cerrada');
  assert.equal(door(sim, 'entrada').open, false, 'sin abrirla');
  putDrone(sim, 20.55, 12.7);
  cmd(sim, ATK, { type: 'drone', dir: DRONE.directions / 4, atTick: sim.round.droneTick }); // al sur: la barricada
  run(sim, 1.5);
  assert.ok(sim.drone.y < 14 - DRONE.radius + 0.01, 'la barricada lo detiene');
  assert.ok(teamView(sim, ATK).barricades.some((b) => b.door === 'sala'), 'y queda vista');
  assert.equal(sim.timeLeft, ROUND.timeLimit);
  assert.equal(sim.turn, 0);
});

test('lo que ve el dron queda marcado: defensores (última posición) y el sitio de la bomba', () => {
  const sim = toDrone();
  putDrone(sim, 31.2, 13, 30 * DEG);
  sim.step();
  const ev = sim.drainEvents();
  assert.ok(ev.some((e) => e.type === EV.BOMB_SPOTTED), 've la bomba');
  assert.equal(teamView(sim, ATK).bomb.site, 'A');
  const seen = sim.teams.defenders.filter((u) => u.seenByEnemy);
  assert.ok(seen.length > 0, 've a algún defensor');
  cmd(sim, ATK, { type: 'droneRecall', atTick: sim.round.droneTick });
  sim.step();
  assert.equal(sim.phase, 'plan');
  const view = teamView(sim, ATK);
  assert.equal(view.enemies.length, 0, 'ya no los ve...');
  for (const u of seen) assert.ok(view.lastKnown.some((k) => k.id === u.id && k.x === u.x && k.y === u.y), '...pero sabe dónde estaban');
});

test('un defensor que lo tiene a la vista lo derriba; se acaba a los 15 s', () => {
  const sim = toDrone();
  putDrone(sim, 30, 17.6, 0); // frente al ancla de A
  run(sim, DRONE.shootDelay + 0.1);
  assert.equal(sim.phase, 'plan');
  assert.equal(sim.drone.end, 'destroyed');
  const late = toDrone();
  putDrone(late, 5, 8); // en el patio, sin nadie
  run(late, DRONE.seconds - 0.1);
  assert.equal(late.phase, 'drone');
  run(late, 0.2);
  assert.deepEqual([late.phase, late.drone.end, late.turn], ['plan', 'time', 1]);
});

test('el dron es determinista: las mismas órdenes con su paso dan el mismo recorrido', () => {
  const fly = () => {
    const sim = toDrone({ controllers: { attackers: 'human', defenders: 'ai' } });
    const plan = [
      [0, 0],
      [40, 1],
      [90, 2],
      [200, -1],
      [230, 15],
    ];
    for (const [atTick, dir] of plan) cmd(sim, ATK, { type: 'drone', dir, atTick });
    cmd(sim, ATK, { type: 'droneRecall', atTick: 400 });
    while (sim.phase === 'drone') sim.step();
    return [sim.tick, sim.drone.x, sim.drone.y, sim.drone.facing, sim.drone.end, sim.units.map((u) => u.facing)];
  };
  assert.deepEqual(fly(), fly());
});

test('la entrada se puede cambiar en la primera planificación, no después del primer turno', () => {
  const sim = new Simulation(MAP, { seed: 3 });
  sim.skipToAssault();
  cmd(sim, ATK, { type: 'chooseEntry', entry: 'sur' });
  sim.flushCommands();
  assert.equal(sim.entry.id, 'sur');
  sim.advancePhase();
  while (sim.phase === 'exec') sim.step();
  cmd(sim, ATK, { type: 'chooseEntry', entry: 'norte' });
  sim.flushCommands();
  assert.deepEqual(rejects(sim), ['entryLocked']);
  assert.equal(sim.entry.id, 'sur');
});

test('la IA defensora lanza su utilidad a la puerta por donde oye venir al atacante, sin herir a los suyos', () => {
  let thrown = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const sim = new Simulation(MAP, { seed, controllers: { attackers: 'ai', defenders: 'ai' } });
    for (let g = 0; sim.phase !== 'end' && g < 40000; g++) {
      if (sim.phase === 'buy' || sim.phase === 'prep' || sim.phase === 'plan') sim.advancePhase();
      else sim.step();
      for (const e of sim.drainEvents()) {
        if (e.type !== EV.GRENADE_THROWN || sim.units[e.unitId].team !== DEF) continue;
        thrown++;
        if (e.kind !== 'frag') continue;
        const r = 4.2; // ENTRY.frag.radius
        for (const o of sim.teams.defenders) if (o.alive) assert.ok(Math.hypot(o.x - e.toX, o.y - e.toY) > r, 'ningún defensor dentro de la explosión al lanzar');
      }
    }
  }
  assert.ok(thrown > 0, 'algún defensor lanzó');
});
