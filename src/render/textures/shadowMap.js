// Bakes a map-space texture: R = soft directional shadow cast by walls and
// tall props, G = ambient occlusion along every wall base, B = ceiling lamp
// pools (one or more per floor area). Generated once per map with Canvas2D
// (blur filter), sampled by the floor shader.
import { LIGHTING, HEIGHTS, LAMPS } from '../../config/render.js';
import { FLOORS } from '../../config/materials.js';

export function bakeShadowCanvas(compiled) {
  const ppm = LIGHTING.shadowPixelsPerMeter;
  const w = Math.ceil(compiled.width * ppm);
  const h = Math.ceil(compiled.height * ppm);
  const [ox, oy] = LIGHTING.shadowOffset;

  const casters = [];
  for (const wall of compiled.walls) {
    const height = wall.kind === 'fence' ? HEIGHTS.fence : HEIGHTS.wall;
    casters.push({ box: wall.box, k: height / HEIGHTS.wall, ao: true });
  }
  for (const win of compiled.windows || []) casters.push({ box: win.box, k: HEIGHTS.sill / HEIGHTS.wall, ao: true });
  for (const p of compiled.props) {
    if (p.h < 0.3) continue;
    casters.push({ box: p.box, k: Math.min(1, p.h / HEIGHTS.wall) * 0.85, ao: p.h > 0.7 });
  }

  const shadow = makeCanvas(w, h);
  const sctx = shadow.getContext('2d');
  sctx.fillStyle = '#ff0000';
  for (const c of casters) {
    // Sweep the footprint along the light offset to fill the shadow volume.
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * c.k;
      rect(sctx, c.box, ox * t, oy * t, ppm);
    }
  }

  const ao = makeCanvas(w, h);
  const actx = ao.getContext('2d');
  actx.fillStyle = '#00ff00';
  for (const c of casters) if (c.ao) rect(actx, c.box, 0, 0, ppm, 0.12);

  const out = makeCanvas(w, h);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  ctx.filter = `blur(${LIGHTING.shadowBlurPx}px)`;
  ctx.drawImage(shadow, 0, 0);
  ctx.filter = `blur(${LIGHTING.aoBlurPx}px)`;
  ctx.drawImage(ao, 0, 0);
  ctx.filter = 'none';
  ctx.drawImage(lampCanvas(compiled, w, h, ppm), 0, 0);
  return out;
}

/** Blue channel: soft lamp pools on a grid inside each floor rectangle (rugs skipped). */
function lampCanvas(compiled, w, h, ppm) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  for (const f of compiled.floors) {
    const mat = FLOORS[f.material];
    if (!mat || mat.pattern === 'rug') continue;
    const [x, y, fw, fh] = f.rect;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x * ppm, y * ppm, fw * ppm, fh * ppm);
    ctx.clip();
    ctx.fillStyle = `rgb(0,0,${Math.round(LAMPS.base * 255)})`;
    ctx.fillRect(x * ppm, y * ppm, fw * ppm, fh * ppm);
    const nx = Math.max(1, Math.round(fw / LAMPS.spacing));
    const ny = Math.max(1, Math.round(fh / LAMPS.spacing));
    const r = Math.min(fw / nx, fh / ny) * LAMPS.radius;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const cx = (x + (fw / nx) * (i + 0.5)) * ppm;
        const cy = (y + (fh / ny) * (j + 0.5)) * ppm;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * ppm * 1.6);
        const peak = Math.round((1 - LAMPS.base) * 255);
        g.addColorStop(0, `rgb(0,0,${peak})`);
        g.addColorStop(0.45, `rgb(0,0,${Math.round(peak * 0.55)})`);
        g.addColorStop(1, 'rgb(0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x * ppm, y * ppm, fw * ppm, fh * ppm);
      }
    }
    ctx.restore();
  }
  return c;
}

function rect(ctx, b, dx, dy, ppm, grow = 0) {
  ctx.fillRect((b.minX + dx - grow) * ppm, (b.minY + dy - grow) * ppm, (b.maxX - b.minX + grow * 2) * ppm, (b.maxY - b.minY + grow * 2) * ppm);
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
