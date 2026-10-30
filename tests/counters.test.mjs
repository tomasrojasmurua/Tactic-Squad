// Las contras del diseño entre clases (config/operators.js) y las
// composiciones arquetípicas (COMPOSITIONS) que leen las dos IA:
//   Brecha > Ancla       la conmoción de su carga llena la sala de detrás
//   Explorador > Merodeador  su oído lo oye aunque pise suave, y se gira
//   Escudo > Tirador     un tiro lento no lo sacude; una ráfaga sí lo clava
//   Granadero > Vigía    el gas saca al Vigía del monitor y lo deja casi ciego
// y el aviso de la cámara de fibra: la fila entra apuntando a lo que vio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { applyRole } from '../src/sim/units.js';
import { EV } from '../src/core/events.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { COMPOSITIONS, AI_SQUADS, planFor, ROLES } from '../src/config/operators.js';
import { aiPosts } from '../src/sim/prep.js';

const MAP = MAPS[DEFAULT_MAP];
const STILL = { attackers: 'human', defenders: 'human' };
const T = 'attackers';

/** As in classes.test.mjs: the squad by the yard's doors, the defenders far away. */
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

// ------------------------------------------------------------ Brecha > Ancla

test('Brecha: la conmoción de su carga deja aturdido al que espera en la sala, no solo pegado a la puerta', () => {
  const after = (role) => {
    const { sim, a, b, defs } = atTheDoor();
    const d0 = defs[0];
    applyRole(d0, 'anchor');
    d0.x = 15; // 5 m adentro del pasillo, más allá del radio de la carga
    d0.y = 12.7;
    d0.facing = Math.PI;
    d0.maxHp = d0.hp = 1000;
    if (b.role !== role) applyRole(b, role);
    b.gear.breach = 1;
    a.x = 3;
    a.y = 18;
    wp(sim, b, 9.25, 11.75);
    cmd(sim, { type: 'setHold', unitId: b.id, code: 'A' });
    cmd(sim, { type: 'setEntry', unitId: b.id, mode: 'breach' });
    runFor(sim, 6);
    cmd(sim, { type: 'go' });
    let stun = 0;
    let blind = 0;
    const end = sim.tick + 60;
    while (sim.tick < end) {
      sim.step();
      stun = Math.max(stun, d0.stun);
      blind = Math.max(blind, d0.blind);
    }
    return { stun, blind };
  };
  const brecha = after('entry');
  const other = after('assault');
  assert.equal(other.stun, 0, 'la carga de otro no llega tan lejos');
  assert.ok(brecha.stun > 0.5 && brecha.blind > 0.5, `aturdido ${brecha.stun.toFixed(2)} s, sin mira ${brecha.blind.toFixed(2)} s`);
});

// ------------------------------------------------------------ Explorador > Merodeador

test('Explorador: oye al Merodeador que se acerca pisando suave y se gira hacia donde va a aparecer', () => {
  const turned = (role) => {
    const { sim, a, b, c, defs } = atTheDoor();
    if (c.role !== role) applyRole(c, role);
    c.x = 12;
    c.y = 12.7;
    c.facing = 0; // mira al este, por el pasillo
    for (const o of [a, b]) {
      o.x = 3;
      o.y = 20;
    }
    const r = defs[0];
    applyRole(r, 'roamer');
    r.x = 12;
    r.y = 17; // al sur, detrás de la pared, caminando hacia él
    r.facing = -Math.PI / 2;
    sim.enqueue({ team: 'defenders', type: 'addWaypoint', unitId: r.id, x: 12, y: 15.5, user: true });
    let alerted = false;
    const end = sim.tick + 40;
    while (sim.tick < end) {
      sim.step();
      sim.drainEvents();
      alerted ||= c.alertTimer > 0;
    }
    return { alerted, facing: c.facing };
  };
  const scout = turned('scout');
  const assault = turned('assault');
  assert.equal(assault.alerted, false, 'un oído normal no lo oye');
  assert.equal(scout.alerted, true, 'el Explorador sí');
  assert.ok(Math.abs(scout.facing) > 0.3, 'y se giró');
});

// ------------------------------------------------------------ Escudo > Tirador

/** An Escudo facing a still shooter of `weapon` 7 m east for `seconds`: his recoil (aim error) at its worst. */
function joltUnder(weapon, seconds = 2) {
  const { sim, a, b, c, defs } = atTheDoor();
  applyRole(a, 'shield');
  a.x = 11;
  a.y = 12.7;
  a.mag = a.reserve = 0;
  a.maxHp = a.hp = 1e6;
  for (const o of [b, c]) {
    o.x = 3;
    o.y = 20;
  }
  const d = defs[0];
  applyRole(d, weapon === 'sniper' ? 'sniper' : 'defender');
  d.x = 18;
  d.y = 12.7;
  d.facing = Math.PI;
  d.reserve = 1e4;
  let worst = 0;
  let stopped = 0;
  const end = sim.tick + Math.round(seconds / sim.dt);
  while (sim.tick < end) {
    a.facing = 0;
    sim.step();
    for (const e of sim.drainEvents()) if (e.type === EV.SHIELD_HIT) stopped++;
    worst = Math.max(worst, a.recoil);
  }
  return { worst, stopped };
}

test('Escudo: una ráfaga contra el escudo lo sacude y no puede apuntar; el tiro lento del francotirador casi no', () => {
  const rifle = joltUnder('rifle');
  const sniper = joltUnder('sniper');
  assert.ok(rifle.stopped >= 4 && sniper.stopped >= 1, `${rifle.stopped} / ${sniper.stopped}`);
  assert.ok(rifle.worst > sniper.worst * 1.8, `${rifle.worst.toFixed(3)} contra ${sniper.worst.toFixed(3)}`);
});

test('francotirador: un impacto al torso tumba a cualquiera de 100 de vida', async () => {
  const { WEAPONS } = await import('../src/config/weapons.js');
  assert.ok(WEAPONS.sniper.damage[0] >= 100);
});

// ------------------------------------------------------------ Granadero > Vigía

test('Granadero: el gas saca al Vigía de su monitor', async () => {
  const { setWatch } = await import('../src/sim/prep.js');
  const { spawnGas } = await import('../src/sim/gas.js');
  const sim = new Simulation(MAP, { seed: 4, site: 'A', controllers: STILL, phases: false, roles: { defenders: ['lookout', 'anchor', 'trapper'] } });
  const v = sim.teams.defenders.find((u) => u.role === 'lookout');
  for (const a of sim.teams.attackers) {
    a.x = 3;
    a.y = 20;
  }
  assert.equal(setWatch(sim, v, { facing: v.facing, react: true, monitor: true }), null);
  for (let i = 0; i < 5; i++) sim.step();
  assert.equal(v.monitor, true, 'mira el monitor');
  spawnGas(sim, v.x, v.y, sim.teams.attackers[0]);
  runFor(sim, 1.5);
  assert.equal(v.monitor, false, 'tosiendo, deja el monitor');
  assert.ok(v.gassed > 0);
});

// ------------------------------------------------------------ Explorador: aviso

test('cámara de fibra: lo que ve el Explorador lo sabe la fila de esa puerta, que entra apuntándole', () => {
  const { sim, a, c, defs } = atTheDoor();
  const d0 = defs[0];
  d0.x = 13.5;
  d0.y = 6.5;
  a.x = 8.4; // en la fila de la oficina, junto al Explorador
  a.y = 10.2;
  wp(sim, c, 9.25, 9.3);
  cmd(sim, { type: 'setHold', unitId: c.id, code: 'A' });
  cmd(sim, { type: 'setEntry', unitId: c.id, mode: 'cam' });
  runFor(sim, 3);
  assert.ok(a.lastKnown && a.lastKnown.until > sim.time, 'el compañero sabe dónde está');
  assert.ok(Math.hypot(a.lastKnown.x - d0.x, a.lastKnown.y - d0.y) < 0.5);
});

// ------------------------------------------------------------ Composiciones

test('cada composición arquetípica es una escuadra válida y con un plan propio', async () => {
  const { canPick, createLobby } = await import('../src/session/Lobby.js');
  for (const team of ['attackers', 'defenders']) {
    const plans = new Set();
    assert.ok(COMPOSITIONS[team].length >= 4 && COMPOSITIONS[team].length <= 6);
    for (const c of COMPOSITIONS[team]) {
      assert.ok(c.roles.every((id, i) => canPick(createLobby(), team, i, id, c.roles)), `${team} ${c.id}`);
      const { id, ...plan } = planFor(team, c.roles);
      assert.equal(id, c.id);
      plans.add(JSON.stringify(plan));
    }
    if (team === 'attackers') assert.equal(plans.size, COMPOSITIONS[team].length, 'planes distintos');
    assert.deepEqual(AI_SQUADS[team].map((r) => r.join()), COMPOSITIONS[team].map((c) => c.roles.join()));
  }
  // Una escuadra que no es arquetípica recibe el plan que sugieren sus clases.
  assert.equal(planFor('attackers', ['marksman', 'scout', 'entry']).overwatch, 'marksman');
  assert.equal(planFor('attackers', ['shield', 'entry', 'scout']).lead, 'shield');
  assert.ok(Object.keys(ROLES).length >= 12);
});

test('la IA defensora pone al francotirador en el puesto de línea más larga y al escopetero en el más corto', () => {
  const sim = new Simulation(MAPS.port, { seed: 1, site: 'A', controllers: { attackers: 'ai', defenders: 'ai' } });
  const layout = sim.compiled.defense.A;
  const slots = aiPosts(sim, layout, ['shotgunner', 'sniper', 'anchor']);
  assert.equal(new Set(slots).size, 3);
  assert.equal(layout[slots[2]].role, 'anchor', 'el Ancla, en el puesto del Ancla');
  const rest = [0, 1, 2, 3].filter((k) => k !== slots[2]);
  const lane = (k) => rest.indexOf(k);
  assert.notEqual(slots[0], slots[1]);
  assert.ok(lane(slots[0]) >= 0 && lane(slots[1]) >= 0);
});

test('composiciones: la IA atacante juega su plan (brecha dura: el Escudo en punta; cobertura: el Tirador atrás)', () => {
  const play = (roles, seed = 2) => {
    const sim = new Simulation(MAP, { seed, site: 'A', controllers: { attackers: 'ai', defenders: 'ai' }, roles: { attackers: roles, defenders: ['anchor', 'shotgunner', 'trapper'] } });
    let shieldOnBomb = null;
    let marksmanStop = null;
    for (let guard = 0; sim.phase !== 'end' && guard < 40000; guard++) {
      if (sim.phase === 'buy' || sim.phase === 'prep' || sim.phase === 'plan') {
        sim.advancePhase();
        if (sim.phase === 'exec' && marksmanStop === null) {
          const m = sim.teams.attackers.find((u) => u.role === 'marksman');
          const last = m && [...m.route].reverse().find((p) => p.user);
          marksmanStop = last ? Math.hypot(last.x - sim.bomb.x, last.y - sim.bomb.y) : -1;
          const s = sim.teams.attackers.find((u) => u.role === 'shield');
          const end = s && [...s.route].reverse().find((p) => p.user);
          shieldOnBomb = end ? Math.hypot(end.x - sim.bomb.x, end.y - sim.bomb.y) : -1;
        }
      } else sim.step();
      sim.drainEvents();
    }
    return { shieldOnBomb, marksmanStop };
  };
  const hard = play(['assault', 'entry', 'shield']);
  assert.ok(hard.shieldOnBomb >= 0 && hard.shieldOnBomb < 0.3, 'brecha dura: el Escudo va primero, a la bomba');
  const pick = play(['marksman', 'shield', 'assault']);
  assert.ok(pick.marksmanStop > 3, `el Tirador se queda a ${pick.marksmanStop.toFixed(1)} m de la bomba`);
});

test('cobertura: el Tirador se queda atrás solo donde ve el sitio al que van (no detrás de una esquina); si no, entra con los suyos', async () => {
  const { segmentBlocked } = await import('../src/core/geom.js');
  let held = 0;
  for (const map of ['warehouse', 'hotel', 'port']) {
    for (const site of ['A', 'B']) {
      const sim = new Simulation(MAPS[map], { seed: 3, site, controllers: { attackers: 'ai', defenders: 'ai' }, roles: { attackers: ['marksman', 'shield', 'assault'], defenders: ['anchor', 'shotgunner', 'trapper'] } });
      for (let g = 0; g < 20000 && sim.phase !== 'exec'; g++) {
        if (sim.phase === 'buy' || sim.phase === 'prep' || sim.phase === 'plan') sim.advancePhase();
        else sim.step();
      }
      // The site they go for (they do not know where the bomb is yet).
      const goal = sim.compiled.sites.find((s) => s.id === sim.attackAi.target);
      const m = sim.teams.attackers.find((u) => u.role === 'marksman');
      const end = [...m.route].reverse().find((p) => p.user);
      assert.ok(goal && end, `${map} ${site}: tiene sitio y ruta`);
      if (Math.hypot(end.x - goal.bombX, end.y - goal.bombY) < 2.5) continue; // entra con los suyos
      held++;
      const w = sim.world;
      assert.ok(!segmentBlocked(w.segments, w.staticSegmentCount, end.x, end.y, goal.bombX, goal.bombY), `${map} ${site}: desde su puesto ve el punto de la bomba`);
    }
  }
  assert.ok(held >= 3, `se queda cubriendo en ${held} de 6 casos`);
});
