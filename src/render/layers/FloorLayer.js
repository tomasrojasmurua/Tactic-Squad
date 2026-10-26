// Floors. At map load the procedural floor shader (patterns + baked wall
// shadows/AO) renders once into a map-space albedo texture; every frame a
// single cheap quad samples it and applies dynamic lights + fog of war.
import { FLOORS, FLOOR_PATTERN } from '../../config/materials.js';
import { LIGHTING, LAMPS, BLUEPRINT } from '../../config/render.js';
import { hexToRgb } from '../../core/math.js';
import * as mat4 from '../../core/mat4.js';
import { ShaderProgram } from '../gl/ShaderProgram.js';
import { Mesh } from '../gl/Mesh.js';
import { RenderTarget, createTexture } from '../gl/RenderTarget.js';
import { FLOOR_VS, FLOOR_BAKE_FS, FLOOR_DRAW_VS, FLOOR_DRAW_FS } from '../shaders/floor.js';
import { bakeShadowCanvas } from '../textures/shadowMap.js';
import { bakeFloorDecor } from '../textures/floorDecor.js';
import { applyFog, applyLights } from '../sceneUniforms.js';

const BAKE_LAYOUT = [
  { loc: 0, size: 2 },
  { loc: 1, size: 1 },
  { loc: 2, size: 3 },
  { loc: 3, size: 3 },
  { loc: 4, size: 2 },
  { loc: 5, size: 4 },
];
const TARGET_PIXELS_PER_METER = 64;

export class FloorLayer {
  constructor(gl) {
    this.gl = gl;
    this.bakeProg = new ShaderProgram(gl, FLOOR_VS, FLOOR_BAKE_FS, 'floor-bake');
    this.drawProg = new ShaderProgram(gl, FLOOR_DRAW_VS, FLOOR_DRAW_FS, 'floor');
    this.quad = new Mesh(gl, [{ loc: 0, size: 2 }]);
    this.albedo = null;
  }

  build(compiled) {
    const gl = this.gl;
    const W = compiled.width;
    const H = compiled.height;

    // Floor rectangles with their pattern parameters.
    const v = [];
    compiled.floors.forEach((f, i) => {
      const mat = FLOORS[f.material];
      if (!mat) throw new Error(`Material de piso desconocido: ${f.material}`);
      const [x, y, w, h] = f.rect;
      const a = hexToRgb(mat.a);
      const b = hexToRgb(mat.b);
      const pat = FLOOR_PATTERN[mat.pattern];
      const corner = (cx, cy) => v.push(cx, cy, pat, ...a, ...b, mat.scale, i * 7.31, x, y, x + w, y + h);
      corner(x, y);
      corner(x + w, y);
      corner(x + w, y + h);
      corner(x, y);
      corner(x + w, y + h);
      corner(x, y + h);
    });
    const mesh = new Mesh(gl, BAKE_LAYOUT, { data: new Float32Array(v) });

    const shadowCanvas = bakeShadowCanvas(compiled);
    const shadowTex = createTexture(gl, shadowCanvas.width, shadowCanvas.height, shadowCanvas);
    const decorCanvas = bakeFloorDecor(compiled);
    const decorTex = createTexture(gl, decorCanvas.width, decorCanvas.height, decorCanvas);

    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const ppm = Math.min(TARGET_PIXELS_PER_METER, Math.floor(maxTex / Math.max(W, H)));
    if (this.albedo) this.albedo.dispose();
    this.albedo = new RenderTarget(gl, Math.ceil(W * ppm), Math.ceil(H * ppm));
    this.albedo.clear(0, 0, 0, 0);

    const ortho = mat4.ortho(mat4.create(), 0, W, 0, H, -1, 1);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    const p = this.bakeProg.use();
    p.mat4('uViewProj', ortho);
    p.tex('uShadow', shadowTex, 1);
    p.tex('uDecor', decorTex, 2);
    p.f2('uMapSize', W, H);
    p.v3('uShadowTint', LIGHTING.shadowTint);
    p.f1('uShadowStrength', LIGHTING.shadowStrength);
    p.f1('uAoStrength', LIGHTING.aoStrength);
    p.f1('uLampFloor', LAMPS.floor);
    p.f1('uLampGain', LAMPS.gain);
    mesh.draw();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteTexture(shadowTex);
    gl.deleteTexture(decorTex);

    gl.bindTexture(gl.TEXTURE_2D, this.albedo.texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);

    this.quad.upload(new Float32Array([0, 0, W, 0, W, H, 0, 0, W, H, 0, H]));
  }

  draw(frame) {
    const gl = this.gl;
    const p = this.drawProg.use();
    p.mat4('uViewProj', frame.viewProj);
    applyFog(p, frame);
    applyLights(p, frame);
    p.f1('uBpGridAlpha', BLUEPRINT.gridAlpha);
    p.tex('uAlbedo', this.albedo.texture, 1);
    gl.depthMask(false);
    this.quad.draw();
    gl.depthMask(true);
  }
}
