// Static lit geometry: extruded walls (grey sides, black tops), window sills
// and all furniture, merged into a single mesh / draw call.
import { WALL } from '../../config/materials.js';
import { HEIGHTS } from '../../config/render.js';
import { ShaderProgram } from '../gl/ShaderProgram.js';
import { Mesh } from '../gl/Mesh.js';
import { MeshBuilder, LIT_LAYOUT } from '../geometry/MeshBuilder.js';
import { buildProp } from '../geometry/props.js';
import { LIT_VS, LIT_FS } from '../shaders/lit.js';
import { applyLit } from '../sceneUniforms.js';
import * as mat4 from '../../core/mat4.js';

export class StaticLayer {
  constructor(gl) {
    this.gl = gl;
    this.prog = new ShaderProgram(gl, LIT_VS, LIT_FS, 'lit-static');
    this.mesh = new Mesh(gl, LIT_LAYOUT);
    this.identity = mat4.create();
  }

  build(compiled) {
    const m = new MeshBuilder();
    for (const w of compiled.walls) {
      const b = w.box;
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      const bw = b.maxX - b.minX;
      const bd = b.maxY - b.minY;
      if (w.kind === 'fence') {
        buildFence(m, cx, cy, bw, bd);
        continue;
      }
      const exterior = w.thickness >= WALL.exteriorThickness;
      const side = exterior ? WALL.exteriorSide : WALL.side;
      const k = WALL.baseboardOut * 2;
      m.box(cx, cy, 0, bw + k, bd + k, WALL.baseboardHeight, WALL.baseboard, { top: WALL.baseboard });
      m.box(cx, cy, 0, bw, bd, HEIGHTS.wall, side, { top: WALL.top });
    }
    for (const w of compiled.windows || []) buildSill(m, w);
    for (const p of compiled.props) buildProp(m, p);
    this.mesh.upload(m.toFloat32());
  }

  draw(frame) {
    const p = this.prog.use();
    applyLit(p, frame);
    p.mat4('uModel', this.identity);
    this.mesh.draw();
  }
}

/** A window: a waist-high sill across the gap, its top pale like glass, with a dark frame along both faces. */
function buildSill(m, w) {
  const b = w.box;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const bw = b.maxX - b.minX;
  const bd = b.maxY - b.minY;
  const h = HEIGHTS.sill;
  m.box(cx, cy, 0, bw, bd, h, WALL.sill, { top: WALL.sillTop });
  const f = 0.05; // frame width, m
  const vertical = w.axis === 'v';
  for (const s of [-1, 1]) {
    const ox = vertical ? (s * (bw - f)) / 2 : 0;
    const oy = vertical ? 0 : (s * (bd - f)) / 2;
    m.box(cx + ox, cy + oy, h, vertical ? f : bw, vertical ? bd : f, 0.03, WALL.sillFrame, { top: WALL.sillFrame });
  }
}

/** Low chain-link-ish fence: posts, rails and a translucent-looking mesh panel. */
function buildFence(m, cx, cy, w, d) {
  const along = w >= d;
  const len = along ? w : d;
  const h = HEIGHTS.fence;
  m.box(cx, cy, 0, w, d, h * 0.92, WALL.fenceMesh, { top: WALL.fenceTop });
  m.box(cx, cy, h * 0.92, along ? w : w * 1.4, along ? d * 1.4 : d, h * 0.08, WALL.fence, { top: WALL.fenceRail });
  const n = Math.max(1, Math.round(len / WALL.fencePostSpacing));
  for (let i = 0; i <= n; i++) {
    const t = -len / 2 + (len * i) / n;
    m.box(cx + (along ? t : 0), cy + (along ? 0 : t), 0, 0.12, 0.12, h + 0.08, WALL.fence, { top: WALL.fenceRail });
  }
}
