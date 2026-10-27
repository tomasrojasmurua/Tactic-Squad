// The menu inside the title screen (session/Lobby.js has its rules):
//   main    JUGAR · TUTORIAL (with the pitch and the how-to)
//   lessons the tutorial's lessons (config/lessons.js): done ✓, the next one
//           recommended, the ones still to come disabled
//   play    CONTRA LA IA · MULTIJUGADOR (coming soon) · VOLVER
//   lobby   format (a single round, best of 3 / 5 / 7), starting side, map
//           (more coming soon), the player's classes per slot for each side,
//           who is in and ready; LISTO starts once everyone is
// Emits EV.REQUEST {action: 'play' | 'vsAi' | 'tutorial' | 'lesson_<id>' | 'back' | 'lobbyReady' |
// 'lobby_bestOf_<n>' | 'lobby_side_<team>' | 'lobby_role_<team>_<i>_<roleId>'}.
import { EV } from '../core/events.js';
import { ROLES } from '../config/operators.js';
import { SQUAD, DEFENDER_NAME } from '../config/squad.js';
import { MAPS } from '../data/maps/index.js';
import { BEST_OF, canPick, pickRoles } from '../session/Lobby.js';
import { LESSONS, nextLesson } from '../config/lessons.js';
import { el, setText, toggle } from './dom.js';
import { T } from './texts.js';

export class Menu {
  constructor(box, bus) {
    this.bus = bus;
    const M = T.flow.menu;
    const L = T.flow.lobby;
    const button = (cls, label, note, action) => {
      const b = el('button', `btn menu-btn ${cls}`, `<span class="mb-l">${label}</span>${note ? `<span class="mb-n">${note}</span>` : ''}`);
      if (action) b.addEventListener('click', () => this.request(action));
      return b;
    };

    // Main
    this.main = el('div', 'menu-view main', `<p class="pitch">${M.pitch}</p><div class="menu"></div><ol class="howto desk-only">${T.howTo.desk.map(([n, v]) => `<li><b>${n}</b>${v}</li>`).join('')}</ol><div class="hint desk-only">${T.startHint}</div>`);
    const mainMenu = this.main.querySelector('.menu');
    mainMenu.append(button('primary play', M.play, M.playNote, 'play'));
    this.tutorialBtn = button('tutorial', M.tutorial, M.tutorialNote, 'tutorial');
    this.tutorialBadge = el('span', 'mb-badge');
    this.tutorialBtn.appendChild(this.tutorialBadge);
    mainMenu.append(this.tutorialBtn);

    // Tutorial: the lessons
    const LS = T.flow.lessons;
    this.lessons = el('div', 'menu-view lessons', `<h2 class="mv-title">${LS.title}</h2><div class="menu lesson-list"></div><div class="menu lesson-back"></div>`);
    this.lessonButtons = LESSONS.map((l) => {
      const b = button(`lesson lesson-${l.id}`, LS.items[l.id].title, LS.items[l.id].note, l.ready ? `lesson_${l.id}` : null);
      const badge = el('span', 'mb-badge');
      b.appendChild(badge);
      b.appendChild(el('span', 'mb-min', LS.minutes(l.minutes)));
      b.disabled = !l.ready;
      this.lessons.querySelector('.lesson-list').appendChild(b);
      return { l, b, badge };
    });
    this.lessons.querySelector('.lesson-back').append(button('back', M.back, null, 'back'));

    // Jugar
    this.play = el('div', 'menu-view play', `<h2 class="mv-title">${M.play}</h2><div class="menu"></div>`);
    const playMenu = this.play.querySelector('.menu');
    playMenu.append(button('primary vs-ai', M.vsAi, M.vsAiNote, 'vsAi'));
    const multi = button('soon', M.multi, M.soon, null);
    multi.disabled = true;
    playMenu.append(multi, button('back', M.back, null, 'back'));

    // Lobby
    this.lobby = el(
      'div',
      'menu-view lobby',
      `<h2 class="mv-title">${L.title}</h2>
      <div class="lb-cols">
        <div class="lb-col">
          <div class="lb-row"><span class="lb-l">${L.format}</span><div class="lb-opts bestof"></div><div class="lb-note fmt-note"></div></div>
          <div class="lb-row"><span class="lb-l">${L.side}</span><div class="lb-opts side"></div></div>
          <div class="lb-row"><span class="lb-l">${L.map}</span><div class="lb-opts map"></div></div>
          <div class="lb-row"><span class="lb-l">${L.players}</span><div class="lb-players"></div></div>
        </div>
        <div class="lb-col team"><span class="lb-l">${L.team}</span><div class="lb-note">${L.teamNote}</div></div>
      </div>
      <div class="lb-actions"></div>`,
    );
    const opt = (parent, label, action, key) => {
      const b = el('button', 'btn lb-opt');
      setText(b, label);
      b.dataset.key = key;
      if (action) b.addEventListener('click', () => this.request(action));
      parent.appendChild(b);
      return b;
    };
    const q = (s) => this.lobby.querySelector(s);
    this.bestOf = BEST_OF.map((n) => opt(q('.bestof'), L.bestOf(n), `lobby_bestOf_${n}`, n));
    this.fmtNote = q('.fmt-note');
    this.side = ['attackers', 'defenders'].map((t) => opt(q('.side'), L.sides[t], `lobby_side_${t}`, t));
    this.mapBtn = opt(q('.map'), '', null, 'map');
    this.mapBtn.classList.add('on');
    const more = opt(q('.map'), L.moreMaps, null, 'soon');
    more.disabled = true;
    this.players = q('.lb-players');
    this.youState = null;
    this.players.innerHTML = `<div class="lb-player you"><b>${L.you}</b><span class="st"></span></div><div class="lb-player ai"><b>${L.ai}</b><span class="st ok">${L.aiReady}</span></div>`;
    this.youState = this.players.querySelector('.you .st');
    // The player's classes, per side and slot.
    this.roleButtons = [];
    const team = q('.lb-col.team');
    for (const side of ['attackers', 'defenders']) {
      const box = el('div', `lb-team ${side}`, `<div class="lb-side"></div>`);
      setText(box.firstChild, L.sides[side === 'attackers' ? 'attackersTeam' : 'defendersTeam']);
      for (let i = 0; i < 3; i++) {
        const row = el('div', 'lb-slot', `<span class="lb-name"></span><div class="lb-opts"></div>`);
        const name = row.firstChild;
        setText(name, side === 'attackers' ? SQUAD[i].callsign : `${DEFENDER_NAME} ${i + 1}`);
        if (side === 'attackers') name.style.color = SQUAD[i].color;
        for (const id of pickRoles(side)) {
          const b = opt(row.children[1], ROLES[id].label, `lobby_role_${side}_${i}_${id}`, id);
          b.title = ROLES[id].blurb;
          this.roleButtons.push({ b, side, i, id });
        }
        box.appendChild(row);
      }
      team.appendChild(box);
    }
    const actions = q('.lb-actions');
    this.ready = el('button', 'btn primary lb-ready', `${L.ready}<span class="key desk-only">${L.readyKey}</span>`);
    this.ready.addEventListener('click', () => this.request('lobbyReady'));
    actions.append(this.ready, button('back', M.back, null, 'back'));

    box.append(this.main, this.lessons, this.play, this.lobby);
  }

  request(action) {
    this.bus.emit(EV.REQUEST, { action });
  }

  update(session) {
    const lobby = session.lobby;
    const view = lobby.view;
    toggle(this.main, 'on', view === 'main');
    toggle(this.play, 'on', view === 'play');
    toggle(this.lessons, 'on', view === 'lessons');
    toggle(this.lobby, 'on', view === 'lobby');
    if (view === 'main') {
      // A first-timer sees it recommended; then how many lessons are done (all: green, styles.css).
      const n = session.tutorial.lessonsDone.length;
      const all = !nextLesson(session.tutorial.lessonsDone);
      setText(this.tutorialBadge, n ? T.flow.menu.lessonsDone(n, LESSONS.length) : T.flow.menu.tutorialNew);
      toggle(this.tutorialBtn, 'done', n > 0 && all);
      toggle(this.tutorialBtn, 'some', n > 0 && !all);
    }
    if (view === 'lessons') {
      const done = session.tutorial.lessonsDone;
      const next = nextLesson(done);
      for (const { l, b, badge } of this.lessonButtons) {
        const state = !l.ready ? 'soon' : done.includes(l.id) ? 'done' : l === next ? 'next' : '';
        toggle(b, 'done', state === 'done');
        toggle(b, 'next', state === 'next');
        badge.hidden = !state;
        setText(badge, state ? T.flow.lessons[state] : '');
      }
    }
    if (view !== 'lobby') return;
    const L = T.flow.lobby;
    for (const b of this.bestOf) toggle(b, 'on', +b.dataset.key === lobby.bestOf);
    setText(this.fmtNote, L.formatNote(lobby.bestOf));
    for (const b of this.side) toggle(b, 'on', b.dataset.key === lobby.side);
    setText(this.mapBtn, MAPS[lobby.map].name);
    for (const { b, side, i, id } of this.roleButtons) {
      const mine = lobby.roles[side][i] === id;
      toggle(b, 'on', mine);
      toggle(b, 'off', !mine && !canPick(lobby, side, i, id));
    }
    setText(this.youState, lobby.ready ? L.youReady : L.youWaiting);
    toggle(this.youState, 'ok', lobby.ready);
  }
}
