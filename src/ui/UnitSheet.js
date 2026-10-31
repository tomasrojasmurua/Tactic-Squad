// The selected operator's sheet (one of the player's own): his class with its emblem, his weapon
// with the ammo left, the utility he still carries, his health and what his class does
// differently. Opens and closes by tapping the selected operator again (his chip or the name
// under it), FICHA's × or the J key; it follows the selection while open.
// Reads session.ui.unitInfo; emits EV.REQUEST {action: 'unitInfo'} to close.
import { EV } from '../core/events.js';
import { ROLES } from '../config/operators.js';
import { controllableUnit } from '../sim/queries.js';
import { ROLE_COLOR, roleTraits } from './Roster.js';
import { el, setText, toggle } from './dom.js';
import { ROLE_EMBLEM, GEAR_ICON, WEAPON_ICONS } from './icons.js';
import { T } from './texts.js';

const GEAR_ORDER = ['flash', 'frag', 'smoke', 'breach', 'molotov', 'gas'];

export class UnitSheet {
  constructor(root, bus) {
    this.bus = bus;
    this.node = el('div', 'unit-sheet hidden');
    this.node.addEventListener('pointerdown', (e) => e.stopPropagation()); // not a tap on the map
    root.appendChild(this.node);
    this.shown = null; // the unit (and class) the sheet was built for
  }

  build(u) {
    const S = T.unitSheet;
    const r = ROLES[u.role] || {};
    this.node.style.setProperty('--rc', ROLE_COLOR[u.role] || u.color);
    this.node.style.setProperty('--op', u.color);
    this.node.innerHTML = `
      <div class="us-head"><span class="us-em">${ROLE_EMBLEM[u.role] || ''}</span>
        <div class="us-title"><b class="us-class"></b><span class="us-name"></span></div>
        <button class="us-close" aria-label="${S.close}">×</button>
      </div>
      <p class="us-blurb"></p>
      <div class="us-sec"><h4>${S.weapon}</h4>
        <div class="us-gun">${WEAPON_ICONS[u.weaponId] || ''}<span><b class="us-wname"></b><small class="us-ammo"></small></span></div>
      </div>
      <div class="us-sec"><h4>${S.gear}</h4><div class="us-gear"></div></div>
      <div class="us-sec"><h4>${S.traits}</h4><ul class="us-traits"><li class="us-hp"></li><li class="us-stress"></li>${roleTraits(u.role).map((t) => `<li>${t}</li>`).join('')}</ul></div>`;
    const q = (s) => this.node.querySelector(s);
    setText(q('.us-class'), r.label || u.role);
    setText(q('.us-name'), u.name);
    setText(q('.us-blurb'), r.blurb || '');
    setText(q('.us-wname'), u.weapon.name);
    q('.us-close').addEventListener('pointerdown', (e) => {
      e.preventDefault(); // a touch would otherwise not become a click (the game's input takes touches)
      this.bus.emit(EV.REQUEST, { action: 'unitInfo' });
    });
    this.ammo = q('.us-ammo');
    this.gear = q('.us-gear');
    this.hp = q('.us-hp');
    this.stress = q('.us-stress');
    this.gearKey = '';
  }

  update(sim, session) {
    // A held chip (touch) shows that operator's; else the open sheet shows the selected one's.
    const id = session.ui.unitPeek !== null && session.ui.unitPeek !== undefined ? session.ui.unitPeek : session.ui.unitInfo ? session.selectedId : -1;
    const u = session.phase !== 'title' && session.phase !== 'ended' ? controllableUnit(sim, id, session.team) : null;
    toggle(this.node, 'hidden', !u);
    if (!u) return;
    const key = `${sim.seed}:${u.id}:${u.role}`;
    if (this.shown !== key) {
      this.shown = key;
      this.build(u);
    }
    const S = T.unitSheet;
    setText(this.ammo, S.ammo(u.mag, u.reserve));
    setText(this.hp, S.hp(Math.max(0, Math.round(u.hp)), u.maxHp));
    const st = Math.round(u.stress * 100);
    this.stress.hidden = st < 5;
    if (st >= 5) setText(this.stress, S.stress(st));
    // The utility he carries now (bought, or left after throwing): an item spent stays, dimmed at 0.
    const kit = (ROLES[u.role] && ROLES[u.role].gear) || {};
    const items = GEAR_ORDER.filter((k) => (u.gear[k] || 0) > 0 || (kit[k] || 0) > 0);
    const gearKey = items.map((k) => `${k}${u.gear[k] || 0}`).join(',');
    if (gearKey !== this.gearKey) {
      this.gearKey = gearKey;
      this.gear.innerHTML = items.length
        ? items.map((k) => `<span class="us-item${u.gear[k] ? '' : ' spent'}">${GEAR_ICON[k] || ''}<span>${u.gear[k] || 0} × ${T.flow.pick.gearName[k] || k}</span></span>`).join('')
        : `<span class="us-none">${S.noGear}</span>`;
    }
  }
}
