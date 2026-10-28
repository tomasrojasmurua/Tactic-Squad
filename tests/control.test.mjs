// Control del escuadrón (revisión de jugabilidad): ruta de escuadra en fila,
// mover e insertar puntos, paso sigiloso y el turno que se corta al ver un
// enemigo. Sin pantalla: órdenes como datos, igual que las daría la sesión.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { MOVE, NOISE, BUY } from '../src/config/balance.js';

const MAP = MAPS[DEFAULT_MAP];
const T = 'attackers';

function round(opts = {}) {
  const sim = new Simulation(MAP, { seed: 3, site: 'B', ...opts });
  sim.skipToAssault();
  const cmd = (c) => {
    sim.enqueue({ team: T, ...c });
    sim.flushCommands();
  };
  return { sim, cmd, squad: sim.teams.attackers };
}

const users = (u) => u.route.filter((p) => p.user);
const rejects = (sim) => sim.drainEvents().filter((e) => e.type === 'orderRejected').map((e) => e.reason);

function playTurn(sim, each = () => {}) {
  sim.advancePhase();
  while (sim.phase === 'exec') {
    sim.step();
    each();
  }
}

test('ruta de escuadra: los demás siguen al líder en fila y se apilan tras él en su espera', () => {
  const { sim, cmd, squad } = round();
  const [a, b, c] = squad;
  cmd({ type: 'follow', unitId: b.id, leaderId: a.id, rank: 1 });
  cmd({ type: 'follow', unitId: c.id, leaderId: a.id, rank: 2 });
  cmd({ type: 'addWaypoint', unitId: a.id, x: 14, y: 12.7, user: true });
  const i = a.route.findIndex((p) => p.ask);
  cmd({ type: 'setEntry', unitId: a.id, mode: 'flash', index: i });
  cmd({ type: 'setHold', unitId: a.id, code: 'A', index: i });
  assert.deepEqual(rejects(sim), []);
  const stack = a.route[i];
  for (const f of [b, c]) {
    const hold = users(f).find((p) => p.hold);
    assert.ok(hold && hold.code === 'A', `${f.name} espera el mismo grupo`);
    const d = Math.hypot(hold.x - stack.x, hold.y - stack.y);
    assert.ok(Math.abs(d - MOVE.fileGap * f.follow.rank) < 0.35, `${f.name} se apila detrás (${d.toFixed(2)} m)`);
    const end = users(f).at(-1);
    const last = users(a).at(-1);
    assert.ok(Math.hypot(end.x - last.x, end.y - last.y) > MOVE.fileGap * 0.7, `${f.name} termina detrás del líder`);
  }
  // Una sola orden al líder cambia la fila entera.
  const before = users(b).at(-1).x;
  cmd({ type: 'addWaypoint', unitId: a.id, x: 22, y: 12.7, user: true });
  assert.ok(users(b).at(-1).x > before + 5, 'la fila sigue la ruta nueva del líder');
  // El GO libera a todos: el líder lanza el flash, los demás entran tras el estallido.
  let go = false;
  const flashed = [];
  playTurn(sim, () => {
    for (const e of sim.drainEvents()) if (e.type === 'blinded' && e.team === T) flashed.push(e.unitId);
    if (!go && a.waitingGo && b.waitingGo) {
      sim.enqueue({ team: T, type: 'go', code: 'A', atTick: sim.round.execTick });
      go = true;
    }
  });
  assert.ok(go, 'todos llegaron a su espera');
  playTurn(sim); // el turno siguiente terminan de pasar
  assert.deepEqual(flashed, [], 'nadie de la fila se ciega con el flash de su líder');
  assert.ok(b.x > 10.3 && c.x > 10.3, 'la fila entró');
});

test('una orden propia saca al seguidor de la fila (conserva la ruta que tenía)', () => {
  const { sim, cmd, squad } = round();
  const [a, b] = squad;
  cmd({ type: 'follow', unitId: b.id, leaderId: a.id, rank: 1 });
  cmd({ type: 'addWaypoint', unitId: a.id, x: 14, y: 12.7, user: true });
  const n = b.route.length;
  cmd({ type: 'setPace', unitId: b.id, pace: 'sneak' });
  assert.equal(b.follow, null);
  assert.equal(b.route.length, n);
  cmd({ type: 'addWaypoint', unitId: a.id, x: 22, y: 12.7, user: true });
  assert.equal(b.route.length, n, 'ya no copia al líder');
  // Nadie sigue a quien sigue a otro, ni a sí mismo.
  const [, , c] = squad;
  cmd({ type: 'follow', unitId: c.id, leaderId: a.id, rank: 1 });
  cmd({ type: 'follow', unitId: b.id, leaderId: c.id, rank: 1 });
  cmd({ type: 'follow', unitId: a.id, leaderId: a.id, rank: 1 });
  assert.deepEqual(rejects(sim), ['badFollow', 'badFollow']);
});

test('mover un punto rehace sus dos tramos y conserva su espera; insertar agrega uno en el tramo', () => {
  const { sim, cmd, squad } = round();
  const [a] = squad;
  cmd({ type: 'addWaypoint', unitId: a.id, x: 6, y: 18, user: true });
  cmd({ type: 'setHold', unitId: a.id, code: 'B' });
  cmd({ type: 'addWaypoint', unitId: a.id, x: 3, y: 9, user: true });
  const i = a.route.findIndex((p) => p.hold);
  cmd({ type: 'moveWaypoint', unitId: a.id, index: i, x: 8, y: 20 });
  const moved = a.route.find((p) => p.hold);
  assert.ok(Math.hypot(moved.x - 8, moved.y - 20) < 0.3, 'el punto está donde se soltó');
  assert.equal(moved.code, 'B', 'conserva su grupo GO');
  assert.equal(users(a).length, 2);
  assert.ok(Math.hypot(users(a)[1].x - 3, users(a)[1].y - 9) < 0.3, 'el punto siguiente no se movió');
  const leg = a.route.indexOf(users(a)[1]);
  cmd({ type: 'insertWaypoint', unitId: a.id, index: leg, x: 2, y: 14 });
  assert.equal(users(a).length, 3);
  assert.ok(Math.hypot(users(a)[1].x - 2, users(a)[1].y - 14) < 0.3, 'el nuevo punto quedó entre los dos');
  cmd({ type: 'moveWaypoint', unitId: a.id, index: 999, x: 1, y: 1 });
  assert.deepEqual(rejects(sim), ['noWaypoint']);
});

test('paso sigiloso: más lento y casi no se oye', () => {
  const walk = (pace) => {
    const { sim, cmd, squad } = round();
    const [a] = squad;
    cmd({ type: 'addWaypoint', unitId: a.id, x: 4.6, y: 22, user: true });
    if (pace) cmd({ type: 'setPace', unitId: a.id, pace });
    const x0 = a.y;
    const steps = [];
    playTurn(sim, () => {
      for (const e of sim.drainEvents()) if (e.type === 'footstep' && e.unitId === a.id) steps.push(e.sneak);
    });
    return { dist: Math.abs(a.y - x0), steps };
  };
  const normal = walk(null);
  const sneak = walk('sneak');
  assert.ok(sneak.dist < normal.dist * 0.7, `avanza menos (${sneak.dist.toFixed(1)} vs ${normal.dist.toFixed(1)} m)`);
  assert.ok(sneak.steps.length > 0 && sneak.steps.every(Boolean), 'sus pasos son sigilosos');
  assert.ok(NOISE.radius.sneak < NOISE.radius.step / 2);
  // El tramo nuevo hereda el paso del anterior.
  const { cmd, squad } = round();
  const [a] = squad;
  cmd({ type: 'addWaypoint', unitId: a.id, x: 4.6, y: 18, user: true });
  cmd({ type: 'setPace', unitId: a.id, pace: 'sneak' });
  cmd({ type: 'addWaypoint', unitId: a.id, x: 4.6, y: 22, user: true });
  assert.ok(a.route.every((p) => p.pace === 'sneak'));
});

test('cortar el turno al ver un enemigo: termina antes y el reintento lo repite igual', () => {
  const play = () => {
    const { sim, cmd, squad } = round({ stopOnContact: true });
    for (const u of squad) cmd({ type: 'addWaypoint', unitId: u.id, x: 22, y: 19, user: true });
    const lengths = [];
    for (let t = 0; t < 6 && !sim.outcome; t++) {
      const before = sim.round.execTotal;
      playTurn(sim);
      if (sim.phase === 'plan') lengths.push(sim.round.execTotal - before); // (a turn the round ended in is shorter anyway)
    }
    return lengths;
  };
  const a = play();
  assert.ok(a.some((n) => n < 300), `algún turno se cortó (${a.join(', ')})`);
  assert.ok(a.every((n) => n >= 30), 'nunca antes de medio segundo');
  assert.deepEqual(play(), a, 'determinista');
});

// ------------------------------------------------------------ clases

test('clases: Brecha y Explorador una vez, cada una con su equipo; dentro de la partida no se cambian', async () => {
  const { ROLES } = await import('../src/config/operators.js');
  const { setRole } = await import('../src/sim/prep.js');
  const sim = new Simulation(MAP, { seed: 1 });
  const [aguila, lobo, zorro] = sim.teams.attackers;
  assert.deepEqual([aguila.role, lobo.role, zorro.role], ['assault', 'entry', 'scout']);
  const order = (c) => {
    sim.enqueue({ team: T, ...c });
    sim.flushCommands();
  };
  // Las reglas de la selección de clases (antes de la partida).
  assert.equal(setRole(sim, aguila, 'scout'), 'roleTaken');
  assert.equal(setRole(sim, aguila, 'anchor'), 'badRole');
  order({ type: 'buy', unitId: zorro.id, item: 'flash', count: 1 });
  assert.equal(setRole(sim, zorro, 'assault'), null);
  assert.equal(zorro.weaponId, ROLES.assault.weapon);
  assert.deepEqual([zorro.gear.flash, zorro.gear.frag, zorro.gear.smoke], [1, 1, 0]);
  assert.equal(zorro.points, BUY.points, 'lo comprado vuelve con la clase anterior: recupera sus puntos');
  assert.equal(setRole(sim, aguila, 'scout'), null);
  assert.equal(aguila.ability, 'scoutPulse');
  rejects(sim);
  // Ya en la ronda, ninguna orden cambia la clase.
  order({ type: 'setRole', unitId: aguila.id, role: 'assault' });
  assert.deepEqual(rejects(sim), ['notNow']);
});

test('Explorador: al terminar el turno detecta a los defensores cerca, con paredes de por medio', () => {
  const { sim, squad } = round();
  const zorro = squad.find((u) => u.role === 'scout');
  const d = sim.teams.defenders[0];
  // Al otro lado de la pared del pasillo, a 5 m.
  zorro.x = 14;
  zorro.y = 12.7;
  d.x = 14;
  d.y = 17.5;
  d.behavior = { type: 'hold', reactsToNoise: false };
  sim.memory.attackers.clear();
  let pulse = null;
  playTurn(sim, () => {
    for (const e of sim.drainEvents()) if (e.type === 'scoutPulse') pulse = e;
  });
  for (const e of sim.drainEvents()) if (e.type === 'scoutPulse') pulse = e;
  assert.ok(pulse && pulse.found >= 1, 'lo detectó');
  assert.ok(sim.memory.attackers.has(d.id), 'queda marcado para el plan');
});

test('cubrir zona: el atacante barre alrededor de su mirada al final de la ruta o donde está', async () => {
  const { Simulation } = await import('../src/sim/Simulation.js');
  const { MAPS, DEFAULT_MAP } = await import('../src/data/maps/index.js');
  const { PREP } = await import('../src/config/balance.js');
  const sim = new Simulation(MAPS[DEFAULT_MAP], { seed: 3, phases: false });
  const a = sim.teams.attackers[0];
  const c = (x) => { sim.enqueue({ team: 'attackers', ...x }); sim.flushCommands(); };
  c({ type: 'setCover', unitId: a.id, on: true, index: 'here' });
  assert.ok(a.cover && a.idleLook !== null);
  const center = a.idleLook;
  const seen = [];
  for (let i = 0; i < 400; i++) { sim.step(); if (a.target < 0) seen.push(a.facing); }
  const off = seen.map((f) => Math.atan2(Math.sin(f - center), Math.cos(f - center)));
  assert.ok(Math.max(...off) - Math.min(...off) > PREP.sweepArc * 0.6, 'barre');
  assert.ok(off.every((o) => Math.abs(o) <= PREP.sweepArc / 2 + 0.05));
  c({ type: 'setCover', unitId: a.id, on: false, index: 'here' });
  assert.equal(a.cover, false);
  // Al final de la ruta: queda marcado en el punto y se aplica al llegar.
  c({ type: 'addWaypoint', unitId: a.id, x: a.x + 2, y: a.y, user: true });
  c({ type: 'setCover', unitId: a.id, on: true });
  assert.ok(a.route[a.route.length - 1].cover);
  for (let i = 0; i < 600 && a.route.length; i++) sim.step();
  assert.equal(a.route.length, 0);
  assert.ok(a.cover);
  // Los defensores no la usan (tienen su vigilancia).
  const d = sim.teams.defenders[0];
  sim.enqueue({ team: 'defenders', type: 'setCover', unitId: d.id, on: true, index: 'here' });
  sim.flushCommands();
  assert.equal(d.cover, false);
});
