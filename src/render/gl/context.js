// WebGL2 context creation with a typed error for the "unsupported" screen.

export class WebGL2UnavailableError extends Error {
  constructor() {
    super('WebGL2 no está disponible en este navegador o dispositivo.');
    this.name = 'WebGL2UnavailableError';
  }
}

export function createContext(canvas, antialias = true) {
  const gl = canvas.getContext('webgl2', {
    antialias,
    alpha: false,
    depth: true,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new WebGL2UnavailableError();
  return gl;
}
