// "Restoring graphics" notice for a lost WebGL context (phones drop it when
// the app is backgrounded with low memory). The renderer rebuilds itself on
// webglcontextrestored; the session pauses a running round by itself
// (session/AutoPause.js, reason 'graphics'); this tells the player what is
// happening until the picture is back.
import { el, toggle } from './dom.js';
import { T } from './texts.js';

export class GfxNotice {
  constructor(root, bus, canvas) {
    this.bus = bus;
    this.phase = null;
    this.node = el('div', 'gfx-lost', `<div class="gfx-box"><div class="gfx-spin"></div><h2>${T.gfxLost.title}</h2><p>${T.gfxLost.text}</p></div>`);
    root.appendChild(this.node);
    canvas.addEventListener('webglcontextlost', () => {
      toggle(this.node, 'on', true); // (no 'toggle' request: it would resume a round the session already paused)
    });
    // The renderer listener (registered first) has rebuilt every GL resource by now.
    canvas.addEventListener('webglcontextrestored', () => toggle(this.node, 'on', false));
  }

  update(session) {
    this.phase = session.phase;
  }
}
