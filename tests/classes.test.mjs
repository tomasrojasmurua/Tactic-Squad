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

// ------------------------------------------------------------ Asaltante

/** First reaction of attacker `role` to a defender straight ahead, having just come through a doorway or not. */
function firstReaction(role, doorway) {
  const { sim, a, defs } = atTheDoor();
  if (a.role !== role) applyRole(a, role);
  a.x = 12;
  a.y = 12.7;
  a.facing = 0;
  if (doorway) a.doorwayAt = 0;
  defs[0].x = 16;
  defs[0].y = 12.7;
  defs[0].facing = Math.PI;
  sim.step();
  assert.equal(a.target, defs[0].id);
  return a.reaction + sim.dt;
}

test('Asaltante: corta el ángulo, recién pasada una puerta reacciona más rápido; los demás, más lento', () => {
  const assault = firstReaction('assault', true);
  const other = firstReaction('scout', true);
  assert.ok(assault < other * 0.75, `${assault.toFixed(3)} contra ${other.toFixed(3)}`);
  assert.ok(firstReaction('scout', false) < other, 'para el resto, la puerta cuesta');
});

// ------------------------------------------------------------ Brecha

test('Brecha: su carga deja inmóvil al que espera tras la puerta más que la de otro', () => {
  const stunAfter = (role) => {
    const { sim, a, b, defs } = atTheDoor();
    const d0 = defs[0];
    d0.x = 11.3;
    d0.y = 12.7;
    d0.facing = Math.PI;
    d0.maxHp = d0.hp = 1000; // que sobreviva para medir
    if (b.role !== role) {
      applyRole(b, role);
      b.gear.breach = 1;
    }
    a.x = 3;
    a.y = 18;
    wp(sim, b, 9.25, 11.75);
    cmd(sim, { type: 'setHold', unitId: b.id, code: 'A' });
    cmd(sim, { type: 'setEntry', unitId: b.id, mode: 'breach' });
    runFor(sim, 6);
    cmd(sim, { type: 'go' });
    let stun = 0;
    const end = sim.tick + 60;
    while (sim.tick < end) {
      sim.step();
      stun = Math.max(stun, d0.stun);
    }
    return stun;
  };
  const brecha = stunAfter('entry');
  const other = stunAfter('assault');
  assert.ok(other > 0, 'toda carga aturde un poco');
  assert.ok(brecha > other * 2, `${brecha.toFixed(2)} s contra ${other.toFixed(2)} s`);
});

test('Brecha: corta el alambre con el alicate, sin hacerlo sonar', async () => {
  const { WIRE } = await import('../src/config/balance.js');
  const play = (role) => {
    const sim = new Simulation(MAP, { seed: 3, site: 'A', controllers: STILL });
    sim.advancePhase();
    const id = sim.compiled.barricadeSlots[0];
    sim.enqueue({ team: 'defenders', type: 'wire', door: id, on: true });
    sim.flushCommands();
    sim.skipToAssault();
    sim.drainEvents();
    const door = sim.doors.find((d) => d.def.id === id);
    const u = sim.teams.attackers[0];
    if (u.role !== role) applyRole(u, role);
    u.x = door.def.cx;
    u.y = door.def.cy;
    sim.advancePhase();
    sim.step();
    return { events: sim.drainEvents(), door, u, WIRE };
  };
  const cut = play('entry');
  assert.ok(cut.events.some((e) => e.type === EV.WIRE_CUT && e.pliers));
  assert.ok(!cut.events.some((e) => e.type === EV.WIRE_CROSSED), 'no suena');
  assert.equal(cut.door.wired, false);
  assert.ok(cut.u.stun > 0, 'se agacha a cortarlo');
  const caught = play('assault');
  assert.ok(caught.events.some((e) => e.type === EV.WIRE_CROSSED));
  assert.equal(caught.door.wired, true);
});

// ------------------------------------------------------------ Escudo

/** A defender (unhurt by anything) fires at the squad for `seconds`: hits on each attacker and shots stopped by a shield. */
function underFire(shieldUp, seconds = 3) {
  const { sim, a, b, c, defs } = atTheDoor();
  applyRole(a, 'shield');
  a.x = 12;
  a.y = 12.7;
  a.facing = shieldUp ? 0 : Math.PI; // toward the shooter, or turned away
  b.x = 11.1; // pegado detrás
  b.y = 12.7;
  b.facing = 0;
  c.x = 3;
  c.y = 20;
  for (const u of [a, b]) {
    u.mag = u.reserve = 0; // they do not shoot back
    u.maxHp = u.hp = 1e6;
  }
  const d = defs[0];
  d.x = 18;
  d.y = 12.7;
  d.facing = Math.PI;
  d.maxHp = d.hp = 1e6;
  d.reserve = 1e4;
  const hits = new Map([[a.id, 0], [b.id, 0]]);
  let stopped = 0;
  const end = sim.tick + Math.round(seconds / sim.dt);
  while (sim.tick < end) {
    a.facing = shieldUp ? 0 : Math.PI; // he holds his stance
    sim.step();
    for (const e of sim.drainEvents()) {
      if (e.type === EV.HIT && hits.has(e.unitId)) hits.set(e.unitId, hits.get(e.unitId) + 1);
      if (e.type === EV.SHIELD_HIT) stopped++;
    }
  }
  return { a: hits.get(a.id), b: hits.get(b.id), stopped };
}

test('Escudo: de frente las balas se quedan en el escudo y no llegan al que va detrás', () => {
  const up = underFire(true);
  assert.ok(up.stopped >= 10, `paró ${up.stopped}`);
  assert.equal(up.b, 0, 'el de atrás, cubierto');
  assert.ok(up.a <= up.stopped * 0.3, `le llegaron ${up.a} (piernas y brazos)`);
  const away = underFire(false);
  assert.equal(away.stopped, 0, 'de espaldas el escudo no sirve');
  assert.ok(away.a > up.a);
});

// ------------------------------------------------------------ Ancla

test('Ancla: tras su parapeto recibe menos impactos y menos daño; si se aleja, ya no lo cubre', async () => {
  const { placeParapets } = await import('../src/sim/parapets.js');
  const damageTaken = (parapet, step = 0) => {
    const { sim, a, b, c, defs } = atTheDoor();
    const d = defs[0];
    applyRole(d, 'anchor');
    d.x = 20;
    d.y = 12.7;
    d.facing = Math.PI;
    d.mag = d.reserve = 0;
    d.maxHp = d.hp = 1e6;
    placeParapets(sim);
    if (!parapet) sim.parapets.length = 0;
    d.x += step;
    a.x = 14;
    a.y = 12.7;
    a.facing = 0;
    a.reserve = 1e4;
    for (const o of [b, c]) {
      o.x = 3;
      o.y = 20;
    }
    let damage = 0;
    const end = sim.tick + 240;
    while (sim.tick < end) {
      sim.step();
      for (const e of sim.drainEvents()) if (e.type === EV.HIT && e.unitId === d.id) damage += e.damage;
    }
    return damage;
  };
  const behind = damageTaken(true);
  const open = damageTaken(false);
  assert.ok(behind < open * 0.6, `${behind} contra ${open}`);
  const left = damageTaken(true, 2.5);
  assert.ok(left > behind * 1.4, 'lejos de su parapeto no lo protege');
});

// ------------------------------------------------------------ Merodeador

test('Merodeador: con supresor sus disparos se oyen mucho más cerca', () => {
  const heard = (role) => {
    const sim = new Simulation(MAP, { seed: 5, site: 'A' });
    sim.skipToAssault();
    const d = sim.teams.defenders[0];
    if (d.role !== role) applyRole(d, role);
    for (const u of sim.teams.attackers) {
      u.x = d.x + 18;
      u.y = d.y;
    }
    const from = sim.events.length;
    sim.emit(EV.SHOT, { unitId: d.id, x: d.x, y: d.y });
    collectNoise(sim, from);
    return sim.noise.heard.length > 0;
  };
  assert.equal(heard('defender'), true);
  assert.equal(heard('roamer'), false);
});

// ------------------------------------------------------------ Vigía

test('Vigía: trae una cámara más; mirando el monitor las cámaras muestran a todos al instante, y él casi no ve', async () => {
  const { setWatch } = await import('../src/sim/prep.js');
  const { teamView } = await import('../src/sim/view.js');
  const { CAMERA } = await import('../src/config/balance.js');
  const shown = (monitor) => {
    const sim = new Simulation(MAP, { seed: 3, site: 'A', controllers: STILL, phases: false, roles: { defenders: ['lookout', 'defender', 'anchor'] } });
    assert.equal(sim.cameras.length, CAMERA.max + 1);
    const v = sim.teams.defenders[0];
    v.x = 36;
    v.y = 24;
    if (monitor) assert.equal(setWatch(sim, v, { facing: 0, react: true, monitor: true }), null);
    const cam = sim.cameras[0];
    const [a, b, c] = sim.teams.attackers;
    const at = (u, ahead) => {
      u.x = cam.x + Math.cos(cam.facing) * ahead;
      u.y = cam.y + Math.sin(cam.facing) * ahead;
    };
    at(a, 4);
    at(b, 7.5); // the corridor, one behind the other
    c.x = 3;
    c.y = 20;
    for (const d of sim.teams.defenders.slice(1)) {
      d.x = 38;
      d.y = 25;
    }
    sim.step();
    const ids = teamView(sim, 'defenders').enemies.map((e) => e.id);
    return { ids, v };
  };
  const on = shown(true);
  assert.equal(on.v.monitor, true);
  assert.ok(on.v.vision.fov < on.v.roleVision.fov * 0.5, 'mira la pantalla, no su ángulo');
  assert.equal(on.ids.length, 2, 'las dos al instante');
  const off = shown(false);
  assert.ok(off.ids.length < 2, 'sin el monitor, una a la vez y tras un momento');
});

test('solo el Vigía puede ponerse al monitor', async () => {
  const { setWatch } = await import('../src/sim/prep.js');
  const sim = new Simulation(MAP, { seed: 3, site: 'A', controllers: STILL, phases: false });
  const d = sim.teams.defenders.find((u) => u.ability !== 'monitor');
  assert.equal(setWatch(sim, d, { facing: 0, react: true, monitor: true }), 'badWatch');
});

// ------------------------------------------------------------ Granadero

test('Granadero: el gas no mata, pero el que lo respira ve poco, tose y se delata; el atacante lleva máscara', async () => {
  const { spawnGas } = await import('../src/sim/gas.js');
  const { sim, a, defs } = atTheDoor();
  applyRole(a, 'grenadier');
  const d = defs[0];
  d.x = 14;
  d.y = 6;
  a.x = 13.5;
  a.y = 6.5;
  for (const u of sim.units) u.mag = u.reserve = 0; // nobody shoots
  spawnGas(sim, 14, 6.2, a);
  const hp = d.hp;
  const events = runFor(sim, 3);
  assert.ok(d.gassed > 0);
  assert.equal(d.hp, hp, 'no hiere');
  assert.ok(d.vision.range <= ENTRY.gas.vision);
  assert.ok(events.some((e) => e.type === EV.COUGH && e.unitId === d.id), 'tose');
  assert.equal(a.gassed, 0, 'con máscara');
  // Al rato se disipa y vuelve a ver.
  runFor(sim, ENTRY.gas.seconds + 2);
  assert.equal(d.gassed, 0);
  sim.step();
  assert.equal(d.vision, d.roleVision);
});

test('Granadero: lanza el gas con el lanzagranadas el doble de lejos; los demás no lo llevan', async () => {
  const { tossRangeOf } = await import('../src/sim/queries.js');
  const { sim, a, b } = atTheDoor();
  applyRole(b, 'grenadier');
  b.gear = { flash: 0, frag: 0, smoke: 1, breach: 0, molotov: 0, gas: 2 };
  assert.equal(tossRangeOf(b), ENTRY.tossRange * 2);
  assert.equal(tossRangeOf(a), ENTRY.tossRange);
  wp(sim, a, 8.2, 16);
  cmd(sim, { type: 'setToss', unitId: a.id, item: 'gas', x: 8.2, y: 20 });
  sim.flushCommands();
  assert.deepEqual(rejected(sim.drainEvents()), ['noGear']);
});

// ------------------------------------------------------------ Tirador

test('Tirador: quieto sobre su ángulo dispara primero', () => {
  const holdReaction = (role) => {
    const { sim, a, defs } = atTheDoor();
    if (a.role !== role) applyRole(a, role);
    a.x = 12;
    a.y = 12.7;
    a.facing = 0;
    a.stillTime = 5;
    const d = defs[0];
    d.x = 22;
    d.y = 12.7;
    d.facing = Math.PI;
    sim.step();
    return a.reaction;
  };
  assert.ok(holdReaction('marksman') < holdReaction('assault') * 0.7);
});

// ------------------------------------------------------------ Escopetero

/** A defender of `role` facing an attacker `dist` m east, both still: his reaction, and the damage per hit over many shots. */
function pointBlank(role, dist) {
  const { sim, a, defs } = atTheDoor();
  const d = defs[0];
  applyRole(d, role);
  d.x = 12;
  d.y = 12.7;
  d.facing = 0;
  d.stillTime = 5;
  a.x = 12 + dist;
  a.y = 12.7;
  a.facing = Math.PI;
  a.mag = 0;
  a.reserve = 0;
  sim.step();
  const reaction = d.reaction;
  let damage = 0;
  let hits = 0;
  for (let i = 0; i < 2400 && hits < 12; i++) {
    a.hp = 1e6;
    d.mag = Math.max(d.mag, 1);
    sim.step();
    for (const e of sim.drainEvents()) if (e.type === EV.HIT && e.attackerId === d.id) (damage += e.damage), hits++;
  }
  return { reaction, perHit: hits ? damage / hits : 0, hits };
}

test('Escopetero: a quemarropa reacciona antes y tumba de un tiro; lejos, la escopeta pierde', () => {
  const near = pointBlank('shotgunner', 3);
  const far = pointBlank('shotgunner', 13);
  const rifle = pointBlank('defender', 3);
  assert.ok(near.reaction < rifle.reaction * 0.8, `reacción ${near.reaction} contra ${rifle.reaction}`);
  assert.ok(near.hits > 0 && far.hits > 0);
  assert.ok(near.perHit >= 85, `de cerca ${near.perHit} por impacto`);
  assert.ok(far.perHit < near.perHit * 0.45, `de lejos ${far.perHit} por impacto`);
});

// ------------------------------------------------------------ La IA

test('la IA elige su escuadra a ciegas según la semilla, siempre una válida', async () => {
  const { aiRoles, canPick, createLobby } = await import('../src/session/Lobby.js');
  const seen = { attackers: new Set(), defenders: new Set() };
  for (let seed = 1; seed <= 40; seed++) {
    for (const team of ['attackers', 'defenders']) {
      const ids = aiRoles(seed, team);
      assert.deepEqual(aiRoles(seed, team), ids, 'la misma semilla, la misma escuadra');
      const lobby = createLobby();
      assert.ok(ids.every((id, i) => canPick(lobby, team, i, id, ids)), `${team}: ${ids}`);
      seen[team].add(ids.join());
    }
  }
  assert.ok(seen.attackers.size >= 3 && seen.defenders.size >= 3, 'varía');
});

test('la IA usa las clases nuevas: el Granadero lanza gas por la puerta y el Vigía mira su monitor', () => {
  const sim = new Simulation(MAP, { seed: 4, site: 'A', controllers: { attackers: 'ai', defenders: 'ai' }, roles: { attackers: ['assault', 'entry', 'grenadier'], defenders: ['anchor', 'lookout', 'trapper'] } });
  const lookout = sim.teams.defenders.find((u) => u.role === 'lookout');
  assert.equal(lookout.behavior.monitor, true);
  let gas = 0;
  let monitored = false;
  for (let guard = 0; sim.phase !== 'end' && guard < 40000; guard++) {
    if (sim.phase === 'buy' || sim.phase === 'prep' || sim.phase === 'plan') sim.advancePhase();
    else sim.step();
    monitored ||= lookout.monitor;
    for (const e of sim.drainEvents()) if (e.type === EV.GAS_START) gas++;
  }
  assert.ok(gas >= 1, 'lanzó gas');
  assert.ok(monitored, 'miró el monitor');
});
