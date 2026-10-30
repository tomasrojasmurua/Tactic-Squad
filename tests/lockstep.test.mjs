// Lockstep sin red: un Room (la lógica del servidor) y clientes con su propia Simulation. Juegan
// partidas completas; si algún hash difiere en una transición el Room manda `desync`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { ALL_MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { Room, roomCode, CODE_CHARS } from '../src/net/roomLogic.js';
import { LockstepClient } from '../src/net/LockstepClient.js';
import { hashSim } from '../src/net/stateHash.js';

const createSim = ({ map, options }) => new Simulation(ALL_MAPS[map] ?? ALL_MAPS[DEFAULT_MAP], options);

/** Server + clients in one process; messages go through queues, in order, as in a socket. */
function harness({ seeds = [11, 12, 13, 14, 15, 16, 17] } = {}) {
  let now = 0;
  let s = 0;
  let k = 0;
  const room = new Room('ABCDE', { seed: () => seeds[s++ % seeds.length], token: () => `tok${k++}` });
  const inbox = [];
  const toServer = [];
  const clients = [];
  const ids = [];
  const deliver = (out) => {
    for (const { to, msg } of out) {
      inbox.forEach((q, i) => { if (to === '*' ? ids[i] >= 0 : ids[i] === to) q.push(msg); });
    }
  };
  const h = {
    room, clients,
    get now() { return now; },
    /** A phone opens the room's link (a new client; with a token: the same player coming back). */
    connect(i, hello) {
      inbox[i] = [];
      ids[i] = -1;
      clients[i] = new LockstepClient({ send: (m) => toServer.push([i, m]), createSim });
      const r = room.join(hello, now);
      ids[i] = r.id;
      deliver(r.out);
      h.flush();
      return clients[i];
    },
    drop(i) {
      deliver(room.leave(ids[i], now));
      ids[i] = -1;
      inbox[i] = [];
    },
    say(i, msg) {
      deliver(room.receive(ids[i], msg, now));
      h.flush();
    },
    flush() {
      for (let guard = 0; guard < 20; guard++) {
        clients.forEach((c, i) => { while (inbox[i] && inbox[i].length) c.receive(inbox[i].shift()); });
        clients.forEach((c, i) => { if (ids[i] >= 0) c.pump(8); });
        if (!toServer.length) break;
        while (toServer.length) {
          const [i, m] = toServer.shift();
          if (ids[i] >= 0) deliver(room.receive(ids[i], m, now));
        }
      }
    },
    /** 50 ms of the world: the server's clock, deliveries, the clients' steps. */
    cycle(ms = 50) {
      now += ms;
      deliver(room.tick(now));
      h.flush();
    },
    run(maxCycles, until, act = () => {}) {
      for (let i = 0; i < maxCycles && !until(); i++) {
        act();
        h.cycle();
      }
      return until();
    },
  };
  return h;
}

/** What a scripted player does each cycle: plans the first turn, recalls the drone, LISTO. */
function autopilot(c) {
  if (!c.sim || c.finished) return;
  const sim = c.sim;
  if (sim.phase === 'drone' && c.team === 'attackers' && !c.recalled) {
    c.recalled = c.n;
    c.command({ type: 'droneRecall' });
  }
  if (!c.deciding) return;
  if (sim.phase === 'plan' && c.team === 'attackers' && sim.turn <= 1 && c.planned !== c.n) {
    c.planned = c.n;
    const site = sim.site;
    for (const u of sim.teams.attackers) c.command({ type: 'addWaypoint', unitId: u.id, x: site.x, y: site.y, user: true });
  }
  if (c.recalled !== undefined && sim.phase !== 'drone') c.recalled = undefined;
  c.ready();
}

function lobbyOf2(h, duracion = 1) {
  const a = h.connect(0, { nombre: 'Ana' });
  const b = h.connect(1, { nombre: 'Beto' });
  h.say(0, { t: 'lobby', duracion, mapa: DEFAULT_MAP });
  h.say(1, { t: 'lobby', listo: true });
  return [a, b];
}

test('códigos de sala sin letras que se confundan', () => {
  for (const ch of '01OIL') assert.ok(!CODE_CHARS.includes(ch));
  let x = 0;
  const code = roomCode(() => ((x = (x + 0.37) % 1)));
  assert.match(code, /^[2-9A-Z]{5}$/);
});

test('el lobby: bandos, anfitrión, LISTO y sala llena', () => {
  const room = new Room('ZZZZZ');
  const a = room.join({ nombre: 'Ana' }, 0);
  const b = room.join({ nombre: 'Beto<script>' }, 0);
  assert.deepEqual(room.players.map((p) => p.team), ['attackers', 'defenders']);
  assert.equal(room.players[1].name, 'Betoscript');
  assert.equal(room.join({ nombre: 'Cami' }, 0).id, -1, 'sala llena');
  assert.ok(room.receive(a.id, { t: 'iniciar' }, 0).some((o) => o.msg.t === 'error'), 'sin LISTO del otro no inicia');
  room.receive(b.id, { t: 'lobby', listo: true }, 0);
  room.receive(b.id, { t: 'lobby', equipo: 'attackers' }, 0);
  assert.deepEqual(room.players.map((p) => p.team), ['defenders', 'attackers'], 'pasarse de bando cambia a los dos');
  assert.equal(room.players[1].ready, false, 'cambiar de bando quita el LISTO');
  room.receive(b.id, { t: 'lobby', listo: true }, 0);
  assert.equal(room.receive(b.id, { t: 'iniciar' }, 0).length, 0, 'solo el anfitrión inicia');
  assert.ok(room.receive(a.id, { t: 'iniciar' }, 0).some((o) => o.msg.t === 'start'));
  assert.equal(room.join({ nombre: 'Cami' }, 0).id, -1, 'no se entra a una partida empezada');
});

test('las órdenes del rival no se ven hasta el cierre y el servidor firma el bando', () => {
  const room = new Room('Q', { seed: () => 5 });
  room.join({ nombre: 'A' }, 0);
  room.join({ nombre: 'B' }, 0);
  room.receive(1, { t: 'lobby', listo: true }, 0);
  room.receive(0, { t: 'iniciar' }, 0);
  const out = room.receive(1, { t: 'ordenes', n: 0, lista: [{ type: 'buy', unitId: 0, item: 'flash', team: 'attackers' }] }, 0);
  assert.equal(out.length, 0, 'nada se reenvía antes del cierre');
  room.receive(0, { t: 'listo', n: 0 }, 0);
  const close = room.receive(1, { t: 'listo', n: 0 }, 0).find((o) => o.msg.t === 'cierre');
  assert.equal(close.msg.ordenes[1].lista[0].team, 'defenders', 'el bando lo pone el servidor');
});

test('una ronda 1v1 completa por lockstep: los dos clientes terminan con el mismo estado', () => {
  const h = harness();
  const [a, b] = lobbyOf2(h, 1);
  h.say(0, { t: 'iniciar' });
  assert.equal(a.phase, 'buy');
  assert.equal(b.team, 'defenders');
  const done = h.run(20000, () => h.room.status === 'finished', () => h.clients.forEach(autopilot));
  assert.ok(done, `la partida termina (fase ${a.phase}, turno ${a.sim.turn})`);
  assert.equal(a.desync, null, 'ningún desync');
  assert.equal(a.phase, 'end');
  assert.equal(hashSim(a.sim), hashSim(b.sim));
  assert.ok(a.sim.turn >= 2, 'se jugaron turnos');
  assert.equal(a.match.score.player, b.match.score.ai, 'los dos llevan el mismo marcador');
});

test('al mejor de 3: cambio de bando a la mitad y fin de partida', () => {
  const h = harness();
  const [a, b] = lobbyOf2(h, 3);
  h.say(0, { t: 'iniciar' });
  const teams = [];
  let last = null;
  h.run(80000, () => h.room.status === 'finished', () => {
    if (a.sim !== last) teams.push(a.team);
    last = a.sim;
    h.clients.forEach(autopilot);
  });
  assert.equal(h.room.status, 'finished');
  assert.equal(a.desync, null);
  assert.ok(a.finished && b.finished);
  assert.equal(teams[0], 'attackers');
  assert.equal(teams[1], 'defenders', 'la segunda ronda, del otro lado');
  assert.ok(a.match.over, 'la partida terminó para el cliente');
  assert.equal(Math.max(a.match.score.player, a.match.score.ai), 2);
  assert.deepEqual(a.match.score, { player: b.match.score.ai, ai: b.match.score.player });
});

test('el plazo de una fase de decisión la cierra sin LISTO', () => {
  const h = harness();
  const [a] = lobbyOf2(h, 1);
  h.say(0, { t: 'iniciar' });
  assert.equal(a.phase, 'buy');
  assert.ok(h.run(500, () => a.phase === 'prep'), 'la compra cierra sola a los 20 s');
});

test('reconexión a mitad de un turno: el cliente que vuelve repite el registro y sigue igual', () => {
  const h = harness({ seeds: [3] });
  const [a] = lobbyOf2(h, 1);
  h.say(0, { t: 'iniciar' });
  h.run(4000, () => a.phase === 'exec', () => h.clients.forEach(autopilot));
  h.run(10, () => false);
  assert.equal(a.phase, 'exec');

  // Beto's phone drops; the turn goes on; he comes back with a fresh page and his token.
  const token = h.room.players[1].token;
  h.drop(1);
  h.run(20, () => false);
  const back = h.connect(1, { token });
  assert.equal(back.me, 1);
  assert.ok(back.sim, 'reconstruyó la ronda');
  h.run(4000, () => a.phase === 'plan' && back.phase === 'plan' && a.deciding && back.deciding);
  assert.equal(hashSim(a.sim), hashSim(back.sim));
  assert.equal(a.desync, null);
  assert.ok(h.run(20000, () => h.room.status === 'finished', () => h.clients.forEach(autopilot)), 'la partida termina');
  assert.equal(a.desync, null);
});

test('reconexión en una fase de decisión: el plazo espera al que se cayó', () => {
  const h = harness();
  const [a] = lobbyOf2(h, 1);
  h.say(0, { t: 'iniciar' });
  h.drop(1);
  assert.ok(!h.run(1000, () => a.phase !== 'buy'), 'sin el rival la compra no cierra por plazo');
  const back = h.connect(1, { token: h.room.players[1].token });
  assert.equal(back.phase, 'buy');
  assert.ok(h.run(1000, () => a.phase === 'prep' && back.phase === 'prep'), 'de vuelta, el plazo sigue corriendo');
});

test('la sala se guarda y se recupera (el Durable Object puede hibernar)', () => {
  const h = harness();
  lobbyOf2(h, 1);
  h.say(0, { t: 'iniciar' });
  h.run(30, () => false, () => h.clients.forEach(autopilot));
  const json = JSON.parse(JSON.stringify(h.room));
  const copy = Room.fromJSON(json, {});
  assert.deepEqual(JSON.parse(JSON.stringify(copy)), json);
  assert.equal(copy.n, h.room.n);
});
