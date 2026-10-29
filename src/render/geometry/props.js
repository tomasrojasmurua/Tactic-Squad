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

  // --- hotel (data/maps/hotel.js)
  bed(m, w, d, h) {
    const base = h * 0.5;
    m.box(0, 0.02, 0, w, d - 0.04, base, C.woodDark, { top: C.wood });
    m.box(0, 0.04, base, w - 0.06, d - 0.12, h - base, C.white, { top: '#f6f7f5' }); // mattress
    m.box(0, d * 0.16, h, w - 0.02, d * 0.62, 0.05, '#e6e0d2', { top: '#efe9dc' }); // duvet
    m.box(0, d * 0.36, h + 0.05, w + 0.01, 0.34, 0.012, '#7a2633', { top: '#8e2f3d' }); // runner at the foot
    for (const s of [-1, 1]) m.box(s * w * 0.24, -d / 2 + 0.3, h, w * 0.4, 0.34, 0.11, '#fbfbf8', { top: '#ffffff' }); // pillows
    m.box(0, -d / 2 + 0.04, 0, w + 0.1, 0.08, 1.05, '#4e3322', { top: '#6a4630' }); // headboard
  },
  nightstand(m, w, d, h) {
    m.box(0, 0, 0, w, d, h, C.woodDark, { top: C.wood });
    m.box(0, d / 2 + 0.005, h * 0.55, w * 0.3, 0.01, 0.03, '#d8c48a');
    m.cylinder(-0.05, -0.04, h, 0.06, 0.2, '#c9a24a', { sides: 8 }); // lamp
    m.frustum(-0.05, -0.04, h + 0.2, 0.13, 0.09, 0.14, '#efe4c8', { sides: 10, top: '#fff6dc' });
  },
  wardrobe(m, w, d, h) {
    m.box(0, 0, 0, w, d, h, '#5b3a24', { top: '#6e4a31' });
    m.box(0, d / 2 + 0.005, 0.08, 0.015, 0.01, h - 0.16, '#3a2416'); // the two doors
    for (const s of [-1, 1]) m.box(s * 0.07, d / 2 + 0.02, h * 0.5, 0.025, 0.03, 0.22, '#d8c48a');
    m.box(-w * 0.22, -0.02, h, w * 0.4, d * 0.7, 0.24, '#2d3a4f', { top: '#3b4b66' }); // suitcase on top
  },
  hotelDesk(m, w, d, h) {
    m.box(0, 0, h - 0.04, w, d, 0.04, C.woodDark, { top: '#7a5236' });
    for (const s of [-1, 1]) m.box((s * (w - 0.06)) / 2, 0, 0, 0.05, d - 0.04, h - 0.04, '#4e3322');
    m.cylinder(w * 0.34, -d * 0.18, h, 0.06, 0.32, '#c9a24a', { sides: 8 }); // lamp
    m.frustum(w * 0.34, -d * 0.18, h + 0.32, 0.15, 0.1, 0.14, '#efe4c8', { sides: 10, top: '#fff6dc' });
    m.box(-w * 0.12, d * 0.05, h, 0.34, 0.24, 0.02, '#2f2a26', { yaw: 0.1 }); // leather folder
    m.box(-w * 0.12, d * 0.05, h + 0.02, 0.22, 0.16, 0.004, '#efe9dc', { yaw: 0.1 });
  },
  floorLamp(m, w, d, h) {
    m.cylinder(0, 0, 0, 0.16, 0.03, '#2a2622', { sides: 10 });
    m.cylinder(0, 0, 0.03, 0.02, h - 0.3, '#c9a24a', { sides: 6 });
    m.frustum(0, 0, h - 0.3, 0.2, 0.13, 0.3, '#efe4c8', { sides: 12, top: '#fff6dc' });
  },
  washer(m, w, d, h) {
    m.box(0, 0, 0, w, d, h, '#e9eef0', { top: '#f4f7f8' });
    m.box(0, -d / 2 + 0.08, h, w - 0.04, 0.14, 0.012, '#9aa6ad'); // control panel
    m.cylinder(w * 0.28, -d / 2 + 0.08, h + 0.012, 0.035, 0.015, '#2a2d31', { sides: 8 });
    m.cylinder(0, d * 0.06, h, w * 0.3, 0.008, '#cfd8dc', { sides: 14 }); // lid
    m.box(0, d / 2 + 0.01, h * 0.48, w * 0.56, 0.02, w * 0.56, '#3c4a52'); // porthole
  },
  dryerStack(m, w, d, h) {
    const half = h / 2;
    for (let i = 0; i < 2; i++) {
      m.box(0, 0, i * half, w, d, half - 0.01, '#dfe5e8', { top: '#eef2f4' });
      m.box(0, d / 2 + 0.01, i * half + half * 0.45, w * 0.55, 0.02, w * 0.55, '#2e383e');
      m.box(0, d / 2 + 0.01, i * half + half * 0.86, w * 0.8, 0.02, 0.06, '#9aa6ad');
    }
    m.box(0, -0.05, h, w * 0.5, d * 0.5, 0.12, '#d7e3ea', { top: '#ffffff' }); // folded towels
  },
  laundryCart(m, w, d, h) {
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) m.cylinder((x * (w - 0.12)) / 2, (y * (d - 0.12)) / 2, 0, 0.05, 0.1, C.black, { sides: 6 });
    m.box(0, 0, 0.1, w, d, h - 0.1, '#566a7a', { top: '#3a4954' });
    m.box(0, 0, h - 0.04, w + 0.04, d + 0.04, 0.04, C.metal);
    m.box(-w * 0.15, 0.02, h - 0.3, w * 0.62, d * 0.75, 0.34, '#f4f4ef', { top: '#ffffff' }); // linen piled up
    m.box(w * 0.22, -0.04, h - 0.2, w * 0.4, d * 0.6, 0.26, '#e3e9ec', { top: '#f0f4f6', yaw: 0.2 });
  },
  linenShelf(m, w, d, h) {
    for (const x of [-1, 1]) for (const y of [-1, 1]) m.box((x * (w - 0.04)) / 2, (y * (d - 0.04)) / 2, 0, 0.04, 0.04, h, C.metal);
    for (let s = 0; s < 4; s++) {
      const z = 0.1 + s * 0.6;
      m.box(0, 0, z, w, d, 0.03, C.metalDark, { top: '#7d858c' });
      for (let i = 0; i < 4; i++) {
        if ((s + i) % 4 === 3) continue;
        const tw = w / 4 - 0.06;
        m.box(-w / 2 + (i + 0.5) * (w / 4), 0, z + 0.03, tw, d * 0.8, 0.22 + ((s + i) % 2) * 0.06, i % 2 ? '#f4f4ef' : '#dfe9ee', { top: '#ffffff' });
      }
    }
  },
  shower(m, w, d, h) {
    m.box(0, 0, 0, w, d, 0.08, '#e9eef0', { top: '#f4f7f8' }); // tray
    m.box(0, 0, 0.08, w - 0.12, d - 0.12, 0.004, '#c4d3da');
    m.cylinder(w * 0.18, -d * 0.18, 0.084, 0.04, 0.004, '#7d858c', { sides: 8 }); // drain
    m.box(-w / 2 + 0.02, 0, 0.08, 0.03, d, h - 0.08, '#a9cbd8', { top: '#d8eef6' }); // glass
    m.box(0, d / 2 - 0.02, 0.08, w, 0.03, h - 0.08, '#a9cbd8', { top: '#d8eef6' });
    m.cylinder(w * 0.3, -d * 0.36, 1.6, 0.06, 0.03, C.metal, { sides: 8 }); // head
  },
  luggageCart(m, w, d, h) {
    m.box(0, 0, 0.12, w, d, 0.05, '#b8902e', { top: '#d8b048' });
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) m.cylinder((x * (w - 0.14)) / 2, (y * (d - 0.14)) / 2, 0, 0.06, 0.12, C.black, { sides: 6 });
    for (const s of [-1, 1]) m.cylinder((s * (w - 0.06)) / 2, 0, 0.17, 0.025, h - 0.17, '#d8b048', { sides: 6 });
    m.box(0, 0, h - 0.04, w, 0.04, 0.04, '#d8b048');
    m.box(-0.2, 0.02, 0.17, 0.55, 0.4, 0.62, '#2d3a4f', { top: '#3b4b66' }); // suitcases
    m.box(0.3, -0.03, 0.17, 0.4, 0.3, 0.48, '#7a2633', { top: '#8e2f3d' });
    m.box(0.3, -0.03, 0.65, 0.34, 0.26, 0.2, '#4a4f55', { top: '#5d636a' });
  },

  // --- port (data/maps/port.js); `color` tints containers and trailers
  container(m, w, d, h, p) {
    containerBox(m, 0, w, d, h, p.color || '#b0402e');
  },
  containerStack(m, w, d, h, p) {
    const c = p.color || '#2f6db0';
    containerBox(m, 0, w, d, h / 2, c);
    containerBox(m, h / 2, w, d, h / 2, shift(c, 0.82));
  },
  trailer(m, w, d, h, p) {
    const cab = 2.1;
    const bed = w - cab - 0.15;
    const bx = -w / 2 + bed / 2;
    // chassis and wheels
    m.box(bx, 0, 0.55, bed, d * 0.5, 0.25, '#2a2c30');
    for (const x of [bx - bed / 2 + 0.7, bx - bed / 2 + 1.7, w / 2 - 0.6, w / 2 - 1.7]) for (const s of [-1, 1]) m.box(x, (s * (d - 0.3)) / 2, 0, 0.95, 0.3, 0.95, C.vanDark);
    // the container on the bed
    containerBox(m, 0.8, bed, d, h - 0.8, p.color || '#d6d2c8', bx);
    // tractor cab
    const cx = w / 2 - cab / 2;
    m.box(cx, 0, 0.6, cab, d, 1.5, '#c23b2c', { top: '#d24a3a' });
    m.box(cx + 0.1, 0, 2.1, cab - 0.5, d * 0.95, 0.9, '#c23b2c', { top: '#d8574a' });
    m.box(w / 2 - 0.08, 0, 1.55, 0.06, d * 0.8, 0.75, '#24313f'); // windshield
    m.box(cx - 0.2, 0, 3.0, 0.5, d * 0.5, 0.25, '#2a2c30'); // air deflector
    for (const s of [-1, 1]) m.box(w / 2 - 0.25, (s * (d + 0.18)) / 2, 1.8, 0.1, 0.12, 0.3, C.black); // mirrors
  },
  forklift(m, w, d, h) {
    // body, counterweight at the back (-y), mast and forks at the front (+y)
    for (const [x, y] of [[-1, -0.6], [1, -0.6], [-1, 0.45], [1, 0.45]]) m.box((x * (w - 0.16)) / 2, y, 0, 0.18, 0.5, 0.5, C.black);
    m.box(0, -0.2, 0.25, w - 0.1, d * 0.62, 0.65, '#e0a321', { top: '#efb83a' });
    m.box(0, -d / 2 + 0.3, 0.25, w - 0.05, 0.55, 0.85, '#3b3d40', { top: '#4c4f53' }); // counterweight
    m.box(0, -0.25, 0.9, 0.5, 0.45, 0.35, C.black); // seat
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box((x * (w - 0.2)) / 2, -0.25 + y * 0.42, 0.9, 0.06, 0.06, 1.25, C.metalDark); // cage posts
    m.box(0, -0.25, 2.12, w - 0.14, 0.95, 0.06, '#3b3d40', { top: '#55595e' }); // overhead guard
    for (const s of [-1, 1]) m.box(s * 0.32, d / 2 - 0.6, 0.15, 0.1, 0.12, h - 0.15, '#3b3d40'); // mast
    m.box(0, d / 2 - 0.6, 1.2, 0.74, 0.1, 0.08, '#3b3d40');
    for (const s of [-1, 1]) m.box(s * 0.24, d / 2 - 0.28, 0.05, 0.12, 0.62, 0.05, C.metalDark); // forks
  },
  bollard(m, w, d, h) {
    m.cylinder(0, 0, 0, w / 2, h * 0.75, '#2a2c30', { sides: 10, top: '#3a3d42' });
    m.cylinder(0, 0, h * 0.75, w / 2 + 0.06, h * 0.25, '#2a2c30', { sides: 10, top: '#e3b51e' });
  },
  guardBooth(m, w, d, h) {
    m.box(0, 0, 0, w, d, 1.0, '#d9dcd5', { top: '#d9dcd5' });
    m.box(0, 0, 1.0, w, d, h - 1.25, '#9fc3d4', { top: '#9fc3d4' }); // glass all round
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box((x * (w - 0.08)) / 2, (y * (d - 0.08)) / 2, 1.0, 0.08, 0.08, h - 1.25, '#5d636a');
    m.box(0, 0, h - 0.25, w + 0.25, d + 0.25, 0.25, '#e3e5e1', { top: '#c23b2c' }); // roof
    m.box(0, d / 2 + 0.02, 0.95, w * 0.7, 0.1, 0.05, C.black); // counter
  },
  xrayScanner(m, w, d, h) {
    m.box(0, 0, 0, w, d * 0.7, 0.75, '#3b3d40', { top: '#2a2c30' }); // belt
    for (let x = -w / 2 + 0.2; x < w / 2; x += 0.35) m.box(x, 0, 0.75, 0.04, d * 0.66, 0.01, '#55595e');
    m.box(0, 0, 0.75, 1.3, d, h - 0.75, '#dcdfdb', { top: '#eceee9' }); // the tunnel's housing
    m.box(-0.4, 0, h, 0.4, d * 0.5, 0.04, '#c23b2c'); // warning strip
    for (const s of [-1, 1]) m.box((s * 1.3) / 2, 0, 0.78, 0.04, d * 0.6, 0.5, '#2a3b2e'); // lead curtains
    m.box(0.25, -d / 2 + 0.1, h, 0.36, 0.2, 0.05, '#24313f'); // monitor on top
  },
  coldRack(m, w, d, h) {
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) m.box((x * (w - 0.06)) / 2, (y * (d - 0.06)) / 2, 0, 0.06, 0.06, h, '#2f6db0');
    for (let s = 0; s < 3; s++) {
      const z = 0.12 + s * 0.78;
      m.box(0, 0, z, w, d, 0.05, '#7d858c', { top: '#a7aeb4' });
      for (let i = 0; i < 3; i++) {
        if ((s * 2 + i) % 4 === 3) continue;
        const bx = -w / 2 + 0.45 + i * 0.85;
        const bh = 0.5 - ((s * 5 + i) % 3) * 0.07;
        m.box(bx, 0, z + 0.05, 0.7, d * 0.82, bh, i % 2 ? '#d8d2c2' : '#c4b48e', { top: '#e9edef' }); // frosted boxes
      }
    }
  },
  evaporator(m, w, d, h) {
    m.box(0, 0, h - 0.7, w, d, 0.7, '#cfd6d9', { top: '#e3e9eb' });
    for (const s of [-1, 1]) {
      m.cylinder(s * w * 0.25, d / 2 + 0.01, h - 0.62, 0.24, 0.02, '#2a2c30', { sides: 12 }); // fans
      m.cylinder(s * w * 0.25, d / 2 + 0.02, h - 0.4, 0.05, 0.02, '#7d858c', { sides: 6 });
    }
    m.box(0, 0, 0, 0.08, 0.08, h - 0.7, '#9aa1a8'); // drain pipe down to the floor
  },

  // --- embassy (data/maps/embassy.js); `color` paints the cars
  sedan(m, w, d, h, p) {
    const c = p.color || '#1d2126';
    const top = shift(c, 1.35);
    for (const x of [-w * 0.3, w * 0.3]) for (const s of [-1, 1]) m.box(x, (s * (d - 0.2)) / 2, 0, 0.62, 0.22, 0.6, C.black);
    m.box(0, 0, 0.25, w, d, 0.55, c, { top }); // body
    m.box(w / 2 - 0.05, 0, 0.42, 0.1, d * 0.8, 0.18, '#d8d2bf'); // grille
    m.box(-0.25, 0, 0.8, w * 0.5, d * 0.86, 0.6, c, { top }); // cabin
    m.box(w * 0.04, 0, 0.84, 0.06, d * 0.82, 0.52, '#24313f'); // windshield
    m.box(-w * 0.3 - 0.04, 0, 0.84, 0.06, d * 0.82, 0.48, '#24313f'); // rear window
    for (const s of [-1, 1]) m.box(-0.25, (s * d * 0.86) / 2, 0.88, w * 0.44, 0.02, 0.38, '#24313f'); // side windows
    for (const s of [-1, 1]) m.box(w / 2 - 0.02, s * d * 0.34, 0.5, 0.04, 0.24, 0.1, '#f2e8b8'); // headlights
  },
  fountain(m, w, d, h) {
    const r = w / 2;
    m.cylinder(0, 0, 0, r, h * 0.5, '#bfb39a', { sides: 16, top: '#d4c9b0' }); // basin rim
    m.cylinder(0, 0, h * 0.5, r - 0.15, 0.01, '#3f7f94', { sides: 16 }); // water
    m.cylinder(0, 0, h * 0.5, r * 0.62, 0.012, '#5aa0b3', { sides: 16 });
    m.cylinder(0, 0, 0, 0.18, h, '#bfb39a', { sides: 8, top: '#d4c9b0' }); // column
    m.cylinder(0, 0, h, 0.42, 0.12, '#bfb39a', { sides: 12, top: '#5aa0b3' }); // upper bowl
    m.cylinder(0, 0, h + 0.12, 0.06, 0.25, '#bfb39a', { sides: 6, top: '#cfeaf2' });
  },
  planter(m, w, d, h) {
    m.box(0, 0, 0, w, d, h * 0.7, '#a6896a', { top: '#bfa27f' });
    m.box(0, 0, h * 0.7, w - 0.12, d - 0.12, 0.02, '#4a3624');
    BUILDERS.plant(m);
    for (const s of [-1, 1]) m.frustum(s * w * 0.3, 0, h * 0.7, 0.32, 0.22, 0.4, C.leafDark, { sides: 7, top: C.leaf, phase: s });
    for (const s of [-1, 1]) m.frustum(s * w * 0.15, s * 0.12, h * 0.7, 0.18, 0.1, 0.2, '#b03a5a', { sides: 6, top: '#d8577a', phase: s * 2 }); // flowers
  },
  flagPole(m, w, d, h) {
    m.cylinder(0, 0, 0, 0.18, 0.12, '#3a3d42', { sides: 8 });
    m.cylinder(0, 0, 0.12, 0.04, h - 0.12, '#c9ced2', { sides: 6, top: '#d8b048' });
    m.box(0.6, 0, h - 0.95, 1.1, 0.03, 0.7, '#f2f2ee'); // the flag, hanging off the pole
    m.box(0.6, 0.02, h - 0.62, 1.1, 0.01, 0.12, '#2f6db0');
  },
  flagStand(m, w, d, h) {
    m.cylinder(0, 0, 0, w / 2, 0.06, '#c9a24a', { sides: 10 });
    m.cylinder(0, 0, 0.06, 0.025, h - 0.06, '#c9a24a', { sides: 6, top: '#d8b048' });
    m.box(0.22, 0, h - 1.05, 0.42, 0.05, 0.9, '#f2f2ee'); // furled flag
    m.box(0.22, 0.03, h - 0.75, 0.42, 0.01, 0.16, '#2f6db0');
    m.box(0.22, 0.03, h - 0.45, 0.42, 0.01, 0.12, '#b0402e');
  },
  execDesk(m, w, d, h) {
    m.box(0, 0, 0, w, d, h - 0.04, '#4a2c18', { top: '#5e3920' });
    m.box(0, 0, h - 0.04, w + 0.06, d + 0.06, 0.04, '#5e3920', { top: '#2a4a3a' }); // leather top
    m.box(-w * 0.28, -d * 0.1, h, 0.4, 0.28, 0.02, '#efe9dc', { yaw: 0.15 }); // documents
    m.cylinder(w * 0.36, -d * 0.24, h, 0.07, 0.36, '#c9a24a', { sides: 8 }); // lamp
    m.frustum(w * 0.36, -d * 0.24, h + 0.36, 0.14, 0.08, 0.1, '#2a6a4a', { sides: 10, top: '#3a8a5a' });
    m.box(w * 0.05, -d * 0.28, h, 0.2, 0.08, 0.06, C.black); // phone
  },
  piano(m, w, d, h) {
    // a grand piano from above: rounded body, raised lid, the keyboard at the front (+y)
    for (const [x, y] of [[-0.5, 0.75], [0.5, 0.75], [0.2, -0.7]]) m.cylinder(x, y, 0, 0.05, h - 0.3, '#0e0f11', { sides: 6 });
    m.box(0, 0.25, h - 0.3, w, d - 0.5, 0.28, '#111214', { top: '#1c1d20' });
    m.frustum(0.1, -0.55, h - 0.3, 0.62, 0.62, 0.28, '#111214', { sides: 12, top: '#1c1d20', sy: 0.75 });
    m.box(0, d / 2 - 0.12, h - 0.18, w - 0.1, 0.18, 0.04, '#f4f4ef'); // keys
    for (let x = -w / 2 + 0.12; x < w / 2 - 0.1; x += 0.12) m.box(x, d / 2 - 0.16, h - 0.14, 0.04, 0.1, 0.02, '#0e0f11');
    m.box(0, 0, h - 0.02, w - 0.2, d * 0.5, 0.02, '#26282c', { yaw: 0.12 }); // lid
  },
  globe(m, w, d, h) {
    m.cylinder(0, 0, 0, 0.22, 0.05, '#4a2c18', { sides: 10 });
    m.cylinder(0, 0, 0.05, 0.03, h * 0.45, '#4a2c18', { sides: 6 });
    m.cylinder(0, 0, h * 0.45, w / 2, 0.06, '#c9a24a', { sides: 14 }); // meridian ring
    m.frustum(0, 0, h * 0.5, 0.26, 0.26, h * 0.42, '#3f7f94', { sides: 12, top: '#4f9a6a' });
  },
};

// A shipping container: corrugated sides, a darker roof frame and the door end at +x.
function containerBox(m, z0, w, d, h, color, x0 = 0) {
  const dark = shift(color, 0.72);
  m.box(x0, 0, z0, w, d, h, color, { top: shift(color, 1.08) });
  for (let x = -w / 2 + 0.25; x < w / 2 - 0.1; x += 0.3) for (const s of [-1, 1]) m.box(x0 + x, (s * d) / 2, z0 + 0.12, 0.12, 0.03, h - 0.24, dark); // ribs
  for (const s of [-1, 1]) m.box(x0, (s * (d - 0.1)) / 2, z0 + h, w, 0.1, 0.03, dark); // roof rails
  for (let x = -w / 2 + 0.6; x < w / 2; x += 1.2) m.box(x0 + x, 0, z0 + h, 0.05, d - 0.2, 0.02, dark); // roof dents
  m.box(x0 + w / 2 + 0.01, 0, z0 + 0.1, 0.03, d - 0.1, h - 0.2, dark); // door end
  for (const s of [-1, 1]) m.box(x0 + w / 2 + 0.03, s * 0.35, z0 + 0.2, 0.03, 0.05, h - 0.4, C.metal); // lock bars
}

/** A hex color scaled by f (darker below 1). */
function shift(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0')}`;
}

/** Appends one prop instance (compiled map prop) to the builder. */
export function buildProp(m, prop) {
  const fn = BUILDERS[prop.type];
  if (!fn) return;
  m.setTransform(prop.x, prop.y, prop.rot);
  fn(m, prop.w, prop.d, prop.h, prop);
  m.setTransform();
}

export const PROP_TYPES = Object.keys(BUILDERS);
