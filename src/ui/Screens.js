// Full-screen overlays: title/briefing, round result, controls help,
// and the fatal / unsupported-browser message.
import { EV } from '../core/events.js';
import { teamUnits } from '../sim/queries.js';
import { el, setText, toggle, formatTime } from './dom.js';
import { T } from './texts.js';
import { buildDebrief } from './debriefText.js';

export class Screens {
  constructor(root, bus) {
    this.bus = bus;

    this.title = el('div', 'screen title');
    this.title.innerHTML = `
      <div class="title-box">
        <h1>TACTIC <em>SQUAD</em></h1>
        <div class="subtitle">${T.subtitle}</div>
        <p class="brief">${T.briefing}</p>
        <ol class="howto touch-only">${T.howTo.touch.map(([n, v]) => `<li><b>${n}</b>${v}</li>`).join('')}</ol>
        <ol class="howto desk-only">${T.howTo.desk.map(([n, v]) => `<li><b>${n}</b>${v}</li>`).join('')}</ol>
        <div class="controls">
          ${T.hints.map(([k, v]) => `<div><span class="key">${k}</span>${v}</div>`).join('')}
        </div>
        <button class="btn primary start">${T.start}</button>
        <button class="btn tutorial">${T.flow.tutorialStart}</button>
        <div class="hint">${T.startHint}</div>
        <div class="hint touch-hint">${T.touch.startHint}</div>
      </div>`;
    this.title.querySelector('.start').addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'start' }));
    this.title.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.title.querySelector('.tutorial').addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'tutorial' }));
    // The whole title card is the start button (touch and desktop: "click or Enter").
    this.title.addEventListener('click', (e) => {
      if (!e.target.closest('button')) bus.emit(EV.REQUEST, { action: 'start' });
    });

    this.result = el('div', 'screen result hidden');
    this.result.innerHTML = `
      <div class="result-box">
        <h2></h2>
        <div class="reason"></div>
        <div class="stats">
          <div>${T.result.stats.time}<b class="st-time"></b></div>
          <div>${T.result.stats.kills}<b class="st-kills"></b></div>
          <div>${T.result.stats.losses}<b class="st-losses"></b></div>
          <div>${T.result.stats.accuracy}<b class="st-acc"></b></div>
        </div>
        <div class="why"><div class="why-title">${T.result.whyLost}</div><ul class="why-list"></ul><div class="tip"></div></div>
        <div class="result-actions">
          <button class="btn primary retry-plan">${T.result.retryButton}</button>
          <button class="btn new-plan">${T.result.newPlanButton}</button>
          <button class="btn reroll">${T.flow.rerollButton}</button>
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
    this.result.querySelector('.retry-plan').addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'restart' }));
    this.result.querySelector('.new-plan').addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'newPlan' }));
    this.result.querySelector('.reroll').addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'reroll' }));

    this.help = el('div', 'screen help hidden');
    this.help.innerHTML = `
      <div class="help-box">
        <h3>${T.help.title}</h3>
        <table class="desk-only">${T.help.rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
        <table class="touch-only">${T.touch.rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
        <div class="help-options">
          <button class="btn opt-contact"></button>
          <button class="btn opt-idle"></button>
        </div>
        <button class="btn close">${T.help.close}</button>
      </div>`;
    this.help.querySelector('.close').addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'help' }));
    // Smart-pause preferences (saved per device by the session).
    this.optContact = this.help.querySelector('.opt-contact');
    this.optIdle = this.help.querySelector('.opt-idle');
    this.optContact.addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'autoPauseContact' }));
    this.optIdle.addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'autoPauseIdle' }));
    this.help.addEventListener('pointerdown', (e) => e.stopPropagation());

    this.resultShown = false;
    root.append(this.title, this.result, this.help);
  }

  setTouch(on) {
    this.touch = on;
  }

  update(sim, session) {
    toggle(this.title, 'hidden', session.phase !== 'title');
    toggle(this.help, 'hidden', !session.helpOpen);
    if (session.helpOpen) {
      setText(this.optContact, T.flow.autoPauseContact(session.autoPause.contact));
      setText(this.optIdle, T.flow.autoPauseIdle(session.autoPause.idle));
      this.optContact.dataset.on = session.autoPause.contact ? '1' : '';
      this.optIdle.dataset.on = session.autoPause.idle ? '1' : '';
    }
    const showResult = session.phase === 'ended' && sim.outcome;
    toggle(this.result, 'hidden', !showResult);
    if (showResult && !this.resultShown) this.fillResult(sim, session.team);
    if (!!showResult !== this.resultShown) this.resultActions.style.display = showResult ? '' : 'none';
    this.resultShown = !!showResult;
  }

  fillResult(sim, team) {
    const o = sim.outcome;
    const win = o.winner === team;
    this.result.classList.toggle('win', win);
    this.result.classList.toggle('lose', !win);
    setText(this.result.querySelector('h2'), win ? T.result.win : T.result.lose);
    setText(this.result.querySelector('.reason'), T.result.reason[o.reason]);
    const squad = teamUnits(sim, team);
    const kills = squad.reduce((s, u) => s + u.stats.kills, 0);
    const shots = squad.reduce((s, u) => s + u.stats.shots, 0);
    const hits = squad.reduce((s, u) => s + u.stats.hits, 0);
    setText(this.result.querySelector('.st-time'), formatTime(o.time));
    setText(this.result.querySelector('.st-kills'), kills);
    setText(this.result.querySelector('.st-losses'), squad.filter((u) => !u.alive).length);
    setText(this.result.querySelector('.st-acc'), shots ? `${Math.round((hits / shots) * 100)}%` : '—');

    setText(this.result.querySelector('.retry'), this.touch ? T.result.retryTouch : T.result.retry);

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
