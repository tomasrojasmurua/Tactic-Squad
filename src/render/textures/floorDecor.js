// Bakes the cosmetic floor dressing into one RGBA map-space canvas (straight
// alpha) that the floor bake shader blends over the procedural materials:
// automatic wear and metal thresholds at every doorway, plus the per-map
// set dressing of render/decor/mapDecor.js. Runs once per map (Canvas2D).
import { MAP_DECOR } from '../decor/mapDecor.js';
import { DECOR } from '../../config/render.js';

const FONT = '900 1px "Arial Black", "Segoe UI Black", Impact, sans-serif';

export function bakeFloorDecor(compiled) {
  const ppm = DECOR.pixelsPerMeter;
  const c = document.createElement('canvas');
  c.width = Math.ceil(compiled.width * ppm);
  c.height = Math.ceil(compiled.height * ppm);
  const ctx = c.getContext('2d');
  ctx.scale(ppm, ppm);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  for (const d of compiled.doorways) doorWear(ctx, d, rnd);
  for (const item of MAP_DECOR[compiled.id] || []) {
    const fn = PAINTERS[item.kind];
    if (fn) fn(ctx, item, rnd);
  }
  return c;
}

/** Scuffed traffic patch on both sides of a doorway + a metal threshold strip. */
function doorWear(ctx, d, rnd) {
  const along = d.normalX ? [0, 1] : [1, 0];
  for (const side of [-1, 1]) {
    const cx = d.cx + d.normalX * side * 0.75;
    const cy = d.cy + d.normalY * side * 0.75;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, d.length * 0.85);
    g.addColorStop(0, 'rgba(20,18,15,0.22)');
    g.addColorStop(1, 'rgba(20,18,15,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    // a few shoe scuffs
    ctx.strokeStyle = 'rgba(15,14,12,0.28)';
    ctx.lineWidth = 0.03;
    for (let i = 0; i < 6; i++) {
      const px = cx + (rnd() - 0.5) * d.length * 0.9;
      const py = cy + (rnd() - 0.5) * d.length * 0.9;
      const a = rnd() * Math.PI;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * 0.18, py + Math.sin(a) * 0.18);
      ctx.stroke();
    }
  }
  if (!d.isDoor) return;
  const hw = d.length / 2;
  const t = 0.11;
  ctx.fillStyle = 'rgba(150,152,150,0.95)';
  ctx.fillRect(d.cx - along[0] * hw - d.normalX * t, d.cy - along[1] * hw - d.normalY * t, along[0] * d.length + d.normalX * t * 2, along[1] * d.length + d.normalY * t * 2);
  ctx.fillStyle = 'rgba(40,40,40,0.5)';
  for (let k = -hw + 0.08; k < hw; k += 0.08) {
    ctx.fillRect(d.cx + along[0] * k - d.normalX * t * 0.7, d.cy + along[1] * k - d.normalY * t * 0.7, along[0] ? 0.02 : t * 1.4, along[1] ? 0.02 : t * 1.4);
  }
}

const PAINTERS = {
  tape(ctx, { rect, color }) {
    const [x, y, w, h] = rect;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 0.08;
    ctx.strokeRect(x, y, w, h);
    ctx.globalAlpha = 1;
  },
  tapeLine(ctx, { a, b, color, w = 0.08 }) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = w;
    ctx.setLineDash([0.9, 0.25]);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  },
  parking(ctx, { a, b }) {
    ctx.strokeStyle = 'rgba(232,226,208,0.7)';
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  },
  tires(ctx, { a, b }) {
    ctx.strokeStyle = 'rgba(8,8,9,0.28)';
    ctx.lineWidth = 0.22;
    ctx.setLineDash([0.06, 0.03]);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.35, b[0], b[1]);
    ctx.stroke();
    ctx.setLineDash([]);
  },
  stain(ctx, { at, r, color, alpha }, rnd) {
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = alpha * (0.35 + rnd() * 0.3);
      const ox = (rnd() - 0.5) * r;
      const oy = (rnd() - 0.5) * r;
      ctx.beginPath();
      ctx.ellipse(at[0] + ox, at[1] + oy, r * (0.4 + rnd() * 0.5), r * (0.3 + rnd() * 0.4), rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  drain(ctx, { at }) {
    const s = 0.42;
    ctx.fillStyle = 'rgba(30,32,34,0.95)';
    ctx.fillRect(at[0] - s / 2, at[1] - s / 2, s, s);
    ctx.fillStyle = 'rgba(120,124,126,0.95)';
    for (let i = 0; i < 6; i++) ctx.fillRect(at[0] - s / 2 + 0.03, at[1] - s / 2 + 0.04 + i * 0.065, s - 0.06, 0.025);
  },
  papers(ctx, { at, n, spread }, rnd) {
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.translate(at[0] + (rnd() - 0.5) * spread, at[1] + (rnd() - 0.5) * spread);
      ctx.rotate(rnd() * Math.PI);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-0.105 + 0.02, -0.15 + 0.02, 0.21, 0.3);
      ctx.fillStyle = '#eef0ec';
      ctx.fillRect(-0.105, -0.15, 0.21, 0.3);
      ctx.fillStyle = 'rgba(60,70,80,0.5)';
      for (let k = 0; k < 6; k++) ctx.fillRect(-0.075, -0.11 + k * 0.04, 0.13 - (k % 3) * 0.025, 0.012);
      ctx.restore();
    }
  },
  cable(ctx, { pts }) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [w, col] of [[0.07, 'rgba(0,0,0,0.3)'], [0.04, '#17181a']]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last[0], last[1]);
      ctx.stroke();
    }
  },
  hatch(ctx, { rect }) {
    const [x, y, w, h] = rect;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(227,181,30,0.75)';
    for (let k = -h; k < w + h; k += 0.4) {
      ctx.beginPath();
      ctx.moveTo(x + k, y);
      ctx.lineTo(x + k + 0.2, y);
      ctx.lineTo(x + k + 0.2 - h, y + h);
      ctx.lineTo(x + k - h, y + h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },
  stencil(ctx, { at, text, size, rot, color }) {
    ctx.save();
    ctx.translate(at[0], at[1]);
    ctx.rotate(rot);
    ctx.font = FONT.replace('1px', `${size}px`);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  },
};
