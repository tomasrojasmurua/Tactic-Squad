// An online game on this device: the room's connection (net/Connection.js), the lockstep
// (net/LockstepClient.js) and the game (Game.js builds each round's Simulation and puts the
// screen in its phase). What the menu and the HUD show of it lives in `session.online`:
//
//   session.online = {code, status, me, room, error, quality, waiting, playing, finished, desync, rival}
//     status   the socket: 'connecting' | 'open' | 'retrying' | 'closed'
//     room     the server's last `sala` (players, settings, host)
//     waiting  LISTO sent: waiting for the other player (or the deadline)
//     rival    the other player's name (the score says it instead of "IA")
import { EV } from '../core/events.js';
import { loadPref, savePref } from '../session/storage.js';
import { Connection, createRoom, serverUrl } from './Connection.js';
import { LockstepClient } from './LockstepClient.js';
import { MAP_CHOICES } from '../session/Lobby.js';
import { DEFAULT_MAP } from '../data/maps/index.js';

const NAME_KEY = 'ts.nombre';
const tokenKey = (code) => `ts.sala.${code}`;

export class OnlineSession {
  /**
   * @param deps.game {startRound(info) => Simulation, advanced(), clock(fase), toRoom(), leftRoom()}
   */
  constructor({ session, bus, game }) {
    this.session = session;
    this.bus = bus;
    this.game = game;
    this.conn = null;
    this.client = null;
    session.online = null;
    session.onlineName = this.name;
  }

  /**
   * The page was opened with ?sala=CODE (an invitation, or a reload in the middle of a game):
   * straight back into a room this device already sat in, else the join screen with the code.
   * Returns the menu view to show, or null.
   */
  fromLink() {
    let code = '';
    try {
      code = (new URLSearchParams(location.search).get('sala') || '').toUpperCase();
    } catch { /* no location */ }
    if (!code || !this.available) return null;
    if (loadPref(tokenKey(code), null) && this.name) {
      this.join(code);
      return 'room';
    }
    return 'online';
  }

  /** Is there a server to play on (the deploy wrote its address, or ?servidor=)? */
  get available() {
    return !!serverUrl();
  }

  /** In a match: commands, LISTO and the steps go through the lockstep. */
  get active() {
    return !!(this.client && this.client.sim && this.session.online && this.session.online.playing);
  }

  get name() {
    return loadPref(NAME_KEY, '');
  }

  setName(name) {
    const clean = String(name || '').trim().slice(0, 16);
    if (!clean) return;
    savePref(NAME_KEY, clean);
    this.session.onlineName = clean;
  }

  /** CREAR SALA: a new room on the server, then in it. */
  async create(name) {
    this.setName(name);
    this.state({ code: null, status: 'connecting', error: null });
    try {
      const code = await createRoom();
      this.join(code, name);
    } catch {
      this.state({ status: 'closed', error: 'servidor' });
    }
  }

  /** UNIRSE (or the invitation's link): into the room with that code. */
  join(code, name = this.name) {
    code = String(code || '').trim().toUpperCase();
    if (!code) return;
    this.setName(name);
    this.leave(false);
    this.session.online = { code, status: 'connecting', me: -1, room: null, error: null, quality: 'bad', waiting: false, playing: false, finished: false, desync: false, rival: '' };
    this.client = new LockstepClient({
      send: (m) => this.conn && this.conn.send(m),
      createSim: (info) => this.game.startRound(info),
      buildSim: (info) => this.game.buildRound(info),
      on: (type, data) => this.onEvent(type, data),
    });
    this.client.batching = true; // one message per frame (OnlineSession.update)
    this.conn = new Connection({
      code,
      hello: () => ({ nombre: this.name, token: loadPref(tokenKey(code), null) }),
      onMessage: (msg) => this.client.receive(msg),
      onStatus: (status) => this.state({ status }),
    });
    this.conn.open();
    // The address keeps the room: a reload (or the phone killing the tab) comes back to it.
    try {
      const url = new URL(location.href);
      url.searchParams.set('sala', code);
      history.replaceState(null, '', url);
    } catch { /* no history (file://) */ }
  }

  /**
   * The screen stays on during a match (a phone that dims and locks would drop the socket):
   * the Screen Wake Lock where there is one, asked again when the page comes back.
   */
  keepAwake(on) {
    this.awake = on;
    if (!on) {
      if (this.wakeLock) this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
      return;
    }
    if (this.wakeLock || typeof navigator === 'undefined' || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then((lock) => {
      if (!this.awake) return lock.release();
      this.wakeLock = lock;
      lock.addEventListener('release', () => { if (this.wakeLock === lock) this.wakeLock = null; });
    }).catch(() => {});
    if (!this.wakeWatch) {
      this.wakeWatch = () => { if (this.awake && document.visibilityState === 'visible') this.keepAwake(true); };
      document.addEventListener('visibilitychange', this.wakeWatch);
    }
  }

  /** Out of the room (VOLVER in the lobby, MENÚ in a match). */
  leave(toMenu = true) {
    this.keepAwake(false);
    if (this.conn) this.conn.close();
    this.conn = null;
    this.client = null;
    const was = this.session.online;
    this.session.online = null;
    try {
      const url = new URL(location.href);
      if (url.searchParams.has('sala')) {
        url.searchParams.delete('sala');
        history.replaceState(null, '', url);
      }
    } catch { /* no history */ }
    if (was && toMenu) this.game.leftRoom();
  }

  state(fields) {
    if (this.session.online) Object.assign(this.session.online, fields);
  }

  send(msg) {
    if (this.conn) this.conn.send(msg);
  }

  // ---- lobby (the room's screen: ui/RoomView.js)

  /** {equipo?, listo?, mapa?, duracion?, nombre?} */
  lobby(fields) {
    this.send({ t: 'lobby', ...fields });
  }

  /** The classes this player chose for each side (session/Lobby.js roles). */
  sendRoles(roles) {
    this.send({ t: 'clases', roles: { attackers: [...roles.attackers], defenders: [...roles.defenders] } });
  }

  start() {
    this.send({ t: 'iniciar' });
  }

  /** After the match: the host takes everyone back to the room (a rematch). */
  backToRoom() {
    this.send({ t: 'volver' });
  }

  // ---- the match

  command(cmd) {
    if (this.client) this.client.command(cmd);
  }

  /** LISTO (a decision phase, or the round's result): sent once; the phase closes when everyone is. */
  ready() {
    if (!this.client || !this.client.deciding) return;
    this.client.ready();
    this.state({ waiting: true });
  }

  /** May the sim take one more step (the server granted it)? */
  canStep(reserve = 0) {
    return !!this.client && this.client.canStep(reserve);
  }

  afterStep() {
    if (this.client) this.client.afterStep();
  }

  /** Steps granted and not run yet (the game runs a few extra per frame to catch up). */
  get behind() {
    return this.client ? this.client.behind : 0;
  }

  /** Every frame: heartbeat, the server's clock, the connection light. */
  update() {
    if (!this.conn) return;
    this.conn.update();
    this.client.flushOrders();
    const nudge = this.client && this.client.clockMsg();
    if (nudge) this.send(nudge);
    this.state({ quality: this.conn.quality });
  }

  onEvent(type, data) {
    const o = this.session.online;
    if (!o) return;
    switch (type) {
      case 'hola':
        savePref(tokenKey(o.code), data.token);
        o.me = data.id;
        o.error = null;
        // This device's classes for both sides (the roster's, kept from the last game) go in at once.
        if (!this.session.lobby.roles.attackers.includes(null) && !this.session.lobby.roles.defenders.includes(null)) this.sendRoles(this.session.lobby.roles);
        return;
      case 'sala': {
        o.room = data;
        // The other side's names (the score says them) and, in a 2v2, the teammate's.
        const me = data.jugadores.find((j) => j.id === o.me);
        const others = data.jugadores.filter((j) => j.id !== o.me);
        o.rival = others.filter((j) => !me || j.equipo !== me.equipo).map((j) => j.nombre).join(' y ');
        o.mate = me ? others.find((j) => j.equipo === me.equipo) || null : null;
        // The host's room starts on his last map (a concrete one: "al azar" draws now).
        if (data.anfitrion === o.me && !data.ajustes.mapa && data.estado === 'lobby') {
          const pref = this.session.lobby.map;
          const ids = MAP_CHOICES.filter((id) => id !== 'random');
          this.lobby({ mapa: ids.includes(pref) ? pref : DEFAULT_MAP, duracion: this.session.lobby.bestOf });
        }
        if (data.estado === 'lobby' && o.playing && !this.client.sim) o.playing = false;
        return;
      }
      case 'round':
        o.slots = this.client.slots;
        this.keepAwake(true);
        o.playing = true;
        o.finished = false;
        o.waiting = false;
        return;
      case 'advance':
        o.waiting = false;
        this.game.advanced(data);
        return;
      case 'fase':
        o.waiting = this.client.isReady;
        o.listos = data.listos;
        this.game.clock(data);
        return;
      case 'resync':
        // The phones had drifted apart: this one now has the host's state (the screen follows).
        o.desync = true;
        this.game.resynced();
        if (data.de !== o.me) this.bus.emit(EV.NOTICE, { code: 'onlineResync', count: 0 });
        return;
      case 'puestos':
        // 2v2: a teammate gone too long; his operators are this player's now.
        o.slots = this.client.slots;
        if (data.para === o.me) {
          this.bus.emit(EV.NOTICE, { code: 'onlineTakeOver', count: 0 });
          this.game.ownersChanged();
        }
        return;
      case 'abandono':
        o.error = data.quien === o.me ? 'abandonaste' : 'abandono';
        return;
      case 'fin':
        o.finished = true;
        o.waiting = false;
        return;
      case 'lobby':
        this.keepAwake(false);
        o.playing = false;
        o.finished = false;
        this.game.toRoom();
        return;
      case 'error':
        o.error = data.motivo;
        return;
      default:
    }
  }
}
