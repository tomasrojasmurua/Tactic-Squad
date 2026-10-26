// Entradas a salas por puerta (sim/entries.js): códigos GO, patada,
// entreabrir, flash, granada y carga de brecha, y que todo siga determinista.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { ENTRY, DOORS } from '../src/config/balance.js';
import { isGoReady, codeWaiting } from '../src/sim/queries.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';

const MAP = MAPS[DEFAULT_MAP];
// Ambos bandos por órdenes: los defensores se quedan quietos donde se los pone.
const STILL = { attackers: 'human', defenders: 'human' };
const T = 'attackers';

/**
 * ÁGUILA (y opcionalmente LOBO) junto a la puerta de entrada del patio
 * (x = 10, el pasillo queda al este). Un defensor en el pasillo, el resto lejos.
 */
function atTheDoor({ defender = [13, 12.7], facing = Math.PI } = {}) {
  const sim = new Simulation(MAP, { seed: 11, site: 'A', controllers: STILL });
  const [d0, ...others] = sim.teams.defenders;
  d0.x = defender[0];
  d0.y = defender[1];
  d0.facing = facing;
  others.forEach((d, i) => {
    d.x = 36 + i * 0.8;
    d.y = 24;
  });
  const [a, b, c] = sim.teams.attackers;
  a.x = 8.2;
  a.y = 12.0;
  b.x = 8.2;
  b.y = 13.4;
  c.x = 3;
  c.y = 20;
  const door = sim.doors.find((d) => d.def.id === 'entrada');
  return { sim, a, b, c, d0, door };
}

const cmd = (sim, c) => sim.enqueue({ team: T, ...c });
const wp = (sim, u, x, y) => cmd(sim, { type: 'addWaypoint', unitId: u.id, x, y, user: true });
const runFor = (sim, seconds) => {
  const end = sim.tick + Math.round(seconds / sim.dt);
  while (!sim.outcome && sim.tick < end) sim.step();
};
/** Stack point next to the door, wait for `code`, entry `mode`, then into the corridor. */
function stack(sim, u, y, code, mode, then = [12.5, 12.7]) {
  wp(sim, u, 9.25, y);
  cmd(sim, { type: 'setHold', unitId: u.id, code });
  if (mode) cmd(sim, { type: 'setEntry', unitId: u.id, mode });
  if (then) wp(sim, u, then[0], then[1]);
}

test('cada espera lleva un código GO: el GO suelta solo a los de ese código', () => {
  const { sim, a, b } = atTheDoor({ defender: [36, 3] });
  stack(sim, a, 11.75, 'A', null);
  stack(sim, b, 13.65, 'B', null);
  runFor(sim, 2.5);
  assert.ok(a.waitingGo && b.waitingGo);
  assert.equal(a.waitCode, 'A');
  assert.equal(b.waitCode, 'B');
  assert.ok(isGoReady(sim, T, 'A') && isGoReady(sim, T, 'B'));
  cmd(sim, { type: 'go' }); // sin código: el primero que alguien espera (A)
  runFor(sim, 0.1);
  assert.equal(a.waitingGo, false);
  assert.equal(b.waitingGo, true);
  assert.ok(codeWaiting(sim, T, 'B'));
  cmd(sim, { type: 'go', code: 'B' });
  runFor(sim, 0.1);
  assert.equal(b.waitingGo, false);
});

test('el botón de espera rota entre los códigos: A, B, C y sin espera', () => {
  const { sim, a } = atTheDoor();
  wp(sim, a, 9.25, 11.75);
  const seen = [];
  for (let i = 0; i < 4; i++) {
    cmd(sim, { type: 'toggleHold', unitId: a.id });
    sim.flushCommands();
    const p = a.route[a.route.length - 1];
    seen.push(p.hold ? p.code : null);
  }
  assert.deepEqual(seen, ['A', 'B', 'C', null]);
});

test('entreabrir: al llegar la puerta queda entornada (se ve, no se pasa) y con el GO se abre', () => {
  const { sim, a, b, d0, door } = atTheDoor({ defender: [14, 13.2], facing: 0 });
  b.x = 3; // LOBO lejos: por la rendija también pasan las balas
  b.y = 18;
  stack(sim, a, 11.75, 'A', 'slow');
  runFor(sim, 1.0);
  assert.equal(a.entry?.mode, 'slow');
  assert.equal(isGoReady(sim, T), false, 'aún entreabriendo');
  runFor(sim, 1.5);
  assert.ok(door.cracked && !door.open, 'entornada, todavía cerrada para el paso');
  assert.ok(Math.abs(Math.abs(door.angle) - DOORS.crackAngle) < 1e-9);
  assert.ok(isGoReady(sim, T));
  assert.ok(d0.seenByEnemy, 'por la rendija se ve al defensor del pasillo');
  assert.equal(a.target, -1, 'pero no se le dispara a través de la puerta');
  assert.equal(a.stats.shots, 0);
  cmd(sim, { type: 'go' });
  runFor(sim, 2.5);
  assert.ok(door.open);
  assert.ok(a.x > 10.5, 'cruzó la puerta');
});

test('patada: la puerta se abre de golpe con el GO y el que está detrás queda aturdido', () => {
  const { sim, a, d0, door } = atTheDoor({ defender: [10.7, 12.7], facing: 0 });
  stack(sim, a, 11.75, 'A', 'kick');
  runFor(sim, 2.5);
  assert.ok(!door.open && a.waitingGo);
  cmd(sim, { type: 'go' });
  sim.step();
  sim.step();
  assert.ok(door.open, 'abierta en el mismo instante del GO');
  assert.ok(d0.blind > 0 && d0.stun > 0, 'el defensor tras la puerta queda aturdido');
});

test('flash: el resto del código espera la detonación y el que la mira queda ciego', () => {
  const { sim, a, b, d0, door } = atTheDoor({ defender: [14, 12.7], facing: Math.PI });
  stack(sim, a, 11.75, 'A', 'flash');
  stack(sim, b, 13.65, 'A', null, [12.5, 13.2]);
  runFor(sim, 2.5);
  assert.ok(isGoReady(sim, T));
  const flashes = a.gear.flash;
  cmd(sim, { type: 'go' });
  runFor(sim, 0.1);
  assert.ok(door.open, 'quien lanza abre la puerta');
  assert.ok(b.goDelay > 0, 'LOBO espera el estallido');
  const bx = b.x;
  runFor(sim, ENTRY.throwDelay + ENTRY.flash.fuse);
  assert.ok(Math.abs(b.x - bx) < 0.05, 'no avanzó antes del flash');
  runFor(sim, 0.5);
  assert.equal(a.gear.flash, flashes - 1);
  assert.ok(d0.blind > 1.5, `ciego: ${d0.blind}`);
  assert.ok(d0.alive);
  assert.equal(d0.visibleEnemies.length, 0, 'ciego no ve a nadie');
  runFor(sim, 1.5);
  assert.ok(b.x > bx + 1, 'LOBO entra tras el flash');
});

test('granada: daña según la distancia y la baja cuenta como explosión', () => {
  // Defensor pegado a la pared norte del pasillo: fuera de la vista desde los costados de la puerta.
  const { sim, a, b, d0 } = atTheDoor({ defender: [12.8, 12.0], facing: 0 });
  b.x = 3;
  b.y = 18;
  stack(sim, a, 11.75, 'A', 'frag', null);
  runFor(sim, 2.5);
  cmd(sim, { type: 'go' });
  runFor(sim, ENTRY.throwDelay + ENTRY.frag.fuse + 1);
  assert.equal(d0.alive, false);
  assert.equal(d0.killerId, a.id);
  assert.equal(d0.deathCause.code, 'explosive');
  assert.equal(a.gear.frag, 0);
});

test('carga de brecha: se coloca al llegar, el GO revienta la puerta y daña al que está detrás', () => {
  const { sim, a, b, d0, door } = atTheDoor({ defender: [11.3, 12.7], facing: Math.PI });
  stack(sim, b, 11.75, 'A', 'breach');
  runFor(sim, 1.6);
  assert.equal(b.entry?.phase, 'prep');
  assert.equal(isGoReady(sim, T), false, 'colocando la carga');
  runFor(sim, ENTRY.breach.prepTime + 0.2);
  assert.ok(isGoReady(sim, T));
  assert.equal(b.gear.breach, 0);
  cmd(sim, { type: 'go' });
  runFor(sim, ENTRY.breach.fuse + 0.1);
  assert.ok(door.destroyed && door.open);
  assert.ok(d0.hp < d0.maxHp, 'herido por la carga');
  assert.equal(a.hp, a.maxHp, 'nadie de este lado sufre');
});

test('órdenes de entrada imposibles se rechazan: sin puerta cerca o sin equipo', () => {
  const { sim, a } = atTheDoor();
  const rejects = () => sim.drainEvents().filter((e) => e.type === 'orderRejected').map((e) => e.reason);
  wp(sim, a, 5, 18);
  cmd(sim, { type: 'setEntry', unitId: a.id, mode: 'flash' });
  sim.flushCommands();
  assert.deepEqual(rejects(), ['noDoor']);
  cmd(sim, { type: 'clearRoute', unitId: a.id });
  wp(sim, a, 9.25, 11.75);
  cmd(sim, { type: 'setEntry', unitId: a.id, mode: 'breach' }); // el asaltante no lleva carga
  cmd(sim, { type: 'setEntry', unitId: a.id, mode: 'flash' });
  wp(sim, a, 9.25, 11.6);
  cmd(sim, { type: 'setEntry', unitId: a.id, mode: 'flash' }); // ya gastó su único flash en el plan
  sim.flushCommands();
  assert.deepEqual(rejects(), ['noGear', 'noGear']);
  assert.equal(a.route.filter((p) => p.entry === 'flash').length, 1);
});

/** Una entrada completa: entreabrir con A, flash y patada por dos puertas con B. */
function playEntryRound(seed) {
  const sim = new Simulation(MAP, { seed, site: 'A', entry: 'principal' });
  const [a, b, c] = sim.teams.attackers;
  const go = [];
  stack(sim, a, 11.75, 'A', 'slow', [12.5, 12.4]);
  stack(sim, b, 13.65, 'B', 'flash', [12.5, 13.1]);
  wp(sim, c, 9.25, 9.95);
  cmd(sim, { type: 'setHold', unitId: c.id, code: 'B' });
  cmd(sim, { type: 'setEntry', unitId: c.id, mode: 'kick' });
  wp(sim, c, 12, 8);
  for (const u of [a, b]) wp(sim, u, 27.4, 12.7);
  while (!sim.outcome && sim.tick < 60 * 150) {
    if (!go.length && isGoReady(sim, T, 'A') && codeWaiting(sim, T, 'A')) go.push(sim.tick, cmd(sim, { type: 'go', code: 'A' }));
    if (go.length === 2 && codeWaiting(sim, T, 'B') && isGoReady(sim, T, 'B')) go.push(sim.tick, cmd(sim, { type: 'go', code: 'B' }));
    sim.step();
  }
  return {
    tick: sim.tick,
    go,
    outcome: sim.outcome && { winner: sim.outcome.winner, reason: sim.outcome.reason },
    doors: sim.doors.map((d) => [d.open, d.cracked, d.destroyed, +d.angle.toFixed(9)]),
    units: sim.units.map((u) => [u.alive, u.hp, +u.x.toFixed(6), +u.y.toFixed(6), u.blind.toFixed(6), { ...u.gear }]),
  };
}

test('una ronda con entradas coordinadas es determinista', () => {
  const a = playEntryRound(4321);
  const b = playEntryRound(4321);
  assert.ok(a.outcome, 'la ronda debe terminar');
  assert.ok(a.go.length === 4, 'se dieron los dos GO');
  assert.deepEqual(a, b);
});
