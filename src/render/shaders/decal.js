// Floor decals: procedural blood (pools / splatters / drops) and textured
// spray paint. Both respect the fog of war.
import { HEADER, NOISE, FOG } from './common.js';

export const DECAL_VS = /* glsl */ `${HEADER}
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
layout(location = 2) in vec4 aColor;
layout(location = 3) in vec4 aParams;   // seed, growth 0..1, kind, unused
uniform mat4 uViewProj;
uniform float uZ;
out vec2 vPos;
out vec2 vUv;
out vec4 vColor;
out vec4 vParams;
void main() {
  vPos = aPos;
  vUv = aUv;
  vColor = aColor;
  vParams = aParams;
  gl_Position = uViewProj * vec4(aPos, uZ, 1.0);
}
`;

export const BLOOD_FS = /* glsl */ `${HEADER}
${NOISE}
${FOG}
in vec2 vPos;
in vec2 vUv;
in vec4 vColor;
in vec4 vParams;
uniform vec3 uDark;
out vec4 outColor;

void main() {
  float seed = vParams.x;
  float growth = vParams.y;
  int kind = int(vParams.z + 0.5);
  vec2 uv = vUv;
  float m;
  if (kind == 1) {
    // Splatter: elongated along +x with ragged lobes and flung droplets.
    vec2 q = vec2(uv.x * 0.62, uv.y);
    float r = length(q);
    float n = fbm(uv * 2.6 + seed * 11.0);
    float body = 1.0 - smoothstep(0.0, 0.05, r - (0.46 + (n - 0.5) * 0.7) * growth);
    vec2 cell = floor(uv * 6.0 + seed);
    vec2 f = fract(uv * 6.0 + seed) - 0.5;
    float h = hash12(cell);
    float drop = (1.0 - smoothstep(0.08, 0.16, length(f) / max(h, 0.2))) * step(0.72, h) * step(length(uv), growth);
    m = max(body, drop);
  } else if (kind == 2) {
    float r = length(uv);
    m = 1.0 - smoothstep(0.75, 0.95, r + (vnoise(uv * 4.0 + seed) - 0.5) * 0.3);
  } else {
    // Pool: lumpy disc that grows over time.
    float r = length(uv);
    float n = fbm(uv * 1.8 + seed * 7.0);
    m = 1.0 - smoothstep(0.0, 0.04, r - (0.55 + (n - 0.5) * 0.55) * growth);
  }
  if (m < 0.01) discard;
  float shade = vnoise(uv * 3.0 + seed * 5.0);
  vec3 col = mix(uDark, vColor.rgb, 0.72 + 0.28 * shade);
  float vis = visionAt(vPos);
  outColor = vec4(applyFogKind(col, vPos, vis, 0.0, 3.0, 0.0), m * vColor.a);
}
`;

export const PAINT_FS = /* glsl */ `${HEADER}
${FOG}
in vec2 vPos;
in vec2 vUv;
in vec4 vColor;
in vec4 vParams;
uniform sampler2D uTex;
out vec4 outColor;
void main() {
  vec4 t = texture(uTex, vUv);
  if (t.a < 0.01) discard;
  float vis = visionAt(vPos);
  outColor = vec4(applyFogKind(t.rgb, vPos, vis, 0.0, 3.0, 0.0), t.a * vColor.a);
}
`;
