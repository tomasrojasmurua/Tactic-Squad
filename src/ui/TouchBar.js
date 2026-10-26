// On-screen controls for touch devices (>= 44px targets, safe-area aware):
// a right-hand column (LISTO, GO, hold, undo, clear) and a bottom
// row (contextual defuse, restart, see all, fullscreen, music, help). Emits EV.REQUEST.
import { EV } from '../core/events.js';
import { canOrderDefuse, isGoReady, codeInUse, codeWaiting, goStatus, lastUserIndex, holdCode } from '../sim/queries.js';
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
    // One button per GO group in use, pressed during the turn ("now!").
    this.goButtons = ENTRY.goCodes.map((code) => {
      const b = mk(this.column, 'go', `<b>GO ${code}</b>`, '', `go_${code}`);
      return { code, b, label: b.querySelector('.tl') };
    });
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
    setText(this.execLabel, !deciding ? T.touch.resume : session.confirm.action === 'ready' ? T.flow.confirmReady : T.touch.ready);
    setHidden(this.exec, !deciding && phase !== 'paused');

    const sel = sim.units[session.selectedId];
    const canPlan = phase === 'planning' || phase === 'prep';
    const canEdit = canPlan && !session.helpOpen && sel && sel.alive;
    const disabled = !canEdit || !sel.route.length;
    for (const b of this.routeButtons) if (b.disabled !== disabled) b.disabled = disabled;
    // GO groups in use: live only while the turn runs (or is paused); the label says how many are in position.
    const team = session.team;
    const live = (phase === 'running' || phase === 'paused') && !session.replay.exec;
    for (const g of this.goButtons) {
      const used = codeInUse(sim, team, g.code) && phase !== 'ended';
      setHidden(g.b, !used);
      if (!used) continue;
      if (g.b.disabled !== !live) g.b.disabled = !live;
      const st = goStatus(sim, team, g.code);
      setText(g.label, T.flow.goReady(st.ready, st.total));
      toggle(g.b, 'ready', live && codeWaiting(sim, team, g.code));
      toggle(g.b, 'all', live && isGoReady(sim, team, g.code));
    }
    const last = sel && sel.alive ? lastUserIndex(sel) : -1;
    const p = last >= 0 ? sel.route[last] : null;
    setText(this.holdLabel, p && p.hold ? `${T.touch.hold} ${holdCode(p)}` : T.touch.hold);
    setText(this.restartLabel, session.confirm.action === 'restart' ? T.flow.confirmRestart : T.touch.restart);
    // The planning clock is running out: LISTO asks for attention (amber pulse: styles.css [data-attn]).
    const attn = deciding && !session.clock.unlimited && session.clock.left <= HUD.clockWarnSeconds ? '1' : '';
    if ((this.exec.dataset.attn || '') !== attn) this.exec.dataset.attn = attn;
    const armed = session.confirm.action === 'restart' ? '1' : '';
    if ((this.restart.dataset.armed || '') !== armed) this.restart.dataset.armed = armed;
    setHidden(this.defuse, phase !== 'planning' || !canOrderDefuse(sim));
    toggle(this.music, 'off', !session.musicOn);
  }
}
