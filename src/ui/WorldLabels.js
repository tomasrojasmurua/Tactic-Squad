// Small DOM tags floating over each operator (number, GO hold, defusing the bomb,
// blinded) and under the planned waypoints that wait for a GO code or carry a
// door entry ("A · FLASH"), positioned every frame through the camera projection.
// A door on the route gets a small "?" on its point (it is opened on the way if
// nobody decides): tapping it, or any tag, opens the door picker on that point
// (EV.REQUEST 'door_<unitId>_<index>'). GO holds wear their group's color.
import { EV } from '../core/events.js';
import { el, toggle, setStyle } from './dom.js';
import { HEIGHTS } from '../config/render.js';
import { HUD, GO_GROUPS } from '../config/ui.js';
import { teamUnits, holdCode, ASK_CODE } from '../sim/queries.js';
import { T } from './texts.js';

export class WorldLabels {
  constructor(root, bus) {
    this.bus = bus;
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
        t.go.textContent = u.waitCode === ASK_CODE ? T.tagAsk : u.waitCode ? T.goShort(u.waitCode) : T.tagGo;
        const g = GO_GROUPS[u.waitCode];
        if (g) t.go.style.setProperty('--g', g.color);
        toggle(t.go, 'grp', !!g);
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
        for (let i = 0; i < u.route.length; i++) {
          const p = u.route[i];
          const waits = p.waitDoor >= 0 && !p.entry;
          if (!p.user || (!p.hold && !p.entry && !p.ask && !waits && !(p.pause > 0) && !p.cover)) continue;
          const t = this.point(n++);
          const code = p.hold ? holdCode(p) : null;
          const g = code && GO_GROUPS[code];
          const tag = p.entry ? T.entry.tags[p.entry] : waits ? T.entry.tags.wait : null;
          const text = p.ask ? '?' : p.hold && tag ? `${g.glyph} ${tag}` : p.hold ? T.goShort(code) : tag || (p.pause > 0 ? T.peek.tag : T.cover.tag);
          toggle(t.node, 'ask', p.ask);
          toggle(t.node, 'go', !p.ask && !!g);
          toggle(t.node, 'entry', !p.ask && !g);
          if (g) t.node.style.setProperty('--g', g.color);
          // Every tag opens the door picker on its point (a hold away from doors: the picker only shows near one).
          t.node.dataset.action = `door_${u.id}_${i}`;
          toggle(t.node, 'target', !!session.pointTarget && session.pointTarget.unitId === u.id && session.pointTarget.index === i);
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
      t.node.addEventListener('pointerdown', (e) => {
        const action = t.node.dataset.action;
        if (!action) return;
        e.stopPropagation();
        e.preventDefault();
        this.bus.emit(EV.REQUEST, { action });
      });
      this.node.appendChild(t.node);
      this.points.push(t);
    }
    return t;
  }
}
