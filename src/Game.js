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
import { MAPS, DEFAULT_MAP } from './data/maps/index.js';
import { Simulation } from './sim/Simulation.js';
import { createSession, resetSessionPreviews } from './session/Session.js';
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

export class Game {
  constructor(canvas, uiRoot) {
    this.bus = new EventBus();
    this.mapDef = MAPS[DEFAULT_MAP];
    this.session = createSession({ touch: matchMedia('(pointer: coarse)').matches });
    this.sim = null;
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
    this.framing = new CameraFraming({ camera: this.camera, session: this.session, mapDef: this.mapDef });
    this.input.use(new ShortcutController(this.bus, this.session));
    this.input.use(this.cameraCtl);
    this.input.use(new MouseKeyController(this.planning));
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

  /** Fresh simulation (same map; the session picks the seed: a retry keeps it); listeners reset on EV.ROUND_RESET. */
  newRound(seed = SIM.seed) {
    this.sim = new Simulation(this.mapDef, { seed });
    this.attempt++;
    this.flow.onRoundStart();
    resetSessionPreviews(this.session);
    this.bus.emit(EV.ROUND_RESET, { sim: this.sim });
    if (this.session.phase !== 'title') this.flow.syncPhase(true);
    this.planning.refresh();
  }

  // ------------------------------------------------------------ loop

  step(dt) {
    this.drone.update(); // the drone's stick, stamped with the step about to run
    this.sim.step(dt);
    this.flushEvents();
    this.flow.afterStep(this.sim, dt);
  }

  /** Publishes the events the simulation queued (never re-entrant). */
  flushEvents() {
    for (const ev of this.sim.drainEvents()) this.bus.emit(ev.type, ev);
  }

  frame(dt, alpha) {
    this.flow.update(dt);
    if (!this.loop.simulating) {
      // Deciding (buy, preparation, planning): orders apply immediately so routes update live.
      this.sim.flushCommands();
      this.flushEvents();
    }
    const droning = this.session.phase === 'drone';
    this.cameraCtl.enabled = !this.session.helpOpen && !droning; // WASD drive the drone
    this.cameraCtl.update(dt);
    if (droning) this.framing.followDrone(this.sim, dt);
    this.planning.update(dt); // edge pan while drawing (inside the game loop, no own rAF)
    this.renderer.render(this.sim, this.session, dt, alpha, this.loop.simulating);
    this.audioDirector.update(dt, this.session.phase === 'paused');
    this.ui.update(this.sim, this.session, dt, this.camera, (u) => this.renderer.units.pose(u, alpha));
  }
}
