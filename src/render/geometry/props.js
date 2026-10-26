// Low-poly furniture built from primitives. Each builder draws in local
// space: centered on the prop, x = width, y = depth, +y is the "front"
// (where you sit / what faces the room). The map's `rot` rotates it.
import { PROP_COLORS as C } from '../../config/materials.js';
import { ngon } from './MeshBuilder.js';

const BUILDERS = {
  desk(m, w, d, h) {
    m.box(0, 0, h - 0.05, w, d, 0.05, C.wood, { top: C.woodLight });
    m.box(-w / 2 + 0.04, 0, 0, 0.05, d - 0.06, h - 0.05, C.woodDark);
    m.box(w / 2 - 0.04, 0, 0, 0.05, d - 0.06, h - 0.05, C.woodDark);
    m.box(0.15, -d * 0.28, h, 0.62, 0.05, 0.38, C.black); // monitor
    m.box(0.15, -d * 0.36, h, 0.16, 0.12, 0.05, C.metalDark);
    m.box(0.12, d * 0.12, h, 0.46, 0.15, 0.02, '#2b2d31'); // keyboard
    m.box(0.52, d * 0.14, h, 0.08, 0.12, 0.02, '#2b2d31'); // mouse
    m.box(-w * 0.32, d * 0.05, h, 0.24, 0.32, 0.015, C.white, { yaw: 0.2 }); // papers
    m.cylinder(-w * 0.12, -d * 0.2, h, 0.045, 0.1, C.white, { sides: 8 }); // mug
  },
  officeChair(m) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
      m.box(Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.04, 0.28, 0.045, 0.04, C.black, { yaw: a });
      m.cylinder(Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0, 0.03, 0.05, '#0e0f11', { sides: 6 });
    }
    m.cylinder(0, 0, 0.08, 0.035, 0.36, C.metalDark, { sides: 6 });
    m.frustum(0, 0.02, 0.42, 0.23, 0.25, 0.08, '#2f3238', { sides: 8, top: '#40444c', phase: Math.PI / 8 });
    for (const s of [-1, 1]) m.box(s * 0.25, 0.04, 0.5, 0.05, 0.26, 0.14, '#24262b', { top: '#33363c' });
    m.box(0, -0.24, 0.48, 0.4, 0.07, 0.52, '#2a2d32', { top: '#3b3f46' });
    m.box(-0.2, -0.205, 0.48, 0.12, 0.07, 0.52, '#2a2d32', { top: '#3b3f46', yaw: 0.45 });
    m.box(0.2, -0.205, 0.48, 0.12, 0.07, 0.52, '#2a2d32', { top: '#3b3f46', yaw: -0.45 });
  },
  cabinet(m, w, d, h) {
    m.box(0, 0, 0, w, d, h, C.metal, { top: '#b3b9bf' });
    for (let i = 0; i < 3; i++) m.box(0, d / 2 + 0.01, 0.2 + i * 0.4, w * 0.4, 0.03, 0.04, C.metalDark);
    m.box(0.05, 0, h, 0.22, 0.28, 0.06, C.crate);
  },
  bookshelf(m, w, d, h) {
    m.box(0, 0, 0, w, d, h, C.woodDark, { top: C.wood });
    const colors = ['#b03a2e', '#2e6db0', '#d4a72c', '#3f8f5a', '#e8e2d0', '#6a3fa0'];
    for (let s = 0; s < 4; s++) {
      let x = -w / 2 + 0.08;
      let k = s * 3;
      while (x < w / 2 - 0.1) {
        const bw = 0.06 + ((k * 37) % 5) * 0.012;
        m.box(x + bw / 2, d / 2 + 0.01, 0.12 + s * 0.46, bw, 0.04, 0.3 + ((k * 13) % 3) * 0.03, colors[k % colors.length]);
        x += bw + 0.01;
        k++;
      }
    }
    m.box(-0.45, 0, h, 0.34, 0.28, 0.16, '#b58d5c', { top: '#c9a26e' }); // archive box
    m.box(-0.45, 0, h + 0.16, 0.36, 0.05, 0.004, '#8a6a42');
    m.box(0.25, 0.02, h, 0.24, 0.3, 0.05, '#2e6db0', { yaw: 0.15 }); // binders lying flat
    m.box(0.27, 0.01, h + 0.05, 0.22, 0.28, 0.04, '#b03a2e', { yaw: -0.1 });
    m.box(0.62, 0, h, 0.16, 0.16, 0.22, C.metalDark, { top: '#7d858c' });
  },
  plant(m) {
    // Terracotta pot with a rim and soil, then overlapping rounded foliage
    // clumps: reads as a bush from above (not a star).
    m.frustum(0, 0, 0, 0.16, 0.2, 0.36, C.pot, { sides: 10, top: '#3a2618' });
    m.frustum(0, 0, 0.32, 0.215, 0.215, 0.06, '#b8693f', { sides: 10, top: '#3a2618' });
    const clumps = [[0.36, 0.9, 1.3], [0.36, 2.9, 3.6], [0.34, 4.9, 5.6]];
    m.frustum(0, 0, 0.38, 0.24, 0.15, 0.36, C.leafDark, { sides: 7, top: C.leaf, phase: 0.3 });
    for (const [r, a, ph] of clumps) {
      m.frustum(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, 0.5, 0.19, 0.12, 0.34, C.leafDark, { sides: 7, top: '#58a84d', phase: ph });
    }
    m.frustum(0.02, -0.02, 0.72, 0.12, 0.06, 0.3, C.leaf, { sides: 6, top: '#6cbc5c', phase: 1.1 });
  },
  counter(m, w, d, h) {
    m.box(0, 0, 0, w, d - 0.04, h - 0.04, C.wood, { top: C.woodLight });
    m.box(0, 0, h - 0.04, w, d, 0.04, '#d9d5cc');
    for (let x = -w / 2 + 0.3; x < w / 2; x += 0.6) m.box(x, d / 2 - 0.01, h - 0.2, 0.12, 0.03, 0.03, C.metalDark);
  },
  stove(m, w, d, h) {
    m.box(0, 0, 0, w, d, h, '#c9ced2', { top: '#2a2b2e' });
    const r = 0.13;
    for (const [x, y] of [[-0.19, -0.14], [0.19, -0.14], [-0.19, 0.16], [0.19, 0.16]]) {
      m.prism(ngon(x, y, r, 6, Math.PI / 6), h, h + 0.025, '#111214', { top: '#5a5d63' });
      m.prism(ngon(x, y, r * 0.45, 6, Math.PI / 6), h + 0.025, h + 0.035, '#111214');
    }
    for (let i = 0; i < 4; i++) m.cylinder(-0.24 + i * 0.16, d / 2 + 0.02, h - 0.12, 0.03, 0.04, C.black, { sides: 6 });
  },
  sink(m, w, d, h) {
    m.box(0, 0, 0, w, d - 0.04, h - 0.04, C.wood);
    m.box(0, 0, h - 0.04, w, d, 0.04, '#d9d5cc');
    m.box(0, 0.03, h, w * 0.62, d * 0.62, 0.012, '#8d969c');
    m.box(0, 0.03, h + 0.012, w * 0.52, d * 0.5, 0.004, '#5f676d');
    m.cylinder(0, -d * 0.36, h, 0.03, 0.22, C.metal, { sides: 6 });
    m.box(0, -d * 0.26, h + 0.2, 0.04, 0.2, 0.03, C.metal);
  },
  fridge(m, w, d, h) {
    m.box(0, 0, 0, w, d, h, C.fridge, { top: '#c6cdd1' });
    m.box(w * 0.3, d / 2 + 0.02, h * 0.45, 0.04, 0.04, 0.5, C.metalDark);
    m.box(0, d / 2 + 0.005, h * 0.62, w * 0.96, 0.01, 0.02, '#9aa3a8');
  },
  table(m, w, d, h) {
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) m.box((x * (w - 0.12)) / 2, (y * (d - 0.12)) / 2, 0, 0.06, 0.06, h - 0.04, C.woodDark);
    m.box(0, 0, h - 0.04, w, d, 0.04, C.woodLight, { top: '#e0b47a' });
    for (const [x, y] of [[-0.42, -0.25], [0.42, -0.25], [-0.42, 0.25], [0.42, 0.25]]) {
      m.prism(ngon(x, y, 0.13, 6, Math.PI / 6), h, h + 0.02, C.white);
    }
    m.box(0.02, 0, h, 0.34, 0.12, 0.02, C.white, { yaw: -0.25 });
  },
  chair(m) {
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) m.box(x * 0.18, y * 0.18, 0, 0.04, 0.04, 0.44, C.woodDark);
    m.box(0, 0, 0.44, 0.44, 0.44, 0.05, C.wood, { top: C.woodLight });
    m.box(0, -0.2, 0.49, 0.44, 0.05, 0.42, C.wood, { top: C.woodLight });
  },
  sofa(m, w, d) {
    m.box(0, 0.05, 0, w, d - 0.1, 0.42, C.fabricGreen);
    m.box(0, -d / 2 + 0.12, 0, w, 0.24, 0.85, '#355c48', { top: '#3f6b55' });
    m.box(-w / 2 + 0.1, 0.05, 0, 0.2, d - 0.1, 0.62, '#355c48', { top: '#4a7a62' });
    m.box(w / 2 - 0.1, 0.05, 0, 0.2, d - 0.1, 0.62, '#355c48', { top: '#4a7a62' });
    const cw = (w - 0.44) / 2;
    m.box(-cw / 2 - 0.01, 0.08, 0.42, cw - 0.04, d - 0.36, 0.1, '#4a7a62', { top: '#558a70' });
    m.box(cw / 2 + 0.01, 0.08, 0.42, cw - 0.04, d - 0.36, 0.1, '#4a7a62', { top: '#558a70' });
  },
  armchair(m, w, d) {
    m.box(0, 0.05, 0, w, d - 0.1, 0.4, C.fabricRed);
    m.box(0, -d / 2 + 0.11, 0, w, 0.22, 0.82, '#7a312d', { top: '#9a4540' });
    m.box(-w / 2 + 0.09, 0.05, 0, 0.18, d - 0.1, 0.6, '#7a312d', { top: '#9a4540' });
    m.box(w / 2 - 0.09, 0.05, 0, 0.18, d - 0.1, 0.6, '#7a312d', { top: '#9a4540' });
    m.box(0, 0.1, 0.4, w - 0.4, d - 0.34, 0.09, '#a34c46');
  },
  coffeeTable(m, w, d, h) {
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) m.box((x * (w - 0.1)) / 2, (y * (d - 0.1)) / 2, 0, 0.05, 0.05, h - 0.04, C.black);
    m.box(0, 0, h - 0.04, w, d, 0.04, '#9fc4cf', { top: '#b9dbe4' });
    m.box(-0.2, 0.02, h, 0.3, 0.22, 0.015, '#e2574c', { yaw: 0.3 });
    m.cylinder(0.32, -0.05, h, 0.045, 0.1, C.white, { sides: 8 });
  },
  tvStand(m, w, d) {
    m.box(0, 0, 0, w, d, 0.5, C.woodDark, { top: C.wood });
    m.box(0, -0.05, 0.5, 0.3, 0.18, 0.05, C.black);
    m.box(0, -0.05, 0.55, 1.25, 0.06, 0.62, C.black);
    m.box(0, -0.015, 0.6, 1.17, 0.005, 0.54, '#25364a');
  },
  vending(m, w, d, h) {
    m.box(0, 0, 0, w, d, h, C.vending, { top: '#3a1a18' });
    m.box(-0.12, d / 2 + 0.01, 0.45, w * 0.62, 0.02, 1.25, '#9fd8f0');
    m.box(w * 0.34, d / 2 + 0.01, 0.9, 0.16, 0.02, 0.5, '#2a2a2a');
  },
  toilet(m) {
    m.box(0, -0.26, 0, 0.42, 0.18, 0.78, C.porcelain, { top: '#f4f8f9' });
    m.prism(ngon(0, 0.08, 0.2, 10).map(([x, y]) => [x, 0.08 + (y - 0.08) * 1.3]), 0, 0.4, C.porcelain, { top: '#f4f8f9' });
    m.prism(ngon(0, 0.1, 0.12, 10).map(([x, y]) => [x, 0.1 + (y - 0.1) * 1.3]), 0.4, 0.41, '#bfd6dd');
  },
  washbasin(m, w, d, h) {
    m.box(0, 0, 0, 0.12, 0.12, h - 0.12, C.porcelain);
    m.box(0, 0, h - 0.12, w, d, 0.12, C.porcelain, { top: '#f4f8f9' });
    m.box(0, 0.04, h, w * 0.66, d * 0.55, 0.005, '#bfd6dd');
    m.cylinder(0, -d * 0.36, h, 0.025, 0.14, C.metal, { sides: 6 });
  },
  stallWall(m, w, d, h) {
    m.box(0, 0, 0.12, w, d, h - 0.12, '#9db3c4', { top: '#c3d3df' });
  },
  crate(m, w, d, h) {
    m.box(0, 0, 0, w, d, h, C.crate, { top: '#c49762' });
    const k = 0.07;
    for (const s of [-1, 1]) {
      m.box((s * (w - k)) / 2, 0, h, k, d, 0.012, C.crateDark);
      m.box(0, (s * (d - k)) / 2, h, w, k, 0.012, C.crateDark);
    }
    m.box(0, 0, h, w * 1.35, k, 0.012, C.crateDark, { yaw: Math.atan2(d, w) });
  },
  crateStack(m, w, d, h) {
    const lower = h * 0.5;
    BUILDERS.crate(m, w, d, lower);
    m.box(0.04, -0.03, lower, w * 0.86, d * 0.86, h - lower, C.crate, { top: '#c49762', yaw: 0.12 });
    m.box(0.04, -0.03, h, w * 0.86, 0.06, 0.012, C.crateDark, { yaw: 0.12 });
    m.box(0.04, -0.03, h, 0.06, d * 0.86, 0.012, C.crateDark, { yaw: 0.12 });
  },
  barrel(m, w, d, h) {
    const r = w / 2;
    m.cylinder(0, 0, 0, r, h, C.barrel, { sides: 12, top: '#4a7cb4' });
    m.cylinder(0, 0, h * 0.3, r + 0.012, 0.05, '#2c5584', { sides: 12 });
    m.cylinder(0, 0, h * 0.7, r + 0.012, 0.05, '#2c5584', { sides: 12 });
    m.cylinder(r * 0.4, -r * 0.3, h, 0.05, 0.02, '#2c5584', { sides: 6 });
  },
  pallet(m, w, d, h) {
    for (let i = 0; i < 5; i++) m.box(-w / 2 + 0.1 + i * ((w - 0.2) / 4), 0, 0.09, 0.14, d, h - 0.09, C.woodLight);
    for (const y of [-d / 2 + 0.06, 0, d / 2 - 0.06]) m.box(0, y, 0, w, 0.1, 0.09, C.wood);
  },
  rack(m, w, d, h) {
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) m.box((x * (w - 0.06)) / 2, (y * (d - 0.06)) / 2, 0, 0.06, 0.06, h, '#d25b2a');
    for (let s = 0; s < 3; s++) {
      const z = 0.15 + s * 0.95;
      m.box(0, 0, z, w, d, 0.05, '#7d858c', { top: '#a7aeb4' });
      for (let i = 0; i < 3; i++) {
        const bx = -w / 2 + 0.45 + i * 0.85;
        if ((s + i) % 3 === 2) continue;
        m.box(bx, 0, z + 0.05, 0.62, d * 0.8, 0.5 - ((s * 7 + i) % 3) * 0.08, i % 2 ? C.crate : '#c9b48a');
      }
    }
  },
  van(m, w, d, h) {
    const body = '#dfe2dc';
    for (const x of [-w * 0.3, w * 0.3]) for (const y of [-1, 1]) m.box(x, (y * d) / 2, 0, 0.7, 0.24, 0.62, C.vanDark);
    m.box(-0.45, 0, 0.32, w - 0.9, d, h - 0.32, body, { top: '#eceee9' });
    m.box(w / 2 - 0.45, 0, 0.32, 0.9, d, 1.0, body, { top: '#eceee9' });
    m.box(w / 2 - 0.82, 0, h - 0.62, 0.12, d * 0.9, 0.5, '#24313f'); // windshield
    m.box(-0.6, 0, h, w - 1.8, d * 0.7, 0.03, '#c5c9c2');
    m.box(0, d / 2 + 0.005, 0.95, w * 0.9, 0.01, 0.16, '#2f6db0');
    m.box(0, -d / 2 - 0.005, 0.95, w * 0.9, 0.01, 0.16, '#2f6db0');
  },
  barrier(m, w, d, h) {
    m.box(0, 0, 0, w, d, h * 0.35, '#9a9a94');
    m.box(0, 0, h * 0.35, w, d * 0.55, h * 0.65, '#a9a9a3', { top: '#bdbdb6' });
    for (let i = 0; i < 5; i++) m.box(-w / 2 + 0.2 + i * 0.4, 0, h, 0.2, d * 0.55, 0.01, i % 2 ? C.black : C.hazard);
  },
  cone(m) {
    m.box(0, 0, 0, 0.34, 0.34, 0.04, C.black);
    m.cylinder(0, 0, 0.04, 0.13, 0.15, C.cone, { sides: 8 });
    m.cylinder(0, 0, 0.19, 0.095, 0.15, C.white, { sides: 8 });
    m.cylinder(0, 0, 0.34, 0.06, 0.16, C.cone, { sides: 8 });
  },
  bin(m, w, d, h) {
    m.cylinder(0, 0, 0, w / 2, h, '#4b5a4f', { sides: 10, top: '#2d342f' });
    m.cylinder(0, 0, h, w / 2 + 0.015, 0.03, '#3a443d', { sides: 10 });
  },
  bench(m, w, d, h) {
    m.box(-w / 2 + 0.1, 0, 0, 0.06, d, h - 0.05, C.metalDark);
    m.box(w / 2 - 0.1, 0, 0, 0.06, d, h - 0.05, C.metalDark);
    for (let i = 0; i < 3; i++) m.box(0, -d / 2 + 0.08 + i * ((d - 0.16) / 2), h - 0.05, w, 0.11, 0.05, C.wood, { top: C.woodLight });
  },
};

/** Appends one prop instance (compiled map prop) to the builder. */
export function buildProp(m, prop) {
  const fn = BUILDERS[prop.type];
  if (!fn) return;
  m.setTransform(prop.x, prop.y, prop.rot);
  fn(m, prop.w, prop.d, prop.h);
  m.setTransform();
}

export const PROP_TYPES = Object.keys(BUILDERS);
