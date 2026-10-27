// Root of the DOM user interface. Components read sim/session state each
// frame and talk back only through bus requests (EV.REQUEST / EV.SELECT).
import { EV } from '../core/events.js';
import { Hud } from './Hud.js';
import { SquadPanel } from './SquadPanel.js';
import { Screens } from './Screens.js';
import { WorldLabels } from './WorldLabels.js';
import { Cursor } from './Cursor.js';
import { TouchBar } from './TouchBar.js';
import { EntryPicker } from './EntryPicker.js';
import { PhasePanel } from './PhasePanel.js';
import { DroneStick } from './DroneStick.js';
import { HudOcclusion } from './HudOcclusion.js';
import { GfxNotice } from './GfxNotice.js';
import { el, toggle, setStyle } from './dom.js';
import { ICON } from './icons.js';
import { T } from './texts.js';

export class UI {
  /** `session` is read live (its `team` = the side this screen plays); the UI never writes it. */
  constructor(root, bus, input, session) {
    this.root = root;
    this.labels = new WorldLabels(root, bus);
    this.hud = new Hud(root, bus, session);
    this.squad = new SquadPanel(root, bus);
    this.screens = new Screens(root, bus);
    this.cursor = new Cursor(root, input);
    this.touchBar = new TouchBar(root, bus);
    this.entryPicker = new EntryPicker(root, bus);
    this.phasePanel = new PhasePanel(root, bus);
    this.droneStick = new DroneStick(root, bus);
    this.rotate = el('div', 'rotate', `<div class="rotate-box"><div class="rotate-phone">${ICON.phone}</div><h2>${T.rotate.title}</h2><p>${T.rotate.text}</p></div>`);
    root.appendChild(this.rotate);
    // Plates that fade when a unit is under them (the touch column only dims: it stays usable).
    const h = this.hud;
    this.occlusion = new HudOcclusion([this.squad.node, h.feed, h.objective, h.banner, h.weapon, this.touchBar.column]);
    this.gfx = new GfxNotice(root, bus, input.canvas);
    bus.on(EV.ROUND_RESET, ({ sim }) => {
      this.squad.build(sim, session.team);
      this.labels.build(sim, session.team);
    });
  }

  update(sim, session, dt, camera, poseOf) {
    this.occlusion.update(sim, session, dt, camera); // first: reads layout while it is still clean
    toggle(document.body, 'touch', session.touch);
    this.hud.update(sim, session, dt);
    setStyle(this.squad.node, 'display', session.phase === 'title' ? 'none' : '');
    this.squad.update(sim, session);
    this.screens.update(sim, session);
    this.labels.update(sim, session, camera, poseOf, this.occlusion);
    this.gfx.update(session);
    this.cursor.update(session);
    this.touchBar.update(sim, session);
    this.entryPicker.update(sim, session);
    this.phasePanel.update(sim, session);
    this.droneStick.update(session);
    this.screens.setTouch(session.touch);
  }
}
