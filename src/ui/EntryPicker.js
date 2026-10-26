// Door entry picker (desktop and touch): when the selected operator's last
// waypoint is next to a doorway, a strip of buttons says HOW he goes through
// it (sim/entries.js): open, kick, crack, flash, grenade, charge. Modes that
// do not fit that doorway or need gear he no longer has are disabled; the
// count of each item left is shown. Emits EV.REQUEST {action: 'entry_<mode>'}.
import { EV } from '../core/events.js';
import { ENTRY } from '../config/balance.js';
import { controllableUnit, lastUserIndex, entryDoorwayAt, entryModeFits, gearLeft, canOrderDefuse, ENTRY_GEAR, holdCode } from '../sim/queries.js';
import { canEditRoutes } from '../session/Session.js';
import { el, setText, toggle, setHidden } from './dom.js';
import { ENTRY_ICON } from './icons.js';
import { T } from './texts.js';

const CHOICES = ['none', ...ENTRY.modes];

export class EntryPicker {
  constructor(root, bus) {
    this.node = el('div', 'entry-picker', `<div class="ep-head"><span class="ep-title">${T.entry.title}</span><span class="ep-code"></span><span class="ep-hint"></span></div><div class="ep-row"></div>`);
    this.code = this.node.querySelector('.ep-code');
    this.hint = this.node.querySelector('.ep-hint');
    const row = this.node.querySelector('.ep-row');
    this.buttons = new Map();
    for (const mode of CHOICES) {
      const b = el('button', `ebtn ebtn-${mode}`, `<span class="ei">${ENTRY_ICON[mode]}</span><span class="el">${mode === 'none' ? T.entry.none : T.entry.modes[mode]}</span><span class="en"></span>`);
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        bus.emit(EV.REQUEST, { action: `entry_${mode}` });
      });
      row.appendChild(b);
      this.buttons.set(mode, { b, count: b.querySelector('.en') });
    }
    root.appendChild(this.node);
  }

  update(sim, session) {
    const u = canEditRoutes(session) && session.phase !== 'ended' ? controllableUnit(sim, session.selectedId, session.team) : null;
    const i = u ? lastUserIndex(u) : -1;
    const p = i >= 0 ? u.route[i] : null;
    const k = p ? entryDoorwayAt(sim.world, p.x, p.y) : -1;
    // The defuse button takes the same spot on phones: the bomb wins.
    const show = k >= 0 && !(session.touch && canOrderDefuse(sim));
    toggle(this.node, 'on', show);
    if (!show) return;
    const current = p.entry || 'none';
    for (const [mode, { b, count }] of this.buttons) {
      const item = ENTRY_GEAR[mode];
      const left = item ? gearLeft(u, item, i) : -1;
      const ok = mode === 'none' || (entryModeFits(sim, k, mode) && (!item || left > 0 || current === mode));
      if (b.disabled !== !ok) b.disabled = !ok;
      toggle(b, 'active', current === mode);
      setText(count, item ? T.entry.left(Math.max(0, left)) : '');
    }
    setText(this.code, p.hold ? `GO ${holdCode(p)}` : '');
    setHidden(this.code, !p.hold);
    setText(this.hint, T.entry.hints[current]);
  }
}
