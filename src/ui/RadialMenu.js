// The touch radial menu (session/radial.js has its options; SessionController opens it on a hold
// and applies what the finger lifts on): a ring of options around the finger, the one it slides to
// grows, its name on top of the screen (the finger hides the ring), a line from the center to the
// finger. Lifting in the middle (or far away) chooses nothing. Reads session.ui.radial.
import { slotOffset, RADIAL } from '../session/radial.js';
import { el, setText, toggle, setStyle } from './dom.js';
import { ENTRY_ICON, GEAR_ICON, ICON } from './icons.js';
import { T } from './texts.js';

const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
// Pictograms of the options the game had no icon for.
const EXTRA = {
  pace: svg('<g fill="currentColor"><ellipse cx="8" cy="15" rx="3" ry="5"/><ellipse cx="16" cy="9" rx="3" ry="5"/></g>'),
  look: svg('<path d="M2 12 C6 5 18 5 22 12 C18 19 6 19 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>'),
  peek: svg('<path d="M4 20 V4 H11" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M14 8 L20 12 L14 16" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M20 12 H9" stroke="currentColor" stroke-width="2.4"/>'),
  cover: svg('<path d="M12 12 L3 6 A11 11 0 0 1 21 6 Z" fill="currentColor" opacity=".55"/><circle cx="12" cy="13" r="3" fill="currentColor"/><path d="M5 20 A9 9 0 0 1 19 20" fill="none" stroke="currentColor" stroke-width="2"/>'),
};

function iconOf(o) {
  if (o.mode) return ENTRY_ICON[o.mode] || '';
  if (o.item) return GEAR_ICON[o.item] || '';
  if (o.id === 'squad') return ICON.squad;
  if (o.id === 'reload') return ICON.bullets;
  return EXTRA[o.id] || '';
}

/** The option's name (and what is left of its item). */
export function radialLabel(o) {
  const R = T.radial;
  let name;
  if (o.mode) name = o.mode === 'none' ? R.open : T.entry.modes[o.mode];
  else if (o.item) name = `${R.toss} ${T.entry.tossItems[o.item].toLowerCase()}`;
  else if (o.id === 'pace') name = o.active ? R.normalPace : R.sneak;
  else if (o.id === 'peek') name = o.active ? T.peek.on : T.peek.off;
  else if (o.id === 'cover') name = o.active ? T.cover.on : T.cover.off;
  else name = R[o.id] || o.id;
  return o.count !== null && o.count !== undefined ? `${name} · ${R.left(o.count)}` : name;
}

export class RadialMenu {
  constructor(root) {
    this.node = el('div', 'radial hidden');
    this.ring = el('div', 'rd-ring');
    this.line = el('div', 'rd-line');
    this.node.append(this.ring, this.line);
    this.label = el('div', 'radial-label hidden');
    root.append(this.node, this.label);
    this.key = '';
    this.items = [];
  }

  build(r) {
    this.ring.innerHTML = '';
    this.items = r.options.map((o) => {
      const off = slotOffset(o.slot);
      const b = el('div', 'rd-opt', `<span class="rd-ic">${iconOf(o)}</span>`);
      setStyle(b, 'transform', `translate(${off.x.toFixed(1)}px, ${off.y.toFixed(1)}px)`);
      toggle(b, 'off', !o.enabled);
      toggle(b, 'active', o.active);
      if (o.item || o.mode) b.dataset.kind = o.item || o.mode;
      this.ring.appendChild(b);
      return b;
    });
  }

  update(session) {
    const r = session.ui.radial;
    toggle(this.node, 'hidden', !r);
    toggle(this.label, 'hidden', !r);
    if (!r) {
      this.key = '';
      return;
    }
    const key = `${r.unitId}:${r.index}:${r.options.map((o) => `${o.id}${o.enabled ? 1 : 0}${o.active ? 1 : 0}`).join(',')}`;
    if (key !== this.key) {
      this.key = key;
      this.build(r);
    }
    setStyle(this.node, 'transform', `translate(${r.x}px, ${r.y}px)`);
    this.items.forEach((b, i) => toggle(b, 'hover', i === r.hover));
    // The line from the center to the finger (how far it is from choosing).
    const dx = r.fx - r.x;
    const dy = r.fy - r.y;
    const len = Math.min(Math.hypot(dx, dy), RADIAL.radiusPx);
    setStyle(this.line, 'width', `${len.toFixed(0)}px`);
    setStyle(this.line, 'transform', `rotate(${Math.atan2(dy, dx).toFixed(3)}rad)`);
    const o = r.options[r.hover];
    setText(this.label, o ? radialLabel(o) : T.radial.titles[r.kind]);
    toggle(this.label, 'chosen', !!o);
  }
}
