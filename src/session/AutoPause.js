// System pause: during an execution turn time stops by itself when the
// player cannot follow it — the page is hidden or frozen, a phone loses
// focus, the WebGL context is lost. Never on contact, never by itself
// otherwise: a turn plays out like it would for real (the planning between
// turns is the only "pause" there is). In the decision phases the clock just
// stops counting meanwhile (session/PhaseClock.js).
// The reason is kept in session.pauseReason; ui/coach.js turns it into the hint.

export class AutoPause {
  /** @param pause (reason) => void — pauses if a turn is running */
  constructor({ session, pause }) {
    this.session = session;
    this.pause = pause;
    this.watchPage();
  }

  /** Background, page freeze and lost graphics pause the turn (they never resume it). */
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
