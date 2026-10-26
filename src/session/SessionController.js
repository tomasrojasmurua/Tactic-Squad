// Session flow: turns player requests (EV.REQUEST from keyboard shortcuts,
// HUD and touch buttons) and selections (EV.SELECT) into phase changes,
// sim commands and app actions. The only place that decides what a request
// means in each phase. Owner: gameplay (flow).
//
// Helpers: PlanRecorder (tick-stamped orders, honest retry), AutoPause (smart
// pause), Tutorial (guided first round), CameraFraming (input/, injected).
import { EV } from '../core/events.js';
import { SIM } from '../config/balance.js';
import { requestFullscreenLandscape, toggleFullscreen } from '../ui/device.js';
import { controllableUnit, defuseCandidate, firstAlive, teamUnits } from '../sim/queries.js';
import { armOrConfirm } from './confirm.js';
import { PlanRecorder } from './PlanRecorder.js';
import { AutoPause } from './AutoPause.js';
import { Tutorial } from './Tutorial.js';

export class SessionController {
  /**
   * @param deps.loop       FixedLoop (setSimulating)
   * @param deps.planning   PlanningController (route edit actions, preview refresh)
   * @param deps.framing    CameraFraming (first shot, "see all", focus)
   * @param deps.getSim     () => current Simulation
   * @param deps.restart    (seed) => starts a new round with that seed
   */
  constructor({ bus, session, loop, planning, framing, audio, getSim, restart }) {
    this.bus = bus;
    this.session = session;
    this.loop = loop;
    this.planning = planning;
    this.framing = framing;
    this.audio = audio; // audio/AudioDirector.js: unlock, toggleMute, toggleMusic
    session.musicOn = audio.musicOn;
    this.getSim = getSim;
    this.restart = restart;
    this.seed = SIM.seed; // the scenario: kept on retry (same plan = same round); "reroll" changes it
    this.postRoundTimer = 0;
    this.helpPaused = false; // the help opened while time ran (closing it resumes)
    this.recorder = new PlanRecorder();
    this.autoPause = new AutoPause({ session, pause: (reason, focus) => this.pause(reason, focus) });
    this.tutorial = new Tutorial(session);

    bus.on(EV.COMMAND, (cmd) => this.record(cmd));
    bus.on(EV.REQUEST, ({ action }) => this.handleRequest(action));
    bus.on(EV.SELECT, ({ unitId }) => this.select(unitId));
    bus.on(EV.ROUTE_CHANGED, () => this.planning.refresh());
    bus.on(EV.DEATH, ({ unitId }) => {
      if (unitId === this.session.selectedId) this.selectNextAlive();
    });
  }

  get sim() {
    return this.getSim();
  }

  /** Called by Game when a new round's simulation exists. */
  onRoundStart() {
    this.selectNextAlive();
    if (this.tutorial.current() === 'select') this.session.selectedId = -1;
    this.postRoundTimer = 0;
    this.autoPause.onRoundStart();
  }

  setPhase(phase, reason = null) {
    const previous = this.session.phase;
    if (previous === phase) return;
    this.session.phase = phase;
    this.session.pauseReason = phase === 'paused' ? reason || 'manual' : null;
    this.session.helpOpen = false; // the help never survives a phase change (it would cover the result)
    if (phase !== 'paused') this.helpPaused = false;
    this.planning.cancel();
    this.planning.refresh();
    this.loop.setSimulating(phase === 'running' || (phase === 'ended' && this.postRoundTimer > 0));
    this.bus.emit(EV.PHASE, { phase, previous, reason: this.session.pauseReason });
  }

  /** Stops time if it runs (auto-pause reasons, help, background...); a given focus point is brought on screen. Never resumes. */
  pause(reason, focus = null) {
    if (this.session.phase !== 'running') return;
    this.setPhase('paused', reason);
    if (focus) this.framing.reveal(focus.x, focus.y);
    this.sound('pause');
  }

  /** Every order, tick-stamped (planning = tick 0). A live order during a replay drops the rest of it. */
  record(cmd) {
    const phase = this.session.phase;
    if (phase === 'title' || phase === 'ended') return;
    const dropped = this.recorder.record(cmd, this.sim.tick);
    this.session.replay.pending = this.recorder.pending;
    if (dropped) this.notice('replayDiverged', dropped);
  }

  /** Before each fixed step: recorded orders due at this tick are re-issued. */
  beforeStep(sim) {
    if (!this.recorder.pending) return;
    this.recorder.due(sim.tick, (cmd) => this.bus.emit(EV.COMMAND, cmd));
    this.session.replay.pending = this.recorder.pending;
  }

  /** After each fixed step: detect the round outcome, run the post-round tail, smart pauses. */
  afterStep(sim, dt) {
    if (sim.outcome && this.session.phase === 'running') {
      this.postRoundTimer = SIM.postRoundSeconds;
      this.setPhase('ended');
    } else if (this.session.phase === 'ended') {
      this.postRoundTimer -= dt;
      if (this.postRoundTimer <= 0) this.loop.setSimulating(false);
    }
    this.autoPause.afterStep(sim, dt);
  }

  /** Every frame: orientation, the guided round, expired confirmations. */
  update() {
    // A phone turned to portrait mid-round is covered by the "rotate" screen, so pause.
    if (this.session.touch && window.innerHeight > window.innerWidth) this.pause('orientation');
    const t = this.tutorial.update(this.sim);
    if (t === 'done') this.notice('tutorialDone');
    else if (t === 'step') this.sound('select');
    const c = this.session.confirm;
    if (c.action && performance.now() >= c.until) c.action = null;
  }

  command(cmd) {
    cmd.team = this.session.team;
    this.bus.emit(EV.COMMAND, cmd);
  }

  sound(name) {
    this.bus.emit(EV.UI_SOUND, { name });
  }

  notice(code, count = 0) {
    this.bus.emit(EV.NOTICE, { code, count });
  }

  /** Does the player's side have any route drawn (something a wipe would lose)? */
  hasPlan() {
    return teamUnits(this.sim, this.session.team).some((u) => u.route.length > 0);
  }

  /** Destructive requests need a confirming repeat (session/confirm.js). True = go ahead. */
  confirmed(action) {
    const r = armOrConfirm(this.session, action, this.hasPlan());
    if (r === 'armed') {
      this.notice(`confirm_${action}`);
      this.sound('undo');
    }
    return r !== 'armed';
  }

  handleRequest(action) {
    const phase = this.session.phase;
    const session = this.session;
    if (session.confirm.action && session.confirm.action !== action) session.confirm.action = null;
    switch (action) {
      case 'start':
      case 'tutorial':
        if (phase !== 'title') return;
        this.audio.unlock();
        if (session.touch) requestFullscreenLandscape();
        if (action === 'tutorial' || !session.tutorial.done) this.tutorial.begin();
        this.setPhase('planning');
        this.framing.frameStart();
        this.sound('select');
        return;
      case 'tutorialSkip':
        if (this.tutorial.finish()) {
          if (session.selectedId < 0) this.selectNextAlive();
          this.notice('tutorialSkipped');
        }
        return;
      case 'toggle':
      case 'execute':
        if (phase === 'planning' && this.tutorial.blocksExecute()) {
          this.notice('tutorialFirst');
          return;
        }
        if (phase === 'planning' || phase === 'paused') {
          this.setPhase('running');
          this.sound(phase === 'planning' ? 'execute' : 'resume');
        } else if (phase === 'running') {
          this.pause('manual');
        }
        return;
      case 'defuse':
        if (phase !== 'ended' && phase !== 'title') {
          // The selected operator if he is at the bomb, else whoever is closest to it.
          const sel = this.session.selectedId;
          this.command({ type: 'defuseNow', unitId: defuseCandidate(this.sim, sel) ? sel : -1 });
        }
        return;
      case 'undo':
        this.planning.undo();
        return;
      case 'clear':
        this.planning.clear();
        return;
      case 'hold':
        this.planning.toggleHold();
        return;
      case 'fullscreen':
        toggleFullscreen();
        return;
      case 'overview':
        if (phase !== 'title') this.framing.toggleOverview();
        return;
      case 'go':
      case 'go_A':
      case 'go_B':
      case 'go_C': {
        // Plain GO (key G, touch button): the next code someone waits for; go_X: that code.
        const code = action.length > 3 ? action.slice(3) : undefined;
        if (phase === 'running' || phase === 'paused') this.command(code ? { type: 'go', code } : { type: 'go' });
        else if (phase === 'planning') this.bus.emit(EV.ORDER_REJECTED, { unitId: -1, reason: 'goBeforeStart' });
        return;
      }
      case 'entryCycle':
        this.planning.cycleEntry();
        return;
      case 'restart':
        // Retry: the same plan (every recorded order, at its tick) on the same seed.
        // In planning it wipes the plan instead — only after a confirming second press.
        if (phase === 'title' || !this.confirmed(action)) return;
        this.newAttempt(phase === 'planning' ? [] : this.recorder.log);
        this.sound('undo');
        return;
      case 'reroll':
        // Same plan, new roll of the dice (explicit choice; retry keeps the seed).
        if (phase === 'title') return;
        this.seed += SIM.retrySeedStride;
        this.newAttempt(this.recorder.log);
        this.notice('rerolled');
        return;
      case 'newPlan':
        if (phase === 'title' || !this.confirmed(action)) return;
        this.newAttempt([]);
        this.sound('undo');
        return;
      case 'help':
        this.toggleHelp();
        return;
      case 'autoPauseIdle':
        this.notice(`idle${this.autoPause.toggle('idle') ? 'On' : 'Off'}`);
        return;
      case 'mute':
        this.bus.emit(EV.MUTE_CHANGED, { muted: this.audio.toggleMute() });
        return;
      case 'music':
        session.musicOn = this.audio.toggleMusic();
        this.bus.emit(EV.MUSIC_CHANGED, { on: session.musicOn });
        return;
      case 'focus': {
        const u = controllableUnit(this.sim, session.selectedId, session.team);
        if (u) this.framing.centerOn(u.x, u.y);
        return;
      }
      default:
        if (action.startsWith('entry_')) this.planning.setEntry(action.slice(6));
    }
  }

  /** Opening the help stops time; closing it resumes only if the help was what stopped it. */
  toggleHelp() {
    const session = this.session;
    if (session.phase === 'title') return;
    if (session.helpOpen) {
      session.helpOpen = false;
      const resume = this.helpPaused && session.phase === 'paused' && session.pauseReason === 'help';
      this.helpPaused = false;
      if (resume) {
        this.setPhase('running');
        this.sound('resume');
      }
      return;
    }
    if (session.phase === 'running') {
      this.setPhase('paused', 'help');
      this.helpPaused = true;
    }
    session.helpOpen = true;
  }

  /**
   * Fresh round on the session seed, then the given recorded orders: tick-0
   * ones re-issued now (they are logged again), later ones at their ticks.
   */
  newAttempt(log) {
    const now = this.recorder.beginAttempt(log);
    const retry = log.length > 0;
    this.restart(this.seed);
    for (const cmd of now) this.bus.emit(EV.COMMAND, cmd);
    this.session.replay.pending = this.recorder.pending;
    this.session.replay.attempt = retry ? this.session.replay.attempt + 1 : 0;
    this.planning.refresh();
  }

  select(unitId) {
    if (!controllableUnit(this.sim, unitId, this.session.team)) return;
    this.session.selectedId = unitId;
    this.planning.refresh();
  }

  selectNextAlive() {
    const next = firstAlive(this.sim, this.session.team);
    this.session.selectedId = next ? next.id : -1;
  }
}
