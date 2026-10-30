// The server's room, with no Cloudflare and no network: it takes a player's message and returns
// what to send to whom, so `node --test` and the local server (scripts/local-server.mjs) run the
// same code as the Durable Object (server/worker.js). The server never simulates: it orders,
// stores and hands out the orders and the pace, and compares the hash of every client's state.
//
// Lockstep. Every phase of the match has a number `n`, and every message of the match carries
// the `n` it belongs to (a stale one is dropped):
//   - decision phase (buy, prep, plan): orders are held back until the phase closes (everyone
//     LISTO or the deadline): the opponent's planning stays blind. `cierre` hands the whole
//     packet to everybody, in the same order, and every client advances its sim.
//   - live phase (drone, turn): the server grants steps (`pasos {hasta}`: the phase's tick every
//     client may run up to) and relays each order right away, stamped with a step the clients
//     have not reached yet (`atTick` > hasta), so all apply it at the same step.
//   - after each `cierre`, and when a live phase ends, every client reports `estado {n, fase, h}`
//     (the phase its sim is in and a hash of its state). All equal: the match goes on; any
//     difference: the host (or whoever is there) is asked for a snapshot of his sim (`foto`),
//     everybody takes it (`resync`) and the match goes on from his state.
//   - the round's end ('end') is a decision phase with no orders: the result stays on screen
//     until everybody is LISTO (or its deadline); then `ronda` starts the next one (the clients
//     said whether the match goes on: `sigue`, from session/Match.js) or `fin` ends it.
// Everything the room broadcasts since the start is kept in `log`, so a phone that reconnects
// replays it and catches up.
//
// Message names follow docs/traspaso/MULTIJUGADOR.md (t: the type).

export const ROOM = Object.freeze({
  maxPlayers: 2, // 1v1 (2v2: 4)
  phaseSeconds: Object.freeze({ buy: 20, prep: 60, plan: 30, end: 30 }),
  grantMs: 100, // a live phase advances this much wall time per `pasos`
  grantTicks: 6, // steps per grant (60 Hz)
  durations: Object.freeze([1, 3, 5, 7]),
  nameLength: 16,
  abandonMs: 90000, // a player gone this long in a match: it ends and the room goes back to its lobby
  maxSnapshot: 900 * 1024, // characters of a snapshot the room relays (a Durable Object message is 1 MiB)
});

const TEAMS = ['attackers', 'defenders'];
const OTHER = { attackers: 'defenders', defenders: 'attackers' };
const LIVE = new Set(['drone', 'exec']);
const DECISION = new Set(['buy', 'prep', 'plan', 'end']);
const send = (to, msg) => ({ to, msg });

/** Rounds of a best of `bestOf` after which the sides switch (as session/Match.js). */
export const switchAfter = (bestOf) => Math.floor(bestOf / 2);

export class Room {
  /** @param deps.seed () => integer seed of a round; deps.token () => unique player token */
  constructor(code, { seed = () => 1, token = () => Math.random().toString(36).slice(2) } = {}) {
    this.code = code;
    this.deps = { seed, token };
    this.players = []; // {id, token, name, team, ready, connected, roles}
    this.settings = { mapa: null, duracion: 3 };
    this.status = 'lobby'; // lobby | playing | finished
    this.round = 0;
    this.log = []; // what was broadcast since the start, for a reconnecting client
    this.n = 0;
    this.phase = null; // {kind: 'decision'|'live'|'sync'|'resync', fase, ...}
  }

  get host() {
    return this.players[0] ? this.players[0].id : null;
  }

  /** Message `hola`: a new player, or an old one coming back with its token. Returns {id, out}. */
  join({ token, nombre }, now) {
    let p = token ? this.players.find((q) => q.token === token) : null;
    if (p) {
      p.connected = true;
      if (nombre) p.name = cleanName(nombre);
      return { id: p.id, out: [send(p.id, this.helloMsg(p)), ...this.resume(p, now), send('*', this.roomMsg())] };
    }
    if (this.status !== 'lobby') return { id: -1, out: [send(-1, { t: 'error', motivo: 'en-juego' })] };
    if (this.players.length >= ROOM.maxPlayers) return { id: -1, out: [send(-1, { t: 'error', motivo: 'llena' })] };
    const id = this.players.length;
    const team = TEAMS.find((t) => !this.players.some((q) => q.team === t)) || TEAMS[id % 2];
    p = { id, token: this.deps.token(), name: cleanName(nombre) || `Jugador ${id + 1}`, team, ready: false, connected: true, roles: null };
    this.players.push(p);
    return { id, out: [send(id, this.helloMsg(p)), send('*', this.roomMsg())] };
  }

  helloMsg(p) {
    return { t: 'hola', id: p.id, token: p.token, sala: this.code };
  }

  roomMsg() {
    return {
      t: 'sala',
      anfitrion: this.host,
      ajustes: this.settings,
      estado: this.status,
      jugadores: this.players.map(({ id, name, team, ready, connected }) => ({ id, nombre: name, equipo: team, listo: ready, conectado: connected })),
      abandono: ROOM.abandonMs,
    };
  }

  /** The connection of a player dropped. */
  leave(id, now) {
    const p = this.players[id];
    if (!p || !p.connected) return [];
    p.connected = false;
    p.leftAt = now;
    if (this.status === 'lobby') p.ready = false;
    const ph = this.phase;
    if (ph && ph.kind === 'decision' && ph.deadline !== null && ph.pausedAt === null) ph.pausedAt = now; // the clock waits for him
    return [send('*', this.roomMsg())];
  }

  /** A player is back: everything since the start again, then the phase that is open. */
  resume(p, now) {
    if (this.status === 'lobby') return [];
    const ph = this.phase;
    if (ph && ph.pausedAt != null && this.players.every((q) => q.connected)) {
      ph.deadline += now - ph.pausedAt;
      ph.pausedAt = null;
    }
    const out = [send(p.id, { t: 'registro', yo: p.id, mensajes: this.log })];
    if (ph && ph.kind === 'decision') out.push(send('*', this.faseMsg(now)));
    return out;
  }

  /** One message from a player; returns [{to: playerId | '*', msg}]. */
  receive(id, msg, now) {
    const p = this.players[id];
    if (!p || !msg || typeof msg !== 'object') return [];
    switch (msg.t) {
      case 'lobby': return this.onLobby(p, msg);
      case 'clases': return this.onRoles(p, msg);
      case 'iniciar': return this.onStart(p, now);
      case 'volver': return this.onBack(p);
      case 'ordenes': return this.onOrders(p, msg);
      case 'listo': return this.onReady(p, msg, now);
      case 'estado': return this.onState(p, msg, now);
      case 'foto': return this.onSnapshot(p, msg, now);
      case 'ping': return [send(id, { t: 'pong', ts: msg.ts })];
      case 'reloj': return []; // only moves the clock (the caller ticks before every message)
      default: return [send(id, { t: 'error', motivo: 'mensaje' })];
    }
  }

  // ---- lobby

  onLobby(p, m) {
    if (this.status !== 'lobby') return [];
    if (m.nombre) p.name = cleanName(m.nombre) || p.name;
    if (m.listo !== undefined) p.ready = !!m.listo;
    if (TEAMS.includes(m.equipo) && p.team !== m.equipo) {
      // A tap on the other side: in 1v1 both players switch.
      const other = this.players.find((q) => q !== p && q.team === m.equipo);
      if (other) {
        other.team = p.team;
        other.ready = false;
      }
      p.team = m.equipo;
      p.ready = false;
    }
    if (p.id === this.host) {
      let changed = false;
      if (m.mapa !== undefined && m.mapa !== this.settings.mapa) {
        this.settings.mapa = m.mapa;
        changed = true;
      }
      if (ROOM.durations.includes(m.duracion) && m.duracion !== this.settings.duracion) {
        this.settings.duracion = m.duracion;
        changed = true;
      }
      if (changed) for (const q of this.players) q.ready = false; // new conditions: everyone confirms again
    }
    return [send('*', this.roomMsg())];
  }

  /** The player's classes for each side ({attackers: [roleId x3], defenders: [...]}): he plays both in a match. */
  onRoles(p, m) {
    if (this.status !== 'lobby' || !m.roles || typeof m.roles !== 'object') return [];
    p.roles = {};
    for (const t of TEAMS) if (Array.isArray(m.roles[t])) p.roles[t] = m.roles[t].map((r) => (typeof r === 'string' ? r : null));
    return [];
  }

  /** Can the host start: a full room, both sides taken, everyone else ready and connected. */
  canStart() {
    return this.players.length === ROOM.maxPlayers
      && new Set(this.players.map((q) => q.team)).size === TEAMS.length
      && this.players.every((q) => q.connected && (q.ready || q.id === this.host));
  }

  onStart(p, now) {
    if (p.id !== this.host || this.status !== 'lobby') return [];
    if (!this.canStart()) return [send(p.id, { t: 'error', motivo: 'no-listos' })];
    this.status = 'playing';
    this.round = 1;
    this.log = [];
    this.n = 0;
    const start = {
      t: 'start',
      mapa: this.settings.mapa,
      duracion: this.settings.duracion,
      roles: Object.fromEntries(this.players.map((q) => [q.id, q.roles])),
      ...this.roundFields(),
    };
    return [...this.broadcast(start), ...this.openDecision('buy', now)];
  }

  /** What a new round needs: its seed, its number and who plays each side. */
  roundFields() {
    return { semilla: this.deps.seed() >>> 0, ronda: this.round, equipos: Object.fromEntries(this.players.map((q) => [q.id, q.team])) };
  }

  /** After a match: back to the lobby (rematch), same players, nobody ready. Either player may. */
  onBack(p) {
    if (this.status !== 'finished') return [];
    this.status = 'lobby';
    this.phase = null;
    for (const q of this.players) q.ready = false;
    return [send('*', { t: 'lobby' }), send('*', this.roomMsg())];
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
    const restan = ph.deadline === null ? null : Math.max(0, ph.deadline - (ph.pausedAt ?? now));
    return { t: 'fase', n: this.n, fase: ph.fase, restan, pausa: ph.pausedAt !== null, listos: [...ph.ready] };
  }

  openDecision(fase, now) {
    const secs = ROOM.phaseSeconds[fase];
    const missing = this.players.some((q) => !q.connected);
    this.phase = { kind: 'decision', fase, deadline: secs ? now + secs * 1000 : null, pausedAt: missing ? now : null, ready: new Set(), orders: [] };
    return [send('*', this.faseMsg(now))];
  }

  onReady(p, m, now) {
    const ph = this.phase;
    if (!ph || ph.kind !== 'decision' || m.n !== this.n) return [];
    ph.ready.add(p.id);
    if (this.players.every((q) => ph.ready.has(q.id))) return this.closeDecision(now);
    return [send('*', this.faseMsg(now))];
  }

  closeDecision(now) {
    const ph = this.phase;
    if (ph.fase === 'end') return this.nextRound(now);
    const orders = this.players.map((q) => ({ p: q.id, lista: ph.orders.filter((o) => o.p === q.id).map((o) => o.cmd) }));
    this.phase = { kind: 'sync', fase: ph.fase, reports: new Map() };
    return this.broadcast({ t: 'cierre', n: this.n, fase: ph.fase, ordenes: orders });
  }

  /** The result was seen: the next round (sides switched at half-time), or the end of the match. */
  nextRound(now) {
    const sigue = this.phase.sigue;
    this.n++;
    if (!sigue) {
      this.status = 'finished';
      this.phase = null;
      return [...this.broadcast({ t: 'fin', n: this.n }), send('*', this.roomMsg())];
    }
    this.round++;
    if (this.round === switchAfter(this.settings.duracion) + 1) for (const q of this.players) q.team = OTHER[q.team];
    return [...this.broadcast({ t: 'ronda', n: this.n, ...this.roundFields() }), ...this.openDecision('buy', now)];
  }

  onOrders(p, m) {
    const ph = this.phase;
    if (!ph || m.n !== this.n || !Array.isArray(m.lista)) return [];
    // The server signs every order with the sender's side: nobody orders the other side's units.
    const cmds = m.lista.filter((c) => c && typeof c.type === 'string').map((c) => ({ ...c, team: p.team }));
    if (ph.kind === 'decision') {
      if (ph.fase === 'end' || ph.ready.has(p.id)) return [];
      for (const cmd of cmds) ph.orders.push({ p: p.id, cmd });
      return [];
    }
    if (ph.kind !== 'live') return [];
    const out = [];
    for (const cmd of cmds) {
      cmd.atTick = Math.max(Number.isInteger(cmd.atTick) ? cmd.atTick : 0, ph.hasta + 1); // never a step some client already ran
      out.push(...this.broadcast({ t: 'orden', n: this.n, p: p.id, cmd }));
    }
    return out;
  }

  onState(p, m, now) {
    const ph = this.phase;
    if (!ph || m.n !== this.n || (ph.kind !== 'sync' && ph.kind !== 'live')) return [];
    const reports = ph.reports || (ph.reports = new Map());
    if (reports.has(p.id)) return [];
    reports.set(p.id, { fase: m.fase, h: m.h, sigue: !!m.sigue });
    if (reports.size < this.players.length) return [];
    const all = [...reports.values()];
    if (all.some((r) => r.h !== all[0].h || r.fase !== all[0].fase)) {
      // The phones drifted apart: everybody takes the state of the host (or of whoever is connected).
      const ref = this.players.find((q) => q.connected && reports.has(q.id)) || p;
      this.phase = { kind: 'resync', from: ref.id, report: reports.get(ref.id), hashes: Object.fromEntries([...reports].map(([id, r]) => [id, r.h])) };
      return [send(ref.id, { t: 'foto', n: this.n })];
    }
    return this.agree(all[0], all, now);
  }

  /** The reference player's snapshot: relayed to everybody (and kept for a reconnection), then on. */
  onSnapshot(p, m, now) {
    const ph = this.phase;
    if (!ph || ph.kind !== 'resync' || p.id !== ph.from || m.n !== this.n || !m.data) return [];
    if (JSON.stringify(m.data).length > ROOM.maxSnapshot) return [];
    const out = this.broadcast({ t: 'resync', n: this.n, de: p.id, data: m.data, hashes: ph.hashes });
    const report = ph.report;
    return [...out, ...this.agree(report, [report], now)];
  }

  /** Every phone is in the same phase with the same state: the next phase opens. */
  agree(report, all, now) {
    const fase = report.fase;
    this.n++;
    if (LIVE.has(fase)) {
      this.phase = { kind: 'live', fase, hasta: 0, grantedAt: now };
      return this.broadcast({ t: 'pasos', n: this.n, hasta: 0 });
    }
    if (!DECISION.has(fase)) return [];
    const out = this.openDecision(fase, now);
    if (fase === 'end') this.phase.sigue = all.every((r) => r.sigue);
    return out;
  }

  /**
   * A player gone for ROOM.abandonMs in a match: it is over (abandonment) and the room goes back to
   * its lobby; his seat stays, he may come back for a rematch.
   */
  checkAbandon(now) {
    if (this.status !== 'playing') return [];
    const gone = this.players.find((q) => !q.connected && now - (q.leftAt ?? now) >= ROOM.abandonMs);
    if (!gone) return [];
    this.status = 'lobby';
    this.phase = null;
    this.log = [];
    for (const q of this.players) q.ready = false;
    return [send('*', { t: 'abandono', quien: gone.id }), send('*', { t: 'lobby' }), send('*', this.roomMsg())];
  }

  /** Called often (every ~50 ms): live phases advance, decision deadlines expire. */
  tick(now) {
    const abandon = this.checkAbandon(now);
    if (abandon.length) return abandon;
    const ph = this.phase;
    if (!ph) return [];
    if (ph.kind === 'live') {
      const grants = Math.floor((now - ph.grantedAt) / ROOM.grantMs);
      if (grants < 1) return [];
      ph.grantedAt += grants * ROOM.grantMs;
      ph.hasta += Math.min(grants, 10) * ROOM.grantTicks; // a stalled server does not leap a whole second at once
      return this.broadcast({ t: 'pasos', n: this.n, hasta: ph.hasta });
    }
    if (ph.kind === 'decision' && ph.deadline !== null && ph.pausedAt === null && now >= ph.deadline) return this.closeDecision(now);
    return [];
  }

  /** Does the room need tick() (a match running)? The Durable Object only keeps a timer then. */
  get ticking() {
    return this.status === 'playing';
  }

  // ---- persistence (a Durable Object may be evicted between messages)

  toJSON() {
    const ph = this.phase && { ...this.phase };
    if (ph && ph.ready) ph.ready = [...ph.ready];
    if (ph && ph.reports) ph.reports = [...ph.reports];
    const { code, players, settings, status, round, log, n } = this;
    return { code, players, settings, status, round, log, n, phase: ph };
  }

  static fromJSON(data, deps) {
    const room = new Room(data.code, deps);
    Object.assign(room, { players: data.players, settings: data.settings, status: data.status, round: data.round, log: data.log, n: data.n });
    const ph = data.phase;
    if (ph && ph.ready) ph.ready = new Set(ph.ready);
    if (ph && ph.reports) ph.reports = new Map(ph.reports);
    room.phase = ph;
    return room;
  }
}

function cleanName(name) {
  return typeof name === 'string' ? name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, ROOM.nameLength) : '';
}

/** A room code: 5 characters with no look-alikes (no 0/O, 1/I/L). `rand`: () => 0..1. */
export const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function roomCode(rand = Math.random, length = 5) {
  let s = '';
  for (let i = 0; i < length; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  return s;
}
