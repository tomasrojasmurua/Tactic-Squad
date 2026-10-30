// The roster (the menu's `pick` view, session/Lobby.js has its rules): a pool
// of characters per side, each with its own emblem; 3 of them make the squad.
// Touching one shows it in detail (weapon, kit, traits) with AÑADIR; touching
// a squad slot empties it. In a match a tab per side (both are picked).
// Emits EV.REQUEST {action: 'lobby_inspect_<team>_<id>' | 'lobby_add_<team>_<id>' |
// 'lobby_remove_<team>_<i>' | 'lobby_pickSide_<team>' | 'lobbyReady' | 'back'}.
import { EV } from '../core/events.js';
import { ROLES } from '../config/operators.js';
import { WEAPONS } from '../config/weapons.js';
import { UNIT, TRAP } from '../config/balance.js';
import { SQUAD, DEFENDER_NAME } from '../config/squad.js';
import { canAdd, freeSlot, pickRoles, pickSides, pickMissing } from '../session/Lobby.js';
import { MAPS } from '../data/maps/index.js';
import { MapPreview } from './MapPreview.js';
import { el, setText, toggle } from './dom.js';
import { ROLE_EMBLEM, GEAR_ICON, WEAPON_ICONS } from './icons.js';
import { T } from './texts.js';

const TEAMS = ['attackers', 'defenders'];

/** Classes of the design still to come, shown locked in the pool until they exist (none now). */
const SOON = { attackers: [], defenders: [] };

/** Each character's color (its emblem and card accent). */
export const ROLE_COLOR = {
  assault: '#ff7a52',
  entry: '#ffb02e',
  scout: '#9be15d',
  defender: '#9fb4c4',
  anchor: '#4fa3ff',
  roamer: '#c58bff',
  trapper: '#f0d34a',
  shield: '#8fb3d9',
  marksman: '#e6dcb4',
  grenadier: '#c9d65a',
  lookout: '#4fd1c5',
  sniper: '#ff6f91',
  shotgunner: '#ff9f43',
};

// Weapon bars: each stat against the best weapon there is (1 = the best).
const W = Object.values(WEAPONS);
const avg = (r) => (r[0] + r[1]) / 2;
const best = {
  damage: Math.max(...W.map((w) => avg(w.damage))),
  rate: Math.min(...W.map((w) => w.fireInterval)),
  accuracy: Math.min(...W.map((w) => w.spread)),
  moving: Math.min(...W.map((w) => w.spread + w.movingSpread)),
};
export function weaponBars(w) {
  return {
    damage: avg(w.damage) / best.damage,
    rate: best.rate / w.fireInterval,
    accuracy: best.accuracy / w.spread,
    moving: best.moving / (w.spread + w.movingSpread),
  };
}

/** A class's traits as lines of text (what it does differently from the standard soldier). */
export function roleTraits(id) {
  const P = T.flow.pick;
  const r = ROLES[id];
  const lines = [];
  if (r.ability && P.abilities[r.ability]) lines.push(P.abilities[r.ability]);
  if (r.sharpEars) lines.push(P.flags.sharpEars);
  if (r.cutsWire) lines.push(P.flags.cutsWire);
  if (id === 'trapper') lines.push(P.traps(TRAP.perTrapper));
  if (r.wires) lines.push(P.flags.wires(r.wires));
  if (r.cameras) lines.push(P.flags.cameras(r.cameras));
  for (const [k, v] of Object.entries(r.modifiers)) {
    if (!P.mods[k] || v === 1) continue;
    const pct = Math.round((v - 1) * 100);
    lines.push(P.mods[k](`${pct > 0 ? '+' : '−'}${Math.abs(pct)}\u00a0%`));
  }
  if (!lines.length) lines.push(P.baseline);
  return lines;
}

const limitOf = (team, id) => (team === 'attackers' ? (ROLES[id].unique ? 1 : 3) : ROLES[id].max);

export class Roster {
  constructor(bus, menuButton) {
    this.bus = bus;
    const P = T.flow.pick;
    const L = T.flow.lobby;
    this.root = el(
      'div',
      'menu-view lobby pick',
      `<div class="pk-head"><h2 class="mv-title">${P.title}</h2><button class="btn pk-map"><span class="pk-mn"></span><span class="pk-mv"></span></button><div class="lb-opts pk-sides"></div></div>
      <div class="lb-note pk-note"></div>
      <div class="rs-body">
        <div class="rs-left"><div class="rs-pool"></div><div class="rs-squad"></div></div>
        <div class="rs-detail"></div>
      </div>
      <div class="lb-actions"><div class="lb-players"></div></div>`,
    );
    const q = (s) => this.root.querySelector(s);
    this.note = q('.pk-note');
    // The map in play: its name, and its card (plan and reading) on a tap, to pick the squad reading it.
    this.mapTag = q('.pk-map');
    setText(this.mapTag.lastChild, T.flow.mapCard.show);
    this.mapCard = new MapPreview();
    this.mapCard.root.classList.add('pk-card');
    this.mapCard.root.hidden = true;
    this.mapTag.addEventListener('click', () => {
      this.mapCard.root.hidden = !this.mapCard.root.hidden;
      toggle(this.mapTag, 'on', !this.mapCard.root.hidden);
    });
    q('.pk-head').after(this.mapCard.root);

    this.tabs = TEAMS.map((t) => {
      const b = el('button', 'btn lb-opt pk-side', `<span class="pk-sl"></span><span class="pk-n"></span>`);
      b.dataset.key = t;
      setText(b.firstChild, L.sides[t === 'attackers' ? 'attackersTeam' : 'defendersTeam']);
      b.addEventListener('click', () => this.request(`lobby_pickSide_${t}`));
      q('.pk-sides').appendChild(b);
      return { b, n: b.lastChild, t };
    });

    // Pool and squad: one set per side, the other side's hidden.
    this.pools = {};
    this.squads = {};
    this.cards = [];
    this.slots = [];
    for (const team of TEAMS) {
      const pool = el('div', `rs-cards ${team}`);
      for (const id of pickRoles(team)) {
        const c = el('button', 'rs-card', `<span class="rs-em">${ROLE_EMBLEM[id]}</span><span class="rs-name"></span><span class="rs-badge"></span>`);
        c.style.setProperty('--rc', ROLE_COLOR[id]);
        setText(c.querySelector('.rs-name'), ROLES[id].label);
        c.addEventListener('click', () => this.request(`lobby_inspect_${team}_${id}`));
        pool.appendChild(c);
        this.cards.push({ c, badge: c.lastChild, team, id });
      }
      for (const id of SOON[team]) {
        const c = el('button', 'rs-card soon', `<span class="rs-em">${ROLE_EMBLEM[id]}</span><span class="rs-name"></span><span class="rs-badge">${P.soon}</span>`);
        setText(c.querySelector('.rs-name'), P.soonNames[id]);
        c.disabled = true;
        pool.appendChild(c);
      }
      this.pools[team] = pool;
      q('.rs-pool').appendChild(pool);

      const squad = el('div', `rs-slots ${team}`, `<div class="rs-sq">${P.squad}</div>`);
      for (let i = 0; i < 3; i++) {
        const s = el('button', 'rs-slot', `<span class="rs-em"></span><span class="rs-who"><b></b><span></span></span><span class="rs-x">×</span>`);
        const who = s.querySelector('.rs-who');
        setText(who.firstChild, team === 'attackers' ? SQUAD[i].callsign : `${DEFENDER_NAME} ${i + 1}`);
        if (team === 'attackers') who.firstChild.style.color = SQUAD[i].color;
        s.title = P.remove;
        s.addEventListener('click', () => this.request(`lobby_remove_${team}_${i}`));
        squad.appendChild(s);
        this.slots.push({ s, em: s.firstChild, cls: who.lastChild, team, i, id: undefined });
      }
      this.squads[team] = squad;
      q('.rs-squad').appendChild(squad);
    }

    // Detail: rebuilt only when the character shown changes; its buttons are updated every frame.
    this.detail = q('.rs-detail');
    this.shown = null;

    this.players = q('.lb-players');
    this.players.innerHTML = `<div class="lb-player you"><b>${L.you}</b><span class="st"></span></div><div class="lb-player ai"><b>${L.ai}</b><span class="st ok">${P.aiPicks}</span></div>`;
    this.youState = this.players.querySelector('.you .st');
    this.otherName = this.players.querySelector('.ai b');
    this.otherState = this.players.querySelector('.ai .st');
    this.ready = el('button', 'btn primary lb-ready', `<span class="rs-ready"></span><span class="key desk-only">${L.readyKey}</span>`);
    this.readyLabel = this.ready.firstChild;
    this.ready.addEventListener('click', () => this.request('lobbyReady'));
    q('.lb-actions').prepend(this.ready, menuButton);
  }

  request(action) {
    this.bus.emit(EV.REQUEST, { action });
  }

  /** The detail of `id` for `team`: header, weapon, kit and traits, and AÑADIR / QUITAR. */
  buildDetail(team, id) {
    const P = T.flow.pick;
    const r = ROLES[id];
    const w = WEAPONS[r.weapon];
    const bars = weaponBars(w);
    const gear = Object.entries(r.gear || {}).filter(([, n]) => n > 0);
    this.detail.style.setProperty('--rc', ROLE_COLOR[id]);
    this.detail.innerHTML = `
      <div class="rd-head"><span class="rs-em">${ROLE_EMBLEM[id]}</span>
        <div class="rd-title"><b></b><span class="rd-limit"></span></div>
        <div class="rd-acts"><button class="btn rd-add"></button><button class="btn rd-del"></button></div>
      </div>
      <p class="rd-blurb"></p>
      <div class="rd-cols">
        <div class="rd-sec rd-weapon"><h4>${P.weapon}</h4>
          <div class="rd-gun">${WEAPON_ICONS[r.weapon] || ''}<span><b></b><small></small></span></div>
          ${Object.keys(P.stats).map((k) => `<div class="rd-bar"><span>${P.stats[k]}</span><i><em style="width:${Math.round(Math.min(1, bars[k]) * 100)}%"></em></i></div>`).join('')}
        </div>
        <div class="rd-sec"><h4>${P.gear}</h4>
          <div class="rd-gear">${gear.length ? gear.map(([k, n]) => `<span class="rd-item">${GEAR_ICON[k] || ''}<span>${n > 1 ? `${n} × ` : ''}${P.gearName[k] || k}</span></span>`).join('') : `<span class="rd-none">${P.noGear}</span>`}</div>
          <h4>${P.traits}</h4>
          <ul class="rd-traits"><li class="rd-hp"></li>${roleTraits(id).map((t) => `<li>${t}</li>`).join('')}</ul>
        </div>
      </div>`;
    const q = (s) => this.detail.querySelector(s);
    setText(q('.rd-title b'), r.label);
    setText(q('.rd-limit'), P.limit(limitOf(team, id)));
    setText(q('.rd-blurb'), r.blurb);
    setText(q('.rd-gun b'), w.name);
    setText(q('.rd-gun small'), P.mag(w.magazine));
    setText(q('.rd-traits .rd-hp'), P.hp(r.maxHp || UNIT.maxHp));
    this.addBtn = q('.rd-add');
    this.delBtn = q('.rd-del');
    this.addBtn.addEventListener('click', () => this.request(`lobby_add_${team}_${id}`));
    this.delBtn.addEventListener('click', () => {
      const lobby = this.lobby;
      const i = lobby && lobby.roles[team].lastIndexOf(id);
      if (i >= 0) this.request(`lobby_remove_${team}_${i}`);
    });
    setText(this.delBtn, P.removeOne);
  }

  /** `online`: session.online in a room (the other chip is the rival, who also picks blind). */
  update(lobby, online = null) {
    const P = T.flow.pick;
    const L = T.flow.lobby;
    this.lobby = lobby;
    const side = lobby.pickSide;
    const sides = pickSides(lobby);
    setText(this.note, online ? P.noteOnline(sides.length > 1) : P.note(sides.length > 1));
    setText(this.otherName, online ? online.rival || T.flow.online.rival : L.ai);
    setText(this.otherState, P.aiPicks);
    setText(this.mapTag.firstChild, MAPS[lobby.drawn] ? P.map(MAPS[lobby.drawn].name, lobby.map === 'random') : '');
    if (!this.mapCard.root.hidden) this.mapCard.show(lobby.drawn);
    for (const { b, n, t } of this.tabs) {
      toggle(b, 'on', t === side);
      b.hidden = sides.length < 2;
      const have = lobby.roles[t].filter(Boolean).length;
      setText(n, P.count(have));
      toggle(n, 'ok', have === 3);
    }
    for (const t of TEAMS) {
      this.pools[t].hidden = t !== side;
      this.squads[t].hidden = t !== side;
    }
    const ids = lobby.roles[side];
    const seen = lobby.inspect[side];
    for (const { c, badge, team, id } of this.cards) {
      if (team !== side) continue;
      const n = ids.filter((o) => o === id).length;
      toggle(c, 'seen', id === seen);
      toggle(c, 'in', n > 0);
      toggle(c, 'off', n === 0 && !canAdd(lobby, team, id));
      setText(badge, n ? P.inSquad(n) : '');
    }
    for (const sl of this.slots) {
      if (sl.team !== side) continue;
      const id = lobby.roles[side][sl.i];
      if (sl.id === id) continue;
      sl.id = id;
      toggle(sl.s, 'empty', !id);
      sl.s.style.setProperty('--rc', id ? ROLE_COLOR[id] : '');
      sl.em.innerHTML = id ? ROLE_EMBLEM[id] : '';
      setText(sl.cls, id ? ROLES[id].label : P.empty);
      sl.s.disabled = !id;
    }

    const key = `${side}:${seen}`;
    if (this.shown !== key) {
      this.shown = key;
      this.buildDetail(side, seen);
    }
    const inSquad = ids.includes(seen);
    const addable = canAdd(lobby, side, seen);
    this.addBtn.disabled = !addable;
    this.addBtn.hidden = !addable && inSquad; // in and no room for another: just QUITAR
    toggle(this.addBtn, 'primary', addable);
    setText(this.addBtn, addable ? P.add : freeSlot(lobby, side) < 0 ? P.full : P.limitReached(limitOf(side, seen)));
    this.delBtn.hidden = !inSquad;

    // CONFIRMAR: says what is missing until every squad has its 3.
    const missing = pickMissing(lobby);
    toggle(this.ready, 'short', !!missing);
    const short = missing && lobby.roles[missing].filter((o) => !o).length;
    setText(this.readyLabel, !missing ? P.ready : P.missing(short, missing !== side ? P.missingSide[missing] : ''));
    setText(this.youState, lobby.ready ? L.youReady : L.youWaiting);
    toggle(this.youState, 'ok', lobby.ready);
  }
}
