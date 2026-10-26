// Small DOM tags floating over each operator (number, GO hold, defusing the bomb,
// blinded) and under the planned waypoints that wait for a GO code or carry a
// door entry ("A · FLASH"), positioned every frame through the camera projection.
import { el, toggle, setStyle } from './dom.js';
import { HEIGHTS } from '../config/render.js';
import { HUD } from '../config/ui.js';
import { teamUnits, holdCode } from '../sim/queries.js';
import { T } from './texts.js';

export class WorldLabels {
  constructor(root) {
    this.node = el('div', 'labels');
    root.appendChild(this.node);
    this.tags = new Map();
    this.points = []; // pooled waypoint tags {node, text}
    this.team = null;
  }

  /** One tag per operator of `team` (the side this screen plays). */
  build(sim, team) {
    this.node.innerHTML = '';
    this.tags.clear();
    this.points.length = 0;
    this.team = team;
    teamUnits(sim, team).forEach((u, i) => {
      const tag = el(
        'div',
        'tag',
        `<div class="n">${i + 1}</div><div class="s go">${T.tagGo}</div><div class="s bomb">${T.tagBomb}</div><div class="s blind">${T.tagBlind}</div>`,
      );
      tag.style.setProperty('--op', u.color);
      this.node.appendChild(tag);
      this.tags.set(u.id, { tag, go: tag.querySelector('.go'), bomb: tag.querySelector('.bomb'), blind: tag.querySelector('.blind'), code: null });
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
      if (u.waitingGo && t.code !== u.waitCode) {
        t.code = u.waitCode;
        t.go.textContent = u.waitCode ? `${T.tagGo} ${u.waitCode}` : T.tagGo;
      }
      toggle(t.bomb, 'on', u.defusing);
      toggle(t.blind, 'on', u.blind > 0);
    }
    this.updatePoints(sim, session, camera, occlusion);
  }

  /** "A", "FLASH" or "A · FLASH" under each planned hold / entry of the side's operators. */
  updatePoints(sim, session, camera, occlusion) {
    let n = 0;
    if (session.phase !== 'title' && this.team) {
      for (const u of teamUnits(sim, this.team)) {
        if (!u.alive) continue;
        for (const p of u.route) {
          if (!p.user || (!p.hold && !p.entry)) continue;
          const t = this.point(n++);
          const text = p.hold && p.entry ? `${holdCode(p)} · ${T.entry.tags[p.entry]}` : p.hold ? holdCode(p) : T.entry.tags[p.entry];
          if (t.text !== text) {
            t.text = text;
            t.node.textContent = text;
          }
          t.node.style.setProperty('--op', u.color);
          const s = camera.worldToScreen(p.x, p.y, 0);
          setStyle(t.node, 'transform', `translate(${s.x.toFixed(1)}px, ${(s.y + HUD.pointTagOffsetPx).toFixed(1)}px) translate(-50%, 0)`);
          toggle(t.node, 'sel', session.selectedId === u.id);
          toggle(t.node, 'under-hud', !!occlusion && occlusion.plateAt(s.x, s.y, HUD.labelHudMarginPx) >= 0);
          toggle(t.node, 'off', false);
        }
      }
    }
    for (let i = n; i < this.points.length; i++) toggle(this.points[i].node, 'off', true);
  }

  point(i) {
    let t = this.points[i];
    if (!t) {
      t = { node: el('div', 'ptag'), text: '' };
      this.node.appendChild(t.node);
      this.points.push(t);
    }
    return t;
  }
}
