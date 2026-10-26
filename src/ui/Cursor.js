// Cyan ring cursor (Redie style) that follows the pointer over the canvas.
import { el, toggle, setStyle } from './dom.js';
import { CURSOR_SVG } from './icons.js';

export class Cursor {
  constructor(root, input) {
    this.input = input;
    this.node = el('div', 'cursor hidden', CURSOR_SVG);
    root.appendChild(this.node);
  }

  update(session) {
    const m = this.input.mouse;
    const hidden = !m.inside || session.phase === 'title' || session.helpOpen;
    toggle(this.node, 'hidden', hidden);
    if (hidden) return;
    setStyle(this.node, 'transform', `translate(${m.x}px, ${m.y}px)`);
    toggle(this.node, 'unit', session.hoverUnitId >= 0);
    toggle(this.node, 'look', !!session.ui.lookPreview);
  }
}
