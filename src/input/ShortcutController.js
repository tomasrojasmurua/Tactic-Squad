// Session-level shortcuts (execute/pause, GO, restart, new plan, help, mute, music, focus, defuse, overview).
// Emits EV.REQUEST; the Game decides what each request means in each phase.
import { EV } from '../core/events.js';
import { KEYS } from '../config/input.js';
import { matches } from './InputManager.js';

export class ShortcutController {
  constructor(bus, session) {
    this.bus = bus;
    this.session = session;
  }

  request(action) {
    this.bus.emit(EV.REQUEST, { action });
    return true;
  }

  onKeyDown(e) {
    if (e.repeat) return false;
    const code = e.code;
    if (this.session.phase === 'title') {
      if (matches(KEYS.execute, code) || matches(KEYS.pause, code)) return this.request('start');
      return false;
    }
    if (matches(KEYS.help, code)) return this.request('help');
    if (this.session.helpOpen && matches(KEYS.deselect, code)) return this.request('help');
    if (matches(KEYS.pause, code)) return this.request('toggle');
    if (matches(KEYS.execute, code)) return this.request('execute');
    if (matches(KEYS.go, code)) return this.request('go');
    if (matches(KEYS.restart, code)) return this.request('restart');
    if (matches(KEYS.newPlan, code)) return this.request('newPlan');
    if (matches(KEYS.mute, code)) return this.request('mute');
    if (matches(KEYS.music, code)) return this.request('music');
    if (matches(KEYS.focus, code)) return this.request('focus');
    if (matches(KEYS.defuse, code)) return this.request('defuse');
    if (matches(KEYS.overview, code)) return this.request('overview');
    return false;
  }
}
