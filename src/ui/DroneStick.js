// On-screen stick for the recon drone (drone phase; any pointer: finger or
// mouse). Emits EV.DRONE_STICK {x, y} (-1..1, screen = map axes) while held
// and {0, 0} on release; input/DroneController.js turns it into orders.
import { EV } from '../core/events.js';
import { el, toggle, setStyle } from './dom.js';
import { T } from './texts.js';

export class DroneStick {
  constructor(root, bus) {
    this.bus = bus;
    this.node = el('div', 'drone-stick', `<div class="lbl">${T.drone.stick}</div><div class="knob"></div>`);
    this.knob = this.node.querySelector('.knob');
    this.pointer = -1;
    const move = (e) => {
      if (e.pointerId !== this.pointer) return;
      const r = this.node.getBoundingClientRect();
      const half = r.width / 2;
      let x = (e.clientX - r.left - half) / half;
      let y = (e.clientY - r.top - half) / half;
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      this.set(x, y);
    };
    const up = (e) => {
      if (e.pointerId !== this.pointer) return;
      this.pointer = -1;
      this.set(0, 0);
    };
    this.node.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.pointer = e.pointerId;
      this.node.setPointerCapture?.(e.pointerId);
      move(e);
    });
    this.node.addEventListener('pointermove', move);
    this.node.addEventListener('pointerup', up);
    this.node.addEventListener('pointercancel', up);
    root.appendChild(this.node);
  }

  set(x, y) {
    setStyle(this.knob, 'transform', `translate(${(x * 40).toFixed(1)}px, ${(y * 40).toFixed(1)}px)`);
    this.bus.emit(EV.DRONE_STICK, { x, y });
  }

  update(session) {
    const on = session.phase === 'drone' && !session.replay.exec && !session.helpOpen;
    toggle(this.node, 'on', on);
    if (!on && this.pointer >= 0) {
      this.pointer = -1;
      this.set(0, 0);
    }
  }
}
