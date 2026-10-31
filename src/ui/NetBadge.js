// Online, during a match: this phone's connection light (green / amber / red, from the ping) and,
// when the rival is gone, how long the room waits for him before the match ends (net/roomLogic.js
// ROOM.abandonMs). Reads session.online (net/OnlineSession.js); nothing to tap.
import { el, setText, toggle, setHidden } from './dom.js';
import { T } from './texts.js';

export class NetBadge {
  constructor(root) {
    this.node = el('div', 'net-badge hidden', '<span class="nb-dot"></span><span class="nb-text"></span>');
    this.dot = this.node.firstChild;
    this.text = this.node.lastChild;
    root.appendChild(this.node);
    this.goneSince = null;
  }

  update(session) {
    const o = session.online;
    const show = !!o && o.playing && session.phase !== 'title';
    toggle(this.node, 'hidden', !show);
    if (!show) {
      this.goneSince = null;
      return;
    }
    const O = T.flow.online;
    const q = o.status === 'open' ? o.quality : 'bad';
    if (this.dot.dataset.q !== q) this.dot.dataset.q = q;
    const rival = o.room && o.room.jugadores.find((j) => j.id !== o.me && !j.conectado);
    const gone = !!rival;
    if (gone && this.goneSince === null) this.goneSince = performance.now();
    if (!gone) this.goneSince = null;
    let line = '';
    if (o.status !== 'open') line = O.status[o.status] || '';
    else if (gone) {
      const left = Math.max(0, ((o.room.abandono || 0) - (performance.now() - this.goneSince)) / 1000);
      line = O.rivalGone(rival.nombre, Math.ceil(left));
    } else if (o.mates && o.mates.length > 1 && ['buy', 'prep', 'planning'].includes(session.phase)) {
      // Coop: how many of the friends are done with this phase.
      const done = o.mates.filter((m) => (o.listos || []).includes(m.id)).length;
      line = O.matesReady(done, o.mates.length);
    } else if (o.mate && ['buy', 'prep', 'planning'].includes(session.phase)) {
      // 2v2: is the teammate done with this phase?
      line = (o.listos || []).includes(o.mate.id) ? O.mateReady(o.mate.nombre) : O.mateDeciding(o.mate.nombre);
    }
    setText(this.text, line);
    setHidden(this.text, !line);
    toggle(this.node, 'alert', !!line);
  }
}
