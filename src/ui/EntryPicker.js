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
// A tap on the selected operator himself opens it on the spot he stands on
// (pointTarget.index HERE): only LANZAR and CUÁNDO — he throws (or waits for
// a GO) from there, then walks his route.
//   ASOMARSE  at the end of the route: he stands there MOVE.peekTime s looking
//           at the point's look and walks back (sim/orders.js setPeek)
//
// Emits EV.REQUEST {action: 'entry_<mode>' | 'when_<now|A|B|C>' | 'toss_<item>' | 'pace_<k>' | 'peek' | 'pickerClose'}.
import { EV } from '../core/events.js';
import { ENTRY } from '../config/balance.js';
import { GO_GROUPS } from '../config/ui.js';
import { controllableUnit, entryDoorwayAt, entryModeFits, gearLeft, ENTRY_GEAR, holdCode, lastUserIndex, HERE } from '../sim/queries.js';
import { canEditRoutes, targetIndex } from '../session/Session.js';
import { el, setText, toggle, setStyle } from './dom.js';
import { ENTRY_ICON } from './icons.js';
import { T } from './texts.js';
import { buyableItems } from '../sim/prep.js';

// The door wheel: every entry around the door point, clockwise from the top.
const WHEEL = ['none', 'kick', 'breach', 'frag', 'flash', 'slow', 'cam']; // 'cam': only for whoever carries the fiber-optic camera
const GAP_PX = 26; // between the point and the popover (a point away from doors)
const EDGE_PX = 8; // kept from the screen edges
const RING_R = 64; // px from the door point to the center of each wheel button
const RING_OUT = RING_R + 34; // px: the wheel's outer radius (button included)
const SIDE_GAP = 6; // px between the wheel and the panel beside it

/** The user point before route[i] (the peek a way back belongs to), or -1. */
function anchorBefore(r, i) {
  for (let j = i - 1; j >= 0; j--) if (r[j].user && !r[j].ask) return j;
  return -1;
}

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
        `<div class="ep-toss"><span class="ep-wl">${T.entry.toss}</span></div>` +
        `<div class="ep-peek"><button class="wbtn pbtn"></button></div>` +
        `<div class="ep-peek ep-cover"><button class="wbtn pbtn"></button></div></div>`,
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
    WHEEL.forEach((mode) => {
      const b = el('button', `ebtn ebtn-${mode}`, `<span class="ei">${ENTRY_ICON[mode]}</span><span class="el">${mode === 'none' ? T.entry.none : T.entry.modes[mode]}</span><span class="en"></span>`);
      b.title = T.entry.hints[mode];
      b.addEventListener('pointerdown', fire(`entry_${mode}`));
      this.ring.appendChild(b);
      this.buttons.set(mode, { b, count: b.querySelector('.en') });
    });
    this.wheelKey = '';
    this.placeWheel(false);
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
    this.peekRow = this.node.querySelector('.ep-peek');
    this.peek = this.peekRow.firstChild;
    this.peek.title = T.peek.hint;
    this.peek.addEventListener('pointerdown', fire('peek'));
    this.coverRow = this.node.querySelector('.ep-cover');
    this.cover = this.coverRow.firstChild;
    this.cover.title = T.cover.hint;
    this.cover.addEventListener('pointerdown', fire('cover'));
    this.size = null; // measured {w, h} of the panel (re-measured when its content changes)
    this.layoutKey = '';
    root.appendChild(this.node);
  }

  /** Spreads the wheel's buttons evenly around the point: with the camera (the Explorador) or without it. */
  placeWheel(cam) {
    const key = cam ? 'cam' : 'plain';
    if (this.wheelKey === key) return;
    this.wheelKey = key;
    const modes = WHEEL.filter((m) => cam || m !== 'cam');
    for (const [mode, { b }] of this.buttons) {
      const n = modes.indexOf(mode);
      b.hidden = n < 0;
      if (n < 0) continue;
      const a = (n / modes.length) * Math.PI * 2;
      b.style.left = `${(RING_OUT + Math.sin(a) * RING_R).toFixed(1)}px`;
      b.style.top = `${(RING_OUT - Math.cos(a) * RING_R).toFixed(1)}px`;
    }
  }

  /** Which point the picker shows for, or null. */
  target(sim, session) {
    if (!canEditRoutes(session) || session.phase === 'ended') return null;
    const u = controllableUnit(sim, session.selectedId, session.team);
    if (!u) return null;
    const t = session.pointTarget;
    if (t && t.unitId === u.id && t.index === HERE) return { u, i: HERE, p: { x: u.x, y: u.y, hold: false, code: null, toss: null, ask: false, pace: null }, k: -1, here: true };
    const i = targetIndex(session, u);
    if (i < 0) return null;
    const p = u.route[i];
    const k = p.door >= 0 ? p.door : entryDoorwayAt(sim.world, p.x, p.y);
    // His first point on the spot he stands on (a throw / wait set "from here") keeps that menu.
    const here = i === 0 && !p.ask && Math.hypot(p.x - u.x, p.y - u.y) < 0.05;
    // Only when asked for: a tap on a door, a "?", a tag or a waypoint (session.pointTarget).
    return t && t.unitId === u.id && t.index === i ? { u, i, p, k: here ? -1 : k, here } : null;
  }

  update(sim, session, camera) {
    const tg = this.target(sim, session);
    toggle(this.node, 'on', !!tg);
    if (!tg) {
      this.layoutKey = '';
      return;
    }
    const { u, i, p, k, here } = tg;
    const at = i === HERE ? -1 : i; // gear left: what his route does not spend already
    const door = k >= 0;
    // Aiming a throw: only the head is left ("where does it land?" + ×), the map stays clear around the point.
    const tp = session.ui.tossPick;
    const aiming = tp && tp.unitId === u.id && tp.index === i ? tp.item : null;
    toggle(this.node, 'aiming', !!aiming);
    const wheel = door && !aiming;
    toggle(this.node, 'door', door);
    toggle(this.node, 'ask', !!p.ask);
    toggle(this.node, 'here', !!here);
    setText(this.title, aiming ? T.entry.aimTitle[aiming] : here ? T.entry.here : p.ask ? T.entry.askTitle : door && p.waitDoor >= 0 && !p.entry ? T.entry.waitTitle : door ? T.entry.title : T.entry.point);
    for (const [k2, b] of this.pace) toggle(b, 'active', k2 === 'sneak' ? p.pace === 'sneak' : p.pace !== 'sneak');
    // A throw from a door point replaces its entry: then no wheel mode is lit.
    const current = p.ask || p.toss ? null : p.entry || 'none';
    this.placeWheel(u.ability === 'fiberCam');
    for (const [mode, { b, count }] of this.buttons) {
      const item = ENTRY_GEAR[mode];
      const left = item ? gearLeft(u, item, i) : -1;
      const ok = mode === 'none' || (entryModeFits(sim, k, mode, u) && (!item || left > 0 || current === mode));
      if (b.disabled !== !ok) b.disabled = !ok;
      toggle(b, 'active', current === mode);
      setText(count, item ? T.entry.left(Math.max(0, left)) : '');
    }
    for (const [code, b] of this.when) toggle(b, 'active', code === 'now' ? !p.hold : p.hold && holdCode(p) === code);
    for (const [item, { b, label, count }] of this.toss) {
      const has = p.toss && p.toss.item === item;
      const left = gearLeft(u, item, at);
      const ok = has || left > 0;
      const hide = !ok && !buyableItems(u.team).includes(item); // the incendiaria is the defenders' only
      if (b.hidden !== hide) b.hidden = hide;
      if (b.disabled !== !ok) b.disabled = !ok;
      toggle(b, 'active', has && !aiming);
      toggle(b, 'aim', aiming === item);
      setText(label, aiming === item ? T.entry.tossAim : T.entry.tossItems[item]);
      setText(count, T.entry.left(Math.max(0, left)));
    }

    // Asomarse: the end of the route (or a peek already set, or its way back).
    const peekAt = here ? -1 : p.back ? anchorBefore(u.route, i) : i;
    const peeking = peekAt >= 0 && u.route[peekAt].pause > 0;
    const canPeek = !here && (peeking || (!p.ask && i === lastUserIndex(u)));
    this.peekRow.hidden = !canPeek;
    toggle(this.peek, 'active', peeking);
    setText(this.peek, peeking ? T.peek.on : T.peek.off);
    // Cubrir zona (attackers): where he stands, or at the end of his route.
    const coverAt = here ? (u.route.length ? -2 : -1) : !p.ask && !p.back && !peeking && i === lastUserIndex(u) ? i : -2;
    const canCover = u.team === 'attackers' && coverAt > -2;
    const covering = canCover && (coverAt < 0 ? u.cover : u.route[coverAt].cover);
    this.coverRow.hidden = !canCover;
    toggle(this.cover, 'active', covering);
    setText(this.cover, covering ? T.cover.on : T.cover.off);

    const key = `${door}|${aiming}|${canPeek}|${canCover}|${here}|${session.touch}|${camera.width}`;
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
