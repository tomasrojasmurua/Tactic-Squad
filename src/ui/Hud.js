// In-game HUD: phase banner + pause glyph, weapon plate (bottom-left),
// objective/timer (bottom-right), action buttons, hints, plant bar,
// kill feed, toasts and the red damage vignette.
import { EV } from '../core/events.js';
import { HUD, VIGNETTE } from '../config/ui.js';
import { teamUnits, enemyTeam, anyWaitingGo, anyGoHold, isGoReady } from '../sim/queries.js';
import { coachHint } from './coach.js';
import { el, setText, toggle, formatTime, setStyle, setClassName, setHidden } from './dom.js';
import { ICON, WEAPON_ICONS } from './icons.js';
import { T } from './texts.js';

export class Hud {
  /** `viewer.team` (the session) = the side this screen plays: vignette, feed and objective follow it. */
  constructor(root, bus, viewer) {
    this.bus = bus;
    this.viewer = viewer;
    this.vignette = el('div', 'vignette');
    this.vignetteLevel = 0;
    this.vignetteFloor = 0;
    root.appendChild(this.vignette);

    this.banner = el('div', 'banner', `<div class="phase"></div><div class="sub"></div>`);
    this.pauseGlyph = el('div', 'pause-glyph', ICON.pause);
    root.append(this.banner, this.pauseGlyph);

    this.weapon = el(
      'div',
      'weapon-plate',
      `<div class="gun"></div><div class="name"></div><div class="ammo"><div class="n"></div><div class="reserve"></div><div class="ic">${ICON.bullets}</div></div><div class="reload">${T.reloadTag}</div>`,
    );
    root.appendChild(this.weapon);
    this.gun = this.weapon.querySelector('.gun');
    this.gunName = this.weapon.querySelector('.name');
    this.ammo = this.weapon.querySelector('.n');
    this.reserve = this.weapon.querySelector('.reserve');
    this.reloadTag = this.weapon.querySelector('.reload');
    this.gunKind = null;

    this.objective = el(
      'div',
      'objective',
      `<div class="label">${T.objective.title.toUpperCase()}</div><div class="text">${T.objective.text}</div><div class="kills"></div><div class="row"><div class="bomb"></div><div class="timer"></div></div>`,
    );
    root.appendChild(this.objective);
    this.kills = this.objective.querySelector('.kills');
    this.bombText = this.objective.querySelector('.bomb');
    this.timer = this.objective.querySelector('.timer');

    this.hints = el('div', 'hints', T.hints.map(([k, v]) => `<span><span class="key">${k}</span>${v}</span>`).join(''));
    root.appendChild(this.hints);

    this.actions = el('div', 'actions');
    const button = (cls, html, action) => {
      const b = el('button', `btn ${cls}`, html);
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', () => this.bus.emit(EV.REQUEST, { action }));
      this.actions.appendChild(b);
      return b;
    };
    this.btnExecute = button('primary', `<span class="ico">${ICON.play}</span><span class="lbl">${T.actions.execute}</span><span class="key">ESPACIO</span>`, 'execute');
    this.btnGo = button('go', `<span>${T.actions.go}</span><span class="key">G</span>`, 'go');
    this.btnRestart = button('', `<span>${T.actions.restart}</span><span class="key">R</span>`, 'restart');
    this.btnHelp = button('', `<span>${T.actions.help}</span><span class="key">F1</span>`, 'help');
    this.btnMusic = button('music', `<span class="ico">${ICON.music}</span><span class="key">B</span>`, 'music');
    this.btnMusic.title = T.actions.music;
    root.appendChild(this.actions);
    this.executeLabel = this.btnExecute.querySelector('.lbl');
    this.executeIcon = this.btnExecute.querySelector('.ico');
    this.executeIconKind = 'play';
    this.goLabel = this.btnGo.firstChild;
    this.restartLabel = this.btnRestart.firstChild;

    // Guided tutorial: always-available way out (flow); shown with `display` from update().
    this.tutSkip = el('button', 'btn tut-skip', T.flow.tutorialSkip);
    this.tutSkip.style.display = 'none';
    this.tutSkip.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.tutSkip.addEventListener('click', () => this.bus.emit(EV.REQUEST, { action: 'tutorialSkip' }));
    root.appendChild(this.tutSkip);

    this.plant = el('div', 'plantbar', `<div class="t">${T.plant}</div><div class="bar"><div class="fill"></div></div>`);
    this.plantFill = this.plant.querySelector('.fill');
    root.appendChild(this.plant);

    this.toastNode = el('div', 'toast');
    root.appendChild(this.toastNode);
    this.toastTime = 0;

    this.feed = el('div', 'feed');
    root.appendChild(this.feed);

    this.coach = null;
    this.coachTimer = 0;
    this.coachPhase = null;
    this.wireEvents();
  }

  wireEvents() {
    const bus = this.bus;
    bus.on(EV.MUTE_CHANGED, ({ muted }) => this.toast(muted ? T.muted : T.unmuted, true));
    bus.on(EV.MUSIC_CHANGED, ({ on }) => this.toast(on ? T.musicOn : T.musicOff, true));
    bus.on(EV.ORDER_REJECTED, (e) => this.toast(`${T.reject}: ${T.rejectReason[e.reason] ?? e.reason}`));
    bus.on(EV.NOTICE, ({ code, count }) => {
      const n = T.flow.notice[code];
      if (!n) return;
      this.toast(typeof n === 'function' ? n(count) : typeof n === 'string' ? n : n[this.touch ? 'touch' : 'desk'], true);
    });
    this.rounds = 0;
    bus.on(EV.ROUND_RESET, ({ sim }) => {
      this.sim = sim;
      this.rounds++;
      // Desktop: after the first round the shortcut list and the objective's long text retire (the player knows them).
      toggle(this.hints, 'retired', this.rounds > 1);
      toggle(this.objective, 'brief', this.rounds > 1);
      this.feed.innerHTML = '';
      this.vignetteLevel = 0;
      this.vignetteFloor = 0;
    });
    bus.on(EV.HIT, (e) => {
      const u = this.sim && this.sim.units[e.unitId];
      if (u && u.team === this.viewer.team) this.vignetteLevel = Math.min(1, this.vignetteLevel + VIGNETTE.hitKick);
    });
    bus.on(EV.DEATH, (e) => {
      const sim = this.sim;
      if (!sim) return;
      const victim = sim.units[e.unitId];
      const killer = sim.units[e.killerId];
      if (victim.team === this.viewer.team) {
        this.vignetteLevel = 1;
        this.vignetteFloor = Math.min(VIGNETTE.deathFloorMax, this.vignetteFloor + VIGNETTE.deathFloorStep);
      }
      this.pushKill(killer, victim);
    });
    bus.on(EV.SPOTTED, (e) => {
      if (e.team === enemyTeam(this.viewer.team)) this.pushInfo(T.feed.contact);
    });
    bus.on(EV.GO_CODE, (e) => {
      if (e.released > 0) this.pushInfo(T.feed.go);
    });
    bus.on(EV.BOMB_DROPPED, () => this.pushInfo(T.feed.bombDropped));
    bus.on(EV.BOMB_PICKED, (e) => this.pushInfo(T.feed.bombPicked(this.sim.units[e.unitId].name)));
    bus.on(EV.BOMB_PLANTED, () => this.pushInfo(T.feed.planted));
    bus.on(EV.ROUND_END, (e) => {
      if (e.winner !== this.viewer.team) this.vignetteFloor = VIGNETTE.defeatFloor;
    });
  }

  pushKill(killer, victim) {
    const item = el('div', 'feed-item');
    // Names wear their unit's color: operator colors for a squad, the side's color otherwise (config/squad.js).
    const kc = killer ? killer.color : '#fff';
    const vc = victim.color;
    item.innerHTML = `<span class="a" style="color:${kc}">${killer ? killer.name : '?'}</span><span class="w">${killer ? killer.weapon.name : ''}</span>${ICON.skull}<span class="v" style="color:${vc}">${victim.name}</span>`;
    this.addFeed(item);
  }

  pushInfo(text) {
    const item = el('div', 'feed-item info');
    item.textContent = text;
    this.addFeed(item);
  }

  addFeed(item) {
    this.feed.appendChild(item);
    while (this.feed.children.length > HUD.feedMaxItems) this.feed.firstChild.remove();
    setTimeout(() => item.classList.add('out'), HUD.feedSeconds * 1000);
    setTimeout(() => item.remove(), HUD.feedSeconds * 1000 + HUD.feedFadeMs);
  }

  toast(text, info = false) {
    setText(this.toastNode, text);
    toggle(this.toastNode, 'info', info);
    this.toastNode.classList.add('on');
    this.toastTime = HUD.toastSeconds;
  }

  update(sim, session, dt) {
    this.touch = session.touch;
    const phase = session.phase;
    const inGame = phase !== 'title';
    this.setVisible(inGame);
    if (!inGame) {
      setStyle(this.tutSkip, 'display', 'none');
      return;
    }

    // Banner
    setClassName(this.banner, `banner ${phase}`);
    setText(this.banner.firstChild, T.phase[phase]);
    // Sub line: the coach's next step for a new player, else the phase's default.
    this.coachTimer -= dt;
    if (this.coachTimer <= 0 || session.phase !== this.coachPhase) {
      this.coachTimer = HUD.coachInterval; // re-evaluated a few times a second, not every frame
      this.coachPhase = session.phase;
      this.coach = coachHint(sim, session);
    }
    const coach = this.coach;
    setText(this.banner.lastChild, coach ? coach.text : (session.touch ? T.phaseSubTouch : T.phaseSub)[phase]);
    toggle(this.banner.lastChild, 'coach', !!coach && coach.strong);
    toggle(this.pauseGlyph, 'on', phase === 'paused');

    // Weapon plate for the selected operator
    const u = sim.units[session.selectedId] || teamUnits(sim, session.team)[0];
    if (u) {
      if (this.gunKind !== u.weaponId) {
        this.gunKind = u.weaponId;
        this.gun.innerHTML = WEAPON_ICONS[u.weaponId] || '';
      }
      setStyle(this.gun, 'color', u.alive ? '#fff' : HUD.deadGunColor);
      setText(this.gunName, `${u.name} · ${u.weapon.name.toUpperCase()}`);
      setText(this.ammo, u.alive ? u.mag : 0);
      toggle(this.ammo, 'low', u.alive && u.mag <= u.weapon.magazine * HUD.lowAmmoFraction);
      setText(this.reserve, `/${u.reserve}`);
      toggle(this.reloadTag, 'on', u.alive && u.reloadTimer > 0);
    }

    // Objective
    const enemies = teamUnits(sim, enemyTeam(session.team));
    let dead = 0;
    for (const d of enemies) if (!d.alive) dead++;
    setText(this.kills, T.objective.kills(dead, enemies.length));
    const b = sim.bomb;
    const carrier = b.carrierId >= 0 ? sim.units[b.carrierId] : null;
    setText(this.bombText, b.planted ? T.objective.bombPlanted : carrier ? T.objective.bombCarrier(carrier.name) : T.objective.bombDropped);
    setText(this.timer, formatTime(sim.timeLeft));
    toggle(this.timer, 'low', sim.timeLeft < HUD.lowTimeSeconds);

    // Actions
    const running = phase === 'running';
    setText(this.executeLabel, phase === 'planning' ? T.actions.execute : running ? T.actions.pause : T.actions.resume);
    const iconKind = running ? 'pause' : 'play';
    if (iconKind !== this.executeIconKind) {
      this.executeIconKind = iconKind;
      this.executeIcon.innerHTML = ICON[iconKind];
    }
    setHidden(this.btnExecute, phase === 'ended');
    const waiting = anyWaitingGo(sim);
    const holds = anyGoHold(sim);
    setHidden(this.btnGo, !(waiting || holds) || phase === 'ended');
    // GO only works while time runs: in planning it shows what it will do, disabled.
    const goLater = phase === 'planning';
    if (this.btnGo.disabled !== goLater) this.btnGo.disabled = goLater;
    setText(this.goLabel, goLater ? T.flow.goLater : T.actions.go);
    const armed = session.confirm.action === 'restart';
    setText(this.restartLabel, armed ? T.flow.confirmRestart : T.actions.restart);
    if ((this.btnRestart.dataset.armed || '') !== (armed ? '1' : '')) this.btnRestart.dataset.armed = armed ? '1' : '';
    setStyle(this.tutSkip, 'display', session.tutorial.active ? '' : 'none');
    toggle(this.btnGo, 'ready', waiting);
    toggle(this.btnGo, 'all', isGoReady(sim)); // everyone in position: the moment to press it
    toggle(this.btnMusic, 'off', !session.musicOn);
    toggle(this.hints, 'hidden', running || phase === 'ended');

    // Plant progress
    const planting = b.planterId >= 0 && !b.planted;
    toggle(this.plant, 'on', planting);
    if (planting) setStyle(this.plantFill, 'width', `${(b.progress * 100).toFixed(1)}%`);

    // Toast
    if (this.toastTime > 0) {
      this.toastTime -= dt;
      if (this.toastTime <= 0) this.toastNode.classList.remove('on');
    }

    // Vignette
    this.vignetteLevel = Math.max(this.vignetteFloor, this.vignetteLevel - dt * VIGNETTE.decayPerSecond);
    setStyle(this.vignette, 'opacity', this.vignetteLevel.toFixed(3));
  }

  setVisible(on) {
    const d = on ? '' : 'none';
    for (const n of [this.banner, this.weapon, this.objective, this.actions, this.hints, this.feed]) {
      if (n.style.display !== d) n.style.display = d;
    }
  }
}
