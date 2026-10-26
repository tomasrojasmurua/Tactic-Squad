// Camera-facing (flat, top-down) particles: smoke, flashes, tracers,
// sparks, blood drops and shell casings. Fogged per fragment.
import { HEADER, FOG } from './common.js';

export const PARTICLE_VS = /* glsl */ `${HEADER}
layout(location = 0) in vec3 aCenter;
layout(location = 1) in vec2 aCorner;
layout(location = 2) in vec2 aSize;
layout(location = 3) in float aRot;
layout(location = 4) in vec4 aColor;
layout(location = 5) in float aShape;
uniform mat4 uViewProj;
out vec2 vUv;
out vec4 vColor;
flat out float vShape;
out vec3 vWorld;
void main() {
  float c = cos(aRot);
  float s = sin(aRot);
  vec2 off = aCorner * aSize;
  off = vec2(c * off.x - s * off.y, s * off.x + c * off.y);
  vec3 w = aCenter + vec3(off, 0.0);
  vUv = aCorner;
  vColor = aColor;
  vShape = aShape;
  vWorld = w;
  gl_Position = uViewProj * vec4(w, 1.0);
}
`;

export const PARTICLE_FS = /* glsl */ `${HEADER}
${FOG}
in vec2 vUv;
in vec4 vColor;
flat in float vShape;
in vec3 vWorld;
uniform float uFogged;
out vec4 outColor;

void main() {
  int shape = int(vShape + 0.5);
  float r = length(vUv);
  float a;
  if (shape == 0) {            // soft puff
    a = (1.0 - smoothstep(0.2, 1.0, r)) * 0.9;
  } else if (shape == 1) {     // hard dot
    a = 1.0 - smoothstep(0.75, 1.0, r);
  } else if (shape == 2) {     // muzzle star
    float core = exp(-r * r * 7.0);
    float rayX = exp(-abs(vUv.y) * 16.0) * (1.0 - abs(vUv.x));
    float rayY = exp(-abs(vUv.x) * 16.0) * (1.0 - abs(vUv.y)) * 0.55;
    a = clamp(core + rayX + rayY, 0.0, 1.0);
  } else if (shape == 3) {     // rectangle (casing)
    vec2 q = abs(vUv);
    a = 1.0 - smoothstep(0.85, 1.0, max(q.x, q.y));
  } else if (shape == 4) {     // tracer / spark streak, head at +x
    float across = 1.0 - abs(vUv.y);
    float along = vUv.x * 0.5 + 0.5;
    a = across * across * mix(0.08, 1.0, along * along);
  } else {                     // beam: soft line, even along its length (smoke trail)
    float across = 1.0 - abs(vUv.y);
    a = across * across * smoothstep(1.0, 0.9, abs(vUv.x));
  }
  float vis = uFogged > 0.5 ? visionAt(vWorld.xy) : 1.0;
  a *= vColor.a * vis;
  if (a < 0.003) discard;
  outColor = vec4(vColor.rgb, a);
}
`;
