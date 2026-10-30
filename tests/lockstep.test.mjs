// Lockstep 1v1 sin red: dos clientes con su propia Simulation, un Room que reparte las órdenes y
// compara hashes. Juegan una ronda completa; si algún hash difiere el Room manda `desync`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { ALL_MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { Room } from '../src/net/roomLogic.js';
import { LockstepClient } from '../src/net/LockstepClient.js';
import { hashSim } from '../src/net/stateHash.js';

const HUMANS = { attackers: 'human', defenders: 'human' };

/** Server + clients in one process; messages go through queues, so ordering is as in a socket. */
function harness({ seed = 11 } = {}) {
  let now = 0;
  const room = new Room('ABCDE', { seed: () => seed, token: (() => { let i = 0; return () => `tok${i++}`; })() });
  const inbox = [new Array(), new Array()];
  const toServer = [];
  const clients = [0, 1].map((i) => new LockstepClient({
    send: (m) => toServer.push([i, m]),
    createSim: (start) => new Simulation(ALL_MAPS[DEFAULT_MAP], { seed: start.semilla, controllers: HUMANS }),
  }));
  const deliver = (out) => {
    for (const { to, msg } of out) {
      if (to === '*') inbox.forEach((q) => q.push(msg));
      else if (to >= 0) inbox[to].push(msg);
    }
  };
  const h = {
    room, clients, get now() { return now; },
    join(i, nombre) {
      const r = room.join({ nombre }, now);
      clients[i].me = r.id;
      deliver(r.out);
    },
    pushToServer() {
      while (toServer.length) {
        const [i, m] = toServer.shift();
        deliver(room.receive(clients[i].me, m, now));
      }
    },
    /** One round of the world: server tick, deliveries, each client runs its steps. */
    cycle(ms = 50) {
      now += ms;
      deliver(room.tick(now));
      for (let k = 0; k < 4; k++) {
        clients.forEach((c, i) => { while (inbox[i].length) c.receive(inbox[i].shift()); });
        clients.forEach((c) => c.pump(8));
        h.pushToServer();
      }
    },
    run(maxCycles, until) {
      for (let i = 0; i < maxCycles && !until(); i++) h.cycle();
    },
  };
  return h;
}

function startMatch(h) {
  h.join(0, 'Ana');
  h.join(1, 'Beto');
  h.room.receive(1, { t: 'lobby', listo: true }, 0);
  const out = h.room.receive(0, { t: 'iniciar' }, 0);
  assert.equal(out.find((o) => o.msg.t === 'error'), undefined);
  // deliver the start through the harness' normal path
  h.cycle(0);
}

test('el lobby: dos jugadores en bandos distintos y el anfitrión inicia', () => {
  const room = new Room('ZZZZZ');
  const a = room.join({ nombre: 'Ana' }, 0);
  const b = room.join({ nombre: 'Beto' }, 0);
  assert.deepEqual(room.players.map((p) => p.team), ['attackers', 'defenders']);
  assert.equal(room.join({ nombre: 'Cami' }, 0).id, -1, 'sala llena');
  assert.ok(room.receive(a.id, { t: 'iniciar' }, 0).some((o) => o.msg.t === 'error'), 'sin LISTO del otro no inicia');
  room.receive(b.id, { t: 'lobby', listo: true }, 0);
  assert.ok(room.receive(b.id, { t: 'iniciar' }, 0).length === 0, 'solo el anfitrión inicia');
  assert.ok(room.receive(a.id, { t: 'iniciar' }, 0).some((o) => o.msg.t === 'start'));
});

test('una ronda 1v1 completa por lockstep: los dos clientes terminan con el mismo estado', () => {
  const h = (() => {
    const x = harness();
    x.join(0, 'Ana');
    x.join(1, 'Beto');
    x.room.receive(1, { t: 'lobby', listo: true }, 0);
    return x;
  })();
  const [att, def] = h.clients;
  const out = h.room.receive(0, { t: 'iniciar' }, 0);
  // the start reaches both clients
  for (const { msg } of out) h.clients.forEach((c) => c.receive(msg));
  assert.equal(att.phase, 'buy');

  const waitPhase = (c, phase) => h.run(2000, () => c.phase === phase && c.deciding);
  const both = (fn) => { fn(att); fn(def); };

  // buy and prep: nothing to do but LISTO
  waitPhase(att, 'buy');
  both((c) => c.ready());
  h.run(200, () => att.phase !== 'buy' && def.phase !== 'buy' && att.deciding);
  assert.equal(att.phase, 'prep');
  both((c) => c.ready());
  // the drone phase (live) ends with the recall of the attackers; then planning
  h.run(400, () => att.phase === 'drone' && def.phase === 'drone');
  if (att.phase === 'drone') {
    att.command({ type: 'droneRecall' });
    h.run(2000, () => att.phase === 'plan' && def.phase === 'plan' && att.deciding);
  }
  assert.equal(att.phase, 'plan');

  // planning: the attackers walk toward the site; then turns until the round ends
  const site = att.sim.site;
  for (let turn = 0; turn < 20 && att.phase !== 'end'; turn++) {
    if (turn === 0) {
      for (const u of att.sim.teams.attackers) att.command({ type: 'addWaypoint', unitId: u.id, x: site.x ?? 20, y: site.y ?? 15, user: true });
    }
    both((c) => c.ready());
    const turnBefore = att.n;
    h.run(4000, () => att.n > turnBefore + 1 && ((att.phase === 'plan' && att.deciding && def.phase === 'plan') || att.phase === 'end'));
  }
  h.run(200, () => h.room.status === 'finished');

  assert.equal(h.clients[0].desync, null, 'ningún desync');
  assert.equal(h.clients[1].desync, null);
  assert.equal(att.phase, 'end');
  assert.equal(h.room.status, 'finished');
  assert.equal(hashSim(att.sim), hashSim(def.sim));
});

test('reconexión a mitad de un turno: el cliente que vuelve repite el registro y sigue igual', () => {
  const h = harness({ seed: 3 });
  h.join(0, 'Ana');
  h.join(1, 'Beto');
  h.room.receive(1, { t: 'lobby', listo: true }, 0);
  const [att, oldDef] = h.clients;
  for (const { msg } of h.room.receive(0, { t: 'iniciar' }, 0)) h.clients.forEach((c) => c.receive(msg));
  h.cycle(0);
  const both = () => h.clients.forEach((c) => c.ready());
  h.run(100, () => att.deciding);
  both(); // buy
  h.run(200, () => att.phase === 'prep' && att.deciding);
  both(); // prep
  h.run(400, () => att.phase === 'drone');
  att.command({ type: 'droneRecall' });
  h.run(400, () => att.phase === 'plan' && att.deciding);
  both();
  h.run(400, () => att.phase === 'exec');
  h.run(10, () => false); // some steps of the turn run

  // Beto's phone drops and comes back with a fresh page: the same token, a new client
  h.room.leave(1, h.now);
  const oldSend = oldDef.send;
  const fresh = new LockstepClient({
    send: oldSend,
    createSim: (s) => new Simulation(ALL_MAPS[DEFAULT_MAP], { seed: s.semilla, controllers: HUMANS }),
  });
  h.clients[1] = fresh;
  const back = h.room.join({ token: h.room.players[1].token }, h.now);
  assert.equal(back.id, 1);
  fresh.me = 1;
  for (const { to, msg } of back.out) if (to === 1 || to === '*') fresh.receive(msg);

  h.run(2000, () => att.phase === 'plan' && fresh.phase === 'plan' && att.deciding);
  assert.equal(att.phase, 'plan');
  assert.equal(fresh.phase, 'plan');
  assert.equal(hashSim(att.sim), hashSim(fresh.sim));
  assert.equal(att.desync, null);
  assert.equal(fresh.desync, null);
});
