// Camera mounts on the map (sim/cameras.js, map `cameraMounts`): playing the
// defenders, in their recon (the first step of the preparation), each mount
// is a round button over its spot on the wall. A free one shows a camera and
// "+": tapping it puts one of your cameras (CAMERA.max, more with a Vigía) up there (its view is
// drawn dashed meanwhile: render/layers/OverlayLayer.js). One with a camera
// only shows a small × beside it: tapping it takes the camera down. Small
// on screen (the map is to scale) but a finger-sized target; hidden under
// the HUD plates.
// Emits EV.REQUEST {action: 'mount_<id>'}.
import { EV } from '../core/events.js';
import { cameraLimit } from '../sim/queries.js';
import { HUD } from '../config/ui.js';
import { OVERLAY } from '../config/render.js';
import { inRecon } from '../session/Session.js';
import { el, setStyle, toggle } from './dom.js';
import { ICON } from './icons.js';
import { T } from './texts.js';

/** Does this screen pick camera mounts now? Once the recon ends they stay where they are. */
export const picksMounts = (sim, session) => inRecon(sim, session) && !session.helpOpen;

export class CameraMounts {
  constructor(root, bus) {
    this.bus = bus;
    this.node = el('div', 'mounts');
    root.appendChild(this.node);
    this.buttons = []; // {b, id}, one per mount of the map being played
    this.map = null;
  }

  build(sim) {
    this.node.innerHTML = '';
    this.map = sim.compiled;
    this.buttons = sim.compiled.cameraMounts.map((m) => {
      const b = el('button', 'cmount', `<span class="ci">${ICON.camera}</span><span class="cx">+</span>`);
      b.setAttribute('aria-label', T.setup.mount);
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.bus.emit(EV.REQUEST, { action: `mount_${m.id}` });
      });
      this.node.appendChild(b);
      toggle(b, 'east', Math.cos(m.facing) > 0); // the icon's lens points west: mirrored for a mount looking east
      return { b, m, x: b.querySelector('.cx') };
    });
  }

  update(sim, session, camera, occlusion) {
    const on = picksMounts(sim, session);
    toggle(this.node, 'on', on);
    if (!on) return;
    if (this.map !== sim.compiled) this.build(sim);
    const full = sim.cameras.length >= cameraLimit(sim);
    for (const { b, m, x } of this.buttons) {
      const up = sim.cameras.some((c) => c.mount === m.id);
      toggle(b, 'up', up);
      toggle(b, 'full', full && !up);
      if (x.textContent !== (up ? '×' : '+')) x.textContent = up ? '×' : '+';
      // Centered on the camera's body (OverlayLayer cameraBody).
      const k = 0.5 * OVERLAY.camera.length;
      const s = camera.worldToScreen(m.at[0] + Math.cos(m.facing) * k, m.at[1] + Math.sin(m.facing) * k, 0);
      setStyle(b, 'transform', `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -50%)`);
      toggle(b, 'under-hud', !!occlusion && occlusion.plateAt(s.x, s.y, HUD.labelHudMarginPx) >= 0);
    }
  }
}
