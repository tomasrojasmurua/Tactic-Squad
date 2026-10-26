// Vertex-colored 2D shapes on a horizontal plane (route overlay, vision
// fans) and the full-screen passes for the vision mask (blur / max-accumulate).
import { HEADER } from './common.js';

export const FLAT_VS = /* glsl */ `${HEADER}
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec4 aColor;
uniform mat4 uViewProj;
uniform float uZ;
out vec4 vColor;
void main() {
  vColor = aColor;
  gl_Position = uViewProj * vec4(aPos, uZ, 1.0);
}
`;

export const FLAT_FS = /* glsl */ `${HEADER}
in vec4 vColor;
out vec4 outColor;
void main() {
  outColor = vColor;
}
`;

/** Full-screen triangle generated from gl_VertexID (no attributes). */
export const FULLSCREEN_VS = /* glsl */ `${HEADER}
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const BLUR_FS = /* glsl */ `${HEADER}
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uStep;
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vUv) * 0.2941;
  c += texture(uTex, vUv + uStep * 1.3333) * 0.3529;
  c += texture(uTex, vUv - uStep * 1.3333) * 0.3529;
  outColor = c;
}
`;

export const COPY_FS = /* glsl */ `${HEADER}
in vec2 vUv;
uniform sampler2D uTex;
out vec4 outColor;
void main() {
  outColor = texture(uTex, vUv);
}
`;
