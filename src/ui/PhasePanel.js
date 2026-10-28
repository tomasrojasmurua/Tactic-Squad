// Panel of the round's first decision phases, over the map (it stays visible):
//   buy       both sides, at once: each operator's class (picked before the
//             game, in the menu), its kit and his utility points: tap an item
//             to buy one, − to give one back (sim/prep.js, BUY in config/balance.js)
//   prep      which entry the squad starts from (hidden from the defenders)
//   recon     prep, playing the defenders, first step: the bomb's site, the
//             barricades and how many cameras are up (their mounts are tapped
//             on the map: ui/CameraMounts.js); CONFIRMAR fixes them
//   deploy    prep, playing the defenders, then: the selected defender's
//             watch order and the Trampero's traps (placing and aiming him are
//             map gestures: input/PlanningController.js)
//   planning  first turn only, compact: the entry can still change
// Emits EV.REQUEST {action: 'buy_<unitId>_<item>_<+|->' | 'chooseEntry_<id>' |
// 'site_<id>' | 'barricade_<doorId>' | 'wire_<doorId>' | 'watch_<mode>' | 'trapmode'}; LISTO is the usual button.
import { EV } from '../core/events.js';
import { ROLES } from '../config/operators.js';
import { BUY, PREP, TRAP, CAMERA } from '../config/balance.js';
import { controllableUnit } from '../sim/queries.js';
import { buyableItems } from '../sim/prep.js';
import { inRecon } from '../session/Session.js';
import { watchOf, WATCH_MODES } from '../session/watch.js';
import { el, setText, toggle } from './dom.js';
import { T } from './texts.js';

/** Which panel the session shows now, or null. */
function panelFor(sim, session) {
  if (session.phase === 'prep' && session.team === 'defenders') return inRecon(sim, session) ? 'recon' : 'deploy';
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
    root.appendChild(this.node);
  }

  request(action) {
    this.bus.emit(EV.REQUEST, { action });
  }

  update(sim, session) {
    const panel = panelFor(sim, session);
    toggle(this.node, 'hidden', !panel || session.helpOpen);
    toggle(this.node, 'compact', panel === 'entry');
    toggle(this.node, 'side', panel === 'recon' || panel === 'deploy');
    if (!panel) {
      this.shown = null;
      return;
    }
    if (panel !== this.shown || sim !== this.sim) {
      this.shown = panel;
      this.sim = sim;
      if (panel === 'buy') this.buildBuy(sim, session.team);
      else if (panel === 'recon') this.buildRecon(sim);
      else if (panel === 'deploy') this.buildDeploy(sim);
      else this.buildEntries(sim, panel);
    }
    if (panel === 'buy') this.refreshItems();
    else if (panel === 'recon') this.refreshRecon(sim);
    else if (panel === 'deploy') this.refreshDeploy(sim, session);
    else for (const b of this.body.children) toggle(b, 'on', b.dataset.entry === sim.entry.id);
  }

  buildBuy(sim, team) {
    setText(this.title, T.buy.title);
    setText(this.note, team === 'defenders' ? T.buy.noteDefend : T.buy.note);
    this.body.innerHTML = '';
    this.items = [];
    for (const u of sim.teams[team]) {
      const row = el('div', 'pp-row pp-buy', `<b style="color:${u.color}"></b><span class="pp-role"></span><span class="pp-points"></span><div class="pp-items"></div>`);
      setText(row.children[0], u.name);
      setText(row.children[1], `${ROLES[u.role].label} · ${u.weapon.name}`);
      row.children[1].title = ROLES[u.role].blurb;
      const items = buyableItems(team);
      row.children[3].style.setProperty('--n', items.length);
      for (const item of items) row.children[3].appendChild(this.itemButtons(item, () => u, row.children[2]));
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

  /** A row of the defender's panels: a label and its options. */
  setupRow(label, cls) {
    const r = el('div', `pp-setup ${cls}`, `<span class="pp-label"></span><div class="pp-opts"></div>`);
    setText(r.children[0], label);
    this.body.appendChild(r);
    return r;
  }

  setupButton(r, text, action, data) {
    const b = el('button', 'btn pp-opt');
    setText(b, text);
    b.dataset.key = data;
    b.addEventListener('click', () => this.request(action));
    r.children[1].appendChild(b);
    return b;
  }

  /** The defenders' recon: the bomb's site, the barricades and the cameras (fixed by CONFIRMAR). */
  buildRecon(sim) {
    const S = T.setup;
    setText(this.title, S.reconTitle);
    setText(this.note, S.reconNote);
    this.body.innerHTML = '';
    const sites = this.setupRow(S.site, 'sites');
    this.siteButtons = sim.compiled.sites.map((s) => this.setupButton(sites, S.siteName(s.id), `site_${s.id}`, s.id));
    this.camRow = this.setupRow('', 'cams'); // the mounts are tapped on the map (ui/CameraMounts.js)
    this.barRow = this.setupRow('', 'bars');
    this.barButtons = sim.compiled.barricadeSlots.map((id) => this.setupButton(this.barRow, S.doors[id] ?? id, `barricade_${id}`, id));
    this.wireRow = this.setupRow('', 'bars');
    this.wireButtons = sim.compiled.barricadeSlots.map((id) => this.setupButton(this.wireRow, S.doors[id] ?? id, `wire_${id}`, id));
  }

  refreshRecon(sim) {
    const S = T.setup;
    for (const b of this.siteButtons) toggle(b, 'on', b.dataset.key === sim.site.id);
    let up = 0;
    for (const b of this.barButtons) {
      const on = sim.doors.find((d) => d.def.id === b.dataset.key).barricaded;
      if (on) up++;
      toggle(b, 'on', on);
    }
    const doorOf = (id) => sim.doors.find((d) => d.def.id === id);
    for (const b of this.barButtons) toggle(b, 'off', (up >= PREP.barricades || doorOf(b.dataset.key).wired) && !b.classList.contains('on'));
    setText(this.barRow.children[0], S.barricades(up, PREP.barricades));
    let wired = 0;
    for (const b of this.wireButtons) {
      const on = doorOf(b.dataset.key).wired;
      if (on) wired++;
      toggle(b, 'on', on);
    }
    for (const b of this.wireButtons) toggle(b, 'off', (wired >= PREP.wires || doorOf(b.dataset.key).barricaded) && !b.classList.contains('on'));
    setText(this.wireRow.children[0], S.wires(wired, PREP.wires));
    setText(this.camRow.children[0], S.cameras(sim.cameras.length, CAMERA.max));
  }

  /** The defenders' operators: the selected one's watch order and the Trampero's traps. */
  buildDeploy(sim) {
    const S = T.setup;
    setText(this.title, S.title);
    setText(this.note, S.note);
    this.body.innerHTML = '';
    this.watchRow = this.setupRow('', 'watch');
    this.watchButtons = WATCH_MODES.map((m) => this.setupButton(this.watchRow, S.watch[m], `watch_${m}`, m));
    this.trapRow = this.setupRow('', 'traps');
    this.trapButton = this.setupButton(this.trapRow, S.trapMode, 'trapmode', 'trap');
  }

  refreshDeploy(sim, session) {
    const S = T.setup;
    const u = controllableUnit(sim, session.selectedId, session.team);
    setText(this.watchRow.children[0], u ? S.watchOf(u.name) : S.pickOne);
    const mode = u ? watchOf(u).mode : null;
    for (const b of this.watchButtons) {
      toggle(b, 'on', b.dataset.key === mode);
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
