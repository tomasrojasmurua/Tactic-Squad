// GLSL chunks shared by several programs.

export const HEADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
`;

/** Noise helpers (hash, value noise, fbm). */
export const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}
`;

/**
 * Fog of war: current vision + explored memory, both in map space, plus the
 * planning "blueprint" (Door Kickers-style tactical plan: pale walls on deep
 * blue, doors in amber). The blueprint covers what the squad does not see and
 * sweeps in / out from the squad as a circular wipe (uPlan).
 */
export const FOG = /* glsl */ `
uniform sampler2D uVision;
uniform sampler2D uExplored;
uniform vec2 uMapSize;
uniform vec3 uMemTint;
uniform float uMemExplored;
uniform float uMemUnexplored;
uniform float uMemSat;
uniform vec4 uPlan;          // wipe origin xy (m), radius (m), mode (+1 blueprint inside, -1 outside)
uniform float uPlanBand;     // soft edge of the wipe (m)
uniform vec3 uBpDeep;        // blueprint floor, dark end
uniform vec3 uBpHigh;        // blueprint floor, light end
uniform vec3 uBpLine;        // wall caps / outlines
uniform vec3 uBpProp;        // furniture
uniform vec4 uBpAccent;      // per draw: rgb + amount (doors)
uniform float uBpPaint;      // how much painted decals keep their own color

float visionAt(vec2 p) {
  return texture(uVision, p / uMapSize).r;
}

float planAt(vec2 p) {
  float inside = clamp((uPlan.z - distance(p, uPlan.xy)) / uPlanBand + 0.5, 0.0, 1.0);
  return uPlan.w > 0.0 ? inside : 1.0 - inside;
}

// kind: 0 floor, 1 vertical face, 2 horizontal top, 3 painted decal. z = height (m).
vec3 blueprintOf(vec3 col, float lum, float kind, float z) {
  if (kind < 0.5) return mix(uBpDeep, uBpHigh, clamp(lum * 1.7, 0.0, 1.0));
  if (kind > 2.5) return mix(mix(uBpDeep, uBpHigh, 0.5), col, uBpPaint);
  float wall = smoothstep(1.75, 2.15, z); // only real walls (2.2 m) read as pale lines; tall furniture stays blue
  vec3 c = kind < 1.5 ? mix(uBpProp * (0.7 + 0.5 * lum), uBpLine * 0.46, wall) : mix(uBpProp * 1.25, uBpLine, wall);
  return mix(c, uBpAccent.rgb * (kind < 1.5 ? 0.8 : 1.0), uBpAccent.a);
}

// boost > 0 brightens remembered geometry (wall faces) so the layout of
// unexplored rooms still reads as a dark blueprint during execution.
vec3 applyFogKind(vec3 col, vec2 p, float vis, float boost, float kind, float z) {
  float explored = texture(uExplored, p / uMapSize).r;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 mem = mix(vec3(lum), col, uMemSat) * uMemTint * mix(uMemUnexplored, uMemExplored, explored) * (1.0 + boost);
  float plan = planAt(p);
  if (plan > 0.0) mem = mix(mem, blueprintOf(col, lum, kind, z), plan);
  return mix(mem, col, vis);
}

vec3 applyFogBoost(vec3 col, vec2 p, float vis, float boost) {
  return applyFogKind(col, p, vis, boost, 0.0, 0.0);
}

vec3 applyFog(vec3 col, vec2 p, float vis) {
  return applyFogKind(col, p, vis, 0.0, 0.0, 0.0);
}

// Faint 1 m grid of the blueprint floor (0..1), antialiased.
float blueprintGrid(vec2 p) {
  vec2 g = abs(fract(p + 0.5) - 0.5) / max(fwidth(p), vec2(1e-4));
  return 1.0 - min(min(g.x, g.y), 1.0);
}
`;

/** Short-lived point lights (muzzle flashes, bomb LED). */
export const LIGHTS = /* glsl */ `
uniform vec4 uLights[8];       // x, y, radius, intensity
uniform vec3 uLightColors[8];
uniform int uLightCount;

vec3 dynamicLights(vec3 p) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= uLightCount) break;
    vec4 L = uLights[i];
    float d = length(vec3(p.xy - L.xy, p.z * 0.5));
    float a = clamp(1.0 - d / L.z, 0.0, 1.0);
    acc += uLightColors[i] * L.w * a * a;
  }
  return acc;
}
`;
