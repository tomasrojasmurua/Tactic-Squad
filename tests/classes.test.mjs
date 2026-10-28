// Las clases y sus firmas (config/operators.js): cada una cambia una
// decisión del plan con equipo real de asalto. Explorador (cámara bajo la
// puerta, oído entrenado), Asaltante (corta el ángulo), Brecha (aturde tras
// la puerta, corta el alambre), Escudo, Tirador, Granadero (gas), Ancla
// (posición preparada), Merodeador (supresor), Trampero (alambre extra) y
// Vigía (monitor de cámaras).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { applyRole } from '../src/sim/units.js';
import { ENTRY, NOISE } from '../src/config/balance.js';
import { EV } from '../src/core/events.js';
import { peekEye } from '../src/sim/queries.js';
import { canSee } from '../src/sim/vision.js';
import { collectNoise, summarizeNoise } from '../src/sim/noise.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';

const MAP = MAPS[DEFAULT_MAP];
const STILL = { attackers: 'human', defenders: 'human' };
const T = 'attackers';

/** The squad by the yard's doors (x = 10, the office and the corridor to the east); the defenders far away. */
function atTheDoor(opts = {}) {
  const sim = new Simulation(MAP, { seed: 11, site: 'A', controllers: STILL, phases: false, ...opts });
  sim.teams.defenders.forEach((d, i) => {
    d.x = 36 + i * 0.8;
    d.y = 24;
  });
  const [a, b, c] = sim.teams.attackers;
  a.x = 8.2;
  a.y = 12.0;
  b.x = 8.2;
  b.y = 13.4;
  c.x = 8.2;
  c.y = 8.6;
  return { sim, a, b, c, defs: sim.teams.defenders };
}

const cmd = (sim, c) => sim.enqueue({ team: T, ...c });
const wp = (sim, u, x, y) => cmd(sim, { type: 'addWaypoint', unitId: u.id, x, y, user: true });
function runFor(sim, seconds) {
  const events = [];
  const end = sim.tick + Math.round(seconds / sim.dt);
  while (!sim.outcome && sim.tick < end) {
    sim.step();
    events.push(...sim.drainEvents());
  }
  return events;
}
const rejected = (events) => events.filter((e) => e.type === EV.ORDER_REJECTED).map((e) => e.reason);

// ------------------------------------------------------------ Explorador

test('Explorador: pasa la cámara de fibra bajo la puerta cerrada y ve la sala sin abrirla, en silencio', () => {
  const { sim, c, defs } = atTheDoor();
  const office = sim.doors.find((d) => d.def.id === 'oficina-ext');
  assert.ok(office, 'la puerta de la oficina');
  const d0 = defs[0];
  d0.x = 13.5;
  d0.y = 6.5;
  wp(sim, c, 9.25, 9.3);
  cmd(sim, { type: 'setHold', unitId: c.id, code: 'A' });
  cmd(sim, { type: 'setEntry', unitId: c.id, mode: 'cam' });
  wp(sim, c, 12, 9.3);
  const events = runFor(sim, 3);
  assert.deepEqual(rejected(events), []);
  assert.equal(c.entry?.mode, 'cam');
  assert.ok(!office.open && !office.cracked, 'la puerta sigue cerrada');
  assert.ok(events.some((e) => e.type === EV.FIBER_CAM && e.unitId === c.id));
  const eye = {};
  assert.ok(peekEye(sim, c, eye), 'mira bajo la puerta');
  let seen = 0;
  let all = 0;
  for (let x = 10.6; x < 17; x += 0.4) {
    for (let y = 2.6; y < 10.8; y += 0.4) {
      all++;
      if (canSee(sim.world, eye, x, y, eye)) seen++;
    }
  }
  assert.ok(seen / all > 0.4, `ve ${((100 * seen) / all).toFixed(0)} % de la sala (más que por una rendija)`);
  assert.ok(sim.memory.attackers.has(d0.id), 'el defensor de adentro queda marcado');
  assert.ok(d0.seenByEnemy);
  assert.ok(!events.some((e) => e.type === EV.DOOR_OPEN), 'no hizo ruido de puerta');
  // Con el GO abre y pasa.
  cmd(sim, { type: 'go', code: 'A' });
  runFor(sim, 1.5);
  assert.equal(c.entry, null);
  assert.ok(office.open);
});

test('solo el Explorador lleva la cámara de fibra', () => {
  const { sim, a } = atTheDoor();
  wp(sim, a, 9.25, 11.75);
  cmd(sim, { type: 'setEntry', unitId: a.id, mode: 'cam' });
  sim.flushCommands();
  assert.deepEqual(rejected(sim.drainEvents()), ['noDoor']);
});

test('oído entrenado: lo que oye el Explorador queda en el punto exacto; lo de los demás, aproximado', () => {
  const pulseOf = (role) => {
    const sim = new Simulation(MAP, { seed: 5, site: 'A' });
    sim.skipToAssault();
    const [a, b, c] = sim.teams.attackers;
    for (const u of [a, b, c]) {
      u.x = 3;
      u.y = 20;
    }
    if (c.role !== role) applyRole(c, role);
    c.x = 14;
    c.y = 12.7;
    const d = sim.teams.defenders[0];
    const from = sim.events.length;
    sim.emit(EV.FOOTSTEP, { unitId: d.id, x: 15.3, y: 15.1, sneak: false });
    collectNoise(sim, from);
    summarizeNoise(sim);
    return sim.noise.pulses.attackers.at(-1);
  };
  const exact = pulseOf('scout');
  assert.equal(exact.exact, true);
  assert.deepEqual([exact.x, exact.y], [15.3, 15.1]);
  const rough = pulseOf('assault');
  assert.equal(rough.exact, false);
  assert.notDeepEqual([rough.x, rough.y], [15.3, 15.1]);
  assert.ok(Math.hypot(rough.x - 15.3, rough.y - 15.1) <= NOISE.cell + NOISE.jitter);
});
