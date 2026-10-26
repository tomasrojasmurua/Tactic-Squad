// Minimal column-major 4x4 matrix helpers (Float32Array) for the renderer.

export const create = () => {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
};

export function multiply(out, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
    out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }
  return out;
}

export function perspective(out, fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

export function ortho(out, left, right, bottom, top, near, far) {
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = -2 * lr;
  out[5] = -2 * bt;
  out[10] = 2 * nf;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;
  return out;
}

/**
 * Translation * RotZ(yaw) * RotY(pitch) * ScaleX(sx). Enough for every
 * transform in this game (props/units only yaw, corpses also pitch,
 * limbs stretch along their local x).
 */
export function fromTransform(out, x, y, z, yaw = 0, pitch = 0, sx = 1) {
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  out[0] = c * cp * sx; out[1] = sn * cp * sx; out[2] = -sp * sx; out[3] = 0;
  out[4] = -sn; out[5] = c; out[6] = 0; out[7] = 0;
  out[8] = c * sp; out[9] = sn * sp; out[10] = cp; out[11] = 0;
  out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  return out;
}
