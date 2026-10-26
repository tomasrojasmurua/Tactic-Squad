// Panel of the round's first decision phases, over the map (it stays visible):
//   buy   the squad's equipment for the round (a shell: buying comes next)
//   prep  which entry the squad starts from (hidden from the defenders)
// Emits EV.REQUEST {action: 'chooseEntry_<id>'}; LISTO is the usual button.
import { EV } from '../core/events.js';
import { ROLES } from '../config/operators.js';
import { el, setText, toggle } from './dom.js';
import { T } from './texts.js';

export class PhasePanel {
  constructor(root, bus) {
    this.bus = bus;
    this.node = el('div', 'phase-panel hidden', `<div class="pp-title"></div><div class="pp-body"></div><div class="pp-note"></div>`);
    this.node.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.title = this.node.querySelector('.pp-title');
    this.body = this.node.querySelector('.pp-body');
    this.note = this.node.querySelector('.pp-note');
    this.shown = null; // phase the body was built for
    this.sim = null;
    root.appendChild(this.node);
  }

  update(sim, session) {
    const phase = session.phase === 'buy' || session.phase === 'prep' ? session.phase : null;
    toggle(this.node, 'hidden', !phase || session.helpOpen);
    if (!phase) {
      this.shown = null;
      return;
    }
    if (phase !== this.shown || sim !== this.sim) {
      this.shown = phase;
      this.sim = sim;
      if (phase === 'buy') this.buildBuy(sim, session.team);
      else this.buildPrep(sim);
    }
    if (phase === 'prep') for (const b of this.body.children) toggle(b, 'on', b.dataset.entry === sim.entry.id);
  }

  buildBuy(sim, team) {
    setText(this.title, T.buy.title);
    setText(this.note, T.buy.note);
    this.body.innerHTML = '';
    for (const u of sim.teams[team]) {
      const gear = Object.entries(u.gear)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${T.buy.gear[k] ?? k}`)
        .join(' · ');
      const row = el('div', 'pp-row', `<b style="color:${u.color}"></b><span class="pp-role"></span><span class="pp-gear"></span>`);
      setText(row.children[0], u.name);
      setText(row.children[1], `${ROLES[u.role]?.label ?? u.role} · ${u.weapon.name}`);
      setText(row.children[2], gear || T.buy.none);
      this.body.appendChild(row);
    }
  }

  buildPrep(sim) {
    setText(this.title, T.prep.title);
    setText(this.note, T.prep.note);
    this.body.innerHTML = '';
    for (const e of sim.compiled.entries) {
      const b = el('button', 'btn pp-entry');
      b.dataset.entry = e.id;
      setText(b, T.prep.entries[e.id] ?? e.id);
      b.addEventListener('click', () => this.bus.emit(EV.REQUEST, { action: `chooseEntry_${e.id}` }));
      this.body.appendChild(b);
    }
  }
}
