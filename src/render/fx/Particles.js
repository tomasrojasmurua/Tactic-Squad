// CPU particle system (cosmetic only, not part of the simulation).
// Particles live in 3D (z = height) and are drawn as flat quads facing up.
// Two batches: alpha-blended (smoke, blood, casings) and additive (fire).
import { FX } from '../../config/render.js';
import { ShaderProgram } from '../gl/ShaderProgram.js';
import { Mesh, FloatBuffer } from '../gl/Mesh.js';
import { PARTICLE_VS, PARTICLE_FS } from '../shaders/particle.js';
import { applyFog } from '../sceneUniforms.js';

export const SHAPE = Object.freeze({ puff: 0, dot: 1, star: 2, rect: 3, streak: 4, beam: 5 });

const LAYOUT = [
  { loc: 0, size: 3 },
  { loc: 1, size: 2 },
  { loc: 2, size: 2 },
  { loc: 3, size: 1 },
  { loc: 4, size: 4 },
  { loc: 5, size: 1 },
];
const CORNERS = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
const GRAVITY = 9.8;

/** One live particle. A single fixed shape (pooled) keeps every numeric field unboxed: no per-frame garbage. */
class Particle {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.life = 1;
    this.age = 0;
    this.size = [0, 0];
    this.grow = 0;
    this.rot = 0;
    this.spin = 0;
    this.color = [0, 0, 0, 0];
    this.fade = true;
    this.fadeIn = false;
    this.fadeOutLast = 0;
    this.shape = 0;
    this.additive = false;
    this.drag = 0;
    this.gravity = 0;
    this.bounce = 0;
    this.onLand = null;
  }
}

/**
 * Particle fields (spawn description): x y z, vx vy vz, life, size [sx, sy],
 * grow (size/s), rot, spin, color [r g b a], fade (bool), shape, additive,
 * drag, gravity, bounce (casings), onLand(p) callback (blood drop -> decal),
 * fadeIn (bool), fadeOutLast (seconds of fade at the end when fade=false).
 * The description is copied into a pooled Particle. Every particle is hidden
 * by the fog of war like the world around it.
 */
export class Particles {
  constructor(gl) {
    this.gl = gl;
    this.prog = new ShaderProgram(gl, PARTICLE_VS, PARTICLE_FS, 'particles');
    this.alphaMesh = new Mesh(gl, LAYOUT, { dynamic: true });
    this.addMesh = new Mesh(gl, LAYOUT, { dynamic: true });
    this.alphaBuf = new FloatBuffer(1 << 15);
    this.addBuf = new FloatBuffer(1 << 14);
    this.list = [];
    this.free = [];
  }

  clear() {
    for (const p of this.list) this.release(p);
    this.list.length = 0;
  }

  release(p) {
    p.onLand = null;
    this.free.push(p);
  }

  spawn(d) {
    if (this.list.length >= FX.maxParticles) this.release(this.list.shift());
    const p = this.free.pop() || new Particle();
    p.x = d.x;
    p.y = d.y;
    p.z = d.z ?? 0;
    p.vx = d.vx ?? 0;
    p.vy = d.vy ?? 0;
    p.vz = d.vz ?? 0;
    p.life = d.life;
    p.age = 0;
    p.size[0] = d.size[0];
    p.size[1] = d.size[1];
    p.grow = d.grow ?? 0;
    p.rot = d.rot ?? 0;
    p.spin = d.spin ?? 0;
    const c = d.color;
    p.color[0] = c[0];
    p.color[1] = c[1];
    p.color[2] = c[2];
    p.color[3] = c[3];
    p.fade = d.fade ?? true;
    p.fadeIn = !!d.fadeIn;
    p.fadeOutLast = d.fadeOutLast ?? 0;
    p.shape = d.shape ?? SHAPE.puff;
    p.additive = !!d.additive;
    p.drag = d.drag ?? 0;
    p.gravity = d.gravity ?? 0;
    p.bounce = d.bounce ?? 0;
    p.onLand = d.onLand ?? null;
    this.list.push(p);
    return p;
  }

  update(dt) {
    // Integrate and compact in place (no per-frame array).
    const list = this.list;
    let kept = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.release(p);
        continue;
      }
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
        p.vz *= p.gravity ? 1 : k;
      }
      p.vz -= p.gravity * GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.spin * dt;
      if (p.grow) {
        p.size[0] += p.grow * dt;
        p.size[1] += p.grow * dt;
      }
      if (p.z <= 0 && p.gravity) {
        p.z = 0;
        if (p.onLand) {
          p.onLand(p);
          this.release(p);
          continue;
        }
        if (p.bounce && Math.abs(p.vz) > 0.6) {
          p.vz = -p.vz * p.bounce;
          p.vx *= 0.55;
          p.vy *= 0.55;
          p.spin *= 0.5;
        } else {
          p.vz = 0;
          p.vx *= 0.8;
          p.vy *= 0.8;
          p.spin *= 0.8;
        }
      }
      list[kept++] = p;
    }
    list.length = kept;
  }

  draw(frame) {
    const gl = this.gl;
    this.alphaBuf.reset();
    this.addBuf.reset();
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      writeQuad(p.additive ? this.addBuf : this.alphaBuf, p);
    }
    const prog = this.prog.use();
    prog.mat4('uViewProj', frame.viewProj);
    prog.f1('uFogged', 1);
    applyFog(prog, frame);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    if (this.alphaBuf.length) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      this.alphaMesh.upload(this.alphaBuf.data, this.alphaBuf.length);
      this.alphaMesh.draw();
    }
    if (this.addBuf.length) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      this.addMesh.upload(this.addBuf.data, this.addBuf.length);
      this.addMesh.draw();
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}

function writeQuad(buf, p) {
  const t = p.age / p.life;
  let alpha = p.fade ? p.color[3] * (1 - t) : p.color[3];
  if (p.fadeIn) alpha *= Math.min(1, t * 6);
  if (p.fadeOutLast) alpha *= Math.min(1, (p.life - p.age) / p.fadeOutLast);
  buf.ensure(6 * 13);
  const d = buf.data;
  let o = buf.length;
  for (let i = 0; i < 12; i += 2) {
    d[o++] = p.x;
    d[o++] = p.y;
    d[o++] = p.z;
    d[o++] = CORNERS[i];
    d[o++] = CORNERS[i + 1];
    d[o++] = p.size[0];
    d[o++] = p.size[1];
    d[o++] = p.rot;
    d[o++] = p.color[0];
    d[o++] = p.color[1];
    d[o++] = p.color[2];
    d[o++] = alpha;
    d[o++] = p.shape;
  }
  buf.length = o;
}
