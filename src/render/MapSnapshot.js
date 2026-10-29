// A still picture of a map exactly as the game draws it: the same floor bake,
// paint, walls, furniture and closed doors, seen by the game's own camera from
// above the map's center, with nothing hidden by fog and no operators. Drawn
// once per map on a throwaway WebGL2 context (the map's card in the lobby,
// ui/MapPreview.js), copied to a 2D canvas and the context released.
import { createContext } from './gl/context.js';
import { createTexture } from './gl/RenderTarget.js';
import { Camera } from './Camera.js';
import { FloorLayer } from './layers/FloorLayer.js';
import { StaticLayer } from './layers/StaticLayer.js';
import { DoorLayer } from './layers/DoorLayer.js';
import { DecalLayer } from './layers/DecalLayer.js';
import { LIGHTING } from '../config/render.js';

const MARGIN = 0.8; // m of black around the map (tall props lean out of it)

/**
 * Renders `compiled` (sim/mapCompiler.js) at `width` px wide. Returns
 * {image: 2D canvas, floor: [x0, y0, x1, y1]} where `floor` is where the
 * map's floor rectangle (0, 0)-(w, h) lands in the image, or null if WebGL2
 * is not available.
 */
export function snapshotMap(compiled, width) {
  const W = compiled.width;
  const H = compiled.height;
  const height = Math.round((width * (H + 2 * MARGIN)) / (W + 2 * MARGIN));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let gl;
  try {
    gl = createContext(canvas, true);
  } catch {
    return null;
  }
  const camera = new Camera();
  camera.setViewport(width, height);
  camera.setBounds(W, H);
  const t = camera.tanHalf;
  camera.jumpTo(W / 2, H / 2, Math.max((H / 2 + MARGIN) / t, (W / 2 + MARGIN) / (t * camera.aspect)));
  camera.updateMatrices();

  const white = createTexture(gl, 1, 1, new Uint8Array([255, 255, 255, 255])); // everything in sight
  const max = LIGHTING.maxDynamicLights;
  const frame = {
    gl,
    camera,
    viewProj: camera.viewProj,
    lights: { data: new Float32Array(max * 4), colors: new Float32Array(max * 3), count: 0 },
    plan: new Float32Array([0, 0, -1e5, 1]), // no blueprint anywhere
    viewer: 'attackers',
    time: 0,
    worldTime: 0,
    dt: 0,
    worldDt: 0,
    alpha: 1,
    simulating: false,
    mapW: W,
    mapH: H,
    visionTex: white,
    exploredTex: white,
  };
  const floor = new FloorLayer(gl);
  const statics = new StaticLayer(gl);
  const doors = new DoorLayer(gl);
  const decals = new DecalLayer(gl);
  floor.build(compiled);
  statics.build(compiled);
  decals.build(compiled);

  // Same pass order as render/Renderer.js.
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.BLEND);
  floor.draw(frame);
  decals.draw(frame);
  statics.draw(frame);
  doors.draw(frame, { doors: compiled.doors.map((def) => ({ def, angle: 0, destroyed: false })) });

  // Copied in the same task, before the drawing buffer is presented and cleared.
  const image = document.createElement('canvas');
  image.width = width;
  image.height = height;
  image.getContext('2d').drawImage(canvas, 0, 0);
  gl.getExtension('WEBGL_lose_context')?.loseContext();

  const a = camera.worldToScreen(0, 0);
  const b = camera.worldToScreen(W, H);
  return { image, floor: [a.x, a.y, b.x, b.y] };
}
