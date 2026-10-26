// On-screen controls for touch devices (>= 44px targets, safe-area aware):
// a right-hand column (LISTO, GO, hold, undo, clear) and a bottom
// row (contextual defuse, restart, see all, fullscreen, music, help). Emits EV.REQUEST.
import { EV } from '../core/events.js';
import { canOrderDefuse, isGoReady, codeInUse, nextGoCode, lastUserIndex, holdCode } from '../sim/queries.js';
import { scheduledGo } from '../sim/round.js';
import { ENTRY } from '../config/balance.js';
import { isDecisionPhase } from '../session/Session.js';
import { HUD } from '../config/ui.js';
import { el, setText, toggle, setHidden } from './dom.js';
import { ICON } from './icons.js';
import { T } from './texts.js';
import { fullscreenSupported } from './device.js';

export class TouchBar {
  constructor(root, bus) {
    this.bus = bus;
    this.column = el('div', 'tbar tbar-col');
    this.row = el('div', 'tbar tbar-row');
    root.append(this.column, this.row);

    // Most buttons act on press (instant feel). Destructive ones act on release
    // INSIDE the button, so a thumb that lands there by accident can slide off.
    const ON_RELEASE = ['restart', 'clear'];
    const mk = (parent, cls, icon, label, action) => {
      const b = el('button', `tbtn ${cls}`, `<span class="ti">${icon}</span><span class="tl">${label}</span>`);
      const fire = () => this.bus.emit(EV.REQUEST, { action });
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!ON_RELEASE.includes(action)) fire();
      });
      if (ON_RELEASE.includes(action)) {
        b.addEventListener('pointerup', (e) => {
          e.stopPropagation();
          const r = b.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) fire();
        });
      }
      parent.appendChild(b);
      return b;
    };
    this.exec = mk(this.column, 'primary big', ICON.play, T.touch.ready, 'ready');
    this.go = mk(this.column, 'go', `<b>GO</b>`, T.touch.go, 'go');
    this.hold = mk(this.column, '', ICON.hold, T.touch.hold, 'hold');
    this.undo = mk(this.column, '', ICON.undo, T.touch.undo, 'undo');
    this.clear = mk(this.column, '', ICON.trash, T.touch.clear, 'clear');

    this.defuse = mk(this.row, 'plant', ICON.bomb, T.touch.defuse, 'defuse');
    this.restart = mk(this.row, 'restart', ICON.restart, T.touch.restart, 'restart'); // set apart from the utilities (CSS)
    this.overview = mk(this.row, 'overview', ICON.overview, T.flow.overview, 'overview');
    this.full = mk(this.row, '', ICON.fullscreen, T.touch.fullscreen, 'fullscreen');
    this.music = mk(this.row, 'music', ICON.music, T.touch.music, 'music');
    this.help = mk(this.row, '', ICON.help, T.touch.help, 'help');
    if (!fullscreenSupported()) this.full.hidden = true;

    this.execLabel = this.exec.querySelector('.tl');
    this.goLabel = this.go.querySelector('.tl');
    this.goCode = this.go.querySelector('.ti b');
    this.holdLabel = this.hold.querySelector('.tl');
    this.restartLabel = this.restart.querySelector('.tl');
    this.routeButtons = [this.hold, this.undo, this.clear];
  }

  update(sim, session) {
    const show = session.touch && session.phase !== 'title';
    toggle(this.column, 'on', show);
    toggle(this.row, 'on', show);
    if (!show) return;
    const phase = session.phase;
    const deciding = isDecisionPhase(session);
    // LISTO ends a decision phase; a running turn cannot be paused (no button), a system pause resumes here.
    setText(this.execLabel, deciding ? T.touch.ready : T.touch.resume);
    setHidden(this.exec, !deciding && phase !== 'paused');

    const sel = sim.units[session.selectedId];
    const canPlan = phase === 'planning' || phase === 'prep';
    const canEdit = canPlan && !session.helpOpen && sel && sel.alive;
    const disabled = !canEdit || !sel.route.length;
    for (const b of this.routeButtons) if (b.disabled !== disabled) b.disabled = disabled;
    // GO schedules the first code (the one already scheduled, else the first in use) for the
    // next turn: each touch moves it (when everyone is ready, 1·2·3·4 s, off). One big button.
    const team = session.team;
    const used = ENTRY.goCodes.filter((c) => codeInUse(sim, team, c) || scheduledGo(sim, team, c));
    const next = used.find((c) => scheduledGo(sim, team, c)) || used[0] || null;
    const plan = next ? scheduledGo(sim, team, next) : null;
    setHidden(this.go, !next || phase === 'ended');
    if (this.go.disabled !== !canPlan) this.go.disabled = !canPlan;
    toggle(this.go, 'armed', !!plan);
    setText(this.goLabel, plan ? T.flow.goAt(plan.at) : canPlan ? T.flow.goOff : T.touch.go);
    setText(this.goCode, next && used.length > 1 ? `GO ${next}` : 'GO');
    const last = sel && sel.alive ? lastUserIndex(sel) : -1;
    const p = last >= 0 ? sel.route[last] : null;
    setText(this.holdLabel, p && p.hold ? `${T.touch.hold} ${holdCode(p)}` : T.touch.hold);
    setText(this.restartLabel, session.confirm.action === 'restart' ? T.flow.confirmRestart : T.touch.restart);
    // The planning clock is running out: LISTO asks for attention (amber pulse: styles.css [data-attn]).
    const attn = deciding && !session.clock.unlimited && session.clock.left <= HUD.clockWarnSeconds ? '1' : '';
    if ((this.exec.dataset.attn || '') !== attn) this.exec.dataset.attn = attn;
    const armed = session.confirm.action === 'restart' ? '1' : '';
    if ((this.restart.dataset.armed || '') !== armed) this.restart.dataset.armed = armed;
    toggle(this.go, 'ready', !!next && nextGoCode(sim, team) === next);
    toggle(this.go, 'all', !!next && isGoReady(sim, team, next));
    setHidden(this.defuse, phase !== 'planning' || !canOrderDefuse(sim));
    toggle(this.music, 'off', !session.musicOn);
  }
}
