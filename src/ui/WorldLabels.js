// Small DOM tags floating over each operator (number, GO hold, bomb),
// positioned every frame through the camera projection.
import { el, toggle, setStyle } from './dom.js';
import { HEIGHTS } from '../config/render.js';
import { HUD } from '../config/ui.js';
import { teamUnits } from '../sim/queries.js';
import { T } from './texts.js';

export class WorldLabels {
  constructor(root) {
    this.node = el('div', 'labels');
    root.appendChild(this.node);
    this.tags = new Map();
  }

  /** One tag per operator of `team` (the side this screen plays). */
  build(sim, team) {
    this.node.innerHTML = '';
    this.tags.clear();
    teamUnits(sim, team).forEach((u, i) => {
      const tag = el('div', 'tag', `<div class="n">${i + 1}</div><div class="s go">${T.tagGo}</div><div class="s bomb">${T.tagBomb}</div>`);
      tag.style.setProperty('--op', u.color);
      this.node.appendChild(tag);
      this.tags.set(u.id, { tag, go: tag.querySelector('.go'), bomb: tag.querySelector('.bomb') });
    });
  }

  /**
   * Close up, a tag floats above the head. Zoomed out (operators ~20 px) it
   * shrinks and sits behind the operator, opposite to where it looks, so a
   * number never lands on a body; tags under a HUD plate are hidden.
   */
  update(sim, session, camera, poseOf, occlusion) {
    const far = 1 / camera.metersPerPixel(HEIGHTS.label) < HUD.labelFarPxPerMeter;
    toggle(this.node, 'far', far);
    for (const [id, t] of this.tags) {
      const u = sim.units[id];
      toggle(t.tag, 'dead', !u.alive || session.phase === 'title');
      if (!u.alive) continue;
      const p = poseOf(u);
      let s;
      if (far) {
        const k = HUD.labelBehindMeters;
        s = camera.worldToScreen(p.x - Math.cos(p.facing) * k, p.y - Math.sin(p.facing) * k, HEIGHTS.label);
        setStyle(t.tag, 'transform', `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -50%)`);
      } else {
        s = camera.worldToScreen(p.x, p.y, HEIGHTS.label);
        setStyle(t.tag, 'transform', `translate(${s.x.toFixed(1)}px, ${(s.y - HUD.labelOffsetPx).toFixed(1)}px) translate(-50%, -100%)`);
      }
      toggle(t.tag, 'under-hud', !!occlusion && occlusion.plateAt(s.x, s.y, HUD.labelHudMarginPx) >= 0);
      toggle(t.tag, 'sel', session.selectedId === id);
      toggle(t.go, 'on', u.waitingGo);
      toggle(t.bomb, 'on', u.carriesBomb && session.selectedId === id);
    }
  }
}
