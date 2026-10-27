// Full-screen overlays: the menu (title: ui/Menu.js), round result, controls help,
// and the fatal / unsupported-browser message.
import { EV } from '../core/events.js';
import { teamUnits } from '../sim/queries.js';
import { el, setText, toggle, formatTime } from './dom.js';
import { T } from './texts.js';
import { buildDebrief } from './debriefText.js';
import { Menu } from './Menu.js';

export class Screens {
  constructor(root, bus) {
    this.bus = bus;

    // The menu: main, JUGAR and the lobby (ui/Menu.js).
    this.title = el('div', 'screen title');
    this.title.innerHTML = `
      <div class="title-box">
        <h1>TACTIC <em>SQUAD</em></h1>
        <div class="subtitle">${T.subtitle}</div>
      </div>`;
    this.menu = new Menu(this.title.querySelector('.title-box'), bus);
    this.title.addEventListener('pointerdown', (e) => e.stopPropagation());

    this.result = el('div', 'screen result hidden');
    this.result.innerHTML = `
      <div class="result-box">
        <div class="match-line"></div>
        <h2></h2>
        <div class="reason"></div>
        <div class="stats">
          <div>${T.result.stats.time}<b class="st-time"></b></div>
          <div>${T.result.stats.kills}<b class="st-kills"></b></div>
          <div>${T.result.stats.losses}<b class="st-losses"></b></div>
          <div>${T.result.stats.accuracy}<b class="st-acc"></b></div>
        </div>
        <div class="why"><div class="why-title">${T.result.whyLost}</div><ul class="why-list"></ul><div class="tip"></div></div>
        <div class="match-pay"></div>
        <div class="result-actions">
          <button class="btn primary next-round"></button>
          <button class="btn primary retry-plan">${T.result.retryButton}</button>
          <button class="btn new-plan">${T.result.newPlanButton}</button>
          <button class="btn reroll">${T.flow.rerollButton}</button>
          <button class="btn to-menu">${T.flow.menu.button}</button>
        </div>
        <div class="retry"></div>
      </div>`;
    // The overlay lets the battlefield be seen (and ignores touches); only its buttons are live.
    this.result.style.pointerEvents = 'none';
    const actions = this.result.querySelector('.result-actions');
    this.resultActions = actions;
    actions.style.pointerEvents = 'auto';
    actions.style.display = 'none'; // shown only with the result (update): never steals touches
    actions.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.result.querySelector('.next-round').addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'nextRound' }));
    this.result.querySelector('.retry-plan').addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'restart' }));
    this.result.querySelector('.new-plan').addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'newPlan' }));
    this.result.querySelector('.reroll').addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'reroll' }));
    this.result.querySelector('.to-menu').addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'menu' }));

    this.help = el('div', 'screen help hidden');
    this.help.innerHTML = `
      <div class="help-box">
        <h3>${T.help.title}</h3>
        <div class="help-scroll">
          <table class="desk-only">${T.help.rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
          <table class="touch-only">${T.touch.rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
        </div>
        <div class="help-options"><button class="btn stop-contact"></button></div>
        <div class="help-actions"><button class="btn primary close">${T.help.close}</button><button class="btn to-menu">${T.flow.menu.button}</button></div>
      </div>`;
    this.help.querySelector('.close').addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'help' }));
    this.helpMenu = this.help.querySelector('.to-menu');
    this.helpMenu.addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'menu' }));
    this.help.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.stopContact = this.help.querySelector('.stop-contact');
    this.stopContact.addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'stopOnContact' }));

    this.resultShown = false;
    root.append(this.title, this.result, this.help);
  }

  setTouch(on) {
    this.touch = on;
  }

  update(sim, session) {
    toggle(this.title, 'hidden', session.phase !== 'title');
    if (session.phase === 'title') this.menu.update(session);
    toggle(this.help, 'hidden', !session.helpOpen);
    if (session.helpOpen) {
      setText(this.helpMenu, session.confirm.action === 'menu' ? T.flow.menu.confirm : T.flow.menu.button);
      setText(this.stopContact, T.flow.stopOnContact(session.progress.stopOnContact));
      const sc = session.progress.stopOnContact ? '1' : '';
      if ((this.stopContact.dataset.on || '') !== sc) this.stopContact.dataset.on = sc;
    }
    const showResult = session.phase === 'ended' && sim.outcome;
    toggle(this.result, 'hidden', !showResult);
    if (showResult && !this.resultShown) this.fillResult(sim, session.team, session.mode === 'match' ? session.match : null);
    if (!!showResult !== this.resultShown) this.resultActions.style.display = showResult ? '' : 'none';
    this.resultShown = !!showResult;
  }

  fillResult(sim, team, match) {
    const o = sim.outcome;
    const win = o.winner === team;
    this.result.classList.toggle('win', win);
    this.result.classList.toggle('lose', !win);
    this.result.classList.toggle('in-match', !!match);
    setText(this.result.querySelector('h2'), match && match.over ? (match.over === 'player' ? T.match.won : T.match.lost) : win ? T.result.win : T.result.lose);
    // A match: the score, what each one earned, and the way forward (no retries).
    const last = match && match.history[match.history.length - 1];
    setText(this.result.querySelector('.match-line'), match ? `${T.match.round(last.round)} · ${T.match.score(match.score.player, match.score.ai)}` : '');
    const pay = this.result.querySelector('.match-pay');
    // What the player's attackers earned, or the half-time switch (a defender earns nothing).
    pay.hidden = !match || !!match.over || (team !== 'attackers' && !last.switched);
    if (match && !match.over && last.switched) setText(pay, T.match.switchSides(match.team));
    else if (match && !match.over && team === 'attackers') setText(pay, `${T.match.payTitle}: ${teamUnits(sim, team).map((u, i) => T.match.pay(u.name, last.income[i])).join(' · ')}`);
    setText(this.result.querySelector('.next-round'), match && match.over ? T.match.again : T.match.next);
    setText(this.result.querySelector('.reason'), (team === 'defenders' ? T.result.reasonDefend : T.result.reason)[o.reason]);
    const squad = teamUnits(sim, team);
    const kills = squad.reduce((s, u) => s + u.stats.kills, 0);
    const shots = squad.reduce((s, u) => s + u.stats.shots, 0);
    const hits = squad.reduce((s, u) => s + u.stats.hits, 0);
    setText(this.result.querySelector('.st-time'), formatTime(o.time));
    setText(this.result.querySelector('.st-kills'), kills);
    setText(this.result.querySelector('.st-losses'), squad.filter((u) => !u.alive).length);
    setText(this.result.querySelector('.st-acc'), shots ? `${Math.round((hits / shots) * 100)}%` : '—');

    setText(this.result.querySelector('.retry'), match ? T.match.toWin(match.toWin) : this.touch ? T.result.retryTouch : T.result.retry);

    // Why: one line per fallen operator / outcome note, plus the tip that matters most.
    const { lines, tip } = buildDebrief(sim, team);
    const list = this.result.querySelector('.why-list');
    list.innerHTML = '';
    for (const line of lines) {
      const li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    }
    setText(this.result.querySelector('.tip'), tip || '');
    this.result.querySelector('.why').hidden = !lines.length;
    this.result.querySelector('.tip').hidden = !tip;
  }
}

export function showFatal(root, error, isWebGL) {
  const box = el('div', 'fatal');
  box.innerHTML = `<div><p>${isWebGL ? T.webgl : T.fatal}</p>${isWebGL ? '' : `<pre></pre>`}</div>`;
  if (!isWebGL) box.querySelector('pre').textContent = String(error && error.stack ? error.stack : error);
  root.appendChild(box);
}
