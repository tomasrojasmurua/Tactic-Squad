// Session flow: turns player requests (EV.REQUEST from keyboard shortcuts,
// HUD and touch buttons) and selections (EV.SELECT) into phase changes,
// sim commands and app actions. The only place that decides what a request
// means in each phase. Owner: gameplay (flow).
//
// The round's phases live in the sim (sim/round.js); this mirrors them on
// screen (session.phase), ends the decision phases (LISTO, or the deadline:
// PhaseClock) and runs the fixed-step loop only while a turn executes.
//
// Helpers: PhaseClock (deadlines), PlanRecorder (orders per phase, honest
// retry), AutoPause (system pause), Tutorial (guided first round),
// CameraFraming (input/, injected).
import { EV } from '../core/events.js';
import { SIM } from '../config/balance.js';
import { requestFullscreenLandscape, toggleFullscreen } from '../ui/device.js';
import { controllableUnit, defuseCandidate, firstAlive, teamUnits, codeInUse } from '../sim/queries.js';
import { scheduledGo } from '../sim/round.js';
import { ENTRY } from '../config/balance.js';
import { SESSION_PHASE, isDecisionPhase } from './Session.js';
import { armOrConfirm } from './confirm.js';
import { PlanRecorder } from './PlanRecorder.js';
import { PhaseClock } from './PhaseClock.js';
import { AutoPause } from './AutoPause.js';
import { Tutorial } from './Tutorial.js';

/** A GO button cycles its code through these moments of the turn (s), then off. */
const GO_STEPS = Object.freeze([0, 1, 2, 3, 4]);

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
    this.helpPaused = false; // the help opened while a turn ran (closing it resumes)
    this.recorder = new PlanRecorder();
    this.clock = new PhaseClock({ session, advance: () => this.advance() });
    this.autoPause = new AutoPause({ session, pause: (reason) => this.pause(reason) });
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
  }

  setPhase(phase, reason = null) {
    const previous = this.session.phase;
    if (previous === phase) return;
    this.session.phase = phase;
    this.session.pauseReason = phase === 'paused' ? reason : null;
    this.session.helpOpen = false; // the help never survives a phase change (it would cover the result)
    if (phase !== 'paused') this.helpPaused = false;
    this.planning.cancel();
    this.planning.refresh();
    this.loop.setSimulating(phase === 'running' || (phase === 'ended' && this.postRoundTimer > 0));
    this.bus.emit(EV.PHASE, { phase, previous, reason: this.session.pauseReason, turn: this.sim.turn });
  }

  /**
   * Puts the screen in the sim's phase. Entering a decision phase starts its
   * clock and, on a retry, re-issues that phase's recorded orders.
   * `fresh`: a new round's first phase (even if the screen already shows that phase).
   */
  syncPhase(fresh = false) {
    const sim = this.sim;
    if (sim.phase === 'end') {
      this.postRoundTimer = SIM.postRoundSeconds;
      this.setPhase('ended');
      return;
    }
    const phase = SESSION_PHASE[sim.phase];
    if (phase === this.session.phase && !fresh) return;
    this.setPhase(phase);
    if (!isDecisionPhase(this.session)) return;
    const auto = this.recorder.enterPhase((cmd) => this.bus.emit(EV.COMMAND, cmd));
    this.session.replay.pending = this.recorder.pending;
    this.clock.start(sim.phase, auto);
    if (phase === 'planning' && this.selectedDead() && this.tutorial.current() !== 'select') this.selectNextAlive();
  }

  /** Ends the current decision phase (LISTO, deadline, replay): the next phase or the turn's execution. */
  advance() {
    if (!isDecisionPhase(this.session)) return;
    this.planning.cancel();
    this.recorder.advance();
    this.sim.advancePhase();
    this.sound(this.sim.phase === 'exec' ? 'execute' : 'select');
    this.syncPhase();
  }

  /** Stops a running turn (system reasons, help); a decision phase only stops its clock (PhaseClock). Never resumes. */
  pause(reason) {
    if (this.session.phase !== 'running') return;
    this.setPhase('paused', reason);
    this.sound('pause');
  }

  /** Orders are recorded per decision phase (they are not taken otherwise). A new one in a replayed phase takes over. */
  record(cmd) {
    if (!isDecisionPhase(this.session)) return;
    const dropped = this.recorder.record(cmd);
    this.session.replay.pending = this.recorder.pending;
    if (dropped) {
      this.clock.takeOver();
      this.notice('replayDiverged', dropped);
    }
  }

  /** After each fixed step: the turn ended (back to planning) or the round did; the post-round tail. */
  afterStep(sim, dt) {
    const phase = this.session.phase;
    if (phase === 'running' && sim.phase !== 'exec') this.syncPhase();
    else if (phase === 'ended') {
      this.postRoundTimer -= dt;
      if (this.postRoundTimer <= 0) this.loop.setSimulating(false);
    }
  }

  /** Every frame: the decision clock, orientation, the guided round, expired confirmations. */
  update(dt) {
    // A phone turned to portrait mid-turn is covered by the "rotate" screen, so pause.
    if (this.session.touch && window.innerHeight > window.innerWidth) this.pause('orientation');
    if (isDecisionPhase(this.session)) this.clock.update(dt);
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
    return teamUnits(this.sim, this.session.team).some((u) => u.route.length > 0) || this.recorder.segments.length > 1;
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

  /** LISTO / SPACE: ends a decision phase; resumes a paused turn; a running turn cannot be stopped. */
  ready() {
    const phase = this.session.phase;
    if (phase === 'planning' && this.tutorial.blocksExecute()) {
      this.notice('tutorialFirst');
      return;
    }
    if (isDecisionPhase(this.session)) return this.advance();
    if (phase === 'paused') {
      this.setPhase('running');
      this.sound('resume');
    } else if (phase === 'running') this.notice('noPause');
  }

  /** A GO button while planning: cycles when in the turn its code goes (0 s, 1 s ... 4 s, off). */
  cycleGo(code) {
    const sim = this.sim;
    sim.flushCommands(); // the holds just drawn count
    const team = this.session.team;
    if (!code) {
      const scheduled = ENTRY.goCodes.find((c) => scheduledGo(sim, team, c));
      code = scheduled || ENTRY.goCodes.find((c) => codeInUse(sim, team, c));
    }
    if (!code || !codeInUse(sim, team, code)) {
      this.bus.emit(EV.ORDER_REJECTED, { unitId: -1, reason: 'noCode' });
      return;
    }
    const g = scheduledGo(sim, team, code);
    const i = g ? GO_STEPS.indexOf(Math.round(g.at)) + 1 : 0;
    if (i >= GO_STEPS.length) this.command({ type: 'cancelGo', code });
    else this.command({ type: 'go', code, at: GO_STEPS[i] });
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
        this.syncPhase();
        // The guided round starts at the planning: buy and preparation have nothing to teach yet.
        if (session.tutorial.active) while (session.phase === 'buy' || session.phase === 'prep') this.advance();
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
      case 'ready':
        this.ready();
        return;
      case 'defuse':
        if (phase === 'planning') {
          // The selected operator if he is at the bomb, else whoever is closest to it.
          const sel = this.session.selectedId;
          this.command({ type: 'defuseNow', unitId: defuseCandidate(this.sim, sel) ? sel : -1 });
        } else if (phase === 'running' || phase === 'paused') this.notice('planFirst');
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
        // Plain GO (key G, touch button): the code already scheduled, else the first in use; go_X: that code.
        const code = action.length > 3 ? action.slice(3) : undefined;
        if (phase === 'planning' || phase === 'prep') this.cycleGo(code);
        else if (phase === 'running' || phase === 'paused') this.notice('planFirst');
        return;
      }
      case 'entryCycle':
        this.planning.cycleEntry();
        return;
      case 'restart':
        // After the round: retry — the same plan (every recorded phase) on the same seed.
        // During it: start the round over with no plan, only after a confirming second press.
        if (phase === 'title' || !this.confirmed(action)) return;
        this.newAttempt(phase === 'ended' ? this.recorder.segments : []);
        this.sound('undo');
        return;
      case 'reroll':
        // Same plan, new roll of the dice (explicit choice; retry keeps the seed).
        if (phase === 'title') return;
        this.seed += SIM.retrySeedStride;
        this.newAttempt(this.recorder.segments);
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
        else if (action.startsWith('chooseEntry_') && phase === 'prep') this.chooseEntry(action.slice(12));
    }
  }

  /** Preparation: the squad starts from another entry (the camera follows). */
  chooseEntry(id) {
    this.command({ type: 'chooseEntry', entry: id });
    this.sim.flushCommands();
    this.framing.frameStart();
    this.sound('select');
  }

  /** Opening the help stops a running turn; closing it resumes only if the help was what stopped it. */
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

  /** Fresh round on the session seed, replaying the given recorded phases (empty: a new plan). */
  newAttempt(segments) {
    const retry = segments.length > 1 || (segments.length === 1 && segments[0].length > 0);
    this.recorder.beginAttempt(segments);
    this.restart(this.seed);
    this.session.replay.attempt = retry ? this.session.replay.attempt + 1 : 0;
    this.planning.refresh();
  }

  select(unitId) {
    if (!controllableUnit(this.sim, unitId, this.session.team)) return;
    this.session.selectedId = unitId;
    this.planning.refresh();
  }

  selectedDead() {
    return !controllableUnit(this.sim, this.session.selectedId, this.session.team);
  }

  selectNextAlive() {
    const next = firstAlive(this.sim, this.session.team);
    this.session.selectedId = next ? next.id : -1;
  }
}
