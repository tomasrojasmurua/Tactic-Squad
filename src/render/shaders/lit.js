// Flat-shaded low-poly meshes (walls, props, doors, characters) with
// procedural outlines (per-vertex distance to face edge), directional
// light, dynamic point lights and fog of war.
import { HEADER, FOG, LIGHTS } from './common.js';

export const LIT_VS = /* glsl */ `${HEADER}
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColor;
layout(location = 3) in float aEdge;
uniform mat4 uViewProj;
uniform mat4 uModel;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out float vEdge;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(uModel) * aNormal;
  vColor = aColor;
  vEdge = aEdge;
  gl_Position = uViewProj * w;
}
`;

export const LIT_FS = /* glsl */ `${HEADER}
${FOG}
${LIGHTS}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in float vEdge;
uniform vec3 uColorMul;
uniform vec4 uTint;          // rgb + amount (hit flash)
uniform float uFogEnabled;   // 0 = always fully visible (own squad)
uniform float uOutlineWidth;
uniform float uOutlineStrength;
uniform vec3 uLightDir;
uniform float uAmbient;
uniform float uDiffuse;
uniform float uWallSampleOffset;
uniform float uAlpha;
uniform float uMemWallBoost;
out vec4 outColor;

void main() {
  vec3 n = normalize(vNormal);
  vec3 base = vColor * uColorMul;
  float aa = fwidth(vEdge) * 1.2;
  float line = 1.0 - smoothstep(uOutlineWidth - aa, uOutlineWidth + aa, vEdge);
  base = mix(base, base * 0.16, line * uOutlineStrength);

  float ndl = max(dot(n, -normalize(uLightDir)), 0.0);
  // Gentle height gradient on vertical faces: darker toward the floor.
  float heightShade = mix(0.82, 1.0, clamp(vWorld.z / 1.6, 0.0, 1.0));
  float shade = (uAmbient + uDiffuse * ndl) * (abs(n.z) > 0.5 ? 1.0 : heightShade);
  vec3 col = base * shade;

  vec2 samplePos = vWorld.xy + n.xy * uWallSampleOffset;
  float vis = uFogEnabled > 0.5 ? visionAt(samplePos) : 1.0;
  col += dynamicLights(vWorld) * base * vis;
  col = mix(col, uTint.rgb, uTint.a);
  if (uFogEnabled > 0.5) {
    bool top = abs(n.z) > 0.5;
    col = applyFogKind(col, samplePos, vis, top ? 0.0 : uMemWallBoost, top ? 2.0 : 1.0, vWorld.z);
  }
  outColor = vec4(col, uAlpha);
}
`;
