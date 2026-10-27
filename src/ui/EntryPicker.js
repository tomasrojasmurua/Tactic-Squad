// Waypoint menu (desktop and touch), a small popover anchored to the point it
// edits, Door Kickers style: the decision happens where the door is. Next to
// a door it is the door picker (how to go through); everywhere it says when
// (GO group) and at what pace (normal / sigilo) the leg to it is walked.
// It opens when the player asks for it — tapping a "?" door, a waypoint tag or
// a waypoint next to a door (session.pointTarget) — and closes with ×.
// A door nobody decides is simply opened on the way (ENTRY.undecided).
//
//   CÓMO    the three common entries (open, kick, flash) and "más" for the
//           rest (crack, grenade, charge); modes that do not fit the doorway
//           or need gear he no longer has are disabled, gear left is shown
//   CUÁNDO  right away, or with a GO group (a color: config/ui.js GO_GROUPS)
//   LANZAR  a flash / grenade / smoke from this point to wherever the player
//           taps next (session.ui.tossPick); pressing the active one removes it
//
// Emits EV.REQUEST {action: 'entry_<mode>' | 'when_<now|A|B|C>' | 'toss_<item>' | 'pace_<k>' | 'pickerMore' | 'pickerClose'}.
import { EV } from '../core/events.js';
import { ENTRY } from '../config/balance.js';
import { GO_GROUPS } from '../config/ui.js';
import { controllableUnit, entryDoorwayAt, entryModeFits, gearLeft, ENTRY_GEAR, holdCode } from '../sim/queries.js';
import { canEditRoutes, targetIndex } from '../session/Session.js';
import { el, setText, toggle, setStyle } from './dom.js';
import { ENTRY_ICON } from './icons.js';
import { T } from './texts.js';

const MAIN = ['none', 'kick', 'flash'];
const MORE = ['slow', 'frag', 'breach'];
const GAP_PX = 26; // between the door point and the popover
const EDGE_PX = 8; // kept from the screen edges

export class EntryPicker {
  constructor(root, bus) {
    this.bus = bus;
    this.node = el(
      'div',
      'entry-picker',
      `<div class="ep-head"><span class="ep-title"></span><button class="ep-x" aria-label="${T.entry.close}">×</button></div>` +
        `<div class="ep-row ep-main"></div><div class="ep-row ep-more"></div>` +
        `<div class="ep-when"><span class="ep-wl">${T.entry.when}</span></div>` +
        `<div class="ep-pace"><span class="ep-wl">${T.pace.title}</span></div>` +
        `<div class="ep-toss"><span class="ep-wl">${T.entry.toss}</span></div>`,
    );
    this.title = this.node.querySelector('.ep-title');
    this.buttons = new Map();
    const fire = (action) => (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.bus.emit(EV.REQUEST, { action });
    };
    const addMode = (row, mode) => {
      const b = el('button', `ebtn ebtn-${mode}`, `<span class="ei">${ENTRY_ICON[mode]}</span><span class="el">${mode === 'none' ? T.entry.none : T.entry.modes[mode]}</span><span class="en"></span>`);
      b.addEventListener('pointerdown', fire(`entry_${mode}`));
      row.appendChild(b);
      this.buttons.set(mode, { b, count: b.querySelector('.en') });
    };
    const main = this.node.querySelector('.ep-main');
    for (const m of MAIN) addMode(main, m);
    this.moreBtn = el('button', 'ebtn ebtn-more', `<span class="ei">⋯</span><span class="el">${T.entry.more}</span>`);
    this.moreBtn.addEventListener('pointerdown', fire('pickerMore'));
    main.appendChild(this.moreBtn);
    this.moreLabel = this.moreBtn.querySelector('.el');
    this.moreRow = this.node.querySelector('.ep-more');
    for (const m of MORE) addMode(this.moreRow, m);
    this.node.querySelector('.ep-x').addEventListener('pointerdown', fire('pickerClose'));

    const when = this.node.querySelector('.ep-when');
    this.when = new Map();
    for (const code of ['now', ...ENTRY.goCodes]) {
      const g = GO_GROUPS[code];
      const b = el('button', 'wbtn', code === 'now' ? T.entry.now : `<i class="gdot" style="--g:${g.color}">${g.glyph}</i>${g.name}`);
      b.addEventListener('pointerdown', fire(`when_${code}`));
      when.appendChild(b);
      this.when.set(code, b);
    }
    const pace = this.node.querySelector('.ep-pace');
    this.pace = new Map();
    for (const k of ['normal', 'sneak']) {
      const b = el('button', 'wbtn', T.pace[k]);
      b.addEventListener('pointerdown', fire(`pace_${k}`));
      pace.appendChild(b);
      this.pace.set(k, b);
    }
    const toss = this.node.querySelector('.ep-toss');
    this.toss = new Map();
    for (const item of ENTRY.tossItems) {
      const b = el('button', `wbtn tbtn tbtn-${item}`, `<span class="tl">${T.entry.tossItems[item]}</span><span class="en"></span>`);
      b.addEventListener('pointerdown', fire(`toss_${item}`));
      toss.appendChild(b);
      this.toss.set(item, { b, label: b.querySelector('.tl'), count: b.querySelector('.en') });
    }
    this.size = null; // measured {w, h} of the popover (re-measured when its content changes)
    this.layoutKey = '';
    root.appendChild(this.node);
  }

  /** Which point the picker shows for, or null. */
  target(sim, session) {
    if (!canEditRoutes(session) || session.phase === 'ended') return null;
    const u = controllableUnit(sim, session.selectedId, session.team);
    if (!u) return null;
    const i = targetIndex(session, u);
    if (i < 0) return null;
    const p = u.route[i];
    const k = p.door >= 0 ? p.door : entryDoorwayAt(sim.world, p.x, p.y);
    // Only when asked for: a tap on a "?", a tag or a waypoint next to a door (session.pointTarget).
    const t = session.pointTarget;
    return t && t.unitId === u.id && t.index === i ? { u, i, p, k } : null;
  }

  update(sim, session, camera) {
    const tg = this.target(sim, session);
    toggle(this.node, 'on', !!tg);
    if (!tg) {
      this.layoutKey = '';
      return;
    }
    const { u, i, p, k } = tg;
    const door = k >= 0;
    // Aiming a throw: only the head is left ("where does it land?" + ×), the map stays clear around the point.
    const tp = session.ui.tossPick;
    const aiming = tp && tp.unitId === u.id && tp.index === i ? tp.item : null;
    toggle(this.node, 'aiming', !!aiming);
    const more = door && (session.ui.moreEntries || MORE.includes(p.entry));
    toggle(this.node, 'more', more);
    toggle(this.node, 'door', door);
    toggle(this.node, 'ask', !!p.ask);
    setText(this.title, aiming ? T.entry.aimTitle[aiming] : p.ask ? T.entry.askTitle : door ? T.entry.title : T.entry.point);
    for (const [k2, b] of this.pace) toggle(b, 'active', k2 === 'sneak' ? p.pace === 'sneak' : p.pace !== 'sneak');
    setText(this.moreLabel, more ? T.entry.less : T.entry.more);
    const current = p.ask ? 'none' : p.entry || 'none';
    for (const [mode, { b, count }] of this.buttons) {
      const item = ENTRY_GEAR[mode];
      const left = item ? gearLeft(u, item, i) : -1;
      const ok = mode === 'none' || (entryModeFits(sim, k, mode) && (!item || left > 0 || current === mode));
      if (b.disabled !== !ok) b.disabled = !ok;
      toggle(b, 'active', !p.ask && current === mode);
      setText(count, item ? T.entry.left(Math.max(0, left)) : '');
    }
    for (const [code, b] of this.when) toggle(b, 'active', code === 'now' ? !p.hold : p.hold && holdCode(p) === code);
    const aim = aiming;
    for (const [item, { b, label, count }] of this.toss) {
      const has = p.toss && p.toss.item === item;
      const left = gearLeft(u, item, i);
      const ok = has || left > 0;
      if (b.disabled !== !ok) b.disabled = !ok;
      toggle(b, 'active', has && !aim);
      toggle(b, 'aim', aim === item);
      setText(label, aim === item ? T.entry.tossAim : T.entry.tossItems[item]);
      setText(count, T.entry.left(Math.max(0, left)));
    }

    // Anchored over the door point, kept on screen (below it when there is no room above).
    const key = `${more}|${door}|${aim}`;
    if (!this.size || this.layoutKey !== key) {
      const r = this.node.getBoundingClientRect();
      this.size = { w: r.width, h: r.height };
      this.layoutKey = key;
    }
    const s = camera.worldToScreen(p.x, p.y, 0);
    const W = camera.width;
    const H = camera.heightPx;
    const { w, h } = this.size;
    let x = Math.min(Math.max(s.x - w / 2, EDGE_PX), W - w - EDGE_PX);
    let y = s.y - GAP_PX - h;
    if (y < EDGE_PX) y = Math.min(s.y + GAP_PX, H - h - EDGE_PX);
    setStyle(this.node, 'transform', `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`);
  }
}
