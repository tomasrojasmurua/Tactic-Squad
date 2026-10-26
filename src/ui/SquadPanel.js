// Left squad panel: one card per operator (portrait, weapon, ammo, HP,
// live status). Clicking a card selects the operator.
import { EV } from '../core/events.js';
import { teamUnits } from '../sim/queries.js';
import { el, setText, toggle, setStyle, setClassName } from './dom.js';
import { ICON } from './icons.js';
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
          <div class="card-name"><span class="nm"></span><span class="bomb">${ICON.bomb}</span></div>
          <div class="card-weapon"><span class="wn"></span><span class="am"></span></div>
          <div class="hp"><div class="hp-fill"></div></div>
          <div class="card-status"></div>
        </div>
        <div class="chip-am"></div><div class="chip-hp"><div class="hp-fill"></div></div>`;
      root.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
        this.bus.emit(EV.SELECT, { unitId: u.id });
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
  }

  update(sim, session) {
    for (const [id, c] of this.cards) {
      const u = sim.units[id];
      setText(c.name, u.name);
      setText(c.weapon, u.weapon.name);
      setText(c.ammo, u.alive ? `${u.mag}/${u.reserve}` : '—');
      const hp = `${Math.max(0, (u.hp / u.maxHp) * 100)}%`;
      setStyle(c.hp, 'width', hp);
      setStyle(c.chipHp, 'width', hp);
      setText(c.chipAmmo, u.alive ? u.mag : '—');
      toggle(c.root, 'selected', session.selectedId === id && u.alive);
      toggle(c.root, 'dead', !u.alive);
      toggle(c.root, 'has-bomb', u.defusing);
      setStatus(c.status, u, sim);
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
  } else if (u.target >= 0) {
    text = S.combat;
    cls = 'alert';
  } else if (u.reloadTimer > 0) {
    text = S.reloading;
  } else if (u.waitingGo) {
    text = S.waitingGo;
    cls = 'go';
  } else if (u.stun > 0) {
    text = S.breaching;
  } else if (u.moving) {
    text = S.moving;
  } else if (u.route.length) {
    text = S.planned;
  }
  setText(node, text);
  setClassName(node, `card-status ${cls}`);
}
