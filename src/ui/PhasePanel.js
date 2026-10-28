// Panel of the round's first decision phases, over the map (it stays visible):
//   buy       each operator's class (Asaltante / Brecha / Explorador), its kit
//             and his utility points: tap an item to buy one, − to give one
//             back (sim/prep.js, BUY in config/balance.js, ROLES in config/operators.js)
//   prep      which entry the squad starts from (hidden from the defenders)
//   setup     prep, playing the defenders: the bomb's site, the barricades,
//             how many cameras are up (their mounts are tapped on the map:
//             ui/CameraMounts.js) and the selected defender's watch order,
//             class and utility
//             (placing and aiming him are map gestures: input/PlanningController.js)
//   planning  first turn only, compact: the entry can still change
// Emits EV.REQUEST {action: 'buy_<unitId>_<item>_<+|->' | 'role_<unitId>_<role>' | 'chooseEntry_<id>' |
// 'site_<id>' | 'barricade_<doorId>' | 'watch_<mode>' | 'defrole_<role>' | 'trapmode'}; LISTO is the usual button.
import { EV } from '../core/events.js';
import { ROLES, PICK_ROLES, DEF_PICK_ROLES } from '../config/operators.js';
import { BUY, PREP, TRAP, CAMERA } from '../config/balance.js';
import { controllableUnit } from '../sim/queries.js';
import { watchOf, WATCH_MODES } from '../session/watch.js';
import { el, setText, toggle } from './dom.js';
import { T } from './texts.js';

/** Which panel the session shows now, or null. */
function panelFor(sim, session) {
  if (session.phase === 'prep' && session.team === 'defenders') return 'setup';
  if (session.phase === 'buy' || session.phase === 'prep') return session.phase;
  // Before the first turn ran the attackers may still change their entry.
  // Not in the guided tutorial, which skips the entry choice (SessionController lockedPhases).
  if (session.phase === 'planning' && !session.locked.includes('prep') && !session.tutorial.active && session.team === 'attackers' && sim.turn === 1 && sim.round.execTotal === 0 && sim.controllers.attackers === 'human') return 'entry';
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
    this.items = []; // buy panel: {u, item, count, sell, points}
    this.roles = []; // buy panel: {u, role, b, label}
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
    this.roles = [];
    this.team = sim.teams[team];
    for (const u of sim.teams[team]) {
      const row = el('div', 'pp-row pp-buy', `<b style="color:${u.color}"></b><span class="pp-role"></span><span class="pp-points"></span><div class="pp-classes"></div><div class="pp-items"></div>`);
      setText(row.children[0], u.name);
      const label = row.children[1];
      const points = row.children[2];
      const classes = row.children[3];
      const list = row.children[4];
      for (const role of PICK_ROLES) {
        const b = el('button', 'btn pp-class');
        setText(b, ROLES[role].label);
        b.title = ROLES[role].blurb;
        b.addEventListener('click', () => this.request(`role_${u.id}_${role}`));
        classes.appendChild(b);
        this.roles.push({ u, role, b, label });
      }
      for (const item of BUY.items) {
        const box = el('span', 'pp-item');
        list.appendChild(this.itemButtons(item, () => u, points));
      }
      this.body.appendChild(row);
    }
  }

  /** One item's buy (+) and give-back (−) buttons for the operator unitOf() returns (null: none). */
  itemButtons(item, unitOf, points) {
    const box = el('span', 'pp-item');
    const buy = el('button', 'btn pp-buy-btn', `<span class="n"></span> ${T.buy.gear[item]} <span class="p">${T.buy.price(BUY.prices[item])}</span>`);
    const sell = el('button', 'btn pp-sell', T.buy.sell);
    const send = (sign) => {
      const u = unitOf();
      if (u) this.request(`buy_${u.id}_${item}_${sign}`);
    };
    buy.addEventListener('click', () => send('+'));
    sell.addEventListener('click', () => send('-'));
    box.append(buy, sell);
    this.items.push({ unitOf, item, buy, count: buy.querySelector('.n'), sell, points });
    return box;
  }

  /** Counts, points and what can still be bought or given back (the class's kit cannot). */
  refreshItems() {
    for (const it of this.items) {
      const u = it.unitOf();
      const n = u ? u.gear[it.item] || 0 : 0;
      setText(it.count, `${n}×`);
      if (it.points) setText(it.points, u ? T.buy.points(u.points) : '');
      const full = !u || n >= BUY.max[it.item] || u.points < BUY.prices[it.item];
      toggle(it.buy, 'off', full);
      toggle(it.buy, 'has', n > 0);
      const kit = u ? n <= (ROLES[u.role].gear?.[it.item] || 0) : true;
      if (it.sell.disabled !== kit) it.sell.disabled = kit;
    }
  }

  refreshBuy() {
    for (const r of this.roles) {
      const mine = r.u.role === r.role;
      toggle(r.b, 'on', mine);
      const taken = !mine && ROLES[r.role].unique && this.team.some((o) => o !== r.u && o.role === r.role);
      if (r.b.disabled !== taken) r.b.disabled = taken;
      if (mine) setText(r.label, `${ROLES[r.role].label} · ${r.u.weapon.name} — ${ROLES[r.role].blurb}`);
    }
    this.refreshItems();
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
    this.camRow = row('', 'cams'); // the mounts are tapped on the map (ui/CameraMounts.js)
    this.watchRow = row('', 'watch');
    this.watchButtons = WATCH_MODES.map((m) => button(this.watchRow, S.watch[m], `watch_${m}`, m));
    this.roleRow = row('', 'roles');
    this.roleButtons = DEF_PICK_ROLES.map((r) => button(this.roleRow, ROLES[r].label, `defrole_${r}`, r));
    this.trapRow = row('', 'traps');
    this.trapButton = button(this.trapRow, S.trapMode, 'trapmode', 'trap');
    // The selected defender's utility: his class's kit plus what his points buy.
    this.items = [];
    this.gearRow = row('', 'gear');
    const selected = () => controllableUnit(sim, this.selectedId, 'defenders');
    for (const item of BUY.defenderItems) this.gearRow.children[1].appendChild(this.itemButtons(item, selected, null));
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
    setText(this.camRow.children[0], S.cameras(sim.cameras.length, CAMERA.max));
    const u = controllableUnit(sim, session.selectedId, session.team);
    this.selectedId = session.selectedId;
    setText(this.gearRow.children[0], u ? S.gearOf(u.name, T.buy.points(u.points)) : S.pickGear);
    this.refreshItems();
    setText(this.watchRow.children[0], u ? S.watchOf(u.name) : S.pickOne);
    const mode = u ? watchOf(u).mode : null;
    for (const b of this.watchButtons) {
      toggle(b, 'on', b.dataset.key === mode);
      if (b.disabled !== !u) b.disabled = !u;
    }
    // The selected defender's class (at most ROLES[id].max of each) and, for the Trampero, his traps.
    setText(this.roleRow.children[0], u ? S.roleOf(u.name, ROLES[u.role].blurb) : S.pickRole);
    for (const b of this.roleButtons) {
      const r = b.dataset.key;
      const taken = sim.teams.defenders.filter((o) => o !== u && o.role === r).length >= ROLES[r].max;
      toggle(b, 'on', !!u && u.role === r);
      toggle(b, 'off', taken);
      if (b.disabled !== !u) b.disabled = !u;
    }
    const trapper = sim.teams.defenders.find((o) => o.role === 'trapper');
    const laid = trapper ? sim.traps.filter((t) => t.alive && t.ownerId === trapper.id).length : 0;
    this.trapRow.hidden = !trapper;
    setText(this.trapRow.children[0], S.traps(laid, TRAP.perTrapper));
    const placing = !!session.ui.trapMode && !!u && u.role === 'trapper';
    toggle(this.trapButton, 'on', placing);
    setText(this.trapButton, placing ? S.trapModeOn : S.trapMode);
    const canPlace = !!u && u.role === 'trapper';
    if (this.trapButton.disabled !== !canPlace) this.trapButton.disabled = !canPlace;
  }
}
