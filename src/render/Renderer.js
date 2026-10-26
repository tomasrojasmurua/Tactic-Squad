// Orchestrates the WebGL2 frame. Reads simulation state (never mutates it)
// and listens to sim events through the FxDirector. Owner: visual.
//
// Pass order: vision mask -> floor -> decals -> ground overlay -> walls &
// props -> doors -> units -> particles -> top overlay (routes).
// Frames are only drawn when something changed (FramePacer); the canvas size
// comes from a ResizeObserver (no layout reads per frame); a lost WebGL
// context is survived: drawing stops and every GL resource is rebuilt on restore.
import { AdaptiveResolution } from './AdaptiveResolution.js';
import { FramePacer } from './FramePacer.js';
import { PlanView } from './PlanView.js';
import { createContext } from './gl/context.js';
import { Camera } from './Camera.js';
import { VisionLayer } from './layers/VisionLayer.js';
import { FloorLayer } from './layers/FloorLayer.js';
import { StaticLayer } from './layers/StaticLayer.js';
import { DoorLayer } from './layers/DoorLayer.js';
import { DecalLayer } from './layers/DecalLayer.js';
import { UnitLayer } from './layers/UnitLayer.js';
import { OverlayLayer } from './layers/OverlayLayer.js';
import { Particles } from './fx/Particles.js';
import { FxDirector } from './fx/FxDirector.js';
import { LIGHTING, DISPLAY } from '../config/render.js';
import { BOMB_COLOR } from '../config/materials.js';
import { hexToRgb } from '../core/math.js';
import { EV } from '../core/events.js';
import { bombKnownTo } from '../sim/queries.js';

const MAX_LIGHTS = LIGHTING.maxDynamicLights;
const BOMB_LIGHT = hexToRgb(BOMB_COLOR.light);
/** Blinking light of the bomb (only once the viewer's side knows where it is). */
const BOMB_BLINK = Object.freeze({ rate: 9, threshold: 0.2, radius: 2.2, intensity: 0.9 });

export class Renderer {
  /** `viewer` = the session: `viewer.team` is the side this screen plays (fog, rings, shake), read live. */
  constructor(canvas, bus, viewer) {
    this.canvas = canvas;
    this.coarse = matchMedia('(pointer: coarse)').matches;
    this.gl = createContext(canvas, DISPLAY.antialias);
    this.camera = new Camera();
    this.time = 0; // real time (UI pulses)
    this.worldTime = 0; // advances only while the sim runs (FX freeze in pause)
    this.createLayers();
    this.fx = new FxDirector(bus, {
      particles: this.particles,
      decals: this.decals,
      units: this.units,
      overlay: this.overlay,
      camera: this.camera,
      clock: () => this.worldTime,
      realClock: () => this.time,
      viewer,
    });
    this.mapId = null;
    this.sim = null;
    this.lights = { data: new Float32Array(MAX_LIGHTS * 4), colors: new Float32Array(MAX_LIGHTS * 3), count: 0 };
    this.plan = new PlanView();
    this.pacer = new FramePacer();
    /** Per-frame context handed to every layer (one object, refreshed each frame). */
    this.frame = { gl: this.gl, camera: this.camera, viewProj: this.camera.viewProj, lights: this.lights, plan: this.plan.uniform, viewer: viewer.team };
    this.pixelRatio = this.maxPixelRatio();
    this.adaptive = new AdaptiveResolution(DISPLAY.adaptive, this.pixelRatio);
    this.cssW = Math.max(1, canvas.clientWidth); // read once; then only the ResizeObserver reports sizes
    this.cssH = Math.max(1, canvas.clientHeight);
    this.observeSize();
    this.resize();
    this.contextLost = false;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); // tells the browser we will restore
      this.contextLost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => this.restoreContext());
    bus.on(EV.ROUND_RESET, ({ sim }) => this.setSimulation(sim));
  }

  /** (Re)creates every GL-owning layer: at start and after a context restore. */
  createLayers() {
    const gl = this.gl;
    this.vision = new VisionLayer(gl);
    this.floor = new FloorLayer(gl);
    this.static = new StaticLayer(gl);
    this.doors = new DoorLayer(gl);
    this.decals = new DecalLayer(gl);
    this.units = new UnitLayer(gl);
    this.overlay = new OverlayLayer(gl);
    this.particles = new Particles(gl);
  }

  /** The context came back with nothing in it: rebuild programs, meshes, textures and the map bake. */
  restoreContext() {
    this.createLayers();
    const fx = this.fx;
    fx.particles = this.particles;
    fx.decals = this.decals;
    fx.units = this.units;
    fx.overlay = this.overlay;
    this.mapId = null;
    this.contextLost = false;
    if (this.sim) this.setSimulation(this.sim);
    this.pacer.markDirty(3);
  }

  observeSize() {
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', () => {
        this.cssW = Math.max(1, this.canvas.clientWidth);
        this.cssH = Math.max(1, this.canvas.clientHeight);
        this.sizeDirty = true;
      });
      return;
    }
    new ResizeObserver((entries) => {
      const r = entries[entries.length - 1].contentRect;
      this.cssW = Math.max(1, r.width);
      this.cssH = Math.max(1, r.height);
      this.sizeDirty = true;
    }).observe(this.canvas);
  }

  maxPixelRatio() {
    const cap = this.coarse ? DISPLAY.maxPixelRatioTouch : DISPLAY.maxPixelRatio;
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  /** Dynamic resolution (render/AdaptiveResolution.js, config/render.js DISPLAY.adaptive). */
  adaptResolution(dt) {
    this.pixelRatio = this.adaptive.update(dt, this.maxPixelRatio());
  }

  resize() {
    const dpr = Math.min(this.pixelRatio, this.maxPixelRatio());
    const w = this.cssW;
    const h = this.cssH;
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
      this.pacer.markDirty();
    }
    this.camera.setViewport(w, h);
    this.sizeDirty = false;
  }

  /** Called on every new round (and map change). */
  setSimulation(sim) {
    this.sim = sim;
    this.pacer.markDirty(3);
    if (this.contextLost) return; // rebuilt on restore
    const compiled = sim.compiled;
    if (this.mapId !== compiled.id) {
      this.mapId = compiled.id;
      this.floor.build(compiled);
      this.static.build(compiled);
      this.decals.build(compiled);
      this.vision.setMap(compiled.width, compiled.height);
      this.camera.setBounds(compiled.width, compiled.height);
    } else {
      this.decals.clearBlood();
      this.vision.resetMemory();
    }
    this.particles.clear();
    this.units.reset();
    this.overlay.reset();
    this.fx.setSim(sim);
  }

  /** Newest dynamic lights first (fading muzzle flashes, blinking bomb). */
  collectLights(sim) {
    const L = this.lights;
    let n = 0;
    const list = this.fx.lights;
    for (let i = list.length - 1; i >= 0 && n < MAX_LIGHTS; i--) {
      const l = list[i];
      writeLight(L, n++, l.x, l.y, l.radius, l.intensity * (1 - l.age / l.life), l.color);
    }
    if (!sim.bomb.defused && bombKnownTo(sim, this.frame.viewer) && n < MAX_LIGHTS && Math.sin(this.time * BOMB_BLINK.rate) > BOMB_BLINK.threshold) {
      writeLight(L, n++, sim.bomb.x, sim.bomb.y, BOMB_BLINK.radius, BOMB_BLINK.intensity, BOMB_LIGHT);
    }
    L.count = n;
  }

  render(sim, session, dt, alpha, simulating) {
    this.time += dt;
    const worldDt = simulating ? dt : 0;
    this.worldTime += worldDt;
    if (this.sizeDirty) this.resize();
    this.camera.update(dt);
    this.fx.update(worldDt);
    this.particles.update(worldDt);
    this.frame.viewer = session.team;
    const transitioning = this.plan.update(dt, sim, session.phase, session.team);
    if (this.contextLost) return;
    const drewLast = this.pacer.drewLast;
    const draw = this.pacer.shouldDraw(dt, { simulating, phase: session.phase, transitioning, viewProj: this.camera.viewProj });
    if (!draw) return;
    // Only consecutive drawn frames measure real load (an idle cadence would read as "slow").
    if (drewLast) {
      const before = this.pixelRatio;
      this.adaptResolution(dt);
      if (this.pixelRatio !== before) this.resize();
    }
    const gl = this.gl;

    // Recomputed only when an operator's interpolated pose or a door changed.
    this.vision.update(sim, alpha, simulating, session.team);
    this.collectLights(sim);

    const frame = this.frame;
    frame.time = this.time;
    frame.worldTime = this.worldTime;
    frame.dt = dt;
    frame.worldDt = worldDt;
    frame.alpha = alpha;
    frame.simulating = simulating;
    frame.mapW = sim.compiled.width;
    frame.mapH = sim.compiled.height;
    frame.visionTex = this.vision.visionTexture;
    frame.exploredTex = this.vision.exploredTexture;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    this.floor.draw(frame);
    this.decals.draw(frame);
    this.overlay.build(frame, sim, session, this.units, this.vision);
    this.overlay.drawGround(frame);
    this.static.draw(frame);
    this.doors.draw(frame, sim);
    this.units.draw(frame, sim);
    this.particles.draw(frame);
    this.overlay.drawTop(frame);
  }
}

function writeLight(L, i, x, y, radius, intensity, color) {
  const d = i * 4;
  L.data[d] = x;
  L.data[d + 1] = y;
  L.data[d + 2] = radius;
  L.data[d + 3] = intensity;
  const c = i * 3;
  L.colors[c] = color[0];
  L.colors[c + 1] = color[1];
  L.colors[c + 2] = color[2];
}
