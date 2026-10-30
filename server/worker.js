// The multiplayer server on Cloudflare: a Worker that creates rooms and routes each room's
// WebSockets to its Durable Object (one per room code). All the rules are in
// src/net/roomLogic.js (tested with `node --test`); this file is only the plumbing:
// sockets with the hibernation API, a timer while a match runs, storage between wake-ups.
//
//   POST /crear            -> {sala: 'ABC23'}   a new room
//   GET  /sala/ABC23       -> WebSocket         (Upgrade: websocket)
//   GET  /                 -> {ok: true}        health check
//
// Deployed by GitHub Actions (.github/workflows/pages.yml) with wrangler; see wrangler.toml.
import { DurableObject } from 'cloudflare:workers';
import { Room, roomCode } from '../src/net/roomLogic.js';

const CODE = /^\/sala\/([2-9A-Z]{4,8})$/;
const TICK_MS = 50;
const IDLE_MS = 6 * 60 * 60 * 1000; // a room with nobody connected is deleted after this long

const cors = (res) => {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
};
const json = (data, status = 200) => cors(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));

function random32() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

const deps = {
  seed: random32,
  token: () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join(''),
};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    if (url.pathname === '/') return json({ ok: true });
    if (url.pathname === '/crear' && req.method === 'POST') {
      for (let i = 0; i < 5; i++) {
        const code = roomCode(() => random32() / 4294967296);
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const res = await stub.fetch(`https://sala/crear?codigo=${code}`, { method: 'POST' });
        if (res.ok) return json({ sala: code });
      }
      return json({ error: 'sin-codigo' }, 503);
    }
    const m = url.pathname.match(CODE);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'websocket' }, 426);
      return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
    }
    return json({ error: 'ruta' }, 404);
  },
};

export class Sala extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    this.timer = null;
    ctx.blockConcurrencyWhile(async () => {
      const data = await ctx.storage.get('room');
      if (data) this.room = Room.fromJSON(data, deps);
    });
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/crear') {
      if (this.room) return new Response('ocupada', { status: 409 });
      this.room = new Room(url.searchParams.get('codigo'), deps);
      await this.save();
      await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
      return new Response('ok');
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: -1 });
    if (!this.room) {
      server.send(JSON.stringify({ t: 'error', motivo: 'no-existe' }));
      server.close(4004, 'no-existe');
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, data) {
    if (!this.room || typeof data !== 'string' || data.length > 64 * 1024) return;
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    const now = Date.now();
    const me = ws.deserializeAttachment() || { id: -1 };
    this.tick(now); // the clock also moves with every message (a timer may not survive hibernation)
    if (msg.t === 'hola') {
      const r = this.room.join(msg, now);
      if (r.id < 0) {
        this.dispatch(r.out, ws);
        ws.close(4001, 'rechazado');
        return;
      }
      // The same player on another tab or an old connection: only the newest one stays.
      for (const other of this.ctx.getWebSockets()) {
        if (other !== ws && (other.deserializeAttachment() || {}).id === r.id) {
          other.serializeAttachment({ id: -1 });
          try { other.close(4000, 'reemplazada'); } catch { /* already closed */ }
        }
      }
      ws.serializeAttachment({ id: r.id });
      this.dispatch(r.out, ws);
    } else if (me.id >= 0) {
      const out = this.room.receive(me.id, msg, now);
      this.dispatch(out, ws);
      if (msg.t === 'ping' || msg.t === 'reloj') return; // nothing changed: no write
    } else return;
    await this.save();
    this.schedule();
  }

  async webSocketClose(ws) {
    await this.gone(ws);
  }

  async webSocketError(ws) {
    await this.gone(ws);
  }

  async gone(ws) {
    const me = ws.deserializeAttachment() || { id: -1 };
    ws.serializeAttachment({ id: -1 });
    if (!this.room || me.id < 0) return;
    const still = this.ctx.getWebSockets().some((o) => o !== ws && (o.deserializeAttachment() || {}).id === me.id);
    if (still) return;
    this.dispatch(this.room.leave(me.id, Date.now()), null);
    await this.save();
  }

  /** Sends each {to, msg}: to a player id, '*' (everyone in the room) or -1 (the socket that asked). */
  dispatch(out, origin) {
    if (!out.length) return;
    const sockets = this.ctx.getWebSockets().map((ws) => [ws, (ws.deserializeAttachment() || {}).id ?? -1]);
    for (const { to, msg } of out) {
      const text = JSON.stringify(msg);
      for (const [ws, id] of sockets) {
        const hit = to === '*' ? id >= 0 : to === -1 ? ws === origin : id === to;
        if (!hit) continue;
        try { ws.send(text); } catch { /* closing */ }
      }
    }
  }

  /** While a match runs, a timer advances live phases and expires deadlines (it keeps the object awake). */
  schedule() {
    if (this.room && this.room.ticking && !this.timer) {
      this.timer = setInterval(() => this.tick(), TICK_MS);
    } else if ((!this.room || !this.room.ticking) && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  tick(now = Date.now()) {
    if (!this.room) return;
    try {
      const out = this.room.tick(now);
      this.dispatch(out, null);
      // Steps granted (`pasos`) are not saved one by one: only phase changes (a deadline closing).
      if (out.some(({ msg }) => msg.t !== 'pasos')) this.save().catch((e) => console.error('save', e));
      this.schedule();
    } catch (e) {
      console.error('tick', e);
    }
  }

  async save() {
    if (this.room) await this.ctx.storage.put('room', this.room.toJSON());
  }

  async alarm() {
    if (this.ctx.getWebSockets().length) {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
      return;
    }
    this.room = null;
    await this.ctx.storage.deleteAll();
  }
}
