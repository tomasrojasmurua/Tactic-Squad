// Callouts: a few words over one of the player's own soldiers when something happens to him or he
// does something the squad must know — "¡Contacto!", "¡Recargando!", "¡Herido!", "¡Granada!",
// "¡Abatido!", "¡Me tienen clavado!". Only the player's side (session.team) and only from what the
// sim already told (bus events), so an online match never shows the other side's. Each soldier has
// one bubble at a time, briefly; a soft radio click goes with it.
import { EV } from '../core/events.js';
import { HUD } from '../config/ui.js';
import { el, setText, toggle, setStyle } from './dom.js';
import { T } from './texts.js';

export class Callouts {
  constructor(root, bus, session) {
    this.bus = bus;
    this.session = session;
    this.node = el('div', 'callouts');
    root.appendChild(this.node);
    this.bubbles = new Map(); // unitId -> {node, until, text}
    this.sim = null;
    const own = (id) => this.sim && this.sim.units[id] && this.sim.units[id].team === this.session.team;
    const say = (id, key) => {
      if (!own(id) || this.session.phase === 'title') return;
      this.say(id, T.callouts[key]);
    };
    bus.on(EV.ROUND_RESET, ({ sim }) => {
      this.sim = sim;
      for (const b of this.bubbles.values()) b.node.remove();
      this.bubbles.clear();
    });
    bus.on(EV.RELOAD, (e) => !e.replay && say(e.unitId, 'reload'));
    bus.on(EV.HIT, (e) => !e.replay && !e.lethal && say(e.unitId, 'hurt'));
    bus.on(EV.PINNED, (e) => !e.replay && say(e.unitId, 'pinned'));
    bus.on(EV.MIRROR_SEEN, (e) => !e.replay && say(e.byId, 'glint'));
    bus.on(EV.MIRROR_BROKEN, (e) => !e.replay && say(e.unitId, 'mirrorBroken'));
    bus.on(EV.GRENADE_THROWN, (e) => !e.replay && say(e.unitId, e.kind === 'flash' ? 'flash' : e.kind === 'smoke' ? 'smoke' : 'frag'));
    bus.on(EV.DEATH, (e) => {
      if (e.replay || !this.sim) return;
      const victim = this.sim.units[e.unitId];
      if (victim && victim.team !== this.session.team) say(e.killerId, 'down');
    });
    // Contact: the soldier of the squad nearest to the enemy just seen calls it.
    bus.on(EV.SPOTTED, (e) => {
      if (e.replay || !this.sim || e.byTeam !== this.session.team || e.byDrone) return;
      let best = null;
      let bd = Infinity;
      for (const u of this.sim.teams[this.session.team]) {
        if (!u.alive) continue;
        const d = (u.x - e.x) ** 2 + (u.y - e.y) ** 2;
        if (d < bd) {
          bd = d;
          best = u;
        }
      }
      if (best) say(best.id, 'contact');
    });
  }

  say(unitId, text) {
    const now = performance.now();
    let b = this.bubbles.get(unitId);
    if (b && b.until > now && b.text === text) return; // already saying it
    if (b && now - b.at < HUD.calloutGapMs) return; // one at a time: no chatter
    if (!b) {
      b = { node: el('div', 'callout'), until: 0, at: 0, text: '' };
      this.node.appendChild(b.node);
      this.bubbles.set(unitId, b);
    }
    b.text = text;
    b.at = now;
    b.until = now + HUD.calloutMs;
    setText(b.node, text);
    b.node.classList.remove('pop');
    void b.node.offsetWidth; // restart the pop
    b.node.classList.add('pop');
    this.bus.emit(EV.UI_SOUND, { name: 'select' }); // a soft radio blip
  }

  update(sim, session, camera, poseOf) {
    const now = performance.now();
    for (const [id, b] of this.bubbles) {
      const u = sim.units[id];
      const on = !!u && u.alive && b.until > now && session.phase !== 'title';
      toggle(b.node, 'off', !on);
      if (!on) continue;
      const p = poseOf(u);
      const s = camera.worldToScreen(p.x, p.y, 0);
      setStyle(b.node, 'transform', `translate(${s.x.toFixed(1)}px, ${(s.y - HUD.calloutLiftPx).toFixed(1)}px) translate(-50%, -100%)`);
    }
  }
}
