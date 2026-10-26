// Uniform blocks shared by every fogged / lit program.
import { FOG, LIGHTING, OUTLINE, BLUEPRINT } from '../config/render.js';

const TEX_VISION = 6;
const TEX_EXPLORED = 7;

export function applyFog(prog, frame) {
  prog.tex('uVision', frame.visionTex, TEX_VISION);
  prog.tex('uExplored', frame.exploredTex, TEX_EXPLORED);
  prog.f2('uMapSize', frame.mapW, frame.mapH);
  prog.v3('uMemTint', FOG.memoryTint);
  prog.f1('uMemExplored', FOG.explored);
  prog.f1('uMemUnexplored', FOG.unexplored);
  prog.f1('uMemSat', FOG.memorySaturation);
  const plan = frame.plan;
  prog.f4('uPlan', plan[0], plan[1], plan[2], plan[3]);
  prog.f1('uPlanBand', BLUEPRINT.wipeBand);
  prog.v3('uBpDeep', BLUEPRINT.deep);
  prog.v3('uBpHigh', BLUEPRINT.high);
  prog.v3('uBpLine', BLUEPRINT.line);
  prog.v3('uBpProp', BLUEPRINT.prop);
  prog.f4('uBpAccent', 0, 0, 0, 0);
  prog.f1('uBpPaint', BLUEPRINT.paintKeep);
}

/** Door slabs read as amber in the blueprint (call after applyLit). */
export function applyDoorAccent(prog) {
  const c = BLUEPRINT.door;
  prog.f4('uBpAccent', c[0], c[1], c[2], BLUEPRINT.doorAmount);
}

export function applyLights(prog, frame) {
  prog.i1('uLightCount', frame.lights.count);
  if (frame.lights.count) {
    prog.v4('uLights', frame.lights.data);
    prog.v3('uLightColors', frame.lights.colors);
  }
}

export function applyLit(prog, frame) {
  prog.mat4('uViewProj', frame.viewProj);
  applyFog(prog, frame);
  applyLights(prog, frame);
  prog.v3('uLightDir', LIGHTING.direction);
  prog.f1('uAmbient', LIGHTING.ambient);
  prog.f1('uDiffuse', LIGHTING.diffuse);
  prog.f1('uOutlineWidth', OUTLINE.width);
  prog.f1('uOutlineStrength', OUTLINE.strength);
  prog.f1('uWallSampleOffset', FOG.wallSampleOffset);
  prog.f3('uColorMul', 1, 1, 1);
  prog.f4('uTint', 0, 0, 0, 0);
  prog.f1('uFogEnabled', 1);
  prog.f1('uAlpha', 1);
  prog.f1('uMemWallBoost', FOG.memoryWallBoost);
}
