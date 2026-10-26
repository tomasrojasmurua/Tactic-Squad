// Procedural floors: checker tiles, small tiles, wood planks, carpet,
// concrete, asphalt and rugs — generated in a fragment shader and baked once
// per map into a map-space albedo texture (with shadows/AO), then sampled.
// Pattern ids must match config/materials.js FLOOR_PATTERN.
import { HEADER, NOISE, FOG, LIGHTS } from './common.js';

export const FLOOR_VS = /* glsl */ `${HEADER}
layout(location = 0) in vec2 aPos;
layout(location = 1) in float aPattern;
layout(location = 2) in vec3 aColA;
layout(location = 3) in vec3 aColB;
layout(location = 4) in vec2 aParams;   // scale, seed
layout(location = 5) in vec4 aRect;     // minX, minY, maxX, maxY
uniform mat4 uViewProj;
out vec2 vPos;
flat out float vPattern;
flat out vec3 vA;
flat out vec3 vB;
flat out vec2 vParams;
flat out vec4 vRect;
void main() {
  vPos = aPos;
  vPattern = aPattern;
  vA = aColA;
  vB = aColB;
  vParams = aParams;
  vRect = aRect;
  gl_Position = uViewProj * vec4(aPos, 0.0, 1.0);
}
`;

export const FLOOR_BAKE_FS = /* glsl */ `${HEADER}
${NOISE}
in vec2 vPos;
flat in float vPattern;
flat in vec3 vA;
flat in vec3 vB;
flat in vec2 vParams;
flat in vec4 vRect;
uniform sampler2D uShadow;
uniform sampler2D uDecor;
uniform vec2 uMapSize;
uniform vec3 uShadowTint;
uniform float uShadowStrength;
uniform float uAoStrength;
uniform float uLampFloor;
uniform float uLampGain;
out vec4 outColor;

// 1 on a grid line of width w (meters) for a grid of cell size s.
float gridLine(vec2 p, float s, float w) {
  vec2 f = fract(p / s) * s;
  vec2 d = min(f, s - f);
  float m = min(d.x, d.y);
  float aa = fwidth(m) * 0.9;
  return 1.0 - smoothstep(w - aa, w + aa, m);
}

// Bevel of a square cell: +1 near the lit (top-left) edges, -1 near the far ones.
float bevel(vec2 p, float s, float w) {
  vec2 f = fract(p / s) * s;
  float lit = 1.0 - smoothstep(0.0, w, min(f.x, f.y));
  float dark = 1.0 - smoothstep(0.0, w, min(s - f.x, s - f.y));
  return lit - dark;
}

// Grime that gathers in large soft blotches (shared by every material).
float grime(vec2 p) {
  return smoothstep(0.45, 0.85, fbm(p * 0.45 + vParams.y * 3.1));
}

vec3 checker(vec2 p, float s) {
  vec2 c = floor(p / s);
  float k = mod(c.x + c.y, 2.0);
  vec3 col = mix(vA, vB, k);
  col *= 0.94 + 0.09 * hash12(c + vParams.y);
  col *= 0.96 + 0.06 * vnoise(p * 2.5);
  col *= 1.0 + 0.07 * bevel(p, s, 0.05);
  // tiny chips and scuffs
  col *= 1.0 - 0.18 * step(0.985, hash12(floor(p * 9.0) + 7.0));
  col *= 1.0 - 0.14 * grime(p);
  float l = gridLine(p, s, 0.017);
  return mix(col, col * 0.28, l * 0.92);
}

vec3 tiles(vec2 p, float s) {
  vec2 c = floor(p / s);
  vec3 col = vA * (0.95 + 0.06 * hash12(c + vParams.y));
  col *= 0.97 + 0.04 * vnoise(p * 4.0);
  col *= 1.0 + 0.06 * bevel(p, s, 0.03);
  col *= 1.0 - 0.1 * grime(p * 1.6);
  return mix(col, vB, gridLine(p, s, 0.012));
}

vec3 wood(vec2 p, float s) {
  float row = floor(p.y / s);
  float off = hash12(vec2(row, vParams.y)) * 3.0;
  float plankLen = 1.9;
  float plank = floor((p.x + off) / plankLen);
  float h = hash12(vec2(row, plank));
  vec3 col = vA * (0.78 + 0.34 * h);
  // grain: stretched noise with a few darker rings
  float grain = vnoise(vec2(p.x * 1.4 + h * 10.0, p.y * 34.0));
  float rings = smoothstep(0.62, 0.9, vnoise(vec2(p.x * 0.6 + h * 31.0, p.y * 9.0 + row)));
  col *= 0.86 + 0.2 * grain;
  col *= 1.0 - 0.18 * rings;
  // knots
  vec2 kc = vec2(fract((p.x + off) / plankLen) * plankLen - (0.4 + h), fract(p.y / s) * s - s * 0.5);
  float knot = 1.0 - smoothstep(0.02, 0.05, length(kc * vec2(0.6, 1.4)));
  col *= 1.0 - 0.45 * knot * step(0.55, h);
  // worn varnish: lighter, glossy-looking streak along traffic
  col *= 1.0 + 0.1 * smoothstep(0.55, 0.8, fbm(p * vec2(0.25, 0.7) + 9.0));
  float fy = fract(p.y / s) * s;
  float fx = fract((p.x + off) / plankLen) * plankLen;
  float seam = min(min(fy, s - fy), min(fx, plankLen - fx));
  float aa = fwidth(seam);
  col *= 1.0 + 0.08 * (1.0 - smoothstep(0.0, 0.025, fy)) - 0.1 * (1.0 - smoothstep(0.0, 0.025, s - fy));
  return mix(vB, col, smoothstep(0.007 - aa, 0.007 + aa, seam));
}

vec3 carpet(vec2 p, float s) {
  vec2 c = floor(p / (s * 0.5));
  float k = mod(c.x + c.y, 2.0);
  vec3 col = mix(vA, vB, k * 0.3);
  col *= 0.9 + 0.14 * fbm(p * 1.7);
  col *= 0.93 + 0.12 * hash12(floor(p * 80.0));
  // walked-on paths are flattened and slightly lighter
  col *= 1.0 + 0.08 * smoothstep(0.5, 0.75, fbm(p * 0.5 + 4.0));
  col *= 1.0 - 0.12 * grime(p);
  return col;
}

vec3 concrete(vec2 p, float s) {
  vec3 col = vA * (0.82 + 0.22 * fbm(p * 0.7 + vParams.y));
  col *= 0.95 + 0.07 * vnoise(p * 14.0);
  col *= 0.97 + 0.05 * hash12(floor(p * 60.0));
  float stain = smoothstep(0.58, 0.72, fbm(p * 0.35 + 3.7));
  col = mix(col, vB, stain * 0.4);
  // oil stains: dark round blots
  vec2 oc = floor(p / 4.0);
  vec2 of = fract(p / 4.0) * 4.0 - (1.0 + 2.0 * vec2(hash12(oc + 1.3), hash12(oc + 2.7)));
  float oil = (1.0 - smoothstep(0.2, 0.9, length(of) + (vnoise(p * 3.0) - 0.5) * 0.5)) * step(0.78, hash12(oc));
  col *= 1.0 - 0.3 * oil;
  // hairline cracks
  float crack = smoothstep(0.01, 0.0, abs(fbm(p * 0.8 + 11.0) - 0.5)) * step(0.5, vnoise(p * 0.4 + 2.0));
  col *= 1.0 - 0.4 * crack;
  // saw-cut joints with a lighter lip
  float joint = gridLine(p, s, 0.016);
  col *= 1.0 + 0.05 * bevel(p, s, 0.06);
  return mix(col, col * 0.5, joint);
}

vec3 asphalt(vec2 p, float s) {
  vec3 col = vA * (0.82 + 0.24 * fbm(p * 1.2));
  col *= 0.84 + 0.3 * hash12(floor(p * 45.0));
  float crack = smoothstep(0.012, 0.0, abs(fbm(p * 0.9) - 0.5)) * step(0.55, vnoise(p * 0.5));
  col = mix(col, vB * 0.6, crack * 0.7);
  // patched repairs: slightly darker rectangles
  vec2 pc = floor(p / 3.3);
  vec2 pf = fract(p / 3.3);
  float repair = step(0.75, hash12(pc + 5.0)) * step(0.2, pf.x) * step(pf.x, 0.75) * step(0.3, pf.y) * step(pf.y, 0.8);
  col *= 1.0 - 0.12 * repair;
  return col;
}

vec3 rug(vec2 p) {
  vec2 lo = p - vRect.xy;
  vec2 hi = vRect.zw - p;
  float d = min(min(lo.x, hi.x), min(lo.y, hi.y));
  vec3 col = vA * (0.9 + 0.12 * fbm(p * 3.0));
  vec2 q = abs(fract(p * 1.3) - 0.5);
  float diamond = step(q.x + q.y, 0.18);
  col = mix(col, col * 0.78, diamond);
  float inner = step(q.x + q.y, 0.07);
  col = mix(col, vB * 0.9, inner * 0.8);
  float band = step(0.14, d) * step(d, 0.24);
  col = mix(col, vB, band);
  float band2 = step(0.32, d) * step(d, 0.36);
  col = mix(col, vB * 0.8, band2);
  float fringe = step(d, 0.05);
  col *= 0.94 + 0.1 * hash12(floor(p * 90.0));
  return mix(col, vB * 0.85, fringe);
}

void main() {
  float s = vParams.x;
  int pat = int(vPattern + 0.5);
  vec3 col;
  if (pat == 0) col = checker(vPos, s);
  else if (pat == 1) col = tiles(vPos, s);
  else if (pat == 2) col = wood(vPos, s);
  else if (pat == 3) col = carpet(vPos, s);
  else if (pat == 4) col = concrete(vPos, s);
  else if (pat == 5) col = asphalt(vPos, s);
  else col = rug(vPos);

  vec4 decor = texture(uDecor, vPos / uMapSize);
  col = mix(col, decor.rgb, decor.a);

  vec3 sh = texture(uShadow, vPos / uMapSize).rgb;
  // Ceiling lamps: bright pools in each room, falling off toward the corners.
  col *= uLampFloor + uLampGain * sh.b;
  col *= mix(vec3(1.0), uShadowTint, sh.r * uShadowStrength);
  col *= 1.0 - sh.g * uAoStrength;
  outColor = vec4(col, 1.0);
}
`;

/** Per-frame floor: samples the baked albedo, adds lights and fog. */
export const FLOOR_DRAW_VS = /* glsl */ `${HEADER}
layout(location = 0) in vec2 aPos;
uniform mat4 uViewProj;
out vec2 vPos;
void main() {
  vPos = aPos;
  gl_Position = uViewProj * vec4(aPos, 0.0, 1.0);
}
`;

export const FLOOR_DRAW_FS = /* glsl */ `${HEADER}
${FOG}
${LIGHTS}
in vec2 vPos;
uniform sampler2D uAlbedo;
uniform float uBpGridAlpha;
out vec4 outColor;
void main() {
  vec4 albedo = texture(uAlbedo, vPos / uMapSize);
  if (albedo.a < 0.5) discard;
  vec3 col = albedo.rgb;
  float vis = visionAt(vPos);
  col += dynamicLights(vec3(vPos, 0.0)) * col * 1.6 * vis;
  col = applyFog(col, vPos, vis);
  col += uBpLine * (blueprintGrid(vPos) * uBpGridAlpha * planAt(vPos) * (1.0 - vis));
  outColor = vec4(col, 1.0);
}
`;
