// Door entry picker (desktop and touch): when the selected operator's last
// waypoint (or the "?" door point the player tapped: session.pointTarget) is
// next to a doorway, a strip of buttons says HOW he goes through it
// (sim/entries.js): open, kick, crack, flash, grenade, charge — and a second
// one WHEN: right away or with GO A / B / C. Modes that do not fit that
// doorway or need gear he no longer has are disabled; the count of each item
// left is shown. Emits EV.REQUEST {action: 'entry_<mode>' | 'when_<now|A|B|C>'}.
import { EV } from '../core/events.js';
import { ENTRY } from '../config/balance.js';
import { controllableUnit, entryDoorwayAt, entryModeFits, gearLeft, canOrderDefuse, ENTRY_GEAR, holdCode } from '../sim/queries.js';
import { canEditRoutes, targetIndex } from '../session/Session.js';
import { el, setText, toggle, setHidden } from './dom.js';
import { ENTRY_ICON } from './icons.js';
import { T } from './texts.js';

const CHOICES = ['none', ...ENTRY.modes];

export class EntryPicker {
  constructor(root, bus) {
    this.node = el('div', 'entry-picker', `<div class="ep-head"><span class="ep-title">${T.entry.title}</span><span class="ep-code"></span><span class="ep-hint"></span></div><div class="ep-row"></div><div class="ep-when"><span class="ep-wl">${T.entry.when}</span></div>`);
    this.title = this.node.querySelector('.ep-title');
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
    const when = this.node.querySelector('.ep-when');
    this.when = new Map();
    for (const code of ['now', ...ENTRY.goCodes]) {
      const b = el('button', 'wbtn', code === 'now' ? T.entry.now : `GO ${code}`);
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        bus.emit(EV.REQUEST, { action: `when_${code}` });
      });
      when.appendChild(b);
      this.when.set(code, b);
    }
    root.appendChild(this.node);
  }

  update(sim, session) {
    const u = canEditRoutes(session) && session.phase !== 'ended' ? controllableUnit(sim, session.selectedId, session.team) : null;
    const i = u ? targetIndex(session, u) : -1;
    const p = i >= 0 ? u.route[i] : null;
    const k = p ? (p.door >= 0 ? p.door : entryDoorwayAt(sim.world, p.x, p.y)) : -1;
    // The defuse button takes the same spot on phones: the bomb wins.
    const show = k >= 0 && !(session.touch && canOrderDefuse(sim));
    toggle(this.node, 'on', show);
    if (!show) return;
    toggle(this.node, 'ask', !!p.ask);
    setText(this.title, p.ask ? T.entry.askTitle : T.entry.title);
    const current = p.ask ? null : p.entry || 'none';
    for (const [mode, { b, count }] of this.buttons) {
      const item = ENTRY_GEAR[mode];
      const left = item ? gearLeft(u, item, i) : -1;
      const ok = mode === 'none' || (entryModeFits(sim, k, mode) && (!item || left > 0 || current === mode));
      if (b.disabled !== !ok) b.disabled = !ok;
      toggle(b, 'active', current === mode);
      setText(count, item ? T.entry.left(Math.max(0, left)) : '');
    }
    for (const [code, b] of this.when) toggle(b, 'active', !p.ask && (code === 'now' ? !p.hold : p.hold && holdCode(p) === code));
    setText(this.code, p.hold ? `GO ${holdCode(p)}` : '');
    setHidden(this.code, !p.hold);
    setText(this.hint, p.ask ? T.entry.askHint : T.entry.hints[current]);
  }
}
