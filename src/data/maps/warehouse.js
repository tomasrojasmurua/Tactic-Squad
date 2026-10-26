// "Operación Almacén" — vertical slice map, pure data (meters, x right, y down).
//
//  Layout:  yard (attacker spawn) | building: office + kitchen (north),
//           corridor (center), bathroom + lounge (south) | bomb site A hall (east)
//
// Walls are axis-aligned center lines; doors/openings cut gaps automatically.
// Door `at` is the center of the opening; `axis` is the wall direction
// ('v' = wall runs along y). `hinge` picks which end the door pivots on.

const DEG = Math.PI / 180;

export default {
  id: 'warehouse',
  name: 'Operación Almacén',
  size: { w: 40, h: 28 },

  walls: [
    // building exterior
    { a: [10, 2], b: [39, 2], t: 0.4 },
    { a: [10, 26], b: [39, 26], t: 0.4 },
    { a: [10, 2], b: [10, 26], t: 0.4 },
    { a: [39, 2], b: [39, 26], t: 0.4 },
    // corridor
    { a: [10, 11.4], b: [28, 11.4] },
    { a: [10, 14], b: [28, 14] },
    // room dividers
    { a: [19, 2], b: [19, 11.4] },
    { a: [16, 14], b: [16, 26] },
    { a: [28, 2], b: [28, 26] },
    // spawn yard fence (low)
    { a: [1, 5], b: [10, 5], t: 0.3, kind: 'fence' },
    { a: [1, 24], b: [10, 24], t: 0.3, kind: 'fence' },
    { a: [1, 5], b: [1, 24], t: 0.3, kind: 'fence' },
  ],

  doors: [
    { id: 'entrada', at: [10, 12.7], axis: 'v', width: 1.15, hinge: 'min' },
    { id: 'oficina', at: [14.55, 11.4], axis: 'h', width: 1.1, hinge: 'min' },
    { id: 'cocina', at: [23.55, 11.4], axis: 'h', width: 1.1, hinge: 'max' },
    { id: 'ofi-cocina', at: [19, 5.55], axis: 'v', width: 1.1, hinge: 'min' },
    { id: 'banio', at: [13.05, 14], axis: 'h', width: 1.1, hinge: 'min' },
    { id: 'banio-ext', at: [10, 21.55], axis: 'v', width: 1.1, hinge: 'max' },
    { id: 'sala', at: [20.55, 14], axis: 'h', width: 1.1, hinge: 'max' },
    { id: 'sitio-pasillo', at: [28, 12.7], axis: 'v', width: 1.15, hinge: 'min' },
    { id: 'sitio-sala', at: [28, 21.55], axis: 'v', width: 1.1, hinge: 'max' },
  ],

  // Doorless gaps.
  openings: [{ id: 'arco-cocina', at: [28, 5.0], axis: 'v', width: 2.0 }],

  // Named areas for the round debrief ("fell in the kitchen"); first match
  // wins, so the site comes before the hall that contains it. Display names
  // live in ui/texts.js T.places (same ids as rooms and doors).
  rooms: [
    { id: 'patio', rect: [0, 0, 10, 28] },
    { id: 'oficina', rect: [10, 2, 9, 9.4] },
    { id: 'cocina', rect: [19, 2, 9, 9.4] },
    { id: 'pasillo', rect: [10, 11.4, 18, 2.6] },
    { id: 'banio', rect: [10, 14, 6, 12] },
    { id: 'sala', rect: [16, 14, 12, 12] },
    { id: 'sitioA', rect: [31, 8.8, 6.2, 8.4] },
    { id: 'nave', rect: [28, 2, 11, 24] },
  ],

  floors: [
    { rect: [1, 5, 9, 19], material: 'yardAsphalt' },
    { rect: [10, 2, 9, 9.4], material: 'officeCarpet' },
    { rect: [19, 2, 9, 9.4], material: 'kitchenChecker' },
    { rect: [10, 11.4, 18, 2.6], material: 'hallLino' },
    { rect: [10, 14, 6, 12], material: 'bathTiles' },
    { rect: [16, 14, 12, 12], material: 'loungeWood' },
    { rect: [28, 2, 11, 24], material: 'siteConcrete' },
    { rect: [19.2, 16.4, 5.6, 3.4], material: 'redRug' },
  ],

  zones: {
    siteA: { rect: [31, 8.8, 6.2, 8.4], label: 'A' },
    spawn: { rect: [2.5, 10.5, 5, 6] },
  },

  // Floor paint (spray-painted decals generated at runtime).
  paint: [
    { kind: 'site', rect: [31, 8.8, 6.2, 8.4], text: 'A', color: '#f2c230' },
    { kind: 'arrow', at: [25.6, 12.7], size: 1.4, rot: 0, text: 'A', color: '#f2c230' },
    { kind: 'text', at: [5.0, 18.4], size: 0.62, text: 'DESPLIEGUE', color: '#e8e2d0' },
    { kind: 'stripes', rect: [7.6, 10.4, 0.5, 6.0], color: '#e3b51e' },
  ],

  props: [
    // --- yard
    { type: 'van', at: [4.4, 7.4], rot: 0 },
    { type: 'barrier', at: [8.1, 18.6], rot: 90 },
    { type: 'crateStack', at: [2.2, 22.3], rot: 0 },
    { type: 'crate', at: [3.7, 22.5], rot: 0 },
    { type: 'barrel', at: [2.0, 20.6], rot: 0 },
    { type: 'cone', at: [8.7, 9.7], rot: 0 },
    { type: 'cone', at: [8.7, 15.8], rot: 0 },
    { type: 'cone', at: [6.8, 20.8], rot: 0 },

    // --- office
    { type: 'desk', at: [12.3, 3.9], rot: 0 },
    { type: 'officeChair', at: [12.3, 4.85], rot: 180 },
    { type: 'desk', at: [16.4, 3.9], rot: 0 },
    { type: 'officeChair', at: [16.2, 4.85], rot: 160 },
    { type: 'desk', at: [17.6, 9.1], rot: 90 },
    { type: 'officeChair', at: [16.7, 9.2], rot: 90 },
    { type: 'cabinet', at: [10.55, 7.0], rot: 90 },
    { type: 'cabinet', at: [10.55, 7.65], rot: 90 },
    { type: 'bookshelf', at: [14.4, 2.45], rot: 0 },
    { type: 'plant', at: [18.4, 10.8], rot: 0 },
    { type: 'plant', at: [10.65, 10.75], rot: 0 },

    // --- kitchen
    { type: 'counter', at: [21.2, 2.55], rot: 0, size: [2.4, 0.65] },
    { type: 'stove', at: [22.8, 2.55], rot: 0 },
    { type: 'sink', at: [23.75, 2.55], rot: 0 },
    { type: 'counter', at: [25.45, 2.55], rot: 0, size: [2.4, 0.65] },
    { type: 'fridge', at: [27.2, 2.6], rot: 0 },
    { type: 'table', at: [23.4, 7.0], rot: 0 },
    { type: 'chair', at: [22.9, 6.2], rot: 90 },
    { type: 'chair', at: [24.0, 6.2], rot: 90 },
    { type: 'chair', at: [22.9, 7.8], rot: 270 },
    { type: 'chair', at: [24.1, 7.85], rot: 250 },
    { type: 'bin', at: [19.5, 10.85], rot: 0 },

    // --- corridor
    { type: 'bench', at: [18.0, 13.55], rot: 0 },
    { type: 'plant', at: [26.2, 13.55], rot: 0 },

    // --- bathroom
    { type: 'toilet', at: [11.2, 25.4], rot: 0 },
    { type: 'toilet', at: [12.7, 25.4], rot: 0 },
    { type: 'toilet', at: [14.2, 25.4], rot: 0 },
    { type: 'stallWall', at: [11.95, 25.05], rot: 0 },
    { type: 'stallWall', at: [13.45, 25.05], rot: 0 },
    { type: 'stallWall', at: [14.95, 25.05], rot: 0 },
    { type: 'washbasin', at: [14.4, 14.42], rot: 0 },
    { type: 'washbasin', at: [15.2, 14.42], rot: 0 },
    { type: 'bin', at: [10.5, 15.0], rot: 0 },

    // --- lounge
    { type: 'tvStand', at: [24.6, 14.45], rot: 0 },
    { type: 'sofa', at: [22.0, 19.6], rot: 180 },
    { type: 'coffeeTable', at: [22.0, 18.1], rot: 0 },
    { type: 'armchair', at: [19.9, 17.6], rot: 90 },
    { type: 'armchair', at: [24.2, 17.6], rot: 270 },
    { type: 'vending', at: [17.0, 25.45], rot: 0 },
    { type: 'vending', at: [18.2, 25.45], rot: 0 },
    { type: 'plant', at: [27.4, 25.4], rot: 0 },
    { type: 'bin', at: [16.5, 14.5], rot: 0 },

    // --- bomb site A hall
    { type: 'crateStack', at: [33.2, 10.6], rot: 0 },
    { type: 'crate', at: [34.65, 10.55], rot: 0 },
    { type: 'crateStack', at: [35.8, 15.7], rot: 0 },
    { type: 'crate', at: [31.7, 15.6], rot: 0 },
    { type: 'crateStack', at: [30.3, 8.0], rot: 0 },
    { type: 'crate', at: [30.5, 18.9], rot: 0 },
    { type: 'barrel', at: [29.9, 2.75], rot: 0 },
    { type: 'barrel', at: [30.6, 2.75], rot: 0 },
    { type: 'barrel', at: [38.3, 9.2], rot: 0 },
    { type: 'barrel', at: [38.3, 9.9], rot: 0 },
    { type: 'rack', at: [38.3, 4.1], rot: 90 },
    { type: 'rack', at: [38.3, 19.6], rot: 90 },
    { type: 'rack', at: [38.3, 22.9], rot: 90 },
    { type: 'pallet', at: [31.0, 24.6], rot: 0 },
    { type: 'pallet', at: [32.5, 24.6], rot: 0 },
    { type: 'crate', at: [32.5, 24.6], rot: 0 },
    { type: 'pallet', at: [35.2, 3.4], rot: 90 },
  ],

  // Defender behaviors: hold (fixed angle), scan {from, to, period}, patrol
  // {points, wait}; reactsToNoise: turns to gunfire / footsteps / pain;
  // rotate {to, look}: on the first firefight heard, moves there once and holds.
  spawns: {
    attackers: [
      { at: [4.6, 11.9], facing: 0 },
      { at: [4.6, 13.4], facing: 0 },
      { at: [4.6, 14.9], facing: 0 },
    ],
    defenders: [
      // Site anchor: off the corridor line, pre-aiming the corridor door at an
      // angle (whoever walks in looking straight ahead must turn to find him).
      // Blind to the south door: the lounge flank is the way to beat him.
      { at: [34.0, 17.6], facing: -139 * DEG, weapon: 'rifle', behavior: { type: 'hold', reactsToNoise: false } },
      { at: [35.2, 4.7], facing: 165 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: 132 * DEG, to: 178 * DEG, period: 5.5, reactsToNoise: true } },
      // Kitchen guard: on the first firefight he rotates to the arch and covers the site.
      { at: [26.1, 8.7], facing: 130 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: 112 * DEG, to: 195 * DEG, period: 6.5, reactsToNoise: true, rotate: { to: [27.3, 4.7], look: 45 * DEG } } },
      { at: [18.4, 22.6], facing: 0, weapon: 'smg', behavior: { type: 'patrol', points: [[18.4, 22.6], [26.2, 22.6]], wait: 2.2, reactsToNoise: true } },
    ],
  },

  // frame: [x, y, w, h] the first shot fits inside the HUD-free area (squad, yard door, corridor).
  camera: { start: [13.5, 13.4], height: 21, frame: [2.5, 8.5, 24, 9.5] },
};
