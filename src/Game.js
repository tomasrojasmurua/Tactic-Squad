// Composition root: builds every subsystem, owns the current Simulation and
// the fixed-step loop, and wires them together. Subsystems talk to each
// other only through the event bus (see docs/ARCHITECTURE.md):
//
//   input ──EV.COMMAND──▶ sim.enqueue      sim events ──flushEvents──▶ bus
//   input/ui ──EV.REQUEST / EV.SELECT──▶ SessionController (phases, selection)
//   render / audio / ui ◀── bus events + read-only state (sim, session)
import { EventBus } from './core/EventBus.js';
import { EV } from './core/events.js';
import { FixedLoop } from './core/FixedLoop.js';
import { SIM } from './config/balance.js';
import { controllersFor } from './config/squad.js';
import { ALL_MAPS, DEFAULT_MAP } from './data/maps/index.js';
import { Simulation } from './sim/Simulation.js';
import { createSession, resetSessionPreviews, pilotsDrone } from './session/Session.js';
import { SessionController } from './session/SessionController.js';
import { Renderer } from './render/Renderer.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { AudioDirector } from './audio/AudioDirector.js';
import { createSpatializer } from './audio/Spatializer.js';
import { InputManager } from './input/InputManager.js';
import { CameraController } from './input/CameraController.js';
import { PlanningController } from './input/PlanningController.js';
import { CameraFraming } from './input/CameraFraming.js';
import { MouseKeyController } from './input/MouseKeyController.js';
import { ShortcutController } from './input/ShortcutController.js';
import { TouchController } from './input/TouchController.js';
import { DroneController } from './input/DroneController.js';
import { UI } from './ui/UI.js';
import { createKillCam, stepKillCam } from './session/KillCam.js';

export class Game {
  constructor(canvas, uiRoot) {
    this.bus = new EventBus();
    this.mapDef = ALL_MAPS[DEFAULT_MAP];
    this.session = createSession({ touch: matchMedia('(pointer: coarse)').matches });
    this.sim = null;
    this.roundArgs = null; // what the round's Simulation was built with (the kill cam plays it again)
    this.killcam = null; // the last kill shown again (session/KillCam.js), or null
    this.attempt = 0;

    // Presentation (subscribes to the bus in their constructors).
    this.renderer = new Renderer(canvas, this.bus, this.session);
    this.camera = this.renderer.camera;
    this.audio = new AudioEngine();
    this.audioDirector = new AudioDirector(this.audio, this.bus, createSpatializer(this.camera), this.session);

    this.loop = new FixedLoop({
      stepSeconds: 1 / SIM.tickRate,
      onStep: (dt) => this.step(dt),
      onFrame: (dt, alpha) => this.frame(dt, alpha),
    });

    // Input -> commands / requests.
    const getSim = () => this.sim;
    this.input = new InputManager(canvas);
    this.cameraCtl = new CameraController(this.camera, this.input);
    this.planning = new PlanningController({ bus: this.bus, camera: this.camera, session: this.session, getSim });
    this.framing = new CameraFraming({ camera: this.camera, session: this.session, mapDef: this.mapDef, getSim: () => this.sim });
    this.input.use(new ShortcutController(this.bus, this.session));
    this.input.use(this.cameraCtl);
    this.input.use(new MouseKeyController(this.planning, this.camera));
    this.input.use(new TouchController({ planning: this.planning, camera: this.camera, framing: this.framing, session: this.session }));

    // Session flow + simulation commands.
    this.flow = new SessionController({
      bus: this.bus,
      session: this.session,
      loop: this.loop,
      planning: this.planning,
      framing: this.framing,
      audio: this.audioDirector,
      getSim,
      restart: (seed) => this.newRound(seed),
      killcam: { start: (kill) => this.startKillcam(kill), stop: () => this.stopKillcam() },
    });
    this.bus.on(EV.COMMAND, (cmd) => this.sim.enqueue(cmd));
    this.drone = new DroneController({ input: this.input, bus: this.bus, session: this.session, steer: (dir) => this.flow.steerDrone(dir) });

    this.ui = new UI(uiRoot, this.bus, this.input, this.session);
    this.unlockAudioOnFirstGesture();

    this.newRound();
    const cam = this.mapDef.camera;
    this.camera.jumpTo(cam.start[0], cam.start[1], cam.height);
  }

  start() {
    this.loop.start();
  }

  unlockAudioOnFirstGesture() {
    // iOS only unlocks audio inside touchend/click handlers; cover them all.
    const unlock = () => this.audioDirector.unlock();
    for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(type, unlock, { capture: true });
  }

  /**
   * Fresh simulation (on session.map; the session picks the seed: a retry keeps it); listeners reset on EV.ROUND_RESET.
   * The player's side (session.team) decides who the AI plays. Its options
   * (tutorial round, stop on contact, a match's loadout) come from the session flow.
   */
  newRound(seed = SIM.seed) {
    this.stopKillcam();
    this.mapDef = ALL_MAPS[this.session.map] ?? ALL_MAPS[DEFAULT_MAP]; // the lobby's map (session.map)
    this.framing.mapDef = this.mapDef;
    this.roundArgs = { seed, controllers: controllersFor(this.session.team), ...this.flow.roundOptions(seed) };
    this.sim = new Simulation(this.mapDef, this.roundArgs);
    this.attempt++;
    this.flow.onRoundStart();
    resetSessionPreviews(this.session);
    this.bus.emit(EV.ROUND_RESET, { sim: this.sim });
    if (this.session.phase !== 'title') this.flow.syncPhase(true);
    this.planning.refresh();
  }

  // ------------------------------------------------------------ loop

  step(dt) {
    if (this.killcam) return this.stepKillcam();
    this.drone.update(); // the drone's stick, stamped with the step about to run
    this.sim.step(dt);
    this.flushEvents();
    this.flow.afterStep(this.sim, dt);
  }

  /** Publishes the events the simulation queued (never re-entrant). */
  flushEvents() {
    for (const ev of this.sim.drainEvents()) this.bus.emit(ev.type, ev);
  }

  // ------------------------------------------------------------ kill cam

  /**
   * The round is over: its last kill again, on a copy of the round played up
   * to just before it (session/KillCam.js). The screen shows the copy — its
   * shots, sounds and effects (events flagged `replay`: the HUD's feed and
   * the session ignore them) — and the killer even if he was never seen.
   */
  startKillcam(kill) {
    this.stopKillcam();
    const kc = createKillCam(this.mapDef, this.roundArgs, this.flow.recorder.segments, kill);
    this.killcam = kc;
    this.renderer.setSimulation(kc.sim);
    this.audioDirector.watch(kc.sim);
    // Who the shot keeps on screen: killer and victim, then whoever joins the exchange.
    kc.cast = new Set([kill.unitId, kill.killerId].filter((id) => kc.sim.units[id]));
    this.framing.followPoints(this.killcamPoints(), 0, true);
    this.loop.setSimulating(true);
  }

  stepKillcam() {
    const kc = this.killcam;
    const reveal = kc.sim.units[kc.kill.killerId];
    const going = stepKillCam(kc, (sim) => {
      if (reveal) reveal.seenByEnemy = true;
      for (const ev of sim.drainEvents()) {
        this.joinKillcam(ev);
        this.bus.emit(ev.type, { ...ev, replay: true });
      }
    });
    if (!going) this.flow.killcamDone();
  }

  /** A shot or hit between someone and the killer or the victim brings them into the shot. */
  joinKillcam(ev) {
    const kc = this.killcam;
    const a = ev.type === EV.SHOT ? ev.unitId : ev.type === EV.HIT ? ev.attackerId : -1;
    const b = ev.type === EV.SHOT ? ev.victimId : ev.type === EV.HIT ? ev.unitId : -1;
    if (a < 0 || b < 0 || !kc.sim.units[a] || !kc.sim.units[b]) return;
    const core = [kc.kill.unitId, kc.kill.killerId];
    if (core.includes(a) || core.includes(b)) kc.cast.add(a).add(b);
  }

  killcamPoints() {
    const units = this.killcam.sim.units;
    return [...this.killcam.cast].map((id) => [units[id].x, units[id].y]);
  }

  /** Back to the real round (its end screen). */
  stopKillcam() {
    if (!this.killcam) return;
    this.killcam = null;
    this.renderer.setSimulation(this.sim);
    this.audioDirector.watch(this.sim);
    this.loop.setSimulating(false);
  }

  frame(dt, alpha) {
    this.flow.update(dt);
    if (!this.loop.simulating) {
      // Deciding (buy, preparation, planning): orders apply immediately so routes update live.
      this.sim.flushCommands();
      this.flushEvents();
    }
    const droning = this.session.phase === 'drone' && pilotsDrone(this.session);
    this.cameraCtl.enabled = !this.session.helpOpen && !droning && !this.killcam; // WASD drive the drone; the kill cam directs its own shot
    this.cameraCtl.update(dt);
    if (droning) this.framing.followDrone(this.sim, dt);
    if (this.killcam) this.framing.followPoints(this.killcamPoints(), dt);
    this.planning.update(dt); // edge pan while drawing (inside the game loop, no own rAF)
    this.renderer.render(this.killcam ? this.killcam.sim : this.sim, this.session, dt, alpha, this.loop.simulating);
    this.audioDirector.update(dt, this.session.phase === 'paused');
    this.ui.update(this.sim, this.session, dt, this.camera, (u) => this.renderer.units.pose(u, alpha));
  }
}
