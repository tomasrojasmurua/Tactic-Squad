// Session flow: turns player requests (EV.REQUEST from keyboard shortcuts,
// HUD and touch buttons) and selections (EV.SELECT) into phase changes,
// sim commands and app actions. The only place that decides what a request
// means in each phase. Owner: gameplay (flow).
//
// The round's phases live in the sim (sim/round.js); this mirrors them on
// screen (session.phase), ends the decision phases (LISTO, or the deadline:
// PhaseClock) and runs the fixed-step loop only while a turn executes. During
// a turn the only order is a GO group ("now!"), stamped with its step. The
// drone phase also runs live: the stick (input/DroneController.js) and the
// recall (LISTO) are stamped with the step of the drone phase the same way.
//
// Helpers: PhaseClock (deadlines), PlanRecorder (orders per phase, honest
// retry), AutoPause (system pause), Tutorial (guided round from the menu),
// CameraFraming (input/, injected).
import { EV } from '../core/events.js';
import { SIM, ENTRY } from '../config/balance.js';
import { PLAYER_TEAM } from '../config/squad.js';
import { DEFAULT_MAP, TRAINING_MAP } from '../data/maps/index.js';
import { FLOW } from '../config/ui.js';
import { lessonById, nextLesson } from '../config/lessons.js';
import { loadPref, savePref } from './storage.js';
import { requestFullscreenLandscape, toggleFullscreen } from '../ui/device.js';
import { controllableUnit, defuseCandidate, firstAlive, teamUnits, pendingDoors, lastUserIndex, enemyTeam, HERE } from '../sim/queries.js';
import { phaseTick } from '../sim/round.js';
import { SESSION_PHASE, isDecisionPhase, isPlanningTime, isLivePhase, pilotsDrone, isDefenderSetup, inRecon, watchInPlanning } from './Session.js';
import { watchOf, watchOrder } from './watch.js';
import { armOrConfirm } from './confirm.js';
import { PlanRecorder } from './PlanRecorder.js';
import { PhaseClock } from './PhaseClock.js';
import { AutoPause } from './AutoPause.js';
import { Tutorial } from './Tutorial.js';

import { createMatch, matchLoadout, endMatchRound } from './Match.js';
import { createLobby, savedLobby, lobbySet, lobbyStart, openPick, pickMissing, aiRoles, canPick, MAP_CHOICES } from './Lobby.js';
import { ROOM } from '../net/roomLogic.js';

export class SessionController {
  /**
   * @param deps.loop       FixedLoop (setSimulating)
   * @param deps.planning   PlanningController (route edit actions, preview refresh)
   * @param deps.framing    CameraFraming (first shot, "see all", focus)
   * @param deps.getSim     () => current Simulation
   * @param deps.restart    (seed) => starts a new round with that seed
   */
  constructor({ bus, session, loop, planning, framing, audio, getSim, restart, killcam }) {
    this.bus = bus;
    this.session = session;
    this.loop = loop;
    this.planning = planning;
    this.framing = framing;
    this.audio = audio; // audio/AudioDirector.js: unlock, toggleMute, toggleMusic
    session.musicOn = audio.musicOn;
    this.getSim = getSim;
    this.restart = restart;
    this.killcam = killcam; // {start(kill), stop()}: Game plays the round's last kill again
    this.seed = SIM.seed; // the scenario: kept on retry (same plan = same round); "reroll" changes it
    this.postRoundTimer = 0;
    this.helpPaused = false; // the help opened while a turn ran (closing it resumes)
    this.recorder = new PlanRecorder();
    this.clock = new PhaseClock({ session, advance: () => this.advance() });
    this.autoPause = new AutoPause({ session, pause: (reason) => this.pause(reason) });
    this.tutorial = new Tutorial(session);
    session.lobby = createLobby(loadPref(FLOW.storageKeys.lobby, null));
    session.progress.stopOnContact = !!loadPref(FLOW.storageKeys.stopOnContact, true);

    bus.on(EV.COMMAND, (cmd) => this.record(cmd));
    bus.on(EV.REQUEST, (req) => this.handleRequest(req.action, req));
    this.online = null; // net/OnlineSession.js (Game sets it): an online game's lockstep
    bus.on(EV.SELECT, ({ unitId }) => this.select(unitId));
    bus.on(EV.ROUTE_CHANGED, ({ unitId, kind, moved }) => {
      // A new / undone / cleared leg: the picker goes back to the last waypoint (indices may have moved).
      const t = this.session.pointTarget;
      if (t && t.unitId === unitId && (kind === 'add' || kind === 'undo' || kind === 'clear')) this.session.pointTarget = null;
      // The decided point went beside the door frame (or back): the picker stays on it.
      if (t && t.unitId === unitId && moved && t.index === moved.from) this.session.pointTarget = { unitId, index: moved.to };
      // A tap on a door stacked him by it (PlanningController.stackAt): the door wheel opens on that point.
      const w = this.session.ui.wheelAt;
      if (w && w.unitId === unitId) {
        this.session.ui.wheelAt = null;
        const u = this.sim.units[unitId];
        const i = u ? lastUserIndex(u) : -1;
        if (kind === 'add' && i >= 0 && Math.hypot(u.route[i].x - w.x, u.route[i].y - w.y) < 0.3) this.session.pointTarget = { unitId, index: i };
      }
      this.planning.refresh();
    });
    bus.on(EV.DEATH, ({ unitId, killerId, tick, replay }) => {
      if (replay) return; // the kill cam's copy of the round
      this.session.lastKill = { tick, unitId, killerId };
      if (unitId === this.session.selectedId) this.selectNextAlive();
    });
  }

  get sim() {
    return this.getSim();
  }

  /** Called by Game when a new round's simulation exists. */
  onRoundStart() {
    this.session.lastKill = null;
    this.session.killcam = null;
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
    this.session.pointTarget = null;
    if (phase !== 'paused') this.helpPaused = false;
    this.planning.cancel();
    this.planning.refresh();
    this.loop.setSimulating(isLivePhase(phase) || (phase === 'ended' && this.postRoundTimer > 0));
    this.bus.emit(EV.PHASE, { phase, previous, reason: this.session.pauseReason, turn: this.sim.turn });
  }

  /**
   * Puts the screen in the sim's phase. Entering a decision phase starts its
   * clock and, on a retry, re-issues that phase's recorded orders; entering a
   * replayed turn queues its recorded GOs (each waits for its step).
   * `fresh`: a new round's first phase (even if the screen already shows that phase).
   */
  syncPhase(fresh = false) {
    const sim = this.sim;
    // Phases not unlocked yet go by on their own (defaults: no purchase, the map's entry, no drone).
    // Each still counts as one recorded phase, so a retry replays in step.
    this.session.locked = this.lockedPhases();
    while (this.session.locked.includes(sim.phase)) {
      this.recorder.advance();
      sim.advancePhase();
    }
    if (sim.phase === 'end') {
      if (this.session.phase !== 'ended') {
        // Score and the loser's bonus, once (online the lockstep keeps the match: net/LockstepClient.js).
        if (this.session.mode === 'match' && this.session.match && !this.onlineActive) endMatchRound(this.session.match, sim);
      }
      this.postRoundTimer = SIM.postRoundSeconds;
      // The result waits for the last kill, shown again once the round's tail has run (not in a lesson).
      // (Not online yet: the kill cam replays this phone's recording, which lacks the rival's orders.)
      if (this.session.phase !== 'ended') this.session.killcam = this.session.lastKill && this.session.mode !== 'tutorial' && !this.onlineActive ? { ...this.session.lastKill, playing: false } : null;
      this.setPhase('ended');
      return;
    }
    const phase = SESSION_PHASE[sim.phase];
    if (phase === this.session.phase && !fresh) return;
    this.setPhase(phase);
    if (isLivePhase(phase)) {
      this.session.replay.exec = this.recorder.inReplay;
      this.recorder.enterPhase((cmd) => this.bus.emit(EV.COMMAND, cmd));
      this.session.replay.pending = this.recorder.pending;
      if (phase === 'drone' && pilotsDrone(this.session)) this.framing.followDrone(this.sim, 0, true);
      this.tutorialTick(); // a tutorial card for this phase stops it before it runs
      return;
    }
    this.session.replay.exec = false;
    if (!isDecisionPhase(this.session)) return;
    const auto = this.recorder.enterPhase((cmd) => this.bus.emit(EV.COMMAND, cmd));
    this.session.replay.pending = this.recorder.pending;
    this.clock.start(sim.phase, auto);
    if (this.onlineActive) this.onlineClock(this.online.client.fase);
    if (phase === 'planning' && this.selectedDead() && this.tutorial.current() !== 'select') this.selectNextAlive();
  }

  /**
   * Options of the next round's Simulation: the tutorial's easier round
   * (config/lessons.js scenario), the lobby's classes, the AI's (from the round's `seed`) and the
   * player's "stop the turn on contact".
   */
  roundOptions(seed) {
    const s = this.session;
    const sc = this.lesson && this.lesson.scenario;
    const tutorial = sc ? { site: sc.site, defenders: sc.defenders } : {};
    const loadout = s.mode === 'match' && s.match ? { loadout: matchLoadout(s.match), lossBonus: s.match.lossBonus } : {};
    // The player's classes from the lobby; the AI picks its squad blind (session/Lobby.js aiRoles).
    const ai = enemyTeam(s.team);
    const roles = s.mode === 'tutorial' ? {} : { roles: { [s.team]: s.lobby.roles[s.team], [ai]: aiRoles(seed, ai) } };
    return { ...tutorial, ...loadout, ...roles, stopOnContact: s.mode === 'tutorial' || s.progress.stopOnContact };
  }

  /** Help option: the turn ends when the squad sees a new enemy (from the next round / attempt on). */
  toggleStopOnContact() {
    const p = this.session.progress;
    p.stopOnContact = !p.stopOnContact;
    savePref(FLOW.storageKeys.stopOnContact, p.stopOnContact);
    this.notice(p.stopOnContact ? 'contactOn' : 'contactOff');
  }

  /**
   * Round phases before the assault skipped with defaults (no purchase, the
   * map's entry, no drone): only the guided tutorial's, which teaches the assault.
   * A game from the lobby is played whole from its first round.
   */
  lockedPhases() {
    return this.lesson ? [...this.lesson.scenario.skip] : [];
  }

  /** In an online match (net/OnlineSession.js)? */
  get onlineActive() {
    return !!(this.online && this.online.active);
  }

  /**
   * Online, the server closed a decision phase (everyone LISTO or its deadline) and the sim
   * advanced (net/LockstepClient.js), or a reconnection caught up: the screen follows.
   */
  onlineAdvanced({ replayed = false } = {}) {
    if (replayed) {
      this.sim.drainEvents(); // the catch-up's shots and sounds are history
      this.syncPhase(true);
      this.framing.frameStart();
      return;
    }
    this.planning.cancel();
    this.sound(this.sim.phase === 'exec' ? 'execute' : 'select');
    this.syncPhase();
  }

  /** The server's deadline of the open decision phase (`fase`): the banner's clock shows it. */
  onlineClock(fase) {
    const c = this.session.clock;
    if (!fase || !this.onlineActive || fase.n !== this.online.client.n) return;
    c.auto = false;
    c.limited = fase.restan !== null;
    c.left = fase.restan === null ? 0 : fase.restan / 1000;
    c.total = Math.max(c.left, ROOM.phaseSeconds[fase.fase] || c.left);
  }

  /** Ends the current decision phase (LISTO, deadline, replay): the next phase or the turn's execution. */
  advance() {
    if (!isDecisionPhase(this.session)) return;
    if (this.onlineActive) {
      // Online the phase ends for everyone at once: LISTO goes to the server (net/OnlineSession.js).
      if (this.session.online.waiting) return;
      this.planning.cancel();
      this.online.ready();
      this.sound('select');
      return;
    }
    this.planning.cancel();
    this.recorder.advance();
    this.sim.advancePhase();
    this.sound(this.sim.phase === 'exec' ? 'execute' : 'select');
    this.syncPhase();
  }

  /** Stops a running turn or the drone (system reasons, help); a decision phase only stops its clock (PhaseClock). Never resumes. */
  pause(reason) {
    if (!isLivePhase(this.session.phase)) return;
    this.session.resumePhase = this.session.phase;
    this.setPhase('paused', reason);
    this.sound('pause');
  }

  /** Back to the turn (or the drone) a pause stopped. */
  resume() {
    this.setPhase(this.session.resumePhase);
    this.sound('resume');
  }

  /** Orders are recorded per phase (a turn only takes GOs; the drone its stick and recall). A new one in a replayed decision phase takes over. */
  record(cmd) {
    const live = isLivePhase(this.session.phase) || this.session.phase === 'paused';
    const liveOrder = cmd.type === 'go' || cmd.type === 'drone' || cmd.type === 'droneRecall';
    if (!isDecisionPhase(this.session) && !(live && liveOrder)) return;
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
    if (phase === 'running' && sim.phase !== 'exec') {
      if (sim.phase !== 'end') this.recorder.advance(); // the turn's GOs are one segment
      if (sim.phase === 'plan' && sim.round.cut) this.notice('contactCut');
      this.syncPhase();
    } else if (phase === 'drone' && sim.phase !== 'drone') {
      this.recorder.advance(); // the drone's stick is one segment
      this.syncPhase();
      if (pilotsDrone(this.session)) this.framing.frameStart(); // back to the squad
    }
    else if (phase === 'ended') {
      this.postRoundTimer -= dt;
      if (this.postRoundTimer > 0) return;
      this.loop.setSimulating(false);
      const kc = this.session.killcam;
      if (kc && !kc.playing) this.playKillcam();
    }
  }

  /** Every frame: the decision clock, orientation, the guided round, expired confirmations. */
  update(dt) {
    // A phone turned to portrait mid-turn is covered by the "rotate" screen, so pause.
    if (this.session.touch && window.innerHeight > window.innerWidth) this.pause('orientation');
    if (isDecisionPhase(this.session)) this.clock.update(dt);
    this.tutorialTick();
    const c = this.session.confirm;
    if (c.action && performance.now() >= c.until) c.action = null;
  }

  /** The guided round: next step, or a card that goes up (one during the drone stops it until ENTENDIDO). */
  tutorialTick() {
    if (this.session.phase === 'title') return;
    const t = this.tutorial.update(this.sim, this.session.mode === 'tutorial');
    if (t === 'done') this.notice('tutorialDone');
    else if (t === 'step') this.sound('select');
    else if (t === 'card') {
      this.sound('hold');
      // Online the round does not wait for one phone: the card goes up over the live phase.
      if (isLivePhase(this.session.phase) && !this.onlineActive) this.pause('tutorial');
    }
  }

  /** ENTENDIDO on the tutorial's card: the next step; a turn or drone it stopped goes on. */
  ackTutorial() {
    if (!this.tutorial.ack()) return false;
    this.sound('select');
    if (this.session.phase === 'paused' && this.session.pauseReason === 'tutorial') this.resume();
    this.tutorialTick();
    return true;
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

  /** LISTO / SPACE: ends a decision phase; recalls the drone; resumes a paused turn; a running turn cannot be stopped. */
  ready() {
    if (this.ackTutorial()) return; // a tutorial card is up: LISTO / Space / Enter closes it
    const phase = this.session.phase;
    if ((isDecisionPhase(this.session) || phase === 'drone') && this.tutorial.blocksReady()) {
      this.notice('tutorialFirst');
      return;
    }
    if (phase === 'drone') {
      if (!pilotsDrone(this.session)) this.notice('enemyDrone');
      else if (this.session.replay.exec) this.notice('droneReplay');
      else this.command({ type: 'droneRecall', atTick: phaseTick(this.sim) });
      return;
    }
    if (inRecon(this.sim, this.session)) {
      // The defender's recon ends: site, barricades and cameras stay; now his operators.
      this.command({ type: 'endRecon' });
      this.sim.flushCommands();
      this.sound('select');
      return;
    }
    if (isDecisionPhase(this.session)) {
      // Strict mode (ENTRY.undecided 'stop'): doors still on "?" stop their operators. Say so once; a second LISTO confirms.
      const doors = ENTRY.undecided === 'stop' ? pendingDoors(this.sim, this.session.team) : 0;
      if (armOrConfirm(this.session, 'ready', doors > 0) === 'armed') {
        this.notice('confirm_ready', doors);
        this.sound('hold');
        return;
      }
      return this.advance();
    }
    if (phase === 'paused') this.resume();
    else if (phase === 'running') this.notice('noPause');
  }

  /** The drone's stick changed (input/DroneController.js): a heading index or -1, stamped with the drone phase's step. */
  steerDrone(dir) {
    if (this.session.phase !== 'drone' || this.session.replay.exec || !pilotsDrone(this.session)) return;
    this.command({ type: 'drone', dir, atTick: phaseTick(this.sim) });
  }

  /** A GO group during the turn ("now!"; no code: the first one someone waits for). */
  callGo(code) {
    if (this.session.replay.exec) {
      this.notice('goReplay');
      return;
    }
    this.command({ type: 'go', code, atTick: this.sim.round.execTick });
  }

  handleRequest(action, req = {}) {
    const phase = this.session.phase;
    const session = this.session;
    if (phase === 'title' && this.onlineRequest(action, req)) return;
    const key = action === 'toggle' || action === 'execute' ? 'ready' : action; // LISTO's other names
    if (session.confirm.action && session.confirm.action !== key) session.confirm.action = null;
    // A round is played forward and its result counts: no retries, no starting over (only a lesson repeats).
    if (session.mode !== 'tutorial' && (action === 'restart' || action === 'newPlan' || action === 'reroll')) {
      if (phase === 'ended') this.notice('noRetry');
      return;
    }
    switch (action) {
      case 'start':
        // Enter / Space on the menu: its main button (JUGAR, CONTRA LA IA, LISTO).
        if (phase !== 'title') return;
        if (session.lobby.view === 'lessons') {
          const next = nextLesson(session.tutorial.lessonsDone);
          if (next) this.handleRequest(`lesson_${next.id}`);
        } else this.handleRequest({ main: 'play', play: 'vsAi', lobby: 'lobbyReady', pick: 'lobbyReady' }[session.lobby.view]);
        return;
      case 'play':
      case 'vsAi':
        // Main menu -> JUGAR (against the AI or, later, others) -> the lobby.
        if (phase !== 'title') return;
        this.audio.unlock();
        session.lobby.view = action === 'play' ? 'play' : 'lobby';
        session.lobby.ready = false;
        this.sound('select');
        return;
      case 'back':
        if (phase !== 'title' || session.lobby.view === 'main') return;
        if (session.online && session.lobby.view === 'pick') {
          this.restoreSquad();
          session.lobby.view = 'room';
          this.sound('undo');
          return;
        }
        session.lobby.view = { pick: 'lobby', lobby: 'play' }[session.lobby.view] || 'main'; // play and lessons go back to main
        this.sound('undo');
        return;
      case 'lobbyReady': {
        // The conditions set: on to the class pick. There, everyone ready (against the AI: the player; the AI always is): the game starts.
        if (phase !== 'title') return;
        if (session.lobby.view === 'lobby') {
          openPick(session.lobby);
          this.sound('select');
          return;
        }
        if (session.lobby.view !== 'pick') return;
        const missing = pickMissing(session.lobby);
        if (missing) {
          // A squad still short of its 3: show it (the button says how many are missing).
          session.lobby.pickSide = missing;
          this.sound('undo');
          return;
        }
        if (session.online) {
          // Online: the classes go to the room and the player is ready (the host starts the game).
          this.online.sendRoles(session.lobby.roles);
          this.restoreSquad();
          savePref(FLOW.storageKeys.lobby, savedLobby(session.lobby));
          if (session.online.room && session.online.room.anfitrion !== session.online.me) this.online.lobby({ listo: true });
          session.lobby.view = 'room';
          this.sound('select');
          return;
        }
        if (session.touch) requestFullscreenLandscape();
        session.lobby.ready = true;
        const { mode, team, bestOf, map } = lobbyStart(session.lobby);
        this.beginMode(mode, team, bestOf, null, map);
        return;
      }
      case 'tutorial':
        // Main menu -> the list of lessons.
        if (phase !== 'title') return;
        this.audio.unlock();
        session.lobby.view = 'lessons';
        this.sound('select');
        return;
      case 'nextRound':
        // Result screen: the match's next round (or, when it is over, a new match); a single round: another one.
        if (phase !== 'ended' || session.killcam) return;
        if (session.online) {
          // Online: the next round starts when both are ready; after the match, back to the room.
          if (session.online.finished) this.online.backToRoom();
          else this.online.ready();
          this.sound('select');
          return;
        }
        if (session.mode === 'match') this.nextMatchRound();
        else if (session.mode === 'play') this.anotherRound();
        return;
      case 'skipKillcam':
        this.killcamDone();
        return;
      case 'killcam':
        this.playKillcam();
        return;
      case 'menu':
        // Back to the main menu (during the round, only after a confirming second press).
        if (phase === 'title' || !this.confirmed(action)) return;
        if (session.online) this.online.leave(); // out of the room: OnlineSession calls toMenu
        else this.toMenu();
        return;
      case 'tutorialOk':
        this.ackTutorial();
        return;
      case 'tutorialSkip':
        if (this.tutorial.finish()) {
          if (session.phase === 'paused' && session.pauseReason === 'tutorial') this.resume();
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
      case 'squad':
        if (isPlanningTime(session)) this.planning.toggleSquad();
        return;
      case 'pace':
        this.planning.togglePace();
        return;
      case 'peek':
        this.planning.togglePeek();
        return;
      case 'cover':
        this.planning.toggleCover();
        return;
      case 'pace_sneak':
      case 'pace_normal':
        this.planning.setPace(action === 'pace_sneak' ? 'sneak' : null);
        return;
      case 'fullscreen':
        toggleFullscreen();
        return;
      case 'unitInfo':
        // The selected operator's sheet: class, weapon, utility (ui/UnitSheet.js). It follows the selection.
        if (phase === 'title') return;
        session.ui.unitInfo = !session.ui.unitInfo;
        this.sound(session.ui.unitInfo ? 'select' : 'undo');
        return;
      case 'overview':
        if (phase !== 'title') this.framing.toggleOverview();
        return;
      case 'cameras':
        this.nextCamera();
        return;
      case 'go':
      case 'go_A':
      case 'go_B':
      case 'go_C': {
        // Plain GO (key G): the first group someone waits for; go_X: that group. Only during the turn.
        const code = action.length > 3 ? action.slice(3) : undefined;
        if (phase === 'running' || phase === 'paused') this.callGo(code);
        else if (phase === 'planning' || phase === 'prep') this.notice('goInTurn');
        return;
      }
      case 'entryCycle':
        this.planning.cycleEntry();
        return;
      case 'tossAim':
        this.notice('tossAim');
        return;
      case 'pickerClose':
        if (session.ui.tossPick) this.planning.cancelToss(); // aiming: back to the menu
        else this.closePicker();
        return;
      case 'holdMenu':
        // Touch ESPERAR: the GO colors to choose from (H on a keyboard cycles them).
        if (isPlanningTime(session)) session.ui.holdMenu = !session.ui.holdMenu;
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
      case 'stopOnContact':
        this.toggleStopOnContact();
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
        if (action.startsWith('toss_')) this.planning.pickToss(action.slice(5));
        else if (action.startsWith('entry_')) this.planning.setEntry(action.slice(6));
        else if (action.startsWith('when_')) {
          this.planning.setWhen(action === 'when_now' ? null : action.slice(5));
          session.ui.holdMenu = false;
        }
        else if (action.startsWith('door_')) this.targetDoor(action);
        else if (action.startsWith('lobby_') && phase === 'title') this.lobbySet(action.slice(6));
        else if (action.startsWith('lesson_') && phase === 'title') this.beginLesson(action.slice(7));
        else if (action.startsWith('chooseEntry_') && (phase === 'prep' || phase === 'planning')) this.chooseEntry(action.slice(12));
        else if (action.startsWith('buy_') && phase === 'buy') this.buy(action);
        else if (action.startsWith('mount_')) this.toggleMount(action.slice(6));
        else if (isDefenderSetup(session) || (action.startsWith('watch_') && watchInPlanning(this.sim, session))) this.setup(action);
    }
  }

  /**
   * The defender's set-up panels (ui/PhasePanel.js): in the recon site_<id>
   * moves the bomb (the set-up starts over from the map's for it) and
   * barricade_<doorId> / wire_<doorId> toggles one; then watch_<mode> changes the selected
   * defender's watch order and trapmode switches taps to laying traps.
   */
  setup(action) {
    const sim = this.sim;
    if (action === 'trapmode') {
      this.session.ui.trapMode = !this.session.ui.trapMode;
      return this.sound('select');
    }
    const [kind, arg] = [action.slice(0, action.indexOf('_')), action.slice(action.indexOf('_') + 1)];
    if (kind === 'site') this.command({ type: 'chooseSite', site: arg });
    else if (kind === 'barricade') {
      const door = sim.doors.find((d) => d.def.id === arg);
      if (!door) return;
      this.command({ type: 'barricade', door: arg, on: !door.barricaded });
    } else if (kind === 'wire') {
      const door = sim.doors.find((d) => d.def.id === arg);
      if (!door) return;
      this.command({ type: 'wire', door: arg, on: !door.wired });
    } else if (kind === 'watch') {
      const u = controllableUnit(sim, this.session.selectedId, this.session.team);
      if (!u) return this.notice('pickDefender');
      const w = watchOf(u);
      this.command({ type: 'setWatch', unitId: u.id, watch: watchOrder(arg, w.facing, w.fallback) });
    } else return;
    sim.flushCommands();
    this.sound('select');
  }

  /** Buy panel: buy_<unitId>_<item>_<+|-> (one item bought or given back). */
  buy(action) {
    const [, id, item, sign] = action.split('_');
    this.command({ type: 'buy', unitId: +id, item, count: sign === '-' ? -1 : 1 });
    this.sim.flushCommands();
    this.sound(sign === '-' ? 'undo' : 'select');
  }

  /**
   * A tapped "?" door point (door_<unitId>_<index>): its operator is selected and the picker edits that point.
   * door_<unitId>_here: the spot he stands on (a throw or a GO wait from there, before he walks on).
   */
  targetDoor(action) {
    if (!isPlanningTime(this.session)) return;
    const [, id, index] = action.split('_');
    const u = controllableUnit(this.sim, +id, this.session.team);
    if (!u) return;
    this.select(u.id);
    this.session.pointTarget = { unitId: u.id, index: index === HERE ? HERE : +index };
    this.sound('select');
  }

  /**
   * Defending, while deciding: the view jumps to the next of your working
   * cameras (its cone and what it reported stay drawn: render/layers/OverlayLayer.js).
   */
  nextCamera() {
    const s = this.session;
    if (s.team !== 'defenders' || !isPlanningTime(s)) return;
    const live = this.sim.cameras.filter((c) => c.alive);
    if (!live.length) return this.notice('noCameras');
    s.ui.camera = (s.ui.camera + 1) % live.length;
    const c = live[s.ui.camera];
    this.framing.centerOn(c.x, c.y);
    this.sound('select');
  }

  /**
   * Defending, a camera mount tapped on the map (ui/CameraMounts.js): a camera
   * goes up there, or comes down. In the recon only: then they stay put.
   */
  toggleMount(id) {
    const s = this.session;
    const sim = this.sim;
    if (!inRecon(sim, s) || s.helpOpen) return;
    const on = !sim.cameras.some((c) => c.mount === id);
    this.command({ type: 'camera', mount: id, on });
    sim.flushCommands();
    this.sound(on ? 'select' : 'undo');
  }


  /** The round's last kill again (after the round, or VER DE NUEVO on the result). */
  playKillcam() {
    if (!this.session.lastKill || this.session.phase !== 'ended') return;
    this.session.killcam = { ...this.session.lastKill, playing: true };
    this.killcam.start(this.session.lastKill);
  }

  /** The clip is over (or skipped): the result. */
  killcamDone() {
    if (!this.session.killcam) return;
    this.session.killcam = null;
    this.killcam.stop();
  }

  /** The door picker's ×. */
  closePicker() {
    this.session.pointTarget = null;
    this.session.ui.tossPick = null;
  }

  /** The lesson being taken (config/lessons.js), or null. */
  get lesson() {
    return this.session.mode === 'tutorial' ? lessonById(this.session.tutorial.lesson) : null;
  }

  /**
   * From the menu: a fresh round against the AI or a series (the lobby's), or
   * the round of a lesson (`lesson`: its id; config/lessons.js scenario), on
   * `map` (a lesson is always on the first map: its scenario is built on it).
   */
  beginMode(mode, team = PLAYER_TEAM, bestOf = undefined, lesson = null, map = this.session.map) {
    this.session.mode = mode;
    this.session.map = mode === 'tutorial' ? TRAINING_MAP : map;
    if (mode === 'tutorial') this.session.tutorial.lesson = lesson;
    this.session.team = mode === 'tutorial' ? this.lesson.scenario.team : team;
    this.session.match = mode === 'match' ? createMatch(this.session.team, bestOf) : null;
    // A match: every round its own scenario (site, spread...), a fresh series each match.
    this.matchSeed = mode === 'match' ? (Math.random() * 1e9) | 0 : 0;
    this.seed = mode === 'tutorial' ? this.lesson.scenario.seed : mode === 'match' ? this.matchSeed + 1 : SIM.seed;
    this.recorder.beginAttempt([]);
    this.session.replay.attempt = 0;
    this.restart(this.seed); // still on the menu: no phase yet
    if (mode === 'tutorial') this.tutorial.begin(this.sim, lesson);
    else this.tutorial.stop();
    this.syncPhase(true);
    this.framing.frameStart();
    this.sound('select');
  }

  /** Match: the next round with what everyone carries over (a new match when this one is decided). */
  nextMatchRound() {
    const m = this.session.match;
    if (m.over) {
      this.setPhase('title');
      this.beginMode('match', this.session.lobby.side, m.bestOf); // the same game again
      return;
    }
    this.session.team = m.team; // after match.switchAfter rounds the player switches sides
    this.seed = this.matchSeed + m.round;
    this.recorder.beginAttempt([]);
    this.session.replay.attempt = 0;
    this.restart(this.seed); // Game.newRound: puts the screen in the new round's first phase
    this.framing.frameStart();
    this.sound('select');
  }

  /** A single round is over: a new one (another scenario: site, spread...), same side and classes. */
  anotherRound() {
    this.seed = (Math.random() * 1e9) | 0;
    this.recorder.beginAttempt([]);
    this.session.replay.attempt = 0;
    this.restart(this.seed);
    this.framing.frameStart();
    this.sound('select');
  }

  /** A lesson from the TUTORIAL list (one not ready yet does nothing). */
  beginLesson(id) {
    const l = lessonById(id);
    if (!l || !l.ready) return;
    if (this.session.touch) requestFullscreenLandscape();
    this.beginMode('tutorial', l.scenario.team, undefined, id);
  }

  /** A lobby setting changed (session/Lobby.js lobbySet): kept on the device. */
  lobbySet(what) {
    const lobby = this.session.lobby;
    if (!lobbySet(lobby, what)) return;
    if (!lobby.full) savePref(FLOW.storageKeys.lobby, savedLobby(lobby)); // a 2v2's pair of picks is not the device's squad
    this.sound('select');
  }

  /**
   * Online requests on the menu (ui/Menu.js, ui/RoomView.js): into a room, its lobby. True when handled.
   *   online · onlineCreate {name} · onlineJoin {name, code} · room_team_<side> · room_ready ·
   *   room_map_<id> · room_bestOf_<n> · room_pick · room_start
   */
  onlineRequest(action, req) {
    const session = this.session;
    const lobby = session.lobby;
    const o = session.online;
    const me = o && o.room ? o.room.jugadores.find((j) => j.id === o.me) : null;
    if (action === 'online') {
      if (!this.online.available) this.notice('onlineUnavailable');
      else lobby.view = o ? 'room' : 'online';
    } else if (action === 'onlineCreate' || action === 'onlineJoin') {
      this.audio.unlock();
      if (action === 'onlineCreate') this.online.create(req.name);
      else this.online.join(req.code, req.name);
      lobby.view = 'room';
    } else if (action === 'back' && (lobby.view === 'online' || lobby.view === 'room')) {
      if (lobby.view === 'room') this.online.leave(false);
      lobby.view = 'play';
      this.sound('undo');
      return true;
    } else if (!action.startsWith('room_') || !o) return false;
    else {
      const [, key, arg] = action.split('_');
      if (key === 'team') this.online.lobby({ equipo: arg });
      else if (key === 'ready') this.online.lobby({ listo: !(me && me.listo) });
      else if (key === 'map') {
        // "Al azar" is drawn now, so both see the map before picking their classes.
        const ids = MAP_CHOICES.filter((id) => id !== 'random');
        this.online.lobby({ mapa: arg === 'random' ? ids[Math.floor(Math.random() * ids.length)] : action.slice('room_map_'.length) });
      } else if (key === 'bestOf') this.online.lobby({ duracion: +arg });
      else if (key === 'mode') this.online.lobby({ modo: arg });
      else if (key === 'start') {
        if (session.touch) requestFullscreenLandscape();
        this.online.start();
      } else if (key === 'pick') {
        // The roster, for the sides this player will play (both in a match: it switches at half-time).
        lobby.bestOf = (o.room && o.room.ajustes.duracion) || lobby.bestOf;
        lobby.side = (me && me.equipo) || lobby.side;
        if (o.room && o.room.ajustes.modo === '2v2' && !lobby.full) {
          // A 2v2: two operators of each side are this player's (the device's squad of 3 waits aside).
          lobby.full = lobby.roles;
          lobby.roles = { attackers: lobby.full.attackers.slice(0, 2), defenders: lobby.full.defenders.slice(0, 2) };
        }
        openPick(lobby);
        lobby.drawn = (o.room && o.room.ajustes.mapa) || DEFAULT_MAP;
      } else return false;
    }
    this.sound('select');
    return true;
  }

  /** Out of a 2v2's pick: the device's squad of 3 again (its first two take the pair just picked). */
  restoreSquad() {
    const lobby = this.session.lobby;
    if (!lobby.full) return;
    for (const t of ['attackers', 'defenders']) {
      const pair = lobby.roles[t];
      const full = [...lobby.full[t]];
      pair.forEach((id, i) => { if (id) full[i] = id; });
      // Keep the squad of 3 valid: a class the pair now repeats beyond its limit goes back to its old one.
      lobby.full[t] = full.every((id, i) => canPick({ roles: { [t]: full } }, t, i, id, full)) ? full : lobby.full[t];
    }
    lobby.roles = lobby.full;
    lobby.full = null;
  }

  /** Back to the main menu (or `view` of it: the online room's lobby): the round is dropped (a new one waits behind the menu). */
  toMenu(view = null) {
    this.tutorial.stop();
    this.session.lobby.view = view || (this.session.mode === 'tutorial' ? 'lessons' : 'main'); // out of a lesson: the list of lessons
    this.session.mode = 'play';
    this.session.team = PLAYER_TEAM;
    this.session.match = null;
    this.session.map = DEFAULT_MAP;
    this.session.lobby.ready = false;
    this.setPhase('title');
    this.seed = SIM.seed;
    this.recorder.beginAttempt([]);
    this.session.replay.attempt = 0;
    this.restart(this.seed);
    this.sound('undo');
  }

  /** Preparation (or the first planning): the squad starts from another entry (the camera follows). */
  chooseEntry(id) {
    this.tutorial.noteEntry();
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
      if (resume) this.resume();
      return;
    }
    if (isLivePhase(session.phase)) {
      session.resumePhase = session.phase;
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
    if (this.tutorial.active) this.tutorial.begin(this.sim); // the guided round starts over with it
    else if (this.session.mode === 'tutorial') this.tutorial.reset();
    this.session.replay.attempt = retry ? this.session.replay.attempt + 1 : 0;
    this.planning.refresh();
  }

  select(unitId) {
    if (!controllableUnit(this.sim, unitId, this.session.team)) return;
    if (!this.owned(this.sim.units[unitId])) {
      this.notice('partnerUnit'); // a 2v2: that one is the teammate's
      return;
    }
    this.session.selectedId = unitId;
    this.session.pointTarget = null;
    this.planning.refresh();
  }

  /** Is this operator the player's to command (a 2v2 online: two of the side's four are the teammate's)? */
  owned(u) {
    const o = this.session.online;
    return !!u && (!o || !o.playing || !o.slots || o.slots.includes(u.slot));
  }

  selectedDead() {
    return !controllableUnit(this.sim, this.session.selectedId, this.session.team);
  }

  selectNextAlive() {
    const next = teamUnits(this.sim, this.session.team).find((u) => u.alive && this.owned(u)) || null;
    this.session.selectedId = next ? next.id : -1;
  }
}
