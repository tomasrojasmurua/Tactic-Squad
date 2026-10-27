// Panel of the round's first decision phases, over the map (it stays visible):
//   buy       each operator's money and utility: tap an item to buy one, − to
//             give one back (sim/prep.js, BUY in config/balance.js)
//   prep      which entry the squad starts from (hidden from the defenders)
//   setup     prep, playing the defenders: the bomb's site, the barricades
//             and the selected defender's watch order (placing and aiming
//             him are map gestures: input/PlanningController.js)
//   planning  first turn only, compact: the entry can still change
// Emits EV.REQUEST {action: 'buy_<unitId>_<item>_<+|->' | 'chooseEntry_<id>' |
// 'site_<id>' | 'barricade_<doorId>' | 'watch_<mode>'}; LISTO is the usual button.
import { EV } from '../core/events.js';
import { ROLES } from '../config/operators.js';
import { BUY, PREP } from '../config/balance.js';
import { controllableUnit } from '../sim/queries.js';
import { watchOf, WATCH_MODES } from '../session/watch.js';
import { el, setText, toggle } from './dom.js';
import { T } from './texts.js';

/** Which panel the session shows now, or null. */
function panelFor(sim, session) {
  if (session.phase === 'prep' && session.team === 'defenders') return 'setup';
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
    toggle(this.node, 'side', panel === 'setup');
    if (!panel) {
      this.shown = null;
      return;
    }
    if (panel !== this.shown || sim !== this.sim) {
      this.shown = panel;
      this.sim = sim;
      if (panel === 'buy') this.buildBuy(sim, session.team);
      else if (panel === 'setup') this.buildSetup(sim);
      else this.buildEntries(sim, panel);
    }
    if (panel === 'buy') this.refreshBuy();
    else if (panel === 'setup') this.refreshSetup(sim, session);
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

  buildSetup(sim) {
    const S = T.setup;
    setText(this.title, S.title);
    setText(this.note, S.note);
    this.body.innerHTML = '';
    const row = (label, cls) => {
      const r = el('div', `pp-setup ${cls}`, `<span class="pp-label"></span><div class="pp-opts"></div>`);
      setText(r.children[0], label);
      this.body.appendChild(r);
      return r;
    };
    const button = (r, text, action, data) => {
      const b = el('button', 'btn pp-opt');
      setText(b, text);
      b.dataset.key = data;
      b.addEventListener('click', () => this.request(action));
      r.children[1].appendChild(b);
      return b;
    };
    const sites = row(S.site, 'sites');
    this.siteButtons = sim.compiled.sites.map((s) => button(sites, S.siteName(s.id), `site_${s.id}`, s.id));
    this.barRow = row('', 'bars');
    this.barButtons = sim.compiled.barricadeSlots.map((id) => button(this.barRow, S.doors[id] ?? id, `barricade_${id}`, id));
    this.watchRow = row('', 'watch');
    this.watchButtons = WATCH_MODES.map((m) => button(this.watchRow, S.watch[m], `watch_${m}`, m));
  }

  refreshSetup(sim, session) {
    const S = T.setup;
    for (const b of this.siteButtons) toggle(b, 'on', b.dataset.key === sim.site.id);
    let up = 0;
    for (const b of this.barButtons) {
      const on = sim.doors.find((d) => d.def.id === b.dataset.key).barricaded;
      if (on) up++;
      toggle(b, 'on', on);
    }
    for (const b of this.barButtons) toggle(b, 'off', up >= PREP.barricades && !b.classList.contains('on'));
    setText(this.barRow.children[0], S.barricades(up, PREP.barricades));
    const u = controllableUnit(sim, session.selectedId, session.team);
    setText(this.watchRow.children[0], u ? S.watchOf(u.name) : S.pickOne);
    const mode = u ? watchOf(u).mode : null;
    for (const b of this.watchButtons) {
      toggle(b, 'on', b.dataset.key === mode);
      if (b.disabled !== !u) b.disabled = !u;
    }
  }
}
