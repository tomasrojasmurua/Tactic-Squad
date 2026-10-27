// Waypoint menu (desktop and touch), a small popover anchored to the point it
// edits, Door Kickers style: the decision happens where the door is. Next to
// a door it is the door picker (how to go through); everywhere it says when
// (GO group) and at what pace (normal / sigilo) the leg to it is walked.
// It opens when the player asks for it — tapping a door, a "?", a waypoint tag
// or a waypoint (session.pointTarget) — and closes with × or Esc.
// A door nobody decides is simply opened on the way (ENTRY.undecided).
//
//   CÓMO    at a door, a wheel around the point with every entry (open,
//           kick, charge, grenade, flash, crack); modes that do not fit the
//           doorway or need gear he no longer has are disabled, gear left is
//           shown; the hub closes it. The rest sits in a panel beside it
//   CUÁNDO  right away, or with a GO group (a color: config/ui.js GO_GROUPS)
//   LANZAR  a flash / grenade / smoke from this point to wherever the player
//           taps next (session.ui.tossPick); pressing the active one removes it
//
// Emits EV.REQUEST {action: 'entry_<mode>' | 'when_<now|A|B|C>' | 'toss_<item>' | 'pace_<k>' | 'pickerClose'}.
import { EV } from '../core/events.js';
import { ENTRY } from '../config/balance.js';
import { GO_GROUPS } from '../config/ui.js';
import { controllableUnit, entryDoorwayAt, entryModeFits, gearLeft, ENTRY_GEAR, holdCode } from '../sim/queries.js';
import { canEditRoutes, targetIndex } from '../session/Session.js';
import { el, setText, toggle, setStyle } from './dom.js';
import { ENTRY_ICON } from './icons.js';
import { T } from './texts.js';

// The door wheel: every entry around the door point, clockwise from the top.
const WHEEL = ['none', 'kick', 'breach', 'frag', 'flash', 'slow'];
const GAP_PX = 26; // between the point and the popover (a point away from doors)
const EDGE_PX = 8; // kept from the screen edges
const RING_R = 64; // px from the door point to the center of each wheel button
const RING_OUT = RING_R + 34; // px: the wheel's outer radius (button included)
const SIDE_GAP = 6; // px between the wheel and the panel beside it

export class EntryPicker {
  constructor(root, bus) {
    this.bus = bus;
    this.node = el(
      'div',
      'entry-picker',
      `<div class="ep-ring"><button class="ep-hub" aria-label="${T.entry.close}">×</button></div>` +
        `<div class="ep-panel"><div class="ep-head"><span class="ep-title"></span><button class="ep-x" aria-label="${T.entry.close}">×</button></div>` +
        `<div class="ep-when"><span class="ep-wl">${T.entry.when}</span></div>` +
        `<div class="ep-pace"><span class="ep-wl">${T.pace.title}</span></div>` +
        `<div class="ep-toss"><span class="ep-wl">${T.entry.toss}</span></div></div>`,
    );
    this.ring = this.node.querySelector('.ep-ring');
    this.panel = this.node.querySelector('.ep-panel');
    this.title = this.node.querySelector('.ep-title');
    this.buttons = new Map();
    const fire = (action) => (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.bus.emit(EV.REQUEST, { action });
    };
    WHEEL.forEach((mode, n) => {
      const a = (n / WHEEL.length) * Math.PI * 2;
      const b = el('button', `ebtn ebtn-${mode}`, `<span class="ei">${ENTRY_ICON[mode]}</span><span class="el">${mode === 'none' ? T.entry.none : T.entry.modes[mode]}</span><span class="en"></span>`);
      b.style.left = `${(RING_OUT + Math.sin(a) * RING_R).toFixed(1)}px`;
      b.style.top = `${(RING_OUT - Math.cos(a) * RING_R).toFixed(1)}px`;
      b.title = T.entry.hints[mode];
      b.addEventListener('pointerdown', fire(`entry_${mode}`));
      this.ring.appendChild(b);
      this.buttons.set(mode, { b, count: b.querySelector('.en') });
    });
    this.ring.style.width = this.ring.style.height = `${RING_OUT * 2}px`;
    this.node.querySelector('.ep-hub').addEventListener('pointerdown', fire('pickerClose'));
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
    this.size = null; // measured {w, h} of the panel (re-measured when its content changes)
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
    // Only when asked for: a tap on a door, a "?", a tag or a waypoint (session.pointTarget).
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
    const wheel = door && !aiming;
    toggle(this.node, 'door', door);
    toggle(this.node, 'ask', !!p.ask);
    setText(this.title, aiming ? T.entry.aimTitle[aiming] : p.ask ? T.entry.askTitle : door ? T.entry.title : T.entry.point);
    for (const [k2, b] of this.pace) toggle(b, 'active', k2 === 'sneak' ? p.pace === 'sneak' : p.pace !== 'sneak');
    // A throw from a door point replaces its entry: then no wheel mode is lit.
    const current = p.ask || p.toss ? null : p.entry || 'none';
    for (const [mode, { b, count }] of this.buttons) {
      const item = ENTRY_GEAR[mode];
      const left = item ? gearLeft(u, item, i) : -1;
      const ok = mode === 'none' || (entryModeFits(sim, k, mode) && (!item || left > 0 || current === mode));
      if (b.disabled !== !ok) b.disabled = !ok;
      toggle(b, 'active', current === mode);
      setText(count, item ? T.entry.left(Math.max(0, left)) : '');
    }
    for (const [code, b] of this.when) toggle(b, 'active', code === 'now' ? !p.hold : p.hold && holdCode(p) === code);
    for (const [item, { b, label, count }] of this.toss) {
      const has = p.toss && p.toss.item === item;
      const left = gearLeft(u, item, i);
      const ok = has || left > 0;
      if (b.disabled !== !ok) b.disabled = !ok;
      toggle(b, 'active', has && !aiming);
      toggle(b, 'aim', aiming === item);
      setText(label, aiming === item ? T.entry.tossAim : T.entry.tossItems[item]);
      setText(count, T.entry.left(Math.max(0, left)));
    }

    const key = `${door}|${aiming}|${session.touch}|${camera.width}`;
    if (!this.size || this.layoutKey !== key) {
      const r = this.panel.getBoundingClientRect();
      // On touch the button column stays usable: the menu keeps to its left.
      const col = session.touch ? this.node.parentNode.querySelector('.tbar-col') : null;
      const cr = col ? col.getBoundingClientRect() : null;
      this.size = { w: r.width, h: r.height, right: cr && cr.width > 0 ? cr.left : Infinity };
      this.layoutKey = key;
    }
    const s = camera.worldToScreen(p.x, p.y, 0);
    const W = Math.min(camera.width, this.size.right);
    const H = camera.heightPx;
    const { w, h } = this.size;
    let x;
    let y;
    if (wheel) {
      // The wheel around the door point, the panel beside it (right, else left);
      // where neither fits (a phone), the wheel slides off the point so both do.
      let cx = s.x;
      const span = RING_OUT + SIDE_GAP + w;
      const right = cx + span <= W - EDGE_PX;
      if (!right && cx - span < EDGE_PX) cx = W - EDGE_PX - span; // panel on the right, wheel pulled left
      cx = Math.min(Math.max(cx, RING_OUT + EDGE_PX), W - RING_OUT - EDGE_PX);
      const cy = Math.min(Math.max(s.y, RING_OUT + EDGE_PX), H - RING_OUT - EDGE_PX);
      setStyle(this.ring, 'transform', `translate(${(cx - RING_OUT).toFixed(0)}px, ${(cy - RING_OUT).toFixed(0)}px)`);
      x = cx + span <= W - EDGE_PX ? cx + RING_OUT + SIDE_GAP : cx - span;
      x = Math.min(Math.max(x, EDGE_PX), W - w - EDGE_PX);
      y = Math.min(Math.max(cy - h / 2, EDGE_PX), H - h - EDGE_PX);
    } else {
      // Anchored over the point, kept on screen (below it when there is no room above).
      x = Math.min(Math.max(s.x - w / 2, EDGE_PX), W - w - EDGE_PX);
      y = s.y - GAP_PX - h;
      if (y < EDGE_PX) y = Math.min(s.y + GAP_PX, H - h - EDGE_PX);
    }
    setStyle(this.panel, 'transform', `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`);
  }
}
