// Panel of the round's first decision phases, over the map (it stays visible):
//   buy       each operator's money and utility: tap an item to buy one, − to
//             give one back (sim/prep.js, BUY in config/balance.js)
//   prep      which entry the squad starts from (hidden from the defenders)
//   planning  first turn only, compact: the entry can still change
// Emits EV.REQUEST {action: 'buy_<unitId>_<item>_<+|->' | 'chooseEntry_<id>'}; LISTO is the usual button.
import { EV } from '../core/events.js';
import { ROLES } from '../config/operators.js';
import { BUY } from '../config/balance.js';
import { el, setText, toggle } from './dom.js';
import { T } from './texts.js';

/** Which panel the session shows now, or null. */
function panelFor(sim, session) {
  if (session.phase === 'buy' || session.phase === 'prep') return session.phase;
  // Before the first turn ran the attackers may still change their entry.
  if (session.phase === 'planning' && !session.tutorial.active && session.team === 'attackers' && sim.turn === 1 && sim.round.execTotal === 0 && sim.controllers.attackers === 'human') return 'entry';
  return null;
}

export class PhasePanel {
  constructor(root, bus) {
    this.bus = bus;
    this.node = el('div', 'phase-panel hidden', `<div class="pp-title"></div><div class="pp-body"></div><div class="pp-note"></div>`);
    this.node.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.title = this.node.querySelector('.pp-title');
    this.body = this.node.querySelector('.pp-body');
    this.note = this.node.querySelector('.pp-note');
    this.shown = null; // panel the body was built for
    this.sim = null;
    this.items = []; // buy panel: {u, item, count, sell, money}
    root.appendChild(this.node);
  }

  request(action) {
    this.bus.emit(EV.REQUEST, { action });
  }

  update(sim, session) {
    const panel = panelFor(sim, session);
    toggle(this.node, 'hidden', !panel || session.helpOpen);
    toggle(this.node, 'compact', panel === 'entry');
    if (!panel) {
      this.shown = null;
      return;
    }
    if (panel !== this.shown || sim !== this.sim) {
      this.shown = panel;
      this.sim = sim;
      if (panel === 'buy') this.buildBuy(sim, session.team);
      else this.buildEntries(sim, panel);
    }
    if (panel === 'buy') this.refreshBuy();
    else for (const b of this.body.children) toggle(b, 'on', b.dataset.entry === sim.entry.id);
  }

  buildBuy(sim, team) {
    setText(this.title, T.buy.title);
    setText(this.note, T.buy.note);
    this.body.innerHTML = '';
    this.items = [];
    for (const u of sim.teams[team]) {
      const row = el('div', 'pp-row pp-buy', `<b style="color:${u.color}"></b><span class="pp-role"></span><span class="pp-money"></span><div class="pp-items"></div>`);
      setText(row.children[0], u.name);
      setText(row.children[1], `${ROLES[u.role]?.label ?? u.role} · ${u.weapon.name}`);
      const money = row.children[2];
      const list = row.children[3];
      for (const item of BUY.items) {
        const box = el('span', 'pp-item');
        const buy = el('button', 'btn pp-buy-btn', `<span class="n"></span> ${T.buy.gear[item]} <span class="p">${T.buy.price(BUY.prices[item])}</span>`);
        const sell = el('button', 'btn pp-sell', T.buy.sell);
        buy.addEventListener('click', () => this.request(`buy_${u.id}_${item}_+`));
        sell.addEventListener('click', () => this.request(`buy_${u.id}_${item}_-`));
        box.append(buy, sell);
        list.appendChild(box);
        this.items.push({ u, item, buy, count: buy.querySelector('.n'), sell, money });
      }
      this.body.appendChild(row);
    }
  }

  refreshBuy() {
    for (const it of this.items) {
      const n = it.u.gear[it.item] || 0;
      setText(it.count, `${n}×`);
      setText(it.money, T.buy.money(it.u.money));
      const full = n >= BUY.max[it.item] || it.u.money < BUY.prices[it.item];
      toggle(it.buy, 'off', full);
      toggle(it.buy, 'has', n > 0);
      if (it.sell.disabled !== n <= 0) it.sell.disabled = n <= 0;
    }
  }

  buildEntries(sim, panel) {
    const t = panel === 'entry' ? T.entryLate : T.prep;
    setText(this.title, t.title);
    setText(this.note, t.note);
    this.body.innerHTML = '';
    for (const e of sim.compiled.entries) {
      const b = el('button', 'btn pp-entry');
      b.dataset.entry = e.id;
      setText(b, T.prep.entries[e.id] ?? e.id);
      b.addEventListener('click', () => this.request(`chooseEntry_${e.id}`));
      this.body.appendChild(b);
    }
  }
}
