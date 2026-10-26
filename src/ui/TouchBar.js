// On-screen controls for touch devices (>= 44px targets, safe-area aware):
// a right-hand column (execute/pause, GO, hold, undo, clear) and a bottom
// row (contextual defuse, restart, see all, fullscreen, music, help). Emits EV.REQUEST.
import { EV } from '../core/events.js';
import { canOrderDefuse, isGoReady, codeInUse, nextGoCode, lastUserIndex, holdCode } from '../sim/queries.js';
import { ENTRY } from '../config/balance.js';
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
    this.exec = mk(this.column, 'primary big', ICON.play, T.touch.execute, 'toggle');
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

    this.execIcon = this.exec.querySelector('.ti');
    this.execLabel = this.exec.querySelector('.tl');
    this.execState = 'play';
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
    const running = phase === 'running';
    const state = running ? 'pause' : 'play';
    if (state !== this.execState) {
      this.execState = state;
      this.execIcon.innerHTML = ICON[state];
    }
    setText(this.execLabel, phase === 'planning' ? T.touch.execute : running ? T.touch.pause : T.touch.resume);
    setHidden(this.exec, phase === 'ended');

    const sel = sim.units[session.selectedId];
    const canEdit = phase !== 'ended' && !session.helpOpen && sel && sel.alive;
    const disabled = !canEdit || !sel.route.length;
    for (const b of this.routeButtons) if (b.disabled !== disabled) b.disabled = disabled;
    // GO releases the next code someone waits for (A, then B, then C): one big button, the thumb never hunts.
    const team = session.team;
    const used = ENTRY.goCodes.filter((c) => codeInUse(sim, team, c));
    const next = nextGoCode(sim, team) || used[0] || null;
    setHidden(this.go, !next || phase === 'ended');
    // GO only works while time runs: while planning it says so and is disabled.
    const goLater = phase === 'planning';
    if (this.go.disabled !== goLater) this.go.disabled = goLater;
    setText(this.goLabel, goLater ? T.flow.goLater : T.touch.go);
    setText(this.goCode, next && used.length > 1 ? `GO ${next}` : 'GO');
    const last = sel && sel.alive ? lastUserIndex(sel) : -1;
    const p = last >= 0 ? sel.route[last] : null;
    setText(this.holdLabel, p && p.hold ? `${T.touch.hold} ${holdCode(p)}` : T.touch.hold);
    setText(this.restartLabel, session.confirm.action === 'restart' ? T.flow.confirmRestart : T.touch.restart);
    // Smart pause: the resume button asks for attention (amber pulse: styles.css [data-attn]).
    const attn = phase === 'paused' && session.pauseReason === 'idle' ? '1' : '';
    if ((this.exec.dataset.attn || '') !== attn) this.exec.dataset.attn = attn;
    const armed = session.confirm.action === 'restart' ? '1' : '';
    if ((this.restart.dataset.armed || '') !== armed) this.restart.dataset.armed = armed;
    toggle(this.go, 'ready', !!next && nextGoCode(sim, team) === next);
    toggle(this.go, 'all', !!next && isGoReady(sim, team, next)); // everyone of that code in position: the moment to press it
    setHidden(this.defuse, !canOrderDefuse(sim));
    toggle(this.music, 'off', !session.musicOn);
  }
}
