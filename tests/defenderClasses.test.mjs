// Clases del defensor: Merodeador (rápido y silencioso) y Trampero (trampas
// que atrapan y delatan al atacante), elegidas antes de la partida con un tope
// por clase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { controllersFor } from '../src/config/squad.js';
import { ROLES } from '../src/config/operators.js';
import { TRAP, NOISE } from '../src/config/balance.js';
import { EV } from '../src/core/events.js';
import { collectNoise } from '../src/sim/noise.js';
import { setDefenderRole } from '../src/sim/prep.js';

// Las clases se prueban con los cuatro puestos del mapa (en una ronda normal se usan los 3 primeros).
const ALL_POSTS = [0, 1, 2, 3];
const MAP = MAPS[DEFAULT_MAP];

/** A human defender in the preparation. */
function setup(site = 'A') {
  const sim = new Simulation(MAP, { seed: 3, site, controllers: controllersFor('defenders'), defenders: ALL_POSTS });
  while (sim.phase !== 'prep') sim.advancePhase();
  sim.drainEvents();
  const cmd = (c) => {
    sim.enqueue({ team: 'defenders', ...c });
    sim.flushCommands();
    return sim.drainEvents().filter((e) => e.type === EV.ORDER_REJECTED).map((e) => e.reason);
  };
  return { sim, cmd, defs: sim.teams.defenders };
}

/** The rules of the class pick (before the game: Simulation opts.roles); no order changes a class in a round. */
const pick = (sim, u, role) => {
  const r = setDefenderRole(sim, u, role);
  sim.drainEvents();
  return r ? [r] : [];
};

/** An assault with an attacker placed by hand. `clear`: the defenders wait far away, in the kitchen. */
function assault(site = 'A', clear = false) {
  const sim = new Simulation(MAP, { seed: 3, site, defenders: ALL_POSTS });
  sim.skipToAssault();
  if (clear) {
    sim.teams.defenders.forEach((d, i) => {
      d.x = d.prevX = 20 + i * 0.9;
      d.y = d.prevY = 3;
      d.route.length = 0;
      d.behavior = null;
    });
  }
  return sim;
}

function run(sim, ticks) {
  const events = [];
  for (let i = 0; i < ticks && !sim.outcome; i++) {
    if (sim.phase !== 'exec') sim.advancePhase();
    sim.step();
    events.push(...sim.drainEvents());
  }
  return events;
}

test('la disposición del mapa trae Merodeador y Trampero, con las trampas del sitio', () => {
  for (const site of ['A', 'B']) {
    const sim = assault(site);
    const roles = sim.teams.defenders.map((u) => u.role);
    assert.ok(roles.includes('roamer'), `${site}: Merodeador`);
    assert.ok(roles.includes('trapper'), `${site}: Trampero`);
    assert.equal(sim.traps.length, TRAP.perTrapper);
    for (const t of sim.traps) assert.ok(sim.world.nav.walkable(t.x, t.y), `${site}: trampa en suelo libre`);
  }
});

test('cambiar de sitio vuelve a poner las trampas del mapa para ese sitio', () => {
  const { sim, cmd } = setup('A');
  const before = sim.traps.map((t) => [t.x, t.y]);
  assert.deepEqual(cmd({ type: 'chooseSite', site: 'B' }), []);
  assert.equal(sim.traps.length, TRAP.perTrapper);
  assert.notDeepEqual(sim.traps.map((t) => [t.x, t.y]), before);
});

test('la clase del defensor se elige con tope por clase y conserva el arma del puesto', () => {
  const { sim, cmd, defs } = setup('A');
  assert.deepEqual(cmd({ type: 'setDefenderRole', unitId: defs[0].id, role: 'roamer' }), ['notNow'], 'no se cambia dentro de la ronda');
  const anchors = () => defs.filter((u) => u.role === 'anchor').length;
  const free = defs.find((u) => u.role === 'defender');
  assert.deepEqual(pick(sim, free, 'anchor'), []);
  assert.equal(anchors(), 2);
  assert.equal(free.maxHp, ROLES.anchor.maxHp);
  const roamer = defs.find((u) => u.role === 'roamer');
  const weapon = roamer.weaponId;
  assert.deepEqual(pick(sim, roamer, 'anchor'), ['roleTaken'], 'no hay tercer Ancla');
  assert.deepEqual(pick(sim, free, 'roamer'), ['roleTaken'], 'un solo Merodeador');
  assert.deepEqual(pick(sim, roamer, 'defender'), []);
  assert.equal(roamer.weaponId, weapon, 'el arma es la del puesto');
  assert.deepEqual(pick(sim, free, 'assault'), ['badRole'], 'clase de atacante');
});

test('el Trampero pone y levanta sus trampas; al dejar de serlo se las lleva', () => {
  const { sim, cmd, defs } = setup('A');
  const trapper = defs.find((u) => u.role === 'trapper');
  const other = defs.find((u) => u.role === 'defender');
  assert.deepEqual(cmd({ type: 'placeTrap', unitId: other.id, x: 30, y: 10 }), ['notTrapper']);
  assert.deepEqual(cmd({ type: 'placeTrap', unitId: trapper.id, x: 32, y: 10 }), ['tooManyTraps'], 'ya puso las del mapa');
  const [t0] = sim.traps;
  assert.deepEqual(cmd({ type: 'placeTrap', unitId: trapper.id, x: t0.x + 0.2, y: t0.y }), [], 'tocar la suya la levanta');
  assert.equal(sim.traps.length, TRAP.perTrapper - 1);
  assert.deepEqual(cmd({ type: 'placeTrap', unitId: trapper.id, x: 5, y: 10 }), ['outsideHalf']);
  assert.deepEqual(cmd({ type: 'placeTrap', unitId: trapper.id, x: 32, y: 10 }), []);
  assert.equal(sim.traps.length, TRAP.perTrapper);
  assert.deepEqual(pick(sim, trapper, 'defender'), []);
  assert.equal(sim.traps.length, 0, 'sin Trampero no hay trampas');
});

test('una trampa atrapa al atacante: lo frena, lo hiere, suena y los defensores saben dónde está', () => {
  const sim = assault('A', true);
  const [a] = sim.teams.attackers;
  const t = sim.traps[0];
  // En la nave, bajando hacia la trampa (sin puertas de por medio).
  a.x = t.x;
  a.y = t.y + 3;
  a.facing = Math.PI / 2;
  sim.enqueue({ team: 'attackers', type: 'addWaypoint', unitId: a.id, x: t.x, y: t.y - 2, user: true });
  sim.flushCommands();
  const ev = run(sim, 60 * 3);
  const sprung = ev.find((e) => e.type === EV.TRAP_SPRUNG);
  assert.ok(sprung, 'saltó');
  assert.equal(sprung.unitId, a.id);
  assert.equal(t.alive, false);
  assert.ok(a.hp < a.maxHp, 'lo hirió');
  assert.ok(sim.memory.defenders.has(a.id), 'los defensores lo marcan');
  const x = a.x;
  run(sim, 30);
  assert.ok(Math.abs(a.x - x) < 1e-6 || !a.alive, 'atrapado: no se mueve');
});

test('el cepo es un tropiezo, no una celda: suelta al atacante pasado TRAP.stun y sigue su ruta', () => {
  const sim = assault('A', true);
  const [a] = sim.teams.attackers;
  const t = sim.traps[0];
  a.x = t.x;
  a.y = t.y + 3;
  a.facing = Math.PI / 2;
  sim.enqueue({ team: 'attackers', type: 'addWaypoint', unitId: a.id, x: t.x, y: t.y - 2, user: true });
  sim.flushCommands();
  let sprung = false;
  for (let i = 0; i < 60 * 3 && !sprung; i++) sprung = run(sim, 1).some((e) => e.type === EV.TRAP_SPRUNG);
  assert.ok(sprung, 'saltó');
  assert.ok(TRAP.stun <= 1, 'menos de un segundo atrapado');
  const x = a.x;
  const y = a.y;
  run(sim, Math.ceil((TRAP.stun + 0.5) / sim.dt));
  assert.ok(!a.alive || Math.hypot(a.x - x, a.y - y) > 0.2, 'ya se mueve otra vez');
});

test('caminando no ve la trampa; con sigilo la descubre y la rompe de un tiro', () => {
  const play = (pace) => {
    const sim = assault('A', true);
    const [a] = sim.teams.attackers;
    const t = sim.traps[0];
    a.x = t.x;
    a.y = t.y + 5;
    a.facing = -Math.PI / 2;
    sim.enqueue({ team: 'attackers', type: 'addWaypoint', unitId: a.id, x: t.x, y: t.y - 2, user: true });
    if (pace) sim.enqueue({ team: 'attackers', type: 'setPace', unitId: a.id, pace });
    sim.flushCommands();
    return run(sim, 60 * 6).map((e) => e.type);
  };
  const walk = play(null);
  assert.ok(walk.includes(EV.TRAP_SPRUNG) && !walk.includes(EV.TRAP_FOUND), 'caminando cae');
  const sneak = play('sneak');
  assert.ok(sneak.includes(EV.TRAP_FOUND) && sneak.includes(EV.TRAP_DESTROYED), 'con sigilo la ve y la rompe');
  assert.ok(!sneak.includes(EV.TRAP_SPRUNG));
});

test('los pasos del Merodeador se oyen mucho más cerca', () => {
  const heardAt = (role) => {
    const sim = assault('A');
    const d = sim.teams.defenders.find((u) => u.role === 'roamer');
    if (role !== 'roamer') {
      d.mods = sim.teams.defenders.find((u) => u.role === 'defender').mods;
    }
    const [a] = sim.teams.attackers;
    for (const o of sim.teams.attackers) if (o !== a) o.x = 1;
    a.x = d.x;
    a.y = d.y - 4; // 4 m: se oye un paso normal (6 m), no el del Merodeador
    a.facing = -Math.PI / 2;
    sim.noise.heard.length = 0;
    const from = sim.events.length;
    sim.emit(EV.FOOTSTEP, { unitId: d.id, team: d.team, x: d.x, y: d.y, speed: 3, sneak: false });
    collectNoise(sim, from);
    return sim.noise.heard.some((h) => h.team === 'attackers' && h.kind === 'step');
  };
  assert.ok(NOISE.radius.step > 4);
  assert.equal(heardAt('defender'), true);
  assert.equal(heardAt('roamer'), false);
});
