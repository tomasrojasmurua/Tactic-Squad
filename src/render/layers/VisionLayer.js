// Fog of war mask, in map space: draw each living attacker's visibility fans
// (FOV cone + close awareness circle) into a texture, blur it a little for
// soft edges, and max-accumulate into the "explored" memory.
//
// The pass is skipped when its result could not change: same simulation,
// same interpolated operator poses and same door slabs (world.segmentsVersion).
// While time is stopped (planning / pause) it only reruns when the sim tick
// changes, exactly like before the cache existed.
import * as mat4 from '../../core/mat4.js';
import { TAU, lerp, lerpAngle } from '../../core/math.js';
import { FOG } from '../../config/render.js';
import { VISION } from '../../config/balance.js';
import { visibilityPolygon } from '../../sim/vision.js';
import { ShaderProgram } from '../gl/ShaderProgram.js';
import { RenderTarget } from '../gl/RenderTarget.js';
import { ShapeBatch } from '../gl/ShapeBatch.js';
import { FLAT_VS, FLAT_FS, FULLSCREEN_VS, BLUR_FS, COPY_FS } from '../shaders/flat.js';

const WHITE = [1, 1, 1, 1];

export class VisionLayer {
  constructor(gl) {
    this.gl = gl;
    this.flat = new ShaderProgram(gl, FLAT_VS, FLAT_FS, 'vision-flat');
    this.blur = new ShaderProgram(gl, FULLSCREEN_VS, BLUR_FS, 'vision-blur');
    this.copy = new ShaderProgram(gl, FULLSCREEN_VS, COPY_FS, 'vision-copy');
    this.batch = new ShapeBatch(gl);
    this.emptyVao = gl.createVertexArray();
    this.ortho = mat4.create();
    this.targets = null;
    /** Latest polygons per unit id, reused by the overlay for cone edges. */
    this.polygons = new Map();
    this.cache = { sim: null, tick: -1, segmentsVersion: -1, poses: [] };
  }

  setMap(width, height) {
    const gl = this.gl;
    if (this.targets) for (const t of Object.values(this.targets)) t.dispose();
    const w = Math.ceil(width * FOG.pixelsPerMeter);
    const h = Math.ceil(height * FOG.pixelsPerMeter);
    this.targets = {
      raw: new RenderTarget(gl, w, h),
      tmp: new RenderTarget(gl, w, h),
      vision: new RenderTarget(gl, w, h),
      explored: new RenderTarget(gl, w, h),
    };
    mat4.ortho(this.ortho, 0, width, 0, height, -1, 1);
    this.resetMemory();
  }

  resetMemory() {
    this.targets.explored.clear(0, 0, 0, 1);
    this.targets.vision.clear(0, 0, 0, 1);
    this.cache.sim = null;
  }

  /** True when the mask would be identical to the last one drawn (see header). */
  isUpToDate(sim, alpha, simulating) {
    const c = this.cache;
    if (c.sim !== sim || c.team !== this.team) return false;
    if (!simulating) return c.tick === sim.tick;
    if (c.segmentsVersion !== sim.world.segmentsVersion) return false;
    let i = 0;
    for (const u of sim.teams[this.team]) {
      if (!u.alive) continue;
      const x = lerp(u.prevX, u.x, alpha);
      const y = lerp(u.prevY, u.y, alpha);
      const f = lerpAngle(u.prevFacing, u.facing, alpha);
      if (c.poses[i] !== u.id || c.poses[i + 1] !== x || c.poses[i + 2] !== y || c.poses[i + 3] !== f) return false;
      i += 4;
    }
    return i === c.poses.length;
  }

  remember(sim) {
    const c = this.cache;
    c.sim = sim;
    c.team = this.team;
    c.tick = sim.tick;
    c.segmentsVersion = sim.world.segmentsVersion;
    c.poses.length = 0;
    for (const u of sim.teams[this.team]) {
      if (!u.alive) continue;
      const p = this.polygons.get(u.id);
      c.poses.push(u.id, p.x, p.y, p.facing);
    }
  }

  get visionTexture() {
    return this.targets.vision.texture;
  }

  get exploredTexture() {
    return this.targets.explored.texture;
  }

  /** Vision of `team` (the side this screen plays: session.team). */
  update(sim, alpha, simulating, team) {
    this.team = team;
    if (this.isUpToDate(sim, alpha, simulating)) return;
    const gl = this.gl;
    const { raw, tmp, vision, explored } = this.targets;
    this.batch.reset();
    for (const id of this.polygons.keys()) if (!sim.units[id] || !sim.units[id].alive) this.polygons.delete(id);
    for (const u of sim.teams[this.team]) {
      if (!u.alive) continue;
      const x = lerp(u.prevX, u.x, alpha);
      const y = lerp(u.prevY, u.y, alpha);
      const f = lerpAngle(u.prevFacing, u.facing, alpha);
      const p = this.polygonsOf(u.id);
      p.x = x;
      p.y = y;
      p.facing = f;
      p.cone = visibilityPolygon(sim.world, x, y, f, u.vision.fov, u.vision.range, p.coneBuf);
      if (p.cone.buffer !== p.coneBuf.buffer) p.coneBuf = new Float32Array(p.cone.length * 2);
      p.near = visibilityPolygon(sim.world, x, y, f, TAU, VISION.awarenessRadius, p.nearBuf);
      if (p.near.buffer !== p.nearBuf.buffer) p.nearBuf = new Float32Array(p.near.length * 2);
      this.batch.fan(x, y, p.cone, WHITE, false);
      this.batch.fan(x, y, p.near, WHITE, true);
    }
    this.batch.upload();
    this.remember(sim);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    raw.clear(0, 0, 0, 1);
    this.flat.use().mat4('uViewProj', this.ortho).f1('uZ', 0);
    this.batch.draw();

    // Separable blur raw -> tmp -> vision.
    gl.bindVertexArray(this.emptyVao);
    this.blur.use();
    tmp.bind();
    this.blur.tex('uTex', raw.texture, 0).f2('uStep', FOG.blurTexels / raw.width, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    vision.bind();
    this.blur.tex('uTex', tmp.texture, 0).f2('uStep', 0, FOG.blurTexels / raw.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // explored = max(explored, vision)
    explored.bind();
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.copy.use().tex('uTex', vision.texture, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Per-unit polygon record with reusable output buffers. */
  polygonsOf(id) {
    let p = this.polygons.get(id);
    if (!p) {
      p = { x: 0, y: 0, facing: 0, cone: null, near: null, coneBuf: new Float32Array(1024), nearBuf: new Float32Array(512) };
      this.polygons.set(id, p);
    }
    return p;
  }
}
