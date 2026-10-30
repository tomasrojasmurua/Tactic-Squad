// The WebSocket to the room (server/worker.js), made for phones: it comes back by itself when
// the network or the page drops it (iOS closes sockets in the background and on a change of
// antenna), says hello again with the player's token so the room puts him back in his seat, and
// measures the round trip with a ping every few seconds (the connection light).
//
// Messages while the socket is down are not queued: the room replays the whole match to a
// player who comes back (net/LockstepClient.js), so nothing old must arrive after that.
import { SERVER_URL } from '../config/server.js';

export const NET = Object.freeze({
  pingMs: 5000, // heartbeat
  retryMs: Object.freeze([300, 1000, 2000, 4000]), // waits between reconnection attempts (the last one repeats)
  goodRtt: 250, // ms: green below, amber up to badRtt, red above (or no answer)
  badRtt: 700,
  staleMs: 12000, // no message for this long: the socket is taken for dead and opened again
});

/** The server's base address (https://...), or '' when there is none (the multiplayer is unavailable). */
export function serverUrl(search = typeof location !== 'undefined' ? location.search : '') {
  const override = new URLSearchParams(search).get('servidor');
  return (override || SERVER_URL || '').replace(/\/$/, '');
}

/** A new room on the server: resolves to its code. */
export async function createRoom(base = serverUrl()) {
  const res = await fetch(`${base}/crear`, { method: 'POST' });
  if (!res.ok) throw new Error(`crear: ${res.status}`);
  const { sala } = await res.json();
  return sala;
}

export class Connection {
  /**
   * @param opts.code     the room's code
   * @param opts.hello    () => {nombre, token}: the `hola` sent on every (re)connection
   * @param opts.onMessage (msg) => void
   * @param opts.onStatus  (status) => void: 'connecting' | 'open' | 'retrying' | 'closed' (by us or for good)
   */
  constructor({ code, hello, onMessage, onStatus, base = serverUrl() }) {
    this.url = `${base.replace(/^http/, 'ws')}/sala/${code}`;
    this.hello = hello;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.ws = null;
    this.status = 'closed';
    this.attempt = 0;
    this.rtt = null;
    this.lastIn = 0;
    this.closedForGood = false;
    this.onVisible = () => {
      if (document.visibilityState === 'visible' && this.status !== 'open' && !this.closedForGood) this.open();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisible);
  }

  setStatus(s) {
    if (this.status === s) return;
    this.status = s;
    this.onStatus(s);
  }

  open() {
    if (this.closedForGood) return;
    clearTimeout(this.retryTimer);
    if (this.ws) this.drop();
    this.setStatus(this.attempt ? 'retrying' : 'connecting');
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch {
      return this.retry();
    }
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.lastIn = performance.now();
      this.setStatus('open');
      ws.send(JSON.stringify({ t: 'hola', ...this.hello() }));
      this.ping();
    };
    ws.onmessage = (e) => {
      this.lastIn = performance.now();
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.t === 'pong') {
        this.rtt = performance.now() - msg.ts;
        return;
      }
      if (msg.t === 'error' && (msg.motivo === 'no-existe' || msg.motivo === 'llena' || msg.motivo === 'en-juego')) this.closedForGood = true;
      this.onMessage(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.closedForGood) this.setStatus('closed');
      else this.retry();
    };
    ws.onerror = () => {}; // onclose follows
  }

  retry() {
    if (this.closedForGood) return;
    this.setStatus('retrying');
    const wait = NET.retryMs[Math.min(this.attempt, NET.retryMs.length - 1)];
    this.attempt++;
    this.retryTimer = setTimeout(() => this.open(), wait);
  }

  drop() {
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onclose = null;
    try { ws.close(); } catch { /* already closed */ }
  }

  send(msg) {
    if (this.ws && this.status === 'open' && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  ping() {
    this.send({ t: 'ping', ts: performance.now() });
  }

  /** Every frame: the heartbeat, and a socket gone quiet is opened again. */
  update(now = performance.now()) {
    if (this.status !== 'open') return;
    if (now - this.lastPing > NET.pingMs || !this.lastPing) {
      this.lastPing = now;
      this.ping();
    }
    if (now - this.lastIn > NET.staleMs) {
      this.rtt = null;
      this.drop();
      this.retry();
    }
  }

  /** The connection light: 'good' | 'fair' | 'bad'. */
  get quality() {
    if (this.status !== 'open' || this.rtt === null) return 'bad';
    return this.rtt < NET.goodRtt ? 'good' : this.rtt < NET.badRtt ? 'fair' : 'bad';
  }

  close() {
    this.closedForGood = true;
    clearTimeout(this.retryTimer);
    this.drop();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisible);
    this.setStatus('closed');
  }
}
