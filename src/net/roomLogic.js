// The server's room, with no Cloudflare and no network: it takes a player's message and returns
// what to send to whom, so `node --test` and the local `ws` server run the same code as the
// Durable Object (server/Room.js). The server never simulates: it orders, stores and hands out
// the orders and the pace, and compares the hash of every client's state.
//
// Lockstep. Every phase of the round (sim/round.js) has a number `n`, and every message of the
// match carries the `n` it belongs to (a stale one is dropped):
//   - decision phase (buy, prep, plan): orders are held back until the phase closes (everyone
//     LISTO or the deadline): the opponent's planning stays blind. `cierre` hands the whole
//     packet to everybody, in the same order, and every client advances its sim.
//   - live phase (drone, turn): the server grants steps (`pasos {hasta}`: the phase's tick every
//     client may run up to) and relays each order right away, stamped with a step the clients
//     have not reached yet (`atTick` > hasta), so all apply it at the same step.
//   - after each `cierre`, and when a live phase ends, every client reports `estado {n, fase, h}`
//     (the phase its sim is in and a hash of its state). All equal: the match goes on; any
//     difference: `desync`.
// Everything the room broadcasts is kept in `log`, so a phone that reconnects replays it.

export const ROOM = Object.freeze({
  maxPlayers: 2, // 1v1 (2v2: 4)
  phaseSeconds: Object.freeze({ buy: 20, prep: 60, plan: 30 }),
  grantMs: 100, // a live phase advances this much wall time per `pasos`
  grantTicks: 6, // steps per grant (60 Hz)
  durations: Object.freeze([1, 3, 5, 7]),
  graceMs: 90000, // a player gone this long: the rest may declare the abandonment
});

const TEAMS = ['attackers', 'defenders'];
const LIVE = new Set(['drone', 'exec']);
const DECISION = new Set(['buy', 'prep', 'plan']);
const send = (to, msg) => ({ to, msg });

export class Room {
  /** @param deps.seed () => integer seed of a round; deps.token () => unique player token */
  constructor(code, { seed = () => 1, token = () => Math.random().toString(36).slice(2) } = {}) {
    this.code = code;
    this.deps = { seed, token };
    this.players = []; // {id, token, name, team, ready, connected, roles}
    this.settings = { mapa: null, duracion: 1 };
    this.status = 'lobby'; // lobby | playing | finished
    this.log = []; // what was broadcast since the start, for a reconnecting client
    this.n = 0;
    this.phase = null; // {kind: 'decision'|'live'|'sync', fase, ...}
  }

  get host() {
    return this.players[0] ? this.players[0].id : null;
  }

  player(id) {
    return this.players[id];
  }

  /** Message `hola`: a new player, or an old one coming back with its token. Returns {id, out}. */
  join({ token, nombre }, now) {
    let p = token && this.players.find((q) => q.token === token);
    if (p) {
      p.connected = true;
      if (nombre) p.name = nombre;
      return { id: p.id, out: [...this.resume(p, now), send('*', this.roomMsg())] };
    }
    if (this.status !== 'lobby' || this.players.length >= ROOM.maxPlayers) return { id: -1, out: [send(-1, { t: 'error', motivo: 'llena' })] };
    const id = this.players.length;
    const team = TEAMS.find((t) => !this.players.some((q) => q.team === t)) || TEAMS[id % 2];
    p = { id, token: this.deps.token(), name: nombre || `Jugador ${id + 1}`, team, ready: false, connected: true, roles: null };
    this.players.push(p);
    return { id, out: [send(id, { t: 'hola', id, token: p.token, sala: this.code }), send('*', this.roomMsg())] };
  }

  roomMsg() {
    return {
      t: 'sala',
      anfitrion: this.host,
      ajustes: this.settings,
      estado: this.status,
      jugadores: this.players.map(({ id, name, team, ready, connected }) => ({ id, nombre: name, equipo: team, listo: ready, conectado: connected })),
    };
  }

  /** The connection of a player dropped. */
  leave(id, now) {
    const p = this.players[id];
    if (!p || !p.connected) return [];
    p.connected = false;
    p.leftAt = now;
    if (this.phase && this.phase.deadline) this.phase.pausedAt = now; // decision clocks wait for the missing player
    return [send('*', this.roomMsg())];
  }

  /** A player is back: replay everything since the start, then the phase that is open. */
  resume(p, now) {
    if (this.status === 'lobby') return [];
    const ph = this.phase;
    if (ph && ph.pausedAt && this.players.every((q) => q.connected)) {
      ph.deadline += now - ph.pausedAt;
      ph.pausedAt = null;
    }
    const out = [send(p.id, { t: 'registro', yo: p.id, mensajes: this.log })];
    if (ph && ph.kind === 'decision') out.push(send(p.id, this.faseMsg(now)));
    return out;
  }

  /** One message from a player; returns [{to: playerId | '*', msg}]. */
  receive(id, msg, now) {
    const p = this.players[id];
    if (!p) return [];
    switch (msg.t) {
      case 'lobby': return this.onLobby(p, msg);
      case 'clases': p.roles = msg.roles; return [];
      case 'iniciar': return this.onStart(p, now);
      case 'ordenes': return this.onOrders(p, msg, now);
      case 'listo': return this.onReady(p, msg, now);
      case 'estado': return this.onState(p, msg, now);
      case 'ping': return [send(id, { t: 'pong', ts: msg.ts })];
      default: return [send(id, { t: 'error', motivo: 'mensaje' })];
    }
  }

  // ---- lobby

  onLobby(p, m) {
    if (this.status !== 'lobby') return [];
    if (m.nombre) p.name = String(m.nombre).slice(0, 16);
    if (m.listo !== undefined) p.ready = !!m.listo;
    if (m.equipo && TEAMS.includes(m.equipo) && !this.players.some((q) => q !== p && q.team === m.equipo)) {
      p.team = m.equipo;
      p.ready = false;
    }
    if (p.id === this.host) {
      if (m.mapa !== undefined) this.settings.mapa = m.mapa;
      if (ROOM.durations.includes(m.duracion)) this.settings.duracion = m.duracion;
    }
    return [send('*', this.roomMsg())];
  }

  onStart(p, now) {
    if (p.id !== this.host || this.status !== 'lobby') return [];
    const ready = this.players.length === ROOM.maxPlayers && this.players.every((q) => q.connected && q.ready || q.id === this.host);
    const teams = new Set(this.players.map((q) => q.team));
    if (!ready || teams.size !== 2) return [send(p.id, { t: 'error', motivo: 'no-listos' })];
    this.status = 'playing';
    const roles = {};
    for (const q of this.players) if (q.roles) roles[q.team] = q.roles;
    const start = {
      t: 'start',
      semilla: this.deps.seed(),
      mapa: this.settings.mapa,
      duracion: this.settings.duracion,
      roles,
      equipos: Object.fromEntries(this.players.map((q) => [q.id, q.team])),
    };
    this.log = [];
    this.n = 0;
    return [...this.broadcast(start), ...this.openDecision('buy', now)];
  }

  // ---- phases

  broadcast(msg) {
    // Only the latest `pasos` of a stretch is worth replaying.
    const last = this.log[this.log.length - 1];
    if (msg.t === 'pasos' && last && last.t === 'pasos') this.log[this.log.length - 1] = msg;
    else this.log.push(msg);
    return [send('*', msg)];
  }

  faseMsg(now) {
    const ph = this.phase;
    return { t: 'fase', n: this.n, fase: ph.fase, restan: ph.deadline === null ? null : Math.max(0, ph.deadline - (ph.pausedAt ?? now)) };
  }

  openDecision(fase, now) {
    const secs = ROOM.phaseSeconds[fase];
    this.phase = { kind: 'decision', fase, deadline: secs ? now + secs * 1000 : null, ready: new Set(), orders: [], pausedAt: null };
    return [send('*', this.faseMsg(now))];
  }

  onReady(p, m, now) {
    const ph = this.phase;
    if (!ph || ph.kind !== 'decision' || m.n !== this.n) return [];
    ph.ready.add(p.id);
    if (this.players.every((q) => ph.ready.has(q.id))) return this.closeDecision(now);
    return [send('*', { t: 'listos', n: this.n, quien: [...ph.ready] })];
  }

  closeDecision() {
    const ph = this.phase;
    const orders = this.players.map((q) => ({ p: q.id, lista: ph.orders.filter((o) => o.p === q.id).map((o) => o.cmd) }));
    this.phase = { kind: 'sync', fase: ph.fase, reports: new Map() };
    return this.broadcast({ t: 'cierre', n: this.n, fase: ph.fase, ordenes: orders });
  }

  onOrders(p, m, now) {
    const ph = this.phase;
    if (!ph || m.n !== this.n || !Array.isArray(m.lista)) return [];
    const cmds = m.lista.map((c) => ({ ...c, team: p.team }));
    if (ph.kind === 'decision') {
      for (const cmd of cmds) ph.orders.push({ p: p.id, cmd });
      return [];
    }
    if (ph.kind !== 'live') return [];
    const out = [];
    for (const cmd of cmds) {
      cmd.atTick = Math.max(cmd.atTick ?? 0, ph.hasta + 1); // never in a step some client already ran
      out.push(...this.broadcast({ t: 'orden', n: this.n, p: p.id, cmd }));
    }
    return out;
  }

  onState(p, m, now) {
    const ph = this.phase;
    if (!ph || m.n !== this.n || (ph.kind !== 'sync' && ph.kind !== 'live')) return [];
    const reports = ph.reports || (ph.reports = new Map());
    if (reports.has(p.id)) return [];
    reports.set(p.id, { fase: m.fase, h: m.h });
    if (reports.size < this.players.length) return [];
    const all = [...reports.values()];
    if (all.some((r) => r.h !== all[0].h || r.fase !== all[0].fase)) {
      this.phase = { kind: 'desync' };
      return this.broadcast({ t: 'desync', n: this.n, hashes: Object.fromEntries(reports) });
    }
    const fase = all[0].fase;
    this.n++;
    if (fase === 'end') {
      this.status = 'finished';
      this.phase = null;
      return this.broadcast({ t: 'fin', n: this.n, h: all[0].h });
    }
    if (LIVE.has(fase)) {
      this.phase = { kind: 'live', fase, hasta: 0, grantedAt: now };
      return this.broadcast({ t: 'pasos', n: this.n, hasta: 0 });
    }
    if (DECISION.has(fase)) return this.openDecision(fase, now);
    return [];
  }

  /** Called often (every ~50 ms): live phases advance, decision deadlines expire. */
  tick(now) {
    const ph = this.phase;
    if (!ph) return [];
    if (ph.kind === 'live') {
      const grants = Math.floor((now - ph.grantedAt) / ROOM.grantMs);
      if (grants < 1) return [];
      ph.grantedAt += grants * ROOM.grantMs;
      ph.hasta += grants * ROOM.grantTicks;
      return this.broadcast({ t: 'pasos', n: this.n, hasta: ph.hasta });
    }
    if (ph.kind === 'decision' && ph.deadline !== null && !ph.pausedAt && now >= ph.deadline) return this.closeDecision(now);
    return [];
  }
}
