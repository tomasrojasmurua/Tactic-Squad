// Smart pause: time stops by itself when the player would otherwise lose
// control. Never resumes by itself (except closing the help it opened).
// Seeing an enemy never stops time: a contact plays out like it would for real.
//   idle        every operator is done: no route, no GO hold, nobody fighting (toggle)
//   background  the page is hidden / frozen / loses focus on a phone
//   graphics    the WebGL context is lost (the renderer restores it)
// The reason is kept in session.pauseReason; ui/coach.js turns it into the hint.
import { FLOW } from '../config/ui.js';
import { teamUnits } from '../sim/queries.js';
import { loadPref, savePref } from './storage.js';

export class AutoPause {
  /** @param pause (reason, focus?: {x, y}) => void — pauses if time is running (and shows `focus`) */
  constructor({ session, pause }) {
    this.session = session;
    this.pause = pause;
    const saved = loadPref(FLOW.storageKeys.autoPause, null);
    session.autoPause = {
      idle: typeof saved?.idle === 'boolean' ? saved.idle : FLOW.autoPause.idle,
    };
    this.onRoundStart();
    this.watchPage();
  }

  onRoundStart() {
    this.idleFor = 0;
    this.idleFired = false;
  }

  /** Toggles one auto-pause ('idle') and remembers it on this device. */
  toggle(kind) {
    const a = this.session.autoPause;
    a[kind] = !a[kind];
    savePref(FLOW.storageKeys.autoPause, a);
    return a[kind];
  }

  /** After each fixed step: the "everyone is done" detector. */
  afterStep(sim, dt) {
    let idle = true;
    let any = false;
    for (const u of teamUnits(sim, this.session.team)) {
      if (!u.alive) continue;
      any = true;
      if (u.route.length || u.waitingGo || u.target >= 0 || u.defusing || u.moving) idle = false;
    }
    if (!idle || !any || sim.outcome) {
      this.idleFor = 0;
      this.idleFired = false;
      return;
    }
    this.idleFor += dt;
    if (!this.idleFired && this.session.autoPause.idle && this.session.phase === 'running' && this.idleFor >= FLOW.autoPause.idleSeconds) {
      this.idleFired = true;
      this.pause('idle');
    }
  }

  /** Background, page freeze and lost graphics pause the round (they never resume it). */
  watchPage() {
    const away = () => this.pause('background');
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') away();
    });
    window.addEventListener('pagehide', away);
    window.addEventListener('blur', () => {
      if (this.session.touch) away(); // notification shade, incoming call, app switch
    });
    // The renderer restores the context (render/Renderer.js); the round must not run blind meanwhile.
    // Capture phase: the event is fired at the canvas and does not bubble.
    window.addEventListener('webglcontextlost', () => this.pause('graphics'), true);
  }
}
