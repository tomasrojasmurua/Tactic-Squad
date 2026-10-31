// On-screen controls for touch devices (>= 44px targets, safe-area aware), kept to the minimum so
// the map stays clear (the rest is gestures: input/TouchController.js, ui/RadialMenu.js):
// a right-hand column — LISTO, the GO groups during a turn, the contextual DESACTIVAR, and
// ESPERAR / DESHACER / BORRAR as discreet icons — and a ⋯ button with the utilities (see all,
// cameras, fullscreen, music, help, a lesson's restart). Emits EV.REQUEST.
import { EV } from '../core/events.js';
import { canOrderDefuse, isGoReady, codeInUse, codeWaiting, goStatus, lastUserIndex, holdCode } from '../sim/queries.js';
import { ENTRY } from '../config/balance.js';
import { isDecisionPhase, pilotsDrone, showCameras, inRecon } from '../session/Session.js';
import { HUD, GO_GROUPS } from '../config/ui.js';
import { el, setText, toggle, setHidden } from './dom.js';
import { ICON } from './icons.js';
import { T } from './texts.js';
import { fullscreenSupported } from './device.js';

export class TouchBar {
  constructor(root, bus) {
    this.bus = bus;
    this.column = el('div', 'tbar tbar-col');
    this.row = el('div', 'tbar tbar-row'); // the ⋯ menu's list
    this.more = el('button', 'tbtn tbar-more', '<span class="ti">⋯</span>');
    this.more.setAttribute('aria-label', T.touch.more);
    this.more.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.bus.emit(EV.REQUEST, { action: 'more' });
    });
    this.action = el('div', 'tbar tbar-action'); // the contextual DESACTIVAR, centered at the bottom
    root.append(this.column, this.more, this.row, this.action);

    // Most buttons act on press (instant feel). Destructive ones act on release
    // INSIDE the button, so a thumb that lands there by accident can slide off.
    const ON_RELEASE = ['restart', 'clear'];
    const mk = (parent, cls, icon, label, action) => {
      const b = el('button', `tbtn ${cls}`, `<span class="ti">${icon}</span><span class="tl">${label}</span>`);
      b.setAttribute('aria-label', label);
      const fire = () => {
        this.bus.emit(EV.REQUEST, { action });
        if (parent === this.row && action !== 'more') this.bus.emit(EV.REQUEST, { action: 'more' }); // a menu item closes the menu
      };
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
      const g = GO_GROUPS[code];
      const b = mk(this.column, 'go grp', `<b>GO <i class="gdot">${g.glyph}</i></b>`, '', `go_${code}`);
      b.style.setProperty('--g', g.color);
      return { code, b, label: b.querySelector('.tl') };
    });
    // ESPERAR opens the GO colors next to the column (ui.holdMenu): the group is chosen, not cycled.
    this.defuse = mk(this.action, 'plant', ICON.bomb, T.touch.defuse, 'defuse');
    this.hold = mk(this.column, 'mini', ICON.hold, T.touch.hold, 'holdMenu');
    this.holdMenu = el('div', 'hold-menu');
    for (const code of [...ENTRY.goCodes, 'now']) {
      const g = GO_GROUPS[code];
      const b = el('button', 'tbtn hm', g ? `<span class="ti"><i class="gdot">${g.glyph}</i></span><span class="tl">${g.name}</span>` : `<span class="ti">✕</span><span class="tl">${T.touch.noHold}</span>`);
      if (g) b.style.setProperty('--g', g.color);
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.bus.emit(EV.REQUEST, { action: `when_${code}` });
      });
      this.holdMenu.appendChild(b);
    }
    root.appendChild(this.holdMenu);
    this.undo = mk(this.column, 'mini', ICON.undo, T.touch.undo, 'undo');
    this.clear = mk(this.column, 'mini', ICON.trash, T.touch.clear, 'clear');

    this.restart = mk(this.row, 'restart', ICON.restart, T.touch.restart, 'restart'); // set apart from the utilities (CSS)
    this.overview = mk(this.row, 'overview', ICON.overview, T.flow.overview, 'overview');
    this.cams = mk(this.row, 'cams', ICON.camera, T.touch.cameras, 'cameras');
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
    toggle(this.action, 'on', show);
    toggle(this.more, 'on', show);
    toggle(this.row, 'on', show && session.ui.moreOpen);
    toggle(this.more, 'active', show && session.ui.moreOpen);
    if (!show) return;
    const phase = session.phase;
    const deciding = isDecisionPhase(session);
    // LISTO ends a decision phase; a running turn cannot be paused (no button), a system pause resumes here.
    const waiting = deciding && session.online && session.online.waiting; // online: LISTO sent, the rival still deciding
    setText(this.execLabel, phase === 'drone' ? T.touch.recall : !deciding ? T.touch.resume : waiting ? T.flow.online.waitingShort : inRecon(sim, session) ? T.actions.endRecon : session.confirm.action === 'ready' ? T.flow.confirmReady : T.touch.ready);
    setHidden(this.exec, !deciding && phase !== 'paused' && !(phase === 'drone' && pilotsDrone(session)));

    const sel = sim.units[session.selectedId];
    const canPlan = phase === 'planning' || phase === 'prep';
    const canEdit = canPlan && !session.helpOpen && sel && sel.alive;
    const disabled = !canEdit || !sel.route.length;
    for (const b of this.routeButtons) {
      if (b.disabled !== disabled) b.disabled = disabled;
      setHidden(b, phase === 'drone' || phase === 'buy'); // nothing to draw while flying the drone or buying
    }
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
    const g = p && p.hold ? GO_GROUPS[holdCode(p)] : null;
    setText(this.holdLabel, g ? g.name : T.touch.hold);
    toggle(this.hold, 'grp', !!g);
    if (g) this.hold.style.setProperty('--g', g.color);
    toggle(this.holdMenu, 'on', show && session.ui.holdMenu && !disabled);
    toggle(this.hold, 'active', session.ui.holdMenu);
    setHidden(this.restart, session.mode !== 'tutorial'); // only a lesson starts over
    setText(this.restartLabel, session.confirm.action === 'restart' ? T.flow.confirmRestart : T.touch.restart);
    // The planning clock is running out: LISTO asks for attention (amber pulse: styles.css [data-attn]).
    const attn = deciding && !session.clock.unlimited && session.clock.left <= HUD.clockWarnSeconds ? '1' : '';
    if ((this.exec.dataset.attn || '') !== attn) this.exec.dataset.attn = attn;
    const armed = session.confirm.action === 'restart' ? '1' : '';
    if ((this.restart.dataset.armed || '') !== armed) this.restart.dataset.armed = armed;
    setHidden(this.defuse, phase !== 'planning' || !canOrderDefuse(sim));
    setHidden(this.cams, !showCameras(sim, session));
    toggle(this.music, 'off', !session.musicOn);
  }
}
