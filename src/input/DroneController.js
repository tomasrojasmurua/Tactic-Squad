// Drives the recon drone during the drone phase: WASD / arrows, or the
// on-screen stick (ui/DroneStick.js, EV.DRONE_STICK). The direction is
// quantized to DRONE.directions headings and sent only when it changes
// (session steerDrone: an order stamped with the drone phase's step).
import { EV } from '../core/events.js';
import { KEYS } from '../config/input.js';
import { DRONE } from '../config/balance.js';
import { TAU } from '../core/math.js';

const DEAD_ZONE = 0.3; // stick deflection below this = stop

export class DroneController {
  /** @param steer (dir) => void — dir: heading index or -1 (session/SessionController.js steerDrone) */
  constructor({ input, bus, session, steer }) {
    this.input = input;
    this.session = session;
    this.steer = steer;
    this.stick = { x: 0, y: 0 };
    this.last = -1;
    bus.on(EV.DRONE_STICK, ({ x, y }) => {
      this.stick.x = x;
      this.stick.y = y;
    });
  }

  /** Every frame. */
  update() {
    if (this.session.phase !== 'drone') {
      if (this.session.phase !== 'paused') this.last = -1; // a new drone starts stopped
      return;
    }
    const down = (binding) => binding.some((c) => this.input.isDown(c));
    let x = 0;
    let y = 0;
    if (down(KEYS.panLeft)) x -= 1;
    if (down(KEYS.panRight)) x += 1;
    if (down(KEYS.panUp)) y -= 1;
    if (down(KEYS.panDown)) y += 1;
    if (!x && !y) {
      x = this.stick.x;
      y = this.stick.y;
    }
    const n = DRONE.directions;
    const dir = Math.hypot(x, y) < DEAD_ZONE ? -1 : ((Math.round((Math.atan2(y, x) / TAU) * n) % n) + n) % n;
    if (dir === this.last) return;
    this.last = dir;
    this.steer(dir);
  }
}
