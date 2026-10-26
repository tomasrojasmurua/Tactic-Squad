// Compiles a GLSL ES 3.0 program and caches uniform locations by name.
// Attributes use explicit `layout(location = N)` in the shaders.

export class ShaderProgram {
  constructor(gl, vertexSrc, fragmentSrc, label = 'shader') {
    this.gl = gl;
    this.label = label;
    const vs = compile(gl, gl.VERTEX_SHADER, vertexSrc, label);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSrc, label);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`[${label}] link: ${gl.getProgramInfoLog(prog)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = prog;
    this.locations = new Map();
    this.textureUnits = new Map();
  }

  use() {
    this.gl.useProgram(this.program);
    return this;
  }

  loc(name) {
    let l = this.locations.get(name);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.program, name);
      this.locations.set(name, l);
    }
    return l;
  }

  f1(name, v) {
    const l = this.loc(name);
    if (l) this.gl.uniform1f(l, v);
    return this;
  }

  f2(name, x, y) {
    const l = this.loc(name);
    if (l) this.gl.uniform2f(l, x, y);
    return this;
  }

  f3(name, x, y, z) {
    const l = this.loc(name);
    if (l) this.gl.uniform3f(l, x, y, z);
    return this;
  }

  v3(name, arr) {
    const l = this.loc(name);
    if (l) this.gl.uniform3fv(l, arr);
    return this;
  }

  f4(name, x, y, z, w) {
    const l = this.loc(name);
    if (l) this.gl.uniform4f(l, x, y, z, w);
    return this;
  }

  v4(name, arr) {
    const l = this.loc(name);
    if (l) this.gl.uniform4fv(l, arr);
    return this;
  }

  i1(name, v) {
    const l = this.loc(name);
    if (l) this.gl.uniform1i(l, v);
    return this;
  }

  mat4(name, m) {
    const l = this.loc(name);
    if (l) this.gl.uniformMatrix4fv(l, false, m);
    return this;
  }

  /** Binds `texture` to a fixed unit per sampler name. */
  tex(name, texture, unit) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    return this.i1(name, unit);
  }
}

function compile(gl, type, src, label) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const kind = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    throw new Error(`[${label}] ${kind}: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}
