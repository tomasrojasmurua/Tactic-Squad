// "Operación Puerto" — Terminal 3, pure data (meters, x right, y down).
// Design notes: docs/diseno/mapas-v2.md (4.3).
//
//  A container terminal in its night shift (60 × 38 m). Layout:
//    north  the water and the quay: a ship's berth, the gantry crane's two legs
//           on their rails, bollards and mooring lines
//    west   the truck staging (attacker side) behind the terminal's fence and gates
//    middle the container yard, stacked the way a working yard is: blocks of
//           one, two and three high, rows broken where boxes were pulled, a
//           reach stacker caught mid-lift, a container opened for stripping with
//           its cargo on the ground, a dented one set apart for inspection,
//           the reefers plugged in at the yard's east end (site A)
//    south  the truck lane and three buildings: customs, the consolidation
//           shed and the cold store with its cold room (site B)
//
// Same format as training.js (see its header for the conventions).

const DEG = Math.PI / 180;

export default {
  id: 'port',
  name: 'Operación Puerto',
  size: { w: 60, h: 38 },

  // Grey concrete walls, a sea-green baseboard (render only).
  palette: { wall: '#a9aeac', exterior: '#6f7775', baseboard: '#2f4a46' },

  traits: ['Contenedores a una, dos y tres alturas', 'Dos carriles largos: el muelle y el carril', 'Un sitio abierto y otro tras puertas pesadas'],
  siteNames: { A: 'los reefers', B: 'la cámara de frío' },
  siteTraits: {
    A: ['Sin puertas: el muelle, el reach o el carril', 'Reefers y pilas de dos: cortan la vista', 'Se ve de lejos desde el muelle'],
    B: ['Dos puertas pesadas y una desde máquinas', 'A la bodega: andén, consolidación o máquinas', 'Estanterías altas: rincones a dos metros'],
  },

  walls: [
    // the quay's edge (the water is north of it) and the staging's fence
    { a: [1, 3], b: [59, 3], t: 0.3, kind: 'fence' },
    { a: [1, 3], b: [1, 37], t: 0.3, kind: 'fence' },
    { a: [1, 37], b: [12, 37], t: 0.3, kind: 'fence' },
    { a: [59, 3], b: [59, 25], t: 0.3, kind: 'fence' },
    // the terminal's gate line
    { a: [12, 3], b: [12, 25], t: 0.3, kind: 'fence' },
    // the south buildings' shell
    { a: [12, 25], b: [59, 25], t: 0.4 },
    { a: [12, 37], b: [59, 37], t: 0.4 },
    { a: [12, 25], b: [12, 37], t: 0.4 },
    { a: [59, 25], b: [59, 37], t: 0.4 },
    // customs | consolidation | cold store
    { a: [24, 25], b: [24, 37], t: 0.4 },
    { a: [37, 25], b: [37, 37], t: 0.4 },
    { a: [12, 31.4], b: [18.6, 31.4] },
    { a: [18.6, 25], b: [18.6, 37] },
    // the cold store: machine room (west) and the cold room (south-east)
    { a: [37, 32.6], b: [47, 32.6] },
    { a: [47, 29.4], b: [59, 29.4], t: 0.3 },
    { a: [47, 29.4], b: [47, 37], t: 0.3 },
  ],

  doors: [
    // From the staging
    { id: 'muelle', at: [12, 5.6], axis: 'v', width: 1.4, hinge: 'min' },
    { id: 'porton', at: [12, 22.6], axis: 'v', width: 1.4, hinge: 'max' },
    { id: 'aduana', at: [12, 34.0], axis: 'v', width: 1.2, hinge: 'min' },
    // Customs
    { id: 'aduana-carril', at: [15.4, 25], axis: 'h', width: 1.2, hinge: 'min' },
    { id: 'insp-oficina', at: [18.6, 28.2], axis: 'v', width: 1.0, hinge: 'min' },
    { id: 'insp-archivo', at: [15.2, 31.4], axis: 'h', width: 1.0, hinge: 'max' },
    { id: 'aduana-consol', at: [24, 34.6], axis: 'v', width: 1.1, hinge: 'max', barricade: true },
    // Consolidation shed
    { id: 'consol-carril', at: [30.4, 25], axis: 'h', width: 1.6, hinge: 'min', barricade: true },
    { id: 'consol-bodega', at: [37, 28.0], axis: 'v', width: 1.2, hinge: 'max', barricade: true },
    { id: 'consol-maquinas', at: [37, 35.0], axis: 'v', width: 1.0, hinge: 'min', barricade: true },
    // Cold store
    { id: 'carga', at: [44.0, 25], axis: 'h', width: 1.6, hinge: 'min', barricade: true },
    { id: 'maquinas', at: [40.4, 32.6], axis: 'h', width: 1.0, hinge: 'max', barricade: true },
    { id: 'camara', at: [47, 31.6], axis: 'v', width: 1.3, hinge: 'min', barricade: true },
    { id: 'camara-norte', at: [55.2, 29.4], axis: 'h', width: 1.3, hinge: 'max', barricade: true },
    { id: 'maquinas-camara', at: [47, 35.4], axis: 'v', width: 0.95, hinge: 'max', barricade: true },
  ],

  openings: [
    { id: 'reja-muelle', at: [6.0, 37], axis: 'h', width: 2.4 },
  ],

  windows: [
    { id: 'ventana-aduana', at: [21.4, 25], axis: 'h', width: 1.8 },
    { id: 'ventana-consol', at: [34.0, 25], axis: 'h', width: 1.6 },
  ],

  rooms: [
    { id: 'sitioA', rect: [47.6, 9.2, 10.6, 9.6] },
    { id: 'sitioB', rect: [48.2, 30.2, 10.0, 6.2] },
    { id: 'explanada', rect: [0, 3, 12, 35] },
    { id: 'muelle', rect: [12, 3, 47, 3.6] },
    { id: 'contenedores', rect: [12, 6.6, 47, 13.2] },
    { id: 'carril', rect: [12, 19.8, 47, 5.2] },
    { id: 'inspeccion', rect: [12, 25, 6.6, 12] },
    { id: 'oficinaAduana', rect: [18.6, 25, 5.4, 12] },
    { id: 'consolidacion', rect: [24, 25, 13, 12] },
    { id: 'maquinas', rect: [37, 32.6, 10, 4.4] },
    { id: 'camara', rect: [47, 29.4, 12, 7.6] },
    { id: 'bodega', rect: [37, 25, 22, 12] },
  ],

  floors: [
    { rect: [0, 0, 60, 3], material: 'harborWater' },
    { rect: [1, 3, 11, 34], material: 'yardAsphalt' },
    { rect: [12, 3, 47, 3.6], material: 'quayConcrete' },
    { rect: [12, 6.6, 47, 13.2], material: 'portConcrete' },
    { rect: [12, 19.8, 47, 5.2], material: 'yardAsphalt' },
    { rect: [12, 25, 6.6, 12], material: 'customsTiles' },
    { rect: [18.6, 25, 5.4, 12], material: 'customsCarpet' },
    { rect: [24, 25, 13, 12], material: 'siteConcrete' },
    { rect: [37, 25, 22, 12], material: 'siteConcrete' },
    { rect: [37, 32.6, 10, 4.4], material: 'serviceLino' },
    { rect: [47, 29.4, 12, 7.6], material: 'coldFloor' },
  ],

  zones: { spawn: { rect: [3, 18, 6, 6] } },

  sites: [
    { id: 'A', rect: [47.6, 9.2, 10.6, 9.6], bomb: [52.4, 13.6] },
    { id: 'B', rect: [48.2, 30.2, 10.0, 6.2], bomb: [56.6, 35.4] },
  ],

  entries: [
    {
      id: 'muelle',
      door: 'muelle',
      frame: [1, 3, 26, 13],
      spawns: [
        { at: [9.4, 5.0], facing: 0 },
        { at: [9.4, 6.4], facing: 0 },
        { at: [8.0, 5.7], facing: 0 },
        { at: [8.0, 7.1], facing: 0 }, // 4.º (2v2)
      ],
    },
    {
      id: 'porton',
      door: 'porton',
      frame: [1, 15, 26, 13],
      spawns: [
        { at: [9.4, 22.0], facing: 0 },
        { at: [9.4, 23.4], facing: 0 },
        { at: [8.0, 22.7], facing: 0 },
        { at: [8.0, 21.3], facing: 0 }, // 4.º (2v2)
      ],
    },
    {
      id: 'aduana',
      door: 'aduana',
      frame: [1, 25, 26, 13],
      spawns: [
        { at: [9.4, 33.4], facing: 0 },
        { at: [9.4, 34.8], facing: 0 },
        { at: [8.0, 34.1], facing: 0 },
        { at: [8.0, 32.7], facing: 0 }, // 4.º (2v2)
      ],
    },
  ],
  defaultEntry: 'porton',

  // Defenders: the yard and the lane east of x = 32, consolidation and the cold store.
  deployment: {
    line: [[32, 3], [32, 25], [24, 25], [24, 37]],
    attackers: [[1, 3, 11, 34]],
    defenders: [[32, 3, 27, 22], [24, 25, 35, 12]],
  },

  paint: [
    { kind: 'site', rect: [47.6, 9.2, 10.6, 9.6], text: 'A', color: '#f2c230' },
    { kind: 'site', rect: [48.2, 30.2, 10.0, 6.2], text: 'B', color: '#f2c230' },
    { kind: 'arrow', at: [27.0, 5.0], size: 1.2, rot: 0, text: 'A', color: '#f2c230' },
    { kind: 'arrow', at: [36.0, 22.4], size: 1.2, rot: 0, text: 'B', color: '#f2c230' },
    { kind: 'text', at: [6.8, 34.8], size: 0.62, text: 'DESPLIEGUE', color: '#e8e2d0' },
    { kind: 'stripes', rect: [10.6, 20.4, 0.5, 4.6], color: '#e3b51e' },
  ],

  props: [
    // --- truck staging: a queue of rigs, the gatehouse, barriers
    { type: 'trailer', at: [4.6, 9.6], rot: 90, color: '#2f6db0' },
    { type: 'trailer', at: [8.4, 13.2], rot: 80, color: '#b0402e' },
    { type: 'van', at: [3.8, 30.0], rot: 90 },
    { type: 'guardBooth', at: [10.4, 18.4], rot: 270 },
    { type: 'barrier', at: [9.6, 25.8], rot: 0 },
    { type: 'barrier', at: [9.6, 31.2], rot: 0 },
    { type: 'cone', at: [10.8, 20.4], rot: 0 },
    { type: 'cone', at: [10.8, 24.8], rot: 0 },
    { type: 'bin', at: [1.8, 36.2], rot: 0 },
    { type: 'car', at: [4.0, 22.0], rot: 90, color: '#d6d2c8' },

    // --- the quay: the crane's legs on their rails, bollards, a coil of mooring line, a lashing cage
    { type: 'craneLeg', at: [24.0, 4.6], rot: 0 },
    { type: 'craneLeg', at: [40.0, 4.6], rot: 0 },
    ...[15, 20.4, 29, 34.6, 45, 51, 56.4].map((x) => ({ type: 'bollard', at: [x, 3.5], rot: 0 })),
    { type: 'barrel', at: [31.2, 5.8], rot: 0 },
    { type: 'pallet', at: [17.2, 5.6], rot: 0 },
    { type: 'crateStack', at: [47.6, 5.4], rot: 0 },
    { type: 'crate', at: [49.0, 5.6], rot: 20 },
    // lashing gear and hatch-cover blocks left on the quay: the only cover in its 47 m
    { type: 'crateStack', at: [19.0, 5.6], rot: 0 },
    { type: 'palletStack', at: [28.0, 5.4], rot: 10, color: '#8fa3b5' },
    { type: 'crateStack', at: [35.6, 5.6], rot: 0 },
    { type: 'crate', at: [37.0, 5.7], rot: -15 },
    { type: 'crateStack', at: [44.0, 5.6], rot: 0 },

    // --- the container yard. West block: three high at the back, a gap where one was pulled
    { type: 'containerStack3', at: [16.4, 8.4], rot: 0, color: '#b0402e', color2: '#2f6db0' },
    { type: 'containerStack', at: [16.4, 10.8], rot: 0, color: '#c98a2a' },
    { type: 'container', at: [23.0, 8.6], rot: 6, color: '#3f7f52' },
    { type: 'containerStack', at: [15.2, 15.8], rot: 90, color: '#8e8a84' },
    { type: 'container', at: [18.0, 16.6], rot: 90, color: '#2f6db0' },
    // middle block: the stripping container open, its cargo on the ground; the dented box apart
    { type: 'containerOpen', at: [27.6, 13.4], rot: 0, color: '#3f7f52' },
    { type: 'palletStack', at: [32.0, 12.6], rot: 15, color: '#c9b48a' },
    { type: 'palletStack', at: [32.2, 14.2], rot: -8, color: '#b9524a' },
    { type: 'crate', at: [33.6, 13.4], rot: 30 },
    { type: 'pallet', at: [31.4, 15.8], rot: 0 },
    { type: 'containerStack', at: [24.6, 17.2], rot: 0, color: '#b0402e' },
    { type: 'containerDented', at: [37.2, 17.4], rot: -12, color: '#c98a2a' },
    { type: 'cone', at: [35.0, 16.0], rot: 0 },
    { type: 'cone', at: [39.6, 15.6], rot: 0 },
    // the reach stacker, caught with a box on its spreader by a two-high block
    { type: 'reachStacker', at: [34.0, 8.6], rot: 0, color: '#2f6db0' },
    { type: 'containerStack', at: [41.2, 9.4], rot: 90, color: '#8e8a84' },
    { type: 'container', at: [38.8, 14.2], rot: 8, color: '#b0402e' }, // set down crooked by the reach stacker
    { type: 'container', at: [43.8, 11.0], rot: 90, color: '#c98a2a' },
    { type: 'containerStack3', at: [43.6, 18.2], rot: 0, color: '#2f6db0', color2: '#b0402e' },
    // --- site A: the reefers plugged in, a generator, a two-high row behind them
    { type: 'reefer', at: [52.2, 10.4], rot: 0 },
    { type: 'reefer', at: [53.0, 16.6], rot: 0, color: '#d8dad4' },
    { type: 'container', at: [55.6, 7.4], rot: 0, color: '#3f7f52' }, // one high: a stack this close to the fence leans out of the frame
    { type: 'generator', at: [48.6, 18.0], rot: 0 },
    { type: 'crate', at: [56.6, 13.2], rot: 0 },
    { type: 'barrel', at: [58.3, 19.4], rot: 0 },
    { type: 'barrel', at: [58.3, 18.6], rot: 0 },

    // --- the truck lane: a parked rig, jersey barriers, a forklift
    { type: 'trailer', at: [22.4, 22.6], rot: 0, color: '#d6d2c8' },
    { type: 'barrier', at: [33.4, 21.0], rot: 10 },
    { type: 'barrier', at: [39.6, 22.4], rot: 0 },
    { type: 'forklift', at: [49.0, 22.4], rot: 90 },
    { type: 'crateStack', at: [53.6, 23.8], rot: 0 },
    { type: 'cone', at: [57.0, 21.0], rot: 0 },

    // --- customs: the scanner, the office, the archive
    { type: 'xrayScanner', at: [15.0, 28.4], rot: 90 },
    { type: 'counter', at: [17.8, 33.8], rot: 90, size: [1.6, 0.65] },
    { type: 'table', at: [14.6, 33.6], rot: 0 },
    { type: 'crateStack', at: [17.4, 36.1], rot: 0 },
    { type: 'bench', at: [13.6, 25.6], rot: 0 },
    { type: 'desk', at: [21.4, 27.2], rot: 0 },
    { type: 'officeChair', at: [21.4, 28.1], rot: 180 },
    { type: 'desk', at: [21.4, 31.4], rot: 180 },
    { type: 'officeChair', at: [21.4, 30.6], rot: 0 },
    { type: 'bookshelf', at: [23.55, 27.4], rot: 270, size: [1.6, 0.4] },
    { type: 'cabinet', at: [19.1, 36.4], rot: 90 },
    { type: 'plant', at: [23.4, 25.6], rot: 0 },

    // --- consolidation: pallet rows being built into a box, a forklift, the wrap station
    { type: 'palletStack', at: [26.4, 27.6], rot: 0, color: '#c9b48a' },
    { type: 'palletStack', at: [27.7, 27.6], rot: 0, color: '#8fa3b5' },
    { type: 'palletStack', at: [26.4, 31.2], rot: 0, color: '#b9524a' },
    { type: 'palletStack', at: [29.6, 33.6], rot: 10, color: '#c9b48a' },
    { type: 'longRack', at: [30.6, 36.2], rot: 0, size: [8.0, 1.0] },
    { type: 'forklift', at: [33.6, 29.4], rot: 0 },
    { type: 'pallet', at: [35.6, 26.2], rot: 0 },
    { type: 'barrel', at: [25.0, 25.7], rot: 0 },

    // --- the cold store hall: forklift lanes, staged pallets, the dock's apron
    { type: 'palletStack', at: [39.0, 26.2], rot: 0, color: '#e3e1d8' },
    { type: 'palletStack', at: [40.3, 26.3], rot: 6, color: '#c9b48a' },
    { type: 'rack', at: [41.2, 30.6], rot: 0 },
    { type: 'forklift', at: [50.6, 27.0], rot: 270 },
    { type: 'crateStack', at: [58.0, 26.0], rot: 0 },
    { type: 'pallet', at: [45.4, 28.4], rot: 90 },
    // the machine room
    { type: 'generator', at: [39.4, 36.2], rot: 0 },
    { type: 'cabinet', at: [44.6, 33.1], rot: 180 },
    { type: 'cabinet', at: [45.25, 33.1], rot: 180 },
    { type: 'toolChest', at: [42.4, 36.5], rot: 180 },
    // the cold room (site B): racks of boxes, the evaporators
    { type: 'coldRack', at: [51.2, 30.2], rot: 0 },
    { type: 'coldRack', at: [51.6, 36.3], rot: 180 },
    { type: 'coldRack', at: [57.4, 31.6], rot: 90 },
    { type: 'coldRack', at: [50.4, 33.4], rot: 90 }, // the middle row: the west doors cannot see the back
    { type: 'crate', at: [54.2, 33.6], rot: 0 },
    { type: 'evaporator', at: [58.5, 34.6], rot: 270 },
    { type: 'evaporator', at: [55.0, 36.5], rot: 180 },
  ],

  defense: {
    A: [
      // Anchor at the fence's corner past the south reefer: the bomb from behind, out of the aisle's line.
      // (31 oct: anchor and trapper pulled back to the fence and one barricade less — the attackers won 34-37 % here.)
      { at: [57.0, 17.0], facing: -150 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // Behind the reefers at the fence: the bomb and the aisle from deep.
      { at: [56.6, 11.0], facing: 200 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'scan', from: 140 * DEG, to: 220 * DEG, period: 6, reactsToNoise: true } },
      // Behind the back row, where the quay meets the yard: holds the quay and the aisle, does not chase.
      { at: [50.6, 7.6], facing: -170 * DEG, weapon: 'rifle', role: 'roamer', behavior: { type: 'hold', reactsToNoise: false } },
      // The lane, by the forklift.
      { at: [51.4, 22.4], facing: 180 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: 160 * DEG, to: 220 * DEG, period: 6, reactsToNoise: true } },
    ],
    B: [
      // Anchor in the cold room's far corner: the west door across the racks.
      { at: [57.4, 34.2], facing: -170 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // By the middle rack: the north door, up close.
      { at: [53.6, 31.0], facing: -75 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'hold', reactsToNoise: true } },
      // In the hall by the staged pallets: the dock door and consolidation's; falls back to the cold room.
      { at: [41.4, 27.4], facing: 170 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true, rotate: { to: [52.0, 32.6], look: 180 * DEG } } },
      // Consolidation, at its window on the lane.
      { at: [34.0, 26.0], facing: -90 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: -150 * DEG, to: -60 * DEG, period: 6, reactsToNoise: true } },
    ],
  },

  aiBarricades: {
    A: ['consol-carril'],
    B: ['aduana-consol', 'consol-maquinas', 'carga'],
  },

  aiTraps: {
    A: [[47.0, 13.6], [52.6, 19.6]],
    B: [[48.0, 31.6], [48.0, 35.4]],
  },

  cameraMounts: [
    { id: 'grua', at: [58.6, 3.4], facing: 170 * DEG }, // the quay from its east end
    { id: 'reefers', at: [58.6, 19.4], facing: -150 * DEG }, // the reefers from the fence's corner
    { id: 'carril', at: [58.6, 24.6], facing: 178 * DEG }, // the truck lane, end to end
    { id: 'porton', at: [12.4, 24.6], facing: -20 * DEG }, // the truck gate from inside (found early)
    { id: 'bodega', at: [37.4, 25.4], facing: 30 * DEG }, // the cold store hall: the dock door and the cold room's
    { id: 'camara', at: [58.6, 36.6], facing: -150 * DEG }, // the cold room and site B
    { id: 'consolidacion', at: [24.4, 36.6], facing: -40 * DEG }, // consolidation from its south-west corner
  ],

  aiCameras: {
    A: ['grua', 'reefers'],
    B: ['camara', 'bodega'],
  },

  aiEntries: {
    A: { muelle: 3, porton: 1, aduana: 1 },
    B: { aduana: 1, porton: 1, muelle: 1 },
  },

  camera: { start: [8, 22], height: 22, frame: [1, 15, 26, 13], defendFrame: [30, 3, 30, 34] },
};
