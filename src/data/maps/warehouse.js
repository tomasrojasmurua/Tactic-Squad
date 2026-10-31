// "Operación Almacén" — Distribuidora Ferrol, pure data (meters, x right, y down).
// Design notes: docs/diseno/mapas-v2.md (4.1).
//
//  A parcel company's regional distribution centre at night, the shift gone
//  half-way through a load. Layout (56 × 34 m):
//    west   staff car park (attacker side), fenced, gates to the two yards
//    north  the truck yard (andén): trucks parked at odd angles, the dock door
//    middle the building: offices, reception and the break room on the west;
//           the racking hall (nave) in the middle, aisles running east-west;
//           the loading dock (site A), dispatch and the forklift workshop (site B) on the east
//    south  the service alley (callejón): bins, a parked car, the workshop's roller door
//
// Three lanes (yard, hall, alley) joined by the building's doors; each entry
// starts on a different one. Dispatch (expedición) joins the two sites: the
// defenders' rotation, and the attackers' way to cut it.
//
// Same format as training.js (the original map; see its header for the conventions).

const DEG = Math.PI / 180;

export default {
  id: 'warehouse',
  name: 'Operación Almacén',
  size: { w: 56, h: 34 },

  traits: ['Tres carriles: andén, nave y callejón', 'Estanterías: pasillos largos y cruces cortos', 'Expedición une los dos sitios por dentro'],
  siteNames: { A: 'el muelle de carga', B: 'el taller' },
  siteTraits: {
    A: ['Portón del andén, paso de carga y expedición', 'Pallets y una carretilla: cobertura baja', 'El paso de carga se ve desde toda la nave'],
    B: ['La nave, expedición y el portón del callejón', 'Bancos y cargadores: rincones junto a puertas', 'Una ventana al callejón'],
  },

  walls: [
    // building shell
    { a: [10, 8], b: [55, 8], t: 0.4 },
    { a: [10, 29], b: [55, 29], t: 0.4 },
    { a: [10, 8], b: [10, 29], t: 0.4 },
    { a: [55, 8], b: [55, 29], t: 0.4 },
    // west block: offices | reception | break room, and its wall on the hall
    { a: [10, 15], b: [22, 15] },
    { a: [10, 21], b: [22, 21] },
    { a: [22, 8], b: [22, 29] },
    // east block: the dock (A) | dispatch | the workshop (B), and its wall on the hall
    { a: [42, 8], b: [42, 29] },
    { a: [42, 17], b: [55, 17] },
    { a: [42, 21.5], b: [55, 21.5] },
    // site fence: the car park, the gates to the yard and the alley, the far ends
    { a: [1, 1], b: [55, 1], t: 0.3, kind: 'fence' },
    { a: [1, 33], b: [55, 33], t: 0.3, kind: 'fence' },
    { a: [1, 1], b: [1, 33], t: 0.3, kind: 'fence' },
    { a: [55, 1], b: [55, 8], t: 0.3, kind: 'fence' },
    { a: [55, 29], b: [55, 33], t: 0.3, kind: 'fence' },
    { a: [10, 1], b: [10, 8], t: 0.3, kind: 'fence' },
    { a: [10, 29], b: [10, 33], t: 0.3, kind: 'fence' },
  ],

  doors: [
    // The three ways in from outside
    { id: 'oficina-anden', at: [13.6, 8], axis: 'h', width: 1.1, hinge: 'min' },
    { id: 'recepcion', at: [10, 18], axis: 'v', width: 1.3, hinge: 'min' },
    { id: 'comedor-callejon', at: [13.6, 29], axis: 'h', width: 1.1, hinge: 'max' },
    // West block
    { id: 'oficina-recepcion', at: [19.6, 15], axis: 'h', width: 1.0, hinge: 'min' },
    { id: 'recepcion-comedor', at: [17.2, 21], axis: 'h', width: 1.0, hinge: 'max' },
    { id: 'oficina-nave', at: [22, 12.4], axis: 'v', width: 1.1, hinge: 'min', barricade: true },
    { id: 'recepcion-nave', at: [22, 18.0], axis: 'v', width: 1.3, hinge: 'max', barricade: true },
    { id: 'comedor-nave', at: [22, 25.8], axis: 'v', width: 1.1, hinge: 'max', barricade: true },
    // East block
    { id: 'porton-anden', at: [47.4, 8], axis: 'h', width: 1.6, hinge: 'min', barricade: true },
    { id: 'expedicion-nave', at: [42, 20.4], axis: 'v', width: 1.0, hinge: 'max', barricade: true },
    { id: 'expedicion-muelle', at: [44.4, 17], axis: 'h', width: 1.0, hinge: 'min', barricade: true },
    { id: 'expedicion-taller', at: [52.6, 21.5], axis: 'h', width: 1.0, hinge: 'max', barricade: true },
    { id: 'taller-nave', at: [42, 25.4], axis: 'v', width: 1.1, hinge: 'min', barricade: true },
    { id: 'porton-callejon', at: [47.8, 29], axis: 'h', width: 1.6, hinge: 'max', barricade: true },
  ],

  // The dock's wide loading gap on the hall, and the fence gates of the car park.
  openings: [
    { id: 'paso-carga', at: [42, 12.3], axis: 'v', width: 2.4 },
    { id: 'reja-anden', at: [10, 4.6], axis: 'v', width: 2.6 },
    { id: 'reja-callejon', at: [10, 31.0], axis: 'v', width: 2.2 },
  ],

  windows: [
    { id: 'ventana-oficina', at: [10, 11.4], axis: 'v', width: 1.6 },
    { id: 'ventana-oficina-anden', at: [18.6, 8], axis: 'h', width: 1.8 },
    { id: 'ventana-comedor', at: [10, 25.0], axis: 'v', width: 1.6 },
    { id: 'ventana-comedor-callejon', at: [18.8, 29], axis: 'h', width: 1.6 },
    { id: 'ventana-expedicion', at: [42, 18.4], axis: 'v', width: 1.2 },
    { id: 'ventana-taller', at: [44.4, 29], axis: 'h', width: 1.4 },
  ],

  rooms: [
    { id: 'sitioA', rect: [43.6, 9.4, 10.2, 6.8] },
    { id: 'sitioB', rect: [45.2, 22.6, 8.8, 5.6] },
    { id: 'aparcamiento', rect: [0, 0, 10, 34] },
    { id: 'anden', rect: [10, 0, 46, 8] },
    { id: 'callejon', rect: [10, 29, 46, 5] },
    { id: 'oficinas', rect: [10, 8, 12, 7] },
    { id: 'recepcion', rect: [10, 15, 12, 6] },
    { id: 'comedor', rect: [10, 21, 12, 8] },
    { id: 'nave', rect: [22, 8, 20, 21] },
    { id: 'muelle', rect: [42, 8, 13, 9] },
    { id: 'expedicion', rect: [42, 17, 13, 4.5] },
    { id: 'taller', rect: [42, 21.5, 13, 7.5] },
  ],

  floors: [
    { rect: [1, 1, 9, 32], material: 'yardAsphalt' },
    { rect: [10, 1, 45, 7], material: 'yardAsphalt' },
    { rect: [10, 29, 45, 4], material: 'yardAsphalt' },
    { rect: [10, 8, 12, 7], material: 'officeCarpet' },
    { rect: [10, 15, 12, 6], material: 'hallLino' },
    { rect: [10, 21, 12, 8], material: 'kitchenChecker' },
    { rect: [22, 8, 20, 21], material: 'siteConcrete' },
    { rect: [42, 8, 13, 9], material: 'siteConcrete' },
    { rect: [42, 17, 13, 4.5], material: 'hallLino' },
    { rect: [42, 21.5, 13, 7.5], material: 'siteConcrete' },
  ],

  zones: { spawn: { rect: [3, 15, 5, 6] } },

  sites: [
    { id: 'A', rect: [43.6, 9.4, 10.2, 6.8], bomb: [50.2, 13.2] },
    { id: 'B', rect: [45.2, 22.6, 8.8, 5.6], bomb: [51.4, 26.4] },
  ],

  entries: [
    {
      id: 'anden',
      door: 'oficina-anden',
      frame: [8, 1, 22, 14],
      spawns: [
        { at: [12.4, 4.4], facing: 90 * DEG },
        { at: [13.8, 4.4], facing: 90 * DEG },
        { at: [13.1, 3.0], facing: 90 * DEG },
        { at: [14.5, 3.0], facing: 90 * DEG }, // 4.º (2v2)
      ],
    },
    {
      id: 'recepcion',
      door: 'recepcion',
      frame: [2, 11, 24, 13],
      spawns: [
        { at: [6.6, 17.3], facing: 0 },
        { at: [6.6, 18.7], facing: 0 },
        { at: [5.2, 18.0], facing: 0 },
        { at: [5.2, 16.6], facing: 0 }, // 4.º (2v2)
      ],
    },
    {
      id: 'callejon',
      door: 'comedor-callejon',
      frame: [8, 20, 22, 14],
      spawns: [
        { at: [12.4, 31.1], facing: -90 * DEG },
        { at: [13.8, 31.1], facing: -90 * DEG },
        { at: [13.1, 32.3], facing: -90 * DEG },
        { at: [13.1, 30.1], facing: -90 * DEG }, // 4.º (2v2)
      ],
    },
  ],
  defaultEntry: 'recepcion',

  // Defenders: the hall and the east block, and the east ends of the yard and the alley.
  deployment: {
    line: [[30, 1], [30, 8], [22, 8], [22, 29], [30, 29], [30, 33]],
    attackers: [[1, 1, 9, 32], [10, 1, 6, 7], [10, 29, 6, 4]],
    defenders: [[22, 8, 33, 21], [34, 1, 21, 7], [34, 29, 21, 4]],
  },

  paint: [
    { kind: 'site', rect: [43.6, 9.4, 10.2, 6.8], text: 'A', color: '#f2c230' },
    { kind: 'site', rect: [45.2, 22.6, 8.8, 5.6], text: 'B', color: '#f2c230' },
    { kind: 'arrow', at: [38.6, 12.6], size: 1.2, rot: 0, text: 'A', color: '#f2c230' },
    { kind: 'arrow', at: [38.6, 24.6], size: 1.2, rot: 0, text: 'B', color: '#f2c230' },
    { kind: 'text', at: [4.6, 22.6], size: 0.62, text: 'DESPLIEGUE', color: '#e8e2d0' },
    { kind: 'stripes', rect: [8.4, 15.6, 0.5, 4.8], color: '#e3b51e' },
    { kind: 'text', at: [24.6, 13.0], size: 0.5, text: 'PASILLO 1', color: '#e8e2d0' },
    { kind: 'text', at: [24.6, 16.5], size: 0.5, text: 'PASILLO 2', color: '#e8e2d0' },
    { kind: 'text', at: [36.4, 21.0], size: 0.5, text: 'PASILLO 3', color: '#e8e2d0' },
    { kind: 'text', at: [24.6, 25.0], size: 0.5, text: 'PASILLO 4', color: '#e8e2d0' },
  ],

  props: [
    // --- staff car park: cars nose-in at odd spots, the company van, a barrier
    { type: 'van', at: [4.2, 6.2], rot: 90 },
    { type: 'car', at: [3.9, 12.4], rot: 0, color: '#2f6db0' },
    { type: 'car', at: [3.4, 25.2], rot: 0, color: '#d6d2c8' },
    { type: 'car', at: [7.4, 28.8], rot: 90, color: '#8e2f3d' },
    { type: 'barrier', at: [8.0, 13.6], rot: 90 },
    { type: 'cone', at: [8.6, 16.0], rot: 0 },
    { type: 'cone', at: [8.6, 20.2], rot: 0 },
    { type: 'bin', at: [1.7, 32.2], rot: 0 },

    // --- the truck yard (andén): two rigs left where they stopped, the dock's waiting trailer
    { type: 'trailer', at: [22.6, 3.4], rot: 0, color: '#d6d2c8' },
    { type: 'trailer', at: [37.2, 5.4], rot: 180, color: '#2f6db0' },
    { type: 'pallet', at: [29.6, 2.2], rot: 90 },
    { type: 'palletStack', at: [30.4, 6.6], rot: 0, color: '#c9b48a' },
    { type: 'palletStack', at: [31.6, 6.7], rot: 10, color: '#8fa3b5' },
    { type: 'dumpster', at: [16.4, 1.9], rot: 0 },
    { type: 'barrier', at: [44.2, 4.2], rot: 0 },
    { type: 'barrier', at: [51.8, 2.4], rot: 0 },
    { type: 'cone', at: [46.0, 6.6], rot: 0 },
    { type: 'cone', at: [48.8, 6.6], rot: 0 },
    { type: 'barrel', at: [54.2, 6.9], rot: 0 },
    { type: 'barrel', at: [53.5, 7.2], rot: 0 },

    // --- offices: open plan, a manager's corner, the printer
    { type: 'desk', at: [12.6, 10.3], rot: 0 },
    { type: 'officeChair', at: [12.6, 11.2], rot: 180 },
    { type: 'desk', at: [14.4, 10.3], rot: 0 },
    { type: 'officeChair', at: [14.5, 11.2], rot: 200 },
    { type: 'desk', at: [12.6, 13.6], rot: 180 },
    { type: 'officeChair', at: [12.7, 12.75], rot: -10 },
    { type: 'desk', at: [17.4, 12.2], rot: 90 },
    { type: 'officeChair', at: [16.5, 12.3], rot: 90 },
    { type: 'bookshelf', at: [20.0, 8.45], rot: 0 },
    { type: 'cabinet', at: [21.5, 9.6], rot: 270 },
    { type: 'cabinet', at: [21.5, 10.25], rot: 270 },
    { type: 'plant', at: [10.6, 14.35], rot: 0 },
    { type: 'bin', at: [16.0, 14.4], rot: 0 },

    // --- reception: the desk facing the door, benches, the packages counter
    { type: 'receptionDesk', at: [15.6, 18.6], rot: 270, size: [3.0, 0.8] },
    { type: 'officeChair', at: [16.5, 18.6], rot: 270 },
    { type: 'bench', at: [11.2, 15.6], rot: 0 },
    { type: 'plant', at: [10.6, 20.4], rot: 0 },
    { type: 'counter', at: [20.6, 16.0], rot: 90, size: [1.6, 0.65] },

    // --- break room: tables, the vending corner, the kitchenette
    { type: 'table', at: [13.4, 24.0], rot: 0 },
    { type: 'chair', at: [12.9, 23.2], rot: 90 },
    { type: 'chair', at: [13.9, 24.8], rot: 260 },
    { type: 'table', at: [16.6, 26.2], rot: 90 },
    { type: 'chair', at: [15.8, 25.8], rot: 0 },
    { type: 'chair', at: [17.4, 26.6], rot: 180 },
    { type: 'vending', at: [21.35, 22.2], rot: 270 },
    { type: 'vending', at: [21.35, 23.3], rot: 270 },
    { type: 'counter', at: [11.4, 28.4], rot: 0, size: [2.4, 0.65] },
    { type: 'fridge', at: [16.0, 28.38], rot: 0 },
    { type: 'sink', at: [17.0, 28.45], rot: 0 },

    // --- the racking hall: four rows east-west, broken by a cross-aisle, the emptied rack and a forklift mid-pick
    { type: 'longRack', at: [28.6, 10.4], rot: 0 },
    { type: 'longRack', at: [37.6, 10.4], rot: 0, size: [6.0, 1.1] },
    { type: 'longRack', at: [27.0, 15.0], rot: 0, size: [6.0, 1.1] },
    { type: 'longRack', at: [36.8, 15.0], rot: 0 },
    { type: 'longRack', at: [37.4, 19.0], rot: 0, size: [7.0, 1.1] },
    { type: 'longRack', at: [26.4, 23.0], rot: 0, size: [6.0, 1.1] },
    { type: 'longRack', at: [35.4, 23.0], rot: 0 },
    // the emptied rack (pasillo 3, west): its stock on the floor, waiting for the count
    { type: 'pallet', at: [25.0, 19.0], rot: 0 },
    { type: 'palletStack', at: [26.4, 19.0], rot: 0, color: '#b9524a' },
    { type: 'palletStack', at: [27.7, 18.8], rot: 8, color: '#c9b48a' },
    { type: 'palletStack', at: [29.6, 19.3], rot: 0, color: '#8fa3b5' },
    { type: 'forklift', at: [32.3, 20.9], rot: 270 },
    { type: 'palletStack', at: [33.8, 12.6], rot: 0, color: '#e3e1d8' },
    { type: 'crateStack', at: [38.4, 13.6], rot: 0 }, // stock waiting by aisle 1: breaks the long look from the dock
    { type: 'palletStack', at: [30.6, 26.8], rot: 0, color: '#c9b48a' },
    { type: 'palletStack', at: [31.8, 27.0], rot: 12, color: '#b9524a' },
    { type: 'pallet', at: [38.8, 27.6], rot: 90 },
    { type: 'crateStack', at: [24.4, 27.6], rot: 0 },
    { type: 'barrel', at: [40.9, 17.4], rot: 0 },
    { type: 'barrel', at: [41.2, 16.8], rot: 0 },

    // --- the loading dock (site A): wrapped pallets staged for the trailer, a forklift parked by the bay
    { type: 'palletStack', at: [46.6, 10.8], rot: 0, color: '#c9b48a' },
    { type: 'palletStack', at: [47.9, 10.9], rot: 0, color: '#c9b48a' },
    { type: 'palletStack', at: [46.7, 12.0], rot: 0, color: '#8fa3b5' },
    { type: 'palletStack', at: [51.9, 14.9], rot: 0, color: '#b9524a' },
    { type: 'pallet', at: [53.3, 14.9], rot: 0 },
    { type: 'forklift', at: [53.4, 10.6], rot: 180 },
    { type: 'crateStack', at: [47.4, 15.9], rot: 0 },
    { type: 'crate', at: [48.8, 16.0], rot: 0 },
    { type: 'rack', at: [54.3, 13.4], rot: 90 },
    { type: 'barrel', at: [43.0, 9.0], rot: 0 },

    // --- dispatch: the dispatcher's desks, the label printer, the waybill files
    { type: 'desk', at: [47.0, 19.1], rot: 0 },
    { type: 'officeChair', at: [47.0, 20.0], rot: 180 },
    { type: 'desk', at: [49.0, 19.1], rot: 0 },
    { type: 'officeChair', at: [49.1, 20.0], rot: 190 },
    { type: 'cabinet', at: [54.45, 18.2], rot: 270 },
    { type: 'cabinet', at: [54.45, 18.85], rot: 270 },
    { type: 'bookshelf', at: [51.6, 17.4], rot: 180, size: [1.6, 0.4] },
    { type: 'plant', at: [50.6, 21.0], rot: 0 },

    // --- the forklift workshop (site B): benches, the chargers, a forklift with its mast off
    { type: 'workbench', at: [46.2, 22.15], rot: 0 },
    { type: 'toolChest', at: [48.0, 22.05], rot: 0 },
    { type: 'forklift', at: [48.6, 25.4], rot: 90 },
    { type: 'charger', at: [54.5, 23.4], rot: 270 },
    { type: 'charger', at: [54.5, 24.6], rot: 270 },
    { type: 'workbench', at: [43.0, 27.4], rot: 90 },
    { type: 'crateStack', at: [53.6, 28.1], rot: 0 },
    { type: 'barrel', at: [52.2, 28.5], rot: 0 },
    { type: 'pallet', at: [51.6, 23.4], rot: 0 },

    // --- the service alley: bins, a parked car, the workshop's scrap
    { type: 'dumpster', at: [20.4, 31.9], rot: 0 },
    { type: 'dumpster', at: [27.6, 30.2], rot: 0 },
    { type: 'car', at: [35.4, 31.7], rot: 0, color: '#3f7f52' },
    { type: 'palletStack', at: [41.6, 30.3], rot: 0, color: '#8fa3b5' },
    { type: 'barrel', at: [44.6, 32.2], rot: 0 },
    { type: 'barrel', at: [45.3, 32.3], rot: 0 },
    { type: 'crate', at: [53.6, 31.5], rot: 0 },
  ],

  defense: {
    A: [
      // Anchor deep in the dock, past the staged pallets: the loading gap at an angle.
      { at: [51.8, 11.2], facing: 172 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // Behind the crates by dispatch's door: the dock door from the yard, and the gap.
      { at: [50.4, 9.6], facing: 170 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'scan', from: 140 * DEG, to: 195 * DEG, period: 6, reactsToNoise: true } },
      // In the hall on aisle 1, looking west: the first contact; falls back into the dock.
      { at: [44.0, 9.8], facing: 120 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true, rotate: { to: [47.6, 13.8], look: 180 * DEG } } },
      // Dispatch, at its window on the hall.
      { at: [43.2, 19.4], facing: 180 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: 150 * DEG, to: 210 * DEG, period: 6, reactsToNoise: true } },
    ],
    B: [
      // Anchor behind the chargers' corner: the hall door across the workshop.
      // (31 oct: the three posts of B pulled into the workshop — the attackers won 61-64 % here.)
      { at: [53.4, 25.3], facing: 178 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // Off the hall door's line, by the dispatch door: the hall door at an angle, 5 m.
      { at: [47.0, 23.2], facing: 156 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'hold', reactsToNoise: true } },
      // In the workshop by the roller door: the alley door and the hall door's back.
      { at: [49.0, 27.6], facing: 210 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true } },
      // Dispatch, at its window on the hall.
      { at: [43.2, 19.4], facing: 180 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: 150 * DEG, to: 210 * DEG, period: 6, reactsToNoise: true } },
    ],
  },

  // Noisy floor (heard even sneaking): glass from a broken office window past reception's hall
  // door, the dock's steel plate inside the dock door, gravel by the roller door in the alley.
  debris: [
    { kind: 'glass', rect: [22.6, 16.6, 1.8, 2.8] },
    { kind: 'metal', rect: [46.2, 8.6, 2.4, 1.6] },
    { kind: 'gravel', rect: [46.4, 29.6, 2.8, 1.8] },
  ],

  aiBarricades: {
    A: ['porton-anden', 'oficina-nave'],
    B: ['expedicion-nave', 'recepcion-nave', 'porton-callejon'],
  },

  aiTraps: {
    A: [[43.2, 12.3], [47.4, 9.0]],
    B: [[43.0, 25.4], [47.8, 28.0]],
  },

  cameraMounts: [
    { id: 'anden', at: [33.4, 7.6], facing: 180 * DEG }, // the truck yard from the building's wall
    { id: 'nave-norte', at: [41.6, 8.4], facing: 165 * DEG }, // the hall from its north-east corner: aisles 1-2
    { id: 'nave-sur', at: [41.6, 28.6], facing: -165 * DEG }, // the hall from its south-east corner: aisles 3-4
    { id: 'muelle', at: [54.6, 8.4], facing: 150 * DEG }, // the dock: the loading gap and the dock door
    { id: 'expedicion', at: [54.6, 20.2], facing: -175 * DEG }, // dispatch, end to end
    { id: 'taller', at: [54.6, 28.6], facing: -150 * DEG }, // the workshop: the hall door and the roller door
    { id: 'callejon', at: [33.4, 29.4], facing: 180 * DEG }, // the alley from the building's wall
  ],

  aiCameras: {
    A: ['nave-norte', 'muelle'],
    B: ['taller', 'nave-sur'],
  },

  aiEntries: {
    A: { recepcion: 2, anden: 1 },
    B: { recepcion: 3, callejon: 1 },
  },

  camera: { start: [12, 18], height: 21, frame: [2, 11, 24, 13], defendFrame: [24, 4, 31, 28] },
};
