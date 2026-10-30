// The online menu (net/OnlineSession.js keeps the state in session.online):
//   online  the player's name, CREAR SALA, or a room's code and UNIRSE
//   room    the room's lobby: its code and INVITAR (WhatsApp or the phone's share sheet), the two
//           sides with their players (ready, connection), the host's format and map, ELEGIR CLASES,
//           LISTO (the guest) or EMPEZAR (the host, once the guest is ready)
// Emits EV.REQUEST {action: 'onlineCreate' {name} | 'onlineJoin' {name, code} | 'room_team_<side>' |
// 'room_ready' | 'room_map_<id>' | 'room_bestOf_<n>' | 'room_mode_<1v1|2v2>' | 'room_pick' | 'room_start' | 'back'}.
import { EV } from '../core/events.js';
import { MAPS } from '../data/maps/index.js';
import { BEST_OF, MAP_CHOICES } from '../session/Lobby.js';
import { CODE_CHARS } from '../net/roomLogic.js';
import { TEAM_LABEL } from '../config/squad.js';
import { el, setText, toggle } from './dom.js';
import { T } from './texts.js';

const TEAMS = ['attackers', 'defenders'];
const BASE_URL = 'https://tomasrojasmurua.github.io/Tactic-Squad/';

/** The invitation's link: this page's address (or the published one) with ?sala=CODE. */
export function inviteUrl(code) {
  let url;
  try {
    url = new URL(location.protocol.startsWith('http') ? location.href : BASE_URL);
  } catch {
    url = new URL(BASE_URL);
  }
  url.search = '';
  url.hash = '';
  const server = new URLSearchParams(location.search).get('servidor');
  if (server) url.searchParams.set('servidor', server); // a test server travels with the link
  url.searchParams.set('sala', code);
  return url.toString();
}

export class RoomView {
  constructor(bus, button) {
    this.bus = bus;
    const O = T.flow.online;
    const L = T.flow.lobby;
    const M = T.flow.menu;

    // Create or join
    this.join = el(
      'div',
      'menu-view lobby online',
      `<h2 class="mv-title">${O.title}</h2>
      <p class="lb-note on-note">${O.note}</p>
      <div class="on-grid">
        <label class="lb-row"><span class="lb-l">${O.name}</span><input class="on-input on-name" maxlength="16" autocomplete="nickname" placeholder="${O.namePlaceholder}"></label>
        <div class="lb-row on-create"></div>
        <label class="lb-row"><span class="lb-l">${O.code}</span><input class="on-input on-code" maxlength="6" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="${O.codePlaceholder}"></label>
        <div class="lb-row on-join"></div>
      </div>
      <div class="on-error lb-note"></div>
      <div class="lb-actions"></div>`,
    );
    const q = (s) => this.join.querySelector(s);
    this.nameInput = q('.on-name');
    this.codeInput = q('.on-code');
    this.codeInput.addEventListener('input', () => {
      // Only the room code's letters (no look-alikes), uppercase.
      const v = this.codeInput.value.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/[01OIL]/g, '');
      if (v !== this.codeInput.value) this.codeInput.value = v;
    });
    const createBtn = button('primary', O.create, O.createNote, null);
    createBtn.addEventListener('click', () => this.request('onlineCreate', { name: this.nameInput.value.trim() }));
    q('.on-create').append(createBtn);
    this.joinBtn = button('', O.join, null, null);
    this.joinBtn.addEventListener('click', () => {
      if (this.codeInput.value.length < 4) return this.codeInput.focus();
      this.request('onlineJoin', { name: this.nameInput.value.trim(), code: this.codeInput.value });
    });
    q('.on-join').append(this.joinBtn);
    this.joinError = q('.on-error');
    q('.lb-actions').append(button('back', M.back, null, 'back'));
    for (const input of [this.nameInput, this.codeInput]) {
      input.addEventListener('keydown', (e) => {
        e.stopPropagation(); // typing is not a game shortcut
        if (e.key === 'Enter') (input === this.codeInput ? this.joinBtn : createBtn).click();
      });
    }

    // The room's lobby
    this.room = el(
      'div',
      'menu-view lobby room',
      `<div class="rm-head"><h2 class="mv-title rm-code"></h2><span class="rm-net"></span><span class="rm-status"></span></div>
      <div class="lb-cols">
        <div class="lb-col">
          <div class="lb-row rm-sides"></div>
        </div>
        <div class="lb-col">
          <div class="lb-row"><span class="lb-l">${O.mode}</span><div class="lb-opts rm-mode"></div></div>
          <div class="lb-row"><span class="lb-l">${L.format}</span><div class="lb-opts bestof"></div></div>
          <div class="lb-row"><span class="lb-l">${L.map}</span><div class="lb-opts rm-maps"></div><div class="lb-note rm-hostnote">${O.hostSets}</div></div>
          <div class="lb-note rm-error"></div>
        </div>
      </div>
      <div class="lb-actions"></div>`,
    );
    const r = (s) => this.room.querySelector(s);
    this.codeTitle = r('.rm-code');
    this.net = r('.rm-net');
    this.status = r('.rm-status');
    this.roomError = r('.rm-error');
    this.hostNote = r('.rm-hostnote');
    const opt = (parent, label, action, key) => {
      const b = el('button', 'btn lb-opt');
      setText(b, label);
      b.dataset.key = key;
      b.addEventListener('click', () => this.request(action));
      parent.appendChild(b);
      return b;
    };
    this.invite = el('button', 'btn lb-opt rm-invite');
    setText(this.invite, O.invite);
    this.invite.addEventListener('click', () => this.share());
    r('.rm-head').append(this.invite);
    // Each side: its players (two seats in a 2v2; an empty one says so) and "pasarme aquí".
    this.sides = TEAMS.map((team) => {
      const box = el('div', `rm-side ${team}`, `<span class="lb-side">${TEAM_LABEL[team]}</span>`);
      const seats = [0, 1].map(() => {
        const row = el('div', 'lb-player', '<b class="rm-name"></b><span class="st"></span>');
        box.append(row);
        return { row, name: row.firstChild, st: row.lastChild };
      });
      const move = el('button', 'btn lb-opt rm-move');
      setText(move, O.switchHere);
      move.addEventListener('click', () => this.request(`room_team_${team}`));
      box.append(move);
      r('.rm-sides').append(box);
      return { team, box, seats, move };
    });
    this.modes = ['1v1', '2v2'].map((m) => opt(r('.rm-mode'), O.modes[m], `room_mode_${m}`, m));
    this.bestOf = BEST_OF.map((n) => opt(r('.bestof'), L.bestOf(n), `room_bestOf_${n}`, n));
    this.maps = MAP_CHOICES.map((id) => opt(r('.rm-maps'), MAPS[id] ? MAPS[id].name : L.randomMap, `room_map_${id}`, id));
    this.pick = button('', O.pick, null, 'room_pick');
    this.go = el('button', 'btn primary lb-ready', '<span></span>');
    this.goLabel = this.go.firstChild;
    this.go.addEventListener('click', () => this.request(this.isHost ? 'room_start' : 'room_ready'));
    r('.lb-actions').append(this.go, this.pick, button('back', O.leave, null, 'back'));
  }

  get roots() {
    return [this.join, this.room];
  }

  request(action, data = {}) {
    this.bus.emit(EV.REQUEST, { action, ...data });
  }

  /** INVITAR: the phone's share sheet when there is one, else WhatsApp (and the link copied). */
  async share() {
    const o = this.online;
    if (!o || !o.code) return;
    const url = inviteUrl(o.code);
    const text = T.flow.online.inviteText(o.code, url);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tactic Squad', text });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    try { await navigator.clipboard.writeText(url); } catch { /* no clipboard */ }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  update(session) {
    const view = session.lobby.view;
    toggle(this.join, 'on', view === 'online');
    toggle(this.room, 'on', view === 'room');
    this.online = session.online;
    if (view === 'online') this.updateJoin(session);
    if (view === 'room') this.updateRoom(session);
  }

  updateJoin(session) {
    if (!this.shownJoin) {
      // Coming in: the saved name, and the invitation's code when the page was opened with one.
      this.shownJoin = true;
      if (!this.nameInput.value) this.nameInput.value = session.onlineName || '';
      const code = (new URLSearchParams(location.search).get('sala') || '').toUpperCase();
      if (code && [...code].every((c) => CODE_CHARS.includes(c))) this.codeInput.value = code;
    }
    setText(this.joinError, '');
  }

  updateRoom(session) {
    this.shownJoin = false;
    const O = T.flow.online;
    const o = session.online;
    if (!o) return;
    const room = o.room;
    setText(this.codeTitle, o.code ? O.room(o.code) : O.status.connecting);
    this.invite.disabled = !o.code;
    setText(this.status, o.status === 'open' ? '' : O.status[o.status] || '');
    this.net.dataset.q = o.status === 'open' ? o.quality : 'bad';
    setText(this.roomError, o.error ? O.errors[o.error] || o.error : '');
    const me = room && room.jugadores.find((j) => j.id === o.me);
    this.isHost = !!room && room.anfitrion === o.me;
    const settings = room ? room.ajustes : { duracion: 3, mapa: null, modo: '1v1' };
    const perSide = settings.modo === '2v2' ? 2 : 1;
    for (const s of this.sides) {
      const players = room ? room.jugadores.filter((j) => j.equipo === s.team) : [];
      s.seats.forEach((seat, k) => {
        const p = players[k];
        seat.row.hidden = k >= perSide;
        const mine = !!p && p.id === o.me;
        setText(seat.name, p ? `${p.nombre}${mine ? ` (${O.you})` : ''}${p.id === room.anfitrion ? ' ★' : ''}` : O.free);
        setText(seat.st, !p ? '' : !p.conectado ? O.offline : p.listo || p.id === room.anfitrion ? O.ready : O.notReady);
        toggle(seat.st, 'ok', !!p && p.conectado && (p.listo || p.id === room.anfitrion));
        toggle(seat.row, 'you', mine);
        toggle(seat.row, 'empty', !p);
      });
      s.move.hidden = !me || me.equipo === s.team;
    }
    for (const b of this.modes) {
      toggle(b, 'on', b.dataset.key === settings.modo);
      b.disabled = !this.isHost || (b.dataset.key === '1v1' && room && room.jugadores.length > 2);
    }
    for (const b of this.bestOf) {
      toggle(b, 'on', +b.dataset.key === settings.duracion);
      b.disabled = !this.isHost;
    }
    for (const b of this.maps) {
      toggle(b, 'on', b.dataset.key === settings.mapa);
      b.disabled = !this.isHost;
      b.hidden = !this.isHost && b.dataset.key === 'random';
    }
    this.hostNote.hidden = this.isHost;
    const full = room && room.jugadores.length === perSide * 2 && room.jugadores.every((j) => j.conectado);
    const guestReady = full && room.jugadores.every((j) => j.id === room.anfitrion || (j.listo && j.conectado));
    if (this.isHost) {
      setText(this.goLabel, !full ? O.startNeedsPlayer : !guestReady ? O.startNeeds : O.start);
      this.go.disabled = !guestReady || !settings.mapa;
    } else {
      setText(this.goLabel, me && me.listo ? O.notReadyAgain : O.imReady);
      this.go.disabled = !me;
    }
    toggle(this.go, 'short', this.go.disabled);
  }
}
