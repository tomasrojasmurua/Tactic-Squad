// Lanzar o volar una puerta desde el costado del marco, no parado frente al vano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { ALL_MAPS, TRAINING_MAP } from '../src/data/maps/index.js';
import { ENTRY } from '../src/config/balance.js';
import { solidLineOfSight } from '../src/sim/vision.js';

const MAP = ALL_MAPS[TRAINING_MAP];
const T = 'attackers';

function round() {
  const sim = new Simulation(MAP, { seed: 3, site: 'B' });
  sim.skipToAssault();
  const cmd = (c) => {
    sim.enqueue({ team: T, ...c });
    sim.flushCommands();
  };
  return { sim, cmd, squad: sim.teams.attackers };
}
const rejects = (sim) => sim.drainEvents().filter((e) => e.type === 'orderRejected').map((e) => e.reason);
const across = (d, p) => (p.x - d.cx) * d.normalX + (p.y - d.cy) * d.normalY;
const along = (d, p) => (p.x - d.cx) * d.normalY - (p.y - d.cy) * d.normalX;

/** A route through the door at (14, 12.7): the index of its "?" and the doorway. */
function toDoor(sim, cmd, a) {
  cmd({ type: 'addWaypoint', unitId: a.id, x: 14, y: 12.7, user: true });
  const i = a.route.findIndex((p) => p.ask);
  return { i, d: sim.world.doorways[a.route[i].door], k: a.route[i].door };
}

test('granada, flash o carga: se pega al costado del marco; patada o abrir: frente a la puerta', () => {
  const { sim, cmd, squad } = round();
  const [a] = squad;
  a.gear.frag = 1;
  const { i, d } = toDoor(sim, cmd, a);
  const ask = { x: a.route[i].x, y: a.route[i].y };
  const p = a.route[i];
  cmd({ type: 'setEntry', unitId: a.id, mode: 'frag', index: i });
  assert.deepEqual(rejects(sim), []);
  assert.ok(p.beside && p.entry === 'frag', 'la granada sigue en el punto');
  assert.ok(Math.abs(along(d, p)) >= d.length / 2 + ENTRY.beside.jamb - 0.05, `al costado del marco (${along(d, p).toFixed(2)})`);
  assert.ok(Math.sign(across(d, p)) === Math.sign(across(d, ask)), 'del mismo lado de la pared');
  // Un defensor frente a la puerta, adentro, no lo ve; parado frente al vano, sí.
  const inside = { x: d.cx - d.normalX * Math.sign(across(d, p)) * 4, y: d.cy - d.normalY * Math.sign(across(d, p)) * 4 };
  const door = sim.doors[p.door];
  door.destroyed = true; // the opening, clear
  sim.world.updateDoorSegments(sim.doors);
  assert.equal(solidLineOfSight(sim.world, inside.x, inside.y, ask.x, ask.y), true, 'frente al vano lo ven');
  assert.equal(solidLineOfSight(sim.world, inside.x, inside.y, p.x, p.y), false, 'al costado, no');
  door.destroyed = false;
  sim.world.updateDoorSegments(sim.doors);
  // Patada: vuelve frente a la puerta.
  const j = a.route.indexOf(p);
  cmd({ type: 'setEntry', unitId: a.id, mode: 'kick', index: j });
  assert.ok(!p.beside && Math.abs(along(d, p)) < 0.05, 'patada: frente al vano');
  assert.ok(Math.abs(Math.abs(across(d, p)) - ENTRY.askDistance) < 0.05);
});

test('granada desde el costado: la lanza adentro, no se hiere, y después cruza', () => {
  const { sim, cmd, squad } = round();
  const [a] = squad;
  a.gear.frag = 1;
  const { i, d, k } = toDoor(sim, cmd, a);
  cmd({ type: 'setEntry', unitId: a.id, mode: 'frag', index: i });
  const start = across(d, a);
  sim.drainEvents();
  sim.advancePhase();
  let thrown = null;
  let boom = false;
  for (let n = 0; n < 1500 && Math.sign(across(d, a)) === Math.sign(start); n++) {
    if (sim.phase !== 'exec') sim.advancePhase();
    if (sim.outcome) break;
    sim.step();
    for (const e of sim.drainEvents()) {
      if (e.type === 'grenadeThrown') thrown = { x: a.x, y: a.y };
      if (e.type === 'grenadeDetonate') boom = true;
    }
  }
  assert.ok(thrown && boom, 'lanzó y explotó');
  assert.ok(Math.abs(along(d, thrown)) > d.length / 2, 'lanzó desde el costado');
  assert.ok(sim.doors[k].open, 'abrió la puerta');
  assert.ok(Math.sign(across(d, a)) !== Math.sign(start), 'después cruzó');
  assert.ok(a.alive && a.hp === a.maxHp, 'sin herirse');
});

test('puerta compartida: si uno la decide, el otro no pregunta, espera al costado y cruza después del estallido', () => {
  const { sim, cmd, squad } = round();
  const [a, b] = squad;
  a.gear.frag = 1;
  const { i, d } = toDoor(sim, cmd, a);
  // LOBO traza por la misma puerta antes de que ÁGUILA decida: le sale el "?".
  cmd({ type: 'addWaypoint', unitId: b.id, x: 14, y: 13.2, user: true });
  assert.ok(b.route.some((p) => p.ask), 'todavía nadie decidió');
  cmd({ type: 'setEntry', unitId: a.id, mode: 'frag', index: i });
  assert.deepEqual(rejects(sim), []);
  assert.ok(!b.route.some((p) => p.ask), 'ya no pregunta');
  const w = b.route.find((p) => p.waitDoor >= 0);
  assert.ok(w && w.beside, 'espera al costado del marco');
  const pa = a.route.find((p) => p.entry === 'frag');
  assert.ok(Math.sign(along(d, w)) !== Math.sign(along(d, pa)), 'del otro lado que el que lanza');
  // ZORRO traza después: directamente espera.
  const [, , c] = squad;
  cmd({ type: 'addWaypoint', unitId: c.id, x: 14, y: 12.2, user: true });
  assert.ok(!c.route.some((p) => p.ask) && c.route.some((p) => p.waitDoor >= 0), 'el tercero también espera');

  const side = Math.sign(across(d, b));
  sim.drainEvents();
  sim.advancePhase();
  let boomAt = -1;
  let crossedAt = -1;
  for (let n = 0; n < 1500 && crossedAt < 0; n++) {
    if (sim.phase !== 'exec') sim.advancePhase();
    if (sim.outcome) break;
    sim.step();
    for (const e of sim.drainEvents()) if (e.type === 'grenadeDetonate') boomAt = n;
    if (Math.sign(across(d, b)) !== side) crossedAt = n;
  }
  assert.ok(boomAt >= 0, 'la granada salió');
  assert.ok(crossedAt > boomAt, `LOBO cruzó después (${crossedAt} > ${boomAt})`);
  assert.ok(b.alive && b.hp === b.maxHp && c.hp === c.maxHp, 'nadie herido por la granada');
});
