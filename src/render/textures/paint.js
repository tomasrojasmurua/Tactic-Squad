// Spray-paint floor markings drawn with Canvas2D at runtime (bomb site
// letter + dashed border, arrows, stencil text, hazard stripes).
// Each returns {canvas, rect:[x, y, w, h], rot} in map meters.

const PPM = 64; // texture pixels per meter
// CPU-backed canvases: weather() reads the pixels back, and a GPU canvas readback
// costs ~0.8 s per decal on software GL (vs ~1 ms); the blur is 10x cheaper too.
const CANVAS_OPTIONS = Object.freeze({ willReadFrequently: true });
const FONT = '900 1px "Arial Black", "Segoe UI Black", Impact, sans-serif';

export function paintDecal(spec) {
  switch (spec.kind) {
    case 'site':
      return sitePaint(spec);
    case 'arrow':
      return arrowPaint(spec);
    case 'text':
      return textPaint(spec);
    case 'stripes':
      return stripePaint(spec);
    default:
      return null;
  }
}

function canvasFor(wm, hm) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(wm * PPM);
  c.height = Math.ceil(hm * PPM);
  const ctx = c.getContext('2d', CANVAS_OPTIONS);
  ctx.scale(PPM, PPM);
  return { c, ctx };
}

/** Breaks paint up with speckles so it reads as worn spray paint. */
function weather(c, amount = 0.35, seed = 1) {
  const ctx = c.getContext('2d');
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 3; i < d.length; i += 4) {
    if (!d[i]) continue;
    const r = rnd();
    d[i] = Math.max(0, d[i] * (r < amount * 0.25 ? 0.15 : 0.72 + r * 0.28));
  }
  ctx.putImageData(img, 0, 0);
  // soft overspray
  const blurred = document.createElement('canvas');
  blurred.width = c.width;
  blurred.height = c.height;
  const b = blurred.getContext('2d', CANVAS_OPTIONS);
  b.filter = 'blur(1.2px)';
  b.drawImage(c, 0, 0);
  return blurred;
}

function sitePaint({ rect, text, color }) {
  const [x, y, w, h] = rect;
  const { c, ctx } = canvasFor(w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.14;
  ctx.setLineDash([0.55, 0.32]);
  ctx.strokeRect(0.12, 0.12, w - 0.24, h - 0.24);
  ctx.setLineDash([]);
  const size = Math.min(w, h) * 0.62;
  ctx.font = FONT.replace('1px', `${size}px`);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.08);
  ctx.fillText(text, 0, size * 0.04);
  ctx.lineWidth = 0.06;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.strokeText(text, 0, size * 0.04);
  ctx.restore();
  return { canvas: weather(c, 0.4, 3), rect: [x, y, w, h], rot: 0 };
}

function arrowPaint({ at, size, rot = 0, text, color }) {
  const w = size * 2.2;
  const h = size;
  const { c, ctx } = canvasFor(w, h);
  ctx.fillStyle = color;
  ctx.font = FONT.replace('1px', `${h * 0.8}px`);
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0.05, h * 0.52);
  const ax = h * 0.75;
  ctx.beginPath();
  ctx.moveTo(ax, h * 0.42);
  ctx.lineTo(w - h * 0.45, h * 0.42);
  ctx.lineTo(w - h * 0.45, h * 0.2);
  ctx.lineTo(w - 0.04, h * 0.5);
  ctx.lineTo(w - h * 0.45, h * 0.8);
  ctx.lineTo(w - h * 0.45, h * 0.58);
  ctx.lineTo(ax, h * 0.58);
  ctx.closePath();
  ctx.fill();
  return { canvas: weather(c, 0.5, 7), rect: [at[0] - w / 2, at[1] - h / 2, w, h], rot };
}

function textPaint({ at, size, text, color }) {
  const h = size;
  const w = size * text.length * 0.78;
  const { c, ctx } = canvasFor(w, h);
  ctx.fillStyle = color;
  ctx.font = FONT.replace('1px', `${h * 0.86}px`);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h * 0.54, w * 0.98);
  return { canvas: weather(c, 0.55, 11), rect: [at[0] - w / 2, at[1] - h / 2, w, h], rot: 0 };
}

function stripePaint({ rect, color }) {
  const [x, y, w, h] = rect;
  const { c, ctx } = canvasFor(w, h);
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  const step = 0.42;
  for (let k = -w - h; k < w + h; k += step) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + step / 2, 0);
    ctx.lineTo(k + step / 2 + h, h);
    ctx.lineTo(k + h, h);
    ctx.closePath();
    ctx.fill();
  }
  return { canvas: weather(c, 0.45, 5), rect: [x, y, w, h], rot: 0 };
}
