// Left squad panel: one card per operator (portrait, weapon, ammo, HP,
// live status). Clicking a card selects the operator; clicking the selected one again
// (or the name under his chip) opens his sheet (ui/UnitSheet.js).
import { ROLES } from '../config/operators.js';
import { EV } from '../core/events.js';
import { teamUnits } from '../sim/queries.js';
import { el, setText, toggle, setStyle, setClassName } from './dom.js';
import { ICON } from './icons.js';
import { HUD } from '../config/ui.js';
import { T } from './texts.js';

export class SquadPanel {
  constructor(root, bus) {
    this.bus = bus;
    this.node = el('div', 'squad');
    root.appendChild(this.node);
    this.cards = new Map();
    bus.on(EV.HIT, (e) => {
      const c = this.cards.get(e.unitId);
      if (!c) return;
      c.root.classList.remove('hit');
      void c.root.offsetWidth; // restart animation
      c.root.classList.add('hit');
    });
  }

  /**
   * Touch on a chip: a tap selects him; held, his sheet shows until the finger lifts
   * (ui/UnitSheet.js, session.ui.unitPeek).
   */
  holdChip(ev, unitId) {
    ev.preventDefault();
    let peek = false;
    const timer = setTimeout(() => {
      peek = true;
      this.bus.emit(EV.REQUEST, { action: 'unitPeek', unitId });
      if (navigator.vibrate) navigator.vibrate(10);
    }, HUD.holdMs);
    const up = (u) => {
      if (u.pointerId !== ev.pointerId) return;
      clearTimeout(timer);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (peek) this.bus.emit(EV.REQUEST, { action: 'unitPeek', unitId: null });
      else this.bus.emit(EV.SELECT, { unitId });
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  /** One card per operator of `team` (the side this screen plays). */
  build(sim, team) {
    this.node.innerHTML = '';
    this.cards.clear();
    teamUnits(sim, team).forEach((u, i) => {
      const root = el('div', 'card clickable');
      root.style.setProperty('--op', u.color);
      root.innerHTML = `
        <div class="avatar">${ICON.helmet}<div class="num">${i + 1}</div></div>
        <div class="card-body">
          <div class="card-name"><span class="nm"></span><span class="bomb">${ICON.bomb}</span><span class="info-hint">ⓘ</span></div>
          <div class="card-weapon"><span class="wn"></span><span class="am"></span></div>
          <div class="hp"><div class="hp-fill"></div></div>
          <div class="card-status"></div>
        </div>
        <div class="chip-am"></div><div class="chip-hp"><div class="hp-fill"></div></div>`;
      root.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
        if (ev.pointerType === 'touch') return this.holdChip(ev, u.id);
        if (root.classList.contains('selected')) this.bus.emit(EV.REQUEST, { action: 'unitInfo' }); // his sheet
        else this.bus.emit(EV.SELECT, { unitId: u.id });
      });
      this.node.appendChild(root);
      this.cards.set(u.id, {
        root,
        name: root.querySelector('.nm'),
        weapon: root.querySelector('.wn'),
        ammo: root.querySelector('.am'),
        hp: root.querySelector('.hp-fill'),
        chipAmmo: root.querySelector('.chip-am'), // phone chip (compact HUD)
        chipHp: root.querySelector('.chip-hp .hp-fill'),
        status: root.querySelector('.card-status'),
      });
    });
    // Squad route: the others follow the selected operator in file (one route for all; again: each on his own).
    this.squadBtn = el('button', 'card squad-all clickable', `<div class="sq-ic">${ICON.squad}</div><div class="sq-l">${T.squad.button}</div>`);
    this.squadBtn.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      this.bus.emit(EV.REQUEST, { action: 'squad' });
    });
    this.squadLabel = this.squadBtn.querySelector('.sq-l');
    this.node.appendChild(this.squadBtn);
  }

  update(sim, session) {
    for (const [id, c] of this.cards) {
      const u = sim.units[id];
      setText(c.name, u.name);
      setText(c.weapon, `${ROLES[u.role]?.label ?? ''} · ${u.weapon.name}`);
      setText(c.ammo, u.alive ? `${u.mag}/${u.reserve}` : '—');
      const hp = `${Math.max(0, (u.hp / u.maxHp) * 100)}%`;
      setStyle(c.hp, 'width', hp);
      setStyle(c.chipHp, 'width', hp);
      setText(c.chipAmmo, u.alive ? u.mag : '—');
      toggle(c.root, 'selected', session.selectedId === id && u.alive);
      toggle(c.root, 'dead', !u.alive);
      // A 2v2: the teammate's operators are shown, not commanded.
      const slots = session.online && session.online.slots;
      toggle(c.root, 'partner', !!slots && !slots.includes(u.slot));
      toggle(c.root, 'has-bomb', u.defusing);
      setStatus(c.status, u, sim);
    }
    // The squad button: shown while planning with two or more alive; lit when the others follow the selected one.
    if (this.squadBtn) {
      const sel = sim.units[session.selectedId];
      const team = teamUnits(sim, session.team);
      const others = team.filter((o) => o.alive && o !== sel);
      const planning = session.phase === 'planning' || session.phase === 'prep';
      setStyle(this.squadBtn, 'display', planning && sel && sel.alive && others.length ? '' : 'none');
      const on = !!sel && others.length > 0 && others.every((o) => o.follow && o.follow.leader === sel.id);
      toggle(this.squadBtn, 'on', on);
      setText(this.squadLabel, on ? T.squad.on : T.squad.button);
    }
  }
}

/** Status line of a card: text + modifier class, highest priority first. */
function setStatus(node, u, sim) {
  const S = T.status;
  let text = S.idle;
  let cls = '';
  if (!u.alive) {
    text = S.dead;
    cls = 'alert';
  } else if (u.defusing) {
    text = `${S.defusing} ${Math.round(sim.bomb.progress * 100)}%`;
    cls = 'plant';
  } else if (u.blind > 0) {
    text = S.blind;
    cls = 'alert';
  } else if (u.target >= 0) {
    text = S.combat;
    cls = 'alert';
  } else if (u.reloadTimer > 0) {
    text = S.reloading;
  } else if (u.entry && u.entry.phase === 'prep') {
    text = u.entry.mode === 'breach' ? S.planting : u.entry.mode === 'cam' ? S.threading : S.cracking;
  } else if (u.entry && u.entry.phase === 'act') {
    // A throw from a doorway carries its item as the mode; a toss to any point, as `item`.
    text = u.entry.mode === 'breach' ? S.firing : S.throwing[u.entry.mode === 'toss' ? u.entry.item : u.entry.mode] || S.throwing.any;
    cls = 'plant';
  } else if (u.waitingGo) {
    text = u.waitCode ? S.waitingCode(u.waitCode) : S.waitingGo;
    cls = 'go';
  } else if (u.goDelay > 0) {
    text = S.bang;
    cls = 'go';
  } else if (u.stun > 0) {
    text = S.breaching;
  } else if (u.moving) {
    text = S.moving;
  } else if (u.follow) {
    text = S.following(sim.units[u.follow.leader].name);
  } else if (u.route.length) {
    text = S.planned;
  }
  setText(node, text);
  setClassName(node, `card-status ${cls}`);
}
