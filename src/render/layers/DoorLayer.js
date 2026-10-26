// Swinging door slabs, one model matrix per door (hinge pivot).
import { DOOR } from '../../config/materials.js';
import { HEIGHTS } from '../../config/render.js';
import { DOORS } from '../../config/balance.js';
import * as mat4 from '../../core/mat4.js';
import { ShaderProgram } from '../gl/ShaderProgram.js';
import { Mesh } from '../gl/Mesh.js';
import { MeshBuilder, LIT_LAYOUT } from '../geometry/MeshBuilder.js';
import { LIT_VS, LIT_FS } from '../shaders/lit.js';
import { applyLit, applyDoorAccent } from '../sceneUniforms.js';

export class DoorLayer {
  constructor(gl) {
    this.gl = gl;
    this.prog = new ShaderProgram(gl, LIT_VS, LIT_FS, 'lit-doors');
    this.meshes = new Map(); // by length
    this.model = mat4.create();
  }

  meshFor(length) {
    const key = length.toFixed(3);
    let mesh = this.meshes.get(key);
    if (!mesh) {
      const m = new MeshBuilder();
      const t = DOORS.thickness;
      const h = HEIGHTS.door;
      // Slab from the hinge (x = 0) to the free end (x = length).
      m.box(length / 2, 0, 0, length - 0.02, t, h, DOOR.slab, { top: DOOR.top });
      m.box(length - 0.16, t / 2 + 0.02, h * 0.5, 0.1, 0.04, 0.04, DOOR.handle); // handles
      m.box(length - 0.16, -t / 2 - 0.02, h * 0.5, 0.1, 0.04, 0.04, DOOR.handle);
      m.box(length * 0.5, 0, h, length * 0.6, t * 0.5, 0.005, DOOR.trim);
      mesh = new Mesh(this.gl, LIT_LAYOUT, { data: m.toFloat32() });
      this.meshes.set(key, mesh);
    }
    return mesh;
  }

  draw(frame, sim) {
    const p = this.prog.use();
    applyLit(p, frame);
    applyDoorAccent(p);
    for (const d of sim.doors) {
      const def = d.def;
      mat4.fromTransform(this.model, def.hingeX, def.hingeY, 0, def.closedAngle + d.angle);
      p.mat4('uModel', this.model);
      this.meshFor(def.length).draw();
    }
  }
}
