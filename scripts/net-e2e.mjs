// Prueba de punta a punta del multijugador contra un servidor real (wrangler dev, el servidor
// local o el desplegado): crea una sala, conecta dos jugadores por WebSocket y juega una partida
// con pilotos automáticos, comparando los hashes de las dos simulaciones.
//
//   node scripts/net-e2e.mjs http://127.0.0.1:8787 [mejorDe=3]
import { Simulation } from '../src/sim/Simulation.js';
import { ALL_MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { LockstepClient } from '../src/net/LockstepClient.js';
import { hashSim } from '../src/net/stateHash.js';

const base = (process.argv[2] || 'http://127.0.0.1:8787').replace(/\/$/, '');
const bestOf = +(process.argv[3] || 3);
const wsBase = base.replace(/^http/, 'ws');

const createSim = ({ map, options }) => new Simulation(ALL_MAPS[map] ?? ALL_MAPS[DEFAULT_MAP], options);

function player(code, name, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}/sala/${code}`);
    const c = new LockstepClient({ send: (m) => ws.send(JSON.stringify(m)), createSim });
    c.ws = ws;
    c.name = name;
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hola', nombre: name, token }));
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      c.receive(msg);
      if (msg.t === 'hola') resolve(c);
      if (msg.t === 'error') console.log(name, 'error', msg.motivo);
    };
    ws.onerror = (e) => reject(e);
  });
}

function autopilot(c) {
  if (!c.sim || c.finished) return;
  const sim = c.sim;
  if (sim.phase === 'drone' && c.team === 'attackers' && c.recalled !== c.n) {
    c.recalled = c.n;
    c.command({ type: 'droneRecall' });
  }
  if (!c.deciding) return;
  if (sim.phase === 'plan' && c.team === 'attackers' && sim.turn <= 1 && c.planned !== c.n) {
    c.planned = c.n;
    for (const u of sim.teams.attackers) c.command({ type: 'addWaypoint', unitId: u.id, x: sim.site.bombX, y: sim.site.bombY, user: true });
  }
  c.ready();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const t0 = Date.now();
const res = await fetch(`${base}/crear`, { method: 'POST' });
const { sala } = await res.json();
console.log('sala', sala);
const a = await player(sala, 'Ana');
const b = await player(sala, 'Beto');
a.send({ t: 'lobby', duracion: bestOf, mapa: DEFAULT_MAP });
await sleep(100);
b.send({ t: 'lobby', listo: true });
await sleep(100);
a.send({ t: 'iniciar' });

let rounds = 0;
let last = null;
let dropped = false;
let bb = b;
while (!(a.finished && bb.finished) && Date.now() - t0 < (process.env.DBG ? 40000 : 900000)) {
  for (const c of [a, bb]) {
    c.pump(8); // 8 steps per 16 ms: plenty to keep up
    const clock = c.clockMsg();
    if (clock) c.send(clock);
    autopilot(c);
  }
  if (a.sim !== last) {
    last = a.sim;
    rounds++;
    console.log(`ronda ${rounds}: Ana ${a.team}, Beto ${bb.team}`);
  }
  // A drop and a reconnection in the middle of the first turn of round 1.
  if (!dropped && rounds === 1 && a.phase === 'exec' && a.sim.turn === 1) {
    dropped = true;
    const token = bb.token;
    bb.ws.close();
    await sleep(300);
    bb = await player(sala, 'Beto', token);
    await sleep(200);
    console.log('Beto volvió:', bb.phase, 'turno', bb.sim && bb.sim.turn);
  }
  if (a.desync || bb.desync) break;
  if (process.env.DBG && Date.now() % 3000 < 17) console.log("dbg", JSON.stringify([a, bb].map((c) => [c.phase, c.n, c.hasta, c.sim && c.sim.turn, c.deciding])));
  await sleep(16);
}
console.log('fin:', { terminada: a.finished && bb.finished, desync: a.desync || bb.desync, marcador: a.match && a.match.score, rondas: rounds, segundos: Math.round((Date.now() - t0) / 1000) });
console.log('hashes', hashSim(a.sim), hashSim(bb.sim));
a.ws.close();
bb.ws.close();
process.exit(a.finished && bb.finished && !a.desync && !bb.desync && hashSim(a.sim) === hashSim(bb.sim) ? 0 : 1);
