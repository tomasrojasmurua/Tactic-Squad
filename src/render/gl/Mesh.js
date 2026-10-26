// Interleaved float vertex buffers wrapped in a VAO.
// layout: [{ loc, size }, ...] in vertex order; stride derived from sizes.

export class Mesh {
  constructor(gl, layout, { dynamic = false, data = null } = {}) {
    this.gl = gl;
    this.floatsPerVertex = layout.reduce((s, a) => s + a.size, 0);
    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    this.dynamic = dynamic;
    this.count = 0;
    this.capacity = 0;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const stride = this.floatsPerVertex * 4;
    let offset = 0;
    for (const a of layout) {
      gl.enableVertexAttribArray(a.loc);
      gl.vertexAttribPointer(a.loc, a.size, gl.FLOAT, false, stride, offset);
      offset += a.size * 4;
    }
    gl.bindVertexArray(null);
    if (data) this.upload(data);
  }

  /** Uploads `floatCount` floats of `data` (defaults to the whole array). */
  upload(data, floatCount = data.length) {
    const gl = this.gl;
    // Note: bufferSubData with length 0 means "the whole source array" in WebGL2.
    if (floatCount <= 0) {
      this.count = 0;
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    if (floatCount > this.capacity) {
      this.capacity = Math.max(floatCount, Math.ceil(this.capacity * 1.5));
      gl.bufferData(gl.ARRAY_BUFFER, this.capacity * 4, this.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, floatCount);
    this.count = floatCount / this.floatsPerVertex;
  }

  draw(mode = this.gl.TRIANGLES, first = 0, count = this.count) {
    if (count <= 0) return;
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(mode, first, count);
    gl.bindVertexArray(null);
  }
}

/** Growable Float32Array for building vertex data each frame without GC churn. */
export class FloatBuffer {
  constructor(initial = 4096) {
    this.data = new Float32Array(initial);
    this.length = 0;
  }

  reset() {
    this.length = 0;
  }

  ensure(extra) {
    if (this.length + extra <= this.data.length) return;
    let cap = this.data.length * 2;
    while (cap < this.length + extra) cap *= 2;
    const next = new Float32Array(cap);
    next.set(this.data.subarray(0, this.length));
    this.data = next;
  }

  push(...values) {
    this.ensure(values.length);
    for (let i = 0; i < values.length; i++) this.data[this.length++] = values[i];
  }
}
