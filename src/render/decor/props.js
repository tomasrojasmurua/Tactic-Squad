// Furniture and set pieces added with the v2 maps (docs/diseno/mapas-v2.md), in the
// same low-poly style as render/geometry/props.js (whose BUILDERS fall back to these).
// Local space: centered, x = width, y = depth, +y the front; the map's `rot` turns it.
// Gameplay footprints live in data/props.js.
import { PROP_COLORS as C } from '../../config/materials.js';

/** A hex color scaled by f (darker below 1). */
function shift(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0')}`;
}

// A shipping container (same look as the port's): ribs, roof rails, the door end at +x.
function containerBox(m, z0, w, d, h, color, x0 = 0, dents = 0) {
  const dark = shift(color, 0.72);
  m.box(x0, 0, z0, w, d, h, color, { top: shift(color, 1.08) });
  for (let x = -w / 2 + 0.25; x < w / 2 - 0.1; x += 0.3) for (const s of [-1, 1]) m.box(x0 + x, (s * d) / 2, z0 + 0.12, 0.12, 0.03, h - 0.24, dark);
  for (const s of [-1, 1]) m.box(x0, (s * (d - 0.1)) / 2, z0 + h, w, 0.1, 0.03, dark);
  for (let x = -w / 2 + 0.6; x < w / 2; x += 1.2) m.box(x0 + x, 0, z0 + h, 0.05, d - 0.2, 0.02, dark);
  m.box(x0 + w / 2 + 0.01, 0, z0 + 0.1, 0.03, d - 0.1, h - 0.2, dark);
  for (const s of [-1, 1]) m.box(x0 + w / 2 + 0.03, s * 0.35, z0 + 0.2, 0.03, 0.05, h - 0.4, C.metal);
  if (dents) m.box(x0 - w * 0.12, d / 2 - 0.02, z0 + h * 0.3, w * 0.3, 0.06, h * 0.45, shift(color, 0.6), { yaw: 0.05 }); // a crushed side
}

// Pallet of goods wrapped in film.
function wrapped(m, x, y, z, w, d, h, color) {
  m.box(x, y, z, w, d, 0.14, C.woodLight);
  m.box(x, y, z + 0.14, w * 0.94, d * 0.94, h - 0.14, color, { top: shift(color, 1.12) });
  m.box(x, y, z + h, w * 0.94, 0.05, 0.004, '#e8eef0');
}

export const EXTRA_BUILDERS = Object.freeze({
  // --- port
  containerStack3(m, w, d, h, p) {
    const c = p.color || '#8e8a84';
    const k = h / 3;
    containerBox(m, 0, w, d, k, c);
    containerBox(m, k, w, d, k, shift(c, 0.85));
    containerBox(m, 2 * k, w, d, k, p.color2 || shift(c, 1.1));
  },
  // A reefer: white box, its refrigeration unit at the -x end, the power cable to the stack.
  reefer(m, w, d, h, p) {
    const c = p.color || '#e4e6e1';
    containerBox(m, 0, w, d, h, c);
    m.box(-w / 2 - 0.02, 0, 0.15, 0.06, d - 0.2, h - 0.3, '#5d636a');
    for (let i = 0; i < 2; i++) m.cylinder(-w / 2 - 0.05, -0.5 + i, h * 0.62, 0.32, 0.02, '#2a2c30', { sides: 12 });
    m.box(-w / 2 - 0.05, 0.6, h * 0.25, 0.04, 0.4, 0.3, '#24313f');
  },
  // An open container: the doors swung back, cargo half out on the ground.
  containerOpen(m, w, d, h, p) {
    const c = p.color || '#3f7f52';
    containerBox(m, 0, w, d, h, c);
    m.box(w / 2 + 0.03, 0, 0.12, 0.02, d - 0.3, h - 0.24, '#1b1c1f'); // dark inside
    const dark = shift(c, 0.8);
    for (const s of [-1, 1]) m.box(w / 2 + 0.55, s * (d / 2 + 0.04), 0.1, 1.1, 0.05, h - 0.2, dark, { top: shift(c, 1.05), yaw: s * 0.35 });
  },
  containerDented(m, w, d, h, p) {
    containerBox(m, 0, w, d, h, p.color || '#c98a2a', 0, 1);
  },
  // Reach stacker: the machine, its boom raised and a container in its spreader.
  reachStacker(m, w, d, h, p) {
    const y = '#e0a321';
    for (const x of [-w * 0.32, w * 0.28]) for (const s of [-1, 1]) m.box(x, (s * (d - 0.5)) / 2, 0, 1.2, 0.5, 1.2, C.black);
    m.box(-w * 0.05, 0, 0.5, w * 0.62, d - 0.6, 1.0, y, { top: '#efb83a' });
    m.box(-w * 0.36, 0, 0.5, w * 0.16, d - 0.4, 1.5, '#3b3d40', { top: '#4c4f53' }); // counterweight
    m.box(w * 0.02, -d * 0.22, 1.5, 1.4, 1.0, 1.4, '#24313f', { top: '#3a4954' }); // cab
    m.box(w * 0.05, 0.2, 1.5, w * 0.62, 0.55, 0.55, y, { top: '#efb83a' }); // boom
    containerBox(m, h - 2.0, w * 0.82, d, 2.0, p.color || '#2f6db0', w * 0.08);
  },
  // The foot of a quay gantry crane: a yellow leg on its rail bogie.
  craneLeg(m, w, d, h) {
    const y = '#d9a21e';
    m.box(0, 0, 0, w, d, 0.7, '#3b3d40', { top: '#55595e' });
    for (let i = 0; i < 4; i++) m.cylinder(-w / 2 + 0.3 + i * ((w - 0.6) / 3), d / 2 + 0.02, 0.05, 0.22, 0.04, C.black, { sides: 8 });
    m.box(0, 0, 0.7, w * 0.55, d * 0.6, h - 0.7, y, { top: '#efb83a' });
    m.box(0, 0, h - 0.25, w * 0.75, d * 0.8, 0.25, '#c08a14', { top: '#e3b51e' });
    for (let z = 0.9; z < h - 0.4; z += 0.6) m.box(0, d * 0.31, z, w * 0.5, 0.02, 0.18, z % 1.2 < 0.6 ? C.black : C.hazard);
  },
  generator(m, w, d, h) {
    m.box(0, 0, 0.12, w, d, h - 0.12, '#3f7f52', { top: '#4f9462' });
    m.box(0, 0, 0, w + 0.06, d + 0.06, 0.12, '#2a2c30');
    for (let i = 0; i < 5; i++) m.box(-w * 0.3 + i * 0.12, d / 2 + 0.01, h * 0.35, 0.06, 0.02, h * 0.45, '#2f6040');
    m.cylinder(w * 0.32, -d * 0.2, h, 0.07, 0.35, '#2a2c30', { sides: 8 }); // exhaust
  },
  // --- warehouse / distribution
  longRack(m, w, d, h) {
    const n = Math.max(2, Math.round(w / 2.7));
    for (let i = 0; i <= n; i++) for (const s of [-1, 1]) m.box(-w / 2 + (i * w) / n, (s * (d - 0.06)) / 2, 0, 0.07, 0.07, h, '#d25b2a');
    const colors = ['#c9b48a', C.crate, '#8fa3b5', '#b9524a', '#e3e1d8'];
    for (let s = 0; s < 3; s++) {
      const z = 0.15 + s * (h / 3);
      m.box(0, 0, z, w, d, 0.05, '#7d858c', { top: '#a7aeb4' });
      for (let i = 0; i < n * 2; i++) {
        if ((s * 7 + i * 3) % 5 === 4) continue; // gaps where goods were picked
        const bx = -w / 2 + (i + 0.5) * (w / (n * 2));
        wrapped(m, bx, 0, z + 0.05, w / (n * 2) - 0.12, d * 0.82, 0.45 + ((s + i) % 3) * 0.08, colors[(s * 3 + i) % colors.length]);
      }
    }
  },
  palletStack(m, w, d, h, p) {
    wrapped(m, 0, 0, 0, w, d, h, p.color || '#c9b48a');
  },
  workbench(m, w, d, h) {
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) m.box((x * (w - 0.1)) / 2, (y * (d - 0.1)) / 2, 0, 0.06, 0.06, h - 0.05, C.metalDark);
    m.box(0, 0, 0.2, w - 0.1, d - 0.1, 0.03, C.metalDark);
    m.box(0, 0, h - 0.05, w, d, 0.05, C.wood, { top: C.woodLight });
    m.box(-w * 0.3, d * 0.3, h, 0.24, 0.18, 0.16, '#3b3d40'); // vise
    m.box(w * 0.15, -d * 0.05, h, 0.5, 0.06, 0.04, '#c23b2c', { yaw: 0.4 }); // wrench
    m.box(w * 0.3, 0.05, h, 0.36, 0.24, 0.12, '#c23b2c', { top: '#d24a3a' }); // tool box
    m.box(0, -d / 2 + 0.03, h, w, 0.04, 0.9, '#7d858c'); // pegboard
  },
  toolChest(m, w, d, h) {
    m.box(0, 0, 0.08, w, d, h - 0.08, '#c23b2c', { top: '#d24a3a' });
    for (let i = 0; i < 5; i++) m.box(0, d / 2 + 0.01, 0.2 + i * 0.17, w * 0.8, 0.02, 0.02, C.metal);
    for (const s of [-1, 1]) m.cylinder((s * (w - 0.1)) / 2, 0, 0, 0.05, 0.08, C.black, { sides: 6 });
  },
  charger(m, w, d, h) {
    m.box(0, 0, 0, w, d, h, '#d9dcd5', { top: '#e3e5e1' });
    m.box(0, d / 2 + 0.01, h * 0.6, w * 0.5, 0.02, h * 0.25, '#24313f');
    m.box(-w * 0.2, d / 2 + 0.01, h * 0.45, 0.06, 0.02, 0.06, '#5fbf5a');
    m.box(w * 0.25, d / 2 + 0.05, 0.1, 0.06, 0.06, h * 0.5, C.black); // cable
  },
  dumpster(m, w, d, h) {
    m.box(0, 0, 0.12, w, d, h - 0.16, '#2f6040', { top: '#24452f' });
    m.box(0, 0, h - 0.04, w + 0.06, d + 0.06, 0.06, '#24452f', { top: '#2c5238' }); // lid
    for (const x of [-1, 1]) for (const y of [-1, 1]) m.cylinder((x * (w - 0.2)) / 2, (y * (d - 0.2)) / 2, 0, 0.07, 0.12, C.black, { sides: 6 });
    m.box(-w * 0.3, d / 2 - 0.05, h, 0.5, 0.4, 0.06, '#e8e2d0', { yaw: 0.3 }); // a box on top
  },
  car(m, w, d, h, p) {
    const c = p.color || '#8e2f3d';
    for (const x of [-w * 0.32, w * 0.3]) for (const s of [-1, 1]) m.box(x, (s * (d - 0.12)) / 2, 0, 0.62, 0.2, 0.62, C.vanDark);
    m.box(0, 0, 0.3, w, d - 0.04, 0.5, c, { top: shift(c, 1.1) });
    m.box(-w * 0.05, 0, 0.8, w * 0.5, d * 0.86, 0.6, shift(c, 0.95), { top: shift(c, 1.15) });
    m.box(w * 0.22, 0, 0.82, 0.06, d * 0.8, 0.5, '#24313f', { yaw: 0 }); // windshield
    m.box(-w * 0.32, 0, 0.82, 0.06, d * 0.8, 0.45, '#24313f');
    for (const s of [-1, 1]) m.box(w / 2 + 0.01, s * d * 0.32, 0.5, 0.02, 0.2, 0.08, '#efe4c8');
  },
  // --- hotel
  column(m, w, d, h) {
    m.box(0, 0, 0, w + 0.12, d + 0.12, 0.12, '#cfc6b4', { top: '#ded6c4' });
    m.box(0, 0, 0.12, w, d, h - 0.28, '#e2d9c6', { top: '#efe8d8' });
    m.box(0, 0, h - 0.16, w + 0.16, d + 0.16, 0.16, '#cfc6b4', { top: '#ded6c4' });
  },
  receptionDesk(m, w, d, h) {
    m.box(0, 0, 0, w, d, h - 0.05, '#4e3322', { top: '#6a4630' });
    m.box(0, d / 2 - 0.06, 0, w, 0.12, h - 0.1, '#b58a3c'); // brass band
    m.box(0, 0.05, h - 0.05, w + 0.08, d * 0.6, 0.05, '#e0d6c0', { top: '#efe7d4' }); // marble top
    m.box(-w * 0.25, -d * 0.2, h, 0.5, 0.06, 0.34, C.black); // screen
    m.box(w * 0.2, 0.05, h, 0.24, 0.18, 0.04, '#b58a3c'); // bell tray
    m.cylinder(w * 0.2, 0.05, h + 0.04, 0.05, 0.05, '#d8c48a', { sides: 8 });
  },
  barCounter(m, w, d, h) {
    m.box(0, 0, 0, w, d, h - 0.05, '#3a2416', { top: '#4e3322' });
    m.box(0, d / 2 - 0.04, 0.1, w, 0.08, h - 0.2, '#6a4630');
    m.box(0, 0, h - 0.05, w + 0.1, d + 0.06, 0.05, '#2a2622', { top: '#3a3430' });
    for (let x = -w / 2 + 0.4; x < w / 2 - 0.2; x += 0.55) {
      m.cylinder(x, -d * 0.1, h, 0.04, 0.24, x % 1.1 < 0.55 ? '#3f8f5a' : '#8e2f3d', { sides: 6 }); // bottles
      m.cylinder(x + 0.2, d * 0.15, h, 0.04, 0.12, '#cfe4ec', { sides: 8 }); // glasses
    }
  },
  backBar(m, w, d, h) {
    m.box(0, 0, 0, w, d, h, '#3a2416', { top: '#4e3322' });
    const colors = ['#3f8f5a', '#8e2f3d', '#c9a227', '#cfe4ec', '#6a3fa0'];
    for (let s = 0; s < 3; s++) for (let i = 0; i < Math.floor(w / 0.18); i++) m.cylinder(-w / 2 + 0.1 + i * 0.18, d / 2 + 0.03, 0.9 + s * 0.4, 0.04, 0.26, colors[(i + s * 2) % colors.length], { sides: 6 });
  },
  barStool(m) {
    m.cylinder(0, 0, 0, 0.18, 0.03, '#2a2622', { sides: 10 });
    m.cylinder(0, 0, 0.03, 0.03, 0.66, '#b58a3c', { sides: 6 });
    m.cylinder(0, 0, 0.69, 0.19, 0.07, '#7a2633', { sides: 10, top: '#8e2f3d' });
  },
  roundTable(m, w, d, h) {
    m.cylinder(0, 0, 0, w * 0.3, 0.04, '#2a2622', { sides: 10 });
    m.cylinder(0, 0, 0.04, 0.04, h - 0.08, '#2a2622', { sides: 6 });
    m.cylinder(0, 0, h - 0.04, w / 2, 0.04, '#efe8d8', { sides: 14, top: '#f6f1e6' });
    m.cylinder(w * 0.12, -w * 0.1, h, 0.04, 0.12, '#cfe4ec', { sides: 8 });
    m.box(-w * 0.12, w * 0.08, h, 0.18, 0.12, 0.01, C.white, { yaw: 0.4 });
  },
  sunLounger(m, w, d, h) {
    for (const x of [-1, 1]) for (const y of [-1, 1]) m.box((x * (w - 0.1)) / 2, (y * (d - 0.08)) / 2, 0, 0.05, 0.05, h - 0.1, '#e8e2d0');
    m.box(0.15, 0, h - 0.1, w - 0.4, d, 0.08, '#e8e2d0', { top: '#2c4a6e' });
    m.box(-w / 2 + 0.3, 0, h - 0.1, 0.55, d, 0.4, '#d8d2c2', { top: '#2c4a6e' });
  },
  planter(m, w, d, h) {
    m.box(0, 0, 0, w, d, h * 0.6, '#9e8f78', { top: '#3a2618' });
    for (let x = -w / 2 + 0.25; x < w / 2; x += 0.42) m.frustum(x, 0, h * 0.55, d * 0.42, d * 0.22, h * 0.45, C.leafDark, { sides: 7, top: '#58a84d', phase: x });
  },
  piano(m, w, d, h) {
    m.box(0, -0.1, 0.25, w, d - 0.35, h - 0.25, C.black, { top: '#2a2b2e' });
    m.box(0, d / 2 - 0.25, 0.25, w, 0.3, 0.55, C.black, { top: '#2a2b2e' });
    m.box(0, d / 2 - 0.18, 0.8, w * 0.9, 0.16, 0.02, C.white);
    for (const [x, y] of [[-0.6, -0.6], [0.6, -0.6], [0, 0.5]]) m.cylinder((x * w) / 1.6, y, 0, 0.05, 0.25, C.black, { sides: 6 });
    m.box(0, -0.2, h, w * 0.85, d * 0.6, 0.02, '#1b1c1f', { yaw: 0.2 }); // lid
  },
  serviceTrolley(m, w, d, h) {
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) m.cylinder((x * (w - 0.1)) / 2, (y * (d - 0.1)) / 2, 0, 0.04, 0.1, C.black, { sides: 6 });
    m.box(0, 0, 0.1, w, d, 0.03, C.metal);
    m.box(0, 0, h - 0.04, w, d, 0.04, C.white, { top: '#f6f7f5' }); // tablecloth
    m.frustum(-w * 0.2, 0, h, 0.2, 0.12, 0.18, C.metal, { sides: 10, top: '#c9ced2' }); // cloche
    m.cylinder(w * 0.25, 0.05, h, 0.04, 0.2, '#8e2f3d', { sides: 6 });
  },
  kitchenRange(m, w, d, h) {
    m.box(0, 0, 0, w, d, h, '#c9ced2', { top: '#2a2b2e' });
    for (let i = 0; i < Math.floor(w / 0.5); i++) for (const y of [-0.15, 0.15]) m.cylinder(-w / 2 + 0.3 + i * 0.5, y, h, 0.14, 0.03, '#111214', { sides: 8 });
    m.box(0, -d / 2 + 0.05, h, w, 0.1, 0.5, '#9aa1a8'); // splash back
  },
  // --- the forest (Aserradero)
  // A pine: the trunk (what blocks) and a narrow crown of three tiers, high above the soldiers.
  pine(m, w, d, h, p) {
    const k = (p.at ? p.at[0] * 7.3 + p.at[1] * 3.1 : 0) % 1; // a little variety per tree
    const g = k < 0.33 ? '#24452f' : k < 0.66 ? '#2c5238' : '#1f3d2a';
    m.cylinder(0, 0, 0, w * 0.32, h * 0.55, '#5a3d26', { sides: 7, top: '#6b4a2e' });
    m.frustum(0, 0, h * 0.42, 1.15, 0.7, h * 0.2, g, { sides: 8, top: shift(g, 1.2), phase: k });
    m.frustum(0, 0, h * 0.6, 0.9, 0.45, h * 0.2, shift(g, 1.08), { sides: 8, top: shift(g, 1.3), phase: k + 0.3 });
    m.frustum(0, 0, h * 0.78, 0.6, 0.05, h * 0.22, shift(g, 1.16), { sides: 8, top: shift(g, 1.4), phase: k + 0.6 });
  },
  bush(m, w, d, h) {
    m.frustum(0, 0, 0, w * 0.5, w * 0.3, h, '#2f5a36', { sides: 7, top: '#3f7546', sx: 1, sy: d / w });
    m.frustum(w * 0.18, -d * 0.1, h * 0.5, w * 0.28, w * 0.12, h * 0.55, '#3a6a40', { sides: 6, top: '#4c8552' });
  },
  rock(m, w, d, h) {
    m.frustum(0, 0, 0, w * 0.5, w * 0.3, h, '#7d7b74', { sides: 6, top: '#9a978e', sy: d / w });
  },
  boulder(m, w, d, h) {
    m.frustum(0, 0, 0, w * 0.5, w * 0.36, h * 0.65, '#6f6d66', { sides: 7, top: '#8b887f', sy: d / w });
    m.frustum(w * 0.08, 0, h * 0.65, w * 0.36, w * 0.16, h * 0.35, '#7d7b74', { sides: 7, top: '#9a978e', sy: d / w, phase: 0.4 });
    m.frustum(-w * 0.3, d * 0.25, 0, w * 0.2, w * 0.1, h * 0.4, '#77756e', { sides: 5, top: '#938f86' });
  },
  stump(m, w, d, h) {
    m.cylinder(0, 0, 0, w / 2, h, '#5a3d26', { sides: 8, top: '#c9a26b' });
    m.cylinder(0, 0, h, w * 0.2, 0.005, '#a77f4c', { sides: 8 });
  },
  // Felled logs, ends to the camera's side: low cover.
  logPile(m, w, d, h) {
    const r = h / 3;
    for (let row = 0; row < 3; row++) {
      const n = 3 - row;
      for (let i = 0; i < n; i++) {
        const y = (i - (n - 1) / 2) * r * 2;
        if (Math.abs(y) > d / 2) continue;
        m.box(0, y, row * r * 1.6, w - row * 0.3, r * 1.9, r * 1.9, '#6b4a2e', { top: '#7c5734' });
        m.box(w / 2 - row * 0.15 + 0.01, y, row * r * 1.6 + r * 0.2, 0.02, r * 1.5, r * 1.5, '#c9a26b');
      }
    }
  },
  logStack(m, w, d, h) {
    m.box(0, 0, 0, w, d, h * 0.94, '#6b4a2e', { top: '#7c5734' });
    for (let y = -d / 2 + 0.3; y < d / 2; y += 0.6) for (let z = 0.3; z < h * 0.94; z += 0.6) m.box(w / 2 + 0.01, y, z - 0.25, 0.02, 0.5, 0.5, '#c9a26b');
    for (let x = -w / 2 + 0.6; x < w / 2; x += 1.2) m.box(x, 0, h * 0.94, 0.06, d + 0.04, 0.06, '#2a2c30'); // straps
  },
  woodpile(m, w, d, h) {
    m.box(0, 0, 0, w, d, h, '#7c5734', { top: '#8d6640' });
    for (let x = -w / 2 + 0.15; x < w / 2; x += 0.22) for (let z = 0.08; z < h; z += 0.22) m.box(x, d / 2 + 0.005, z, 0.17, 0.01, 0.17, '#c9a26b');
    m.box(0, 0, h, w + 0.2, d + 0.3, 0.05, '#4a4d52'); // its tin roof
  },
  // The head saw: its bed, the carriage with a log on it and the blade's housing.
  sawBench(m, w, d, h) {
    m.box(0, 0, 0, w, d, h * 0.6, '#5b616b', { top: '#6f757e' });
    m.box(-w * 0.1, 0, h * 0.6, w * 0.7, d * 0.5, h * 0.4, '#6b4a2e', { top: '#7c5734' });
    m.box(w * 0.35, 0, h * 0.6, 0.5, d, h * 0.9, '#c98a2a', { top: '#d89a3a' });
    m.cylinder(w * 0.35, 0, h * 1.5, 0.45, 0.04, '#9aa1a8', { sides: 14 });
  },
  bunkBed(m, w, d, h) {
    for (const x of [-1, 1]) for (const y of [-1, 1]) m.box((x * (w - 0.08)) / 2, (y * (d - 0.08)) / 2, 0, 0.07, 0.07, h, '#6b4a2e');
    for (const z of [0.3, h * 0.62]) {
      m.box(0, 0, z, w, d, 0.12, '#6b4a2e');
      m.box(0, 0, z + 0.12, w - 0.1, d - 0.08, 0.12, '#5b616b', { top: '#7a8290' });
      m.box(-w / 2 + 0.3, 0, z + 0.24, 0.4, d - 0.2, 0.08, '#e8e2d0');
    }
  },
});
