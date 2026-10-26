// Floor decals: spray paint (static, textured) and blood (procedural,
// grows over time, persists for the whole round). The blood vertex buffer
// is only rebuilt when a decal was added/removed or one is still growing.
import { HEIGHTS, FX } from '../../config/render.js';
import { ShaderProgram } from '../gl/ShaderProgram.js';
import { Mesh, FloatBuffer } from '../gl/Mesh.js';
import { createTexture } from '../gl/RenderTarget.js';
import { DECAL_VS, BLOOD_FS, PAINT_FS } from '../shaders/decal.js';
import { paintDecal } from '../textures/paint.js';
import { applyFog } from '../sceneUniforms.js';

const LAYOUT = [
  { loc: 0, size: 2 },
  { loc: 1, size: 2 },
  { loc: 2, size: 4 },
  { loc: 3, size: 4 },
];

export const BLOOD_KIND = Object.freeze({ pool: 0, splatter: 1, drop: 2 });

export class DecalLayer {
  constructor(gl) {
    this.gl = gl;
    this.bloodProg = new ShaderProgram(gl, DECAL_VS, BLOOD_FS, 'blood');
    this.paintProg = new ShaderProgram(gl, DECAL_VS, PAINT_FS, 'paint');
    this.bloodMesh = new Mesh(gl, LAYOUT, { dynamic: true });
    this.buf = new FloatBuffer(1 << 14);
    this.blood = [];
    this.paints = [];
    this.bloodDirty = true; // vertex data must be rebuilt
  }

  build(compiled) {
    const gl = this.gl;
    for (const p of this.paints) gl.deleteTexture(p.tex);
    this.paints = [];
    for (const spec of compiled.paint) {
      const d = paintDecal(spec);
      if (!d) continue;
      const [x, y, w, h] = d.rect;
      const tex = createTexture(gl, d.canvas.width, d.canvas.height, d.canvas, { mipmaps: true });
      const v = [];
      quad(v, x + w / 2, y + h / 2, w / 2, h / 2, d.rot, [1, 1, 1, 0.92], [0, 0, 0, 0], true);
      this.paints.push({ tex, mesh: new Mesh(gl, LAYOUT, { data: new Float32Array(v) }) });
    }
    this.clearBlood();
  }

  clearBlood() {
    this.blood.length = 0;
    this.bloodDirty = true;
  }

  /** kind: BLOOD_KIND.*, size in meters (half extents), angle radians. */
  addBlood({ x, y, sx, sy = sx, angle = 0, kind = BLOOD_KIND.pool, growTime = 0.15, alpha = 0.95, seed = Math.random(), time }) {
    if (this.blood.length >= FX.maxDecals) this.blood.shift();
    this.blood.push({ x, y, sx, sy, angle, kind, growTime, alpha, seed, born: time });
    this.bloodDirty = true;
  }

  rebuildBlood(worldTime) {
    const v = this.buf;
    v.reset();
    let growing = false;
    for (const b of this.blood) {
      const t = Math.min(1, (worldTime - b.born) / b.growTime);
      if (t < 1) growing = true;
      const growth = 1 - (1 - t) * (1 - t) * (1 - t);
      quadInto(v, b.x, b.y, b.sx, b.sy, b.angle, FX.bloodRed, b.alpha, b.seed, growth, b.kind);
    }
    this.bloodMesh.upload(v.data, v.length);
    this.bloodDirty = growing;
  }

  draw(frame) {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    if (this.paints.length) {
      const p = this.paintProg.use();
      p.mat4('uViewProj', frame.viewProj).f1('uZ', HEIGHTS.floorDecal);
      applyFog(p, frame);
      for (const d of this.paints) {
        p.tex('uTex', d.tex, 0);
        d.mesh.draw();
      }
    }

    if (this.blood.length) {
      if (this.bloodDirty) this.rebuildBlood(frame.worldTime);
      const p = this.bloodProg.use();
      p.mat4('uViewProj', frame.viewProj).f1('uZ', HEIGHTS.bloodDecal);
      p.v3('uDark', FX.bloodDark);
      applyFog(p, frame);
      this.bloodMesh.draw();
    }

    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}

function corners(cx, cy, hx, hy, rot) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, w]) => [cx + u * hx * c - w * hy * s, cy + u * hx * s + w * hy * c, u, w]);
}

function quad(out, cx, cy, hx, hy, rot, color, params, uv01) {
  const k = corners(cx, cy, hx, hy, rot);
  for (const i of [0, 1, 2, 0, 2, 3]) {
    const [x, y, u, w] = k[i];
    const uu = uv01 ? (u + 1) / 2 : u;
    const ww = uv01 ? (w + 1) / 2 : w;
    out.push(x, y, uu, ww, ...color, ...params);
  }
}

const QUAD_CORNERS = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]; // two triangles, (u, w) in -1..1

/** Appends one blood quad (6 vertices) without allocating. */
function quadInto(buf, cx, cy, hx, hy, rot, rgb, alpha, seed, growth, kind) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  buf.ensure(72);
  const d = buf.data;
  let o = buf.length;
  for (let i = 0; i < 12; i += 2) {
    const u = QUAD_CORNERS[i];
    const w = QUAD_CORNERS[i + 1];
    d[o++] = cx + u * hx * c - w * hy * s;
    d[o++] = cy + u * hx * s + w * hy * c;
    d[o++] = u;
    d[o++] = w;
    d[o++] = rgb[0];
    d[o++] = rgb[1];
    d[o++] = rgb[2];
    d[o++] = alpha;
    d[o++] = seed;
    d[o++] = growth;
    d[o++] = kind;
    d[o++] = 0;
  }
  buf.length = o;
}
