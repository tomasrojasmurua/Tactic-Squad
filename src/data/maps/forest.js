// "Operación Aserradero" — a logging camp in the forest, pure data (meters, x right, y down).
//
//  A sawmill deep in a pine forest at night (58 × 36 m). Layout:
//    west   the forest's edge (attacker side), outside the camp's fence: three gates,
//           the north trail (sendero), the logging road (camino) and the creek (arroyo)
//    middle open forest: pines, boulders, felled logs and stumps; the dirt road
//           cuts it east to west; a tool shed (cobertizo) in the south
//    east   the camp: the sawmill shed (site A) with its office and its store
//           (no light) at the north, the log yard in the middle, the ranger's
//           lodge (site B) at the south with its kitchen, bunk room, washroom
//           and the pantry (no light)
//
// The forest is the long open middle: cover is trunks and rocks, never walls.
// The log yard joins the two sites outside; the north alley between the fence
// and the shed is the flank to the sawmill's office.
//
// Same format as training.js (see its header for the conventions).

const DEG = Math.PI / 180;

/** Pines of the forest: the camp's middle, the attackers' edge. */
const PINES = [
  [15, 3.2], [19.5, 5], [16.8, 9.4], [22, 2.6], [24.4, 7.8], [20.2, 12.6], [27.6, 4.4], [29.8, 10.2], [26, 13.4], [32.6, 6.6], [34.4, 2.8], [14.6, 13.6], [35.2, 10.6],
  [14.6, 22.4], [18.4, 24.6], [16.4, 33.2], [21, 21.8], [20.6, 31.2], [32.4, 22.6], [34.6, 27.4], [31.6, 33.2], [22.8, 33.6], [35.4, 32.0], [27, 22.6], [18, 28.4],
  [4, 3.4], [7.6, 10.8], [3.2, 13.4], [5.4, 26.4], [3, 31.6], [8.6, 33.6], [2.6, 8], [4.6, 22.0],
];

export default {
  id: 'forest',
  name: 'Operación Aserradero',
  size: { w: 58, h: 36 },

  // Timber walls, a dark wood baseboard (render only).
  palette: { wall: '#9b7a55', exterior: '#5e4630', baseboard: '#3a2a1c' },

  traits: ['Bosque abierto: troncos, rocas y pinos', 'Un camino de tierra parte el bosque', 'El patio de troncos une los dos sitios'],
  siteNames: { A: 'la sierra', B: 'la cabaña' },
  siteTraits: {
    A: ['Portón oeste, patio y la oficina al norte', 'La sierra y los troncos: cobertura baja', 'Un callejón al norte, junto a la valla'],
    B: ['El porche, el patio y la despensa', 'Cuartos chicos: rincones a dos metros', 'La despensa está a oscuras'],
  },

  walls: [
    // the camp's fence: around the map, and its gate line on the forest's edge
    { a: [1, 1], b: [57, 1], t: 0.3, kind: 'fence' },
    { a: [1, 35], b: [57, 35], t: 0.3, kind: 'fence' },
    { a: [1, 1], b: [1, 35], t: 0.3, kind: 'fence' },
    { a: [57, 1], b: [57, 35], t: 0.3, kind: 'fence' },
    { a: [12, 1], b: [12, 35], t: 0.3, kind: 'fence' },
    // the sawmill shed: the hall | the office (north) and the store (south)
    { a: [38, 4], b: [57, 4], t: 0.4 },
    { a: [38, 14], b: [57, 14], t: 0.4 },
    { a: [38, 4], b: [38, 14], t: 0.4 },
    { a: [51, 4], b: [51, 14] },
    { a: [51, 9], b: [57, 9] },
    // the ranger's lodge: common room | kitchen and bunks; pantry and washroom to the south
    { a: [40, 22], b: [57, 22], t: 0.4 },
    { a: [40, 22], b: [40, 35], t: 0.4 },
    { a: [49, 22], b: [49, 35] },
    { a: [49, 27], b: [57, 27] },
    { a: [40, 29], b: [49, 29] },
    { a: [45, 29], b: [45, 35] },
    // the tool shed in the forest
    { a: [24, 26], b: [30, 26], t: 0.25 },
    { a: [24, 31], b: [30, 31], t: 0.25 },
    { a: [24, 26], b: [24, 31], t: 0.25 },
    { a: [30, 26], b: [30, 31], t: 0.25 },
  ],

  doors: [
    // The camp's three gates
    { id: 'sendero', at: [12, 6], axis: 'v', width: 1.4, hinge: 'min' },
    { id: 'camino', at: [12, 18], axis: 'v', width: 1.6, hinge: 'max' },
    { id: 'arroyo', at: [12, 30], axis: 'v', width: 1.4, hinge: 'min' },
    // The sawmill
    { id: 'aserradero-oeste', at: [38, 8], axis: 'v', width: 1.6, hinge: 'min', barricade: true },
    { id: 'aserradero-sur', at: [43.6, 14], axis: 'h', width: 1.6, hinge: 'max', barricade: true },
    { id: 'aserradero-norte', at: [54, 4], axis: 'h', width: 1.1, hinge: 'min', barricade: true },
    { id: 'oficina-sierra', at: [51, 6.6], axis: 'v', width: 1.0, hinge: 'max', barricade: true },
    { id: 'oficina-almacen', at: [54, 9], axis: 'h', width: 1.0, hinge: 'min', barricade: true },
    { id: 'almacen-sierra', at: [51, 11.8], axis: 'v', width: 1.1, hinge: 'min', barricade: true },
    { id: 'almacen-patio', at: [54.4, 14], axis: 'h', width: 1.2, hinge: 'max', barricade: true },
    // The lodge
    { id: 'cabana-porche', at: [40, 25.2], axis: 'v', width: 1.2, hinge: 'min', barricade: true },
    { id: 'cabana-patio', at: [46.2, 22], axis: 'h', width: 1.2, hinge: 'max', barricade: true },
    { id: 'despensa-oeste', at: [40, 32], axis: 'v', width: 1.0, hinge: 'max', barricade: true },
    { id: 'comun-cocina', at: [49, 24.6], axis: 'v', width: 1.0, hinge: 'min', barricade: true },
    { id: 'cocina-literas', at: [53, 27], axis: 'h', width: 1.0, hinge: 'max', barricade: true },
    { id: 'comun-despensa', at: [42.6, 29], axis: 'h', width: 1.0, hinge: 'min', barricade: true },
    { id: 'comun-bano', at: [47.2, 29], axis: 'h', width: 0.95, hinge: 'max', barricade: true },
    { id: 'bano-literas', at: [49, 32], axis: 'v', width: 0.95, hinge: 'min', barricade: true },
    // The tool shed
    { id: 'cobertizo-norte', at: [27, 26], axis: 'h', width: 1.1, hinge: 'min' },
    { id: 'cobertizo-oeste', at: [24, 28.6], axis: 'v', width: 1.0, hinge: 'max' },
  ],

  openings: [],

  windows: [
    { id: 'ventana-sierra-oeste', at: [38, 11.8], axis: 'v', width: 1.4 },
    { id: 'ventana-sierra-norte', at: [41, 4], axis: 'h', width: 1.6 },
    { id: 'ventana-cabana', at: [40, 27.6], axis: 'v', width: 1.2 },
    { id: 'ventana-cocina', at: [53.4, 22], axis: 'h', width: 1.4 },
  ],

  rooms: [
    { id: 'sitioA', rect: [40.6, 5.0, 9.4, 8.2] },
    { id: 'sitioB', rect: [41, 23, 7, 5] },
    { id: 'lindero', rect: [1, 1, 11, 34] },
    { id: 'callejonNorte', rect: [36, 1, 21, 3] },
    { id: 'aserradero', rect: [38, 4, 13, 10] },
    { id: 'oficinaSierra', rect: [51, 4, 6, 5] },
    { id: 'almacenSierra', rect: [51, 9, 6, 5] },
    { id: 'patio', rect: [36, 14, 21, 8] },
    { id: 'comun', rect: [40, 22, 9, 7] },
    { id: 'cocinaCabana', rect: [49, 22, 8, 5] },
    { id: 'literas', rect: [49, 27, 8, 8] },
    { id: 'despensa', rect: [40, 29, 5, 6] },
    { id: 'banoCabana', rect: [45, 29, 4, 6] },
    { id: 'cobertizo', rect: [24, 26, 6, 5] },
    { id: 'camino', rect: [12, 16.4, 24, 3.4] },
    { id: 'bosqueNorte', rect: [12, 1, 26, 15.4] },
    { id: 'bosqueSur', rect: [12, 19.8, 28, 15.2] },
  ],

  // Rooms with no light at night (config/balance.js NIGHT): seen into only up close or with a flashlight.
  dark: ['almacenSierra', 'despensa'],

  floors: [
    { rect: [1, 1, 56, 34], material: 'forestFloor' },
    { rect: [1, 16.8, 37, 2.4], material: 'forestPath' },
    { rect: [36, 14, 21, 8], material: 'forestPath' },
    { rect: [38, 4, 13, 10], material: 'millConcrete' },
    { rect: [51, 4, 6, 5], material: 'cabinPlanks' },
    { rect: [51, 9, 6, 5], material: 'millConcrete' },
    { rect: [40, 22, 17, 13], material: 'cabinPlanks' },
    { rect: [41.6, 23.4, 6, 4], material: 'cabinRug' },
    { rect: [45, 29, 4, 6], material: 'bathTiles' },
    { rect: [51.2, 29.4, 2.6, 3.2], material: 'cabinRug' },
    { rect: [24, 26, 6, 5], material: 'cabinPlanks' },
  ],

  zones: { spawn: { rect: [3, 15, 6, 6] } },

  sites: [
    { id: 'A', rect: [40.6, 5.0, 9.4, 8.2], bomb: [46.0, 10.6] },
    { id: 'B', rect: [41, 23, 7, 5], bomb: [45.0, 26.4] },
  ],

  entries: [
    {
      id: 'sendero',
      door: 'sendero',
      frame: [1, 1, 26, 13],
      spawns: [
        { at: [9.4, 5.2], facing: 0 },
        { at: [9.4, 6.8], facing: 0 },
        { at: [8.0, 6.0], facing: 0 },
        { at: [8.0, 4.4], facing: 0 }, // 4.º (2v2)
      ],
    },
    {
      id: 'camino',
      door: 'camino',
      frame: [1, 11.5, 26, 13],
      spawns: [
        { at: [9.4, 17.2], facing: 0 },
        { at: [9.4, 18.8], facing: 0 },
        { at: [8.0, 18.0], facing: 0 },
        { at: [8.0, 16.4], facing: 0 }, // 4.º (2v2)
      ],
    },
    {
      id: 'arroyo',
      door: 'arroyo',
      frame: [1, 22, 26, 13],
      spawns: [
        { at: [9.4, 29.2], facing: 0 },
        { at: [9.4, 30.8], facing: 0 },
        { at: [8.0, 30.0], facing: 0 },
        { at: [8.0, 31.6], facing: 0 }, // 4.º (2v2)
      ],
    },
  ],
  defaultEntry: 'camino',

  deployment: {
    line: [[35, 1], [35, 35]],
    attackers: [[1, 1, 11, 34]],
    defenders: [[35, 1, 22, 34]],
  },

  paint: [
    { kind: 'site', rect: [40.6, 5.0, 9.4, 8.2], text: 'A', color: '#f2c230' },
    { kind: 'site', rect: [41, 23, 7, 5], text: 'B', color: '#f2c230' },
    { kind: 'arrow', at: [36.2, 8.0], size: 1.2, rot: 0, text: 'A', color: '#f2c230' },
    { kind: 'arrow', at: [37.6, 25.2], size: 1.2, rot: 0, text: 'B', color: '#f2c230' },
    { kind: 'text', at: [6.0, 21.0], size: 0.62, text: 'DESPLIEGUE', color: '#e8e2d0' },
    { kind: 'text', at: [24.0, 17.0], size: 0.5, text: 'CAMINO', color: '#e8e2d0' },
    { kind: 'text', at: [44.0, 2.4], size: 0.5, text: 'CALLEJÓN', color: '#e8e2d0' },
    { kind: 'text', at: [46.0, 21.0], size: 0.5, text: 'PATIO', color: '#e8e2d0' },
  ],

  props: [
    ...PINES.map(([x, y]) => ({ type: 'pine', at: [x, y], rot: (x * 37 + y * 11) % 360 })),
    ...[[18.2, 7.2], [25.8, 10.4], [30.4, 8.4], [17, 21.6], [29.4, 23.8], [33.4, 30.2], [21.6, 15.0], [6.4, 14.6], [3.8, 28.6]].map(([x, y]) => ({ type: 'bush', at: [x, y], rot: (x * 23) % 180 })),
    { type: 'rock', at: [23.2, 15.2], rot: 20 },
    { type: 'rock', at: [28.6, 15.6], rot: -30 },
    { type: 'rock', at: [26.2, 20.8], rot: 60 },
    { type: 'rock', at: [33.8, 20.4], rot: 10 },
    { type: 'boulder', at: [21.6, 9.0], rot: 20 },
    { type: 'boulder', at: [17.4, 26.6], rot: -15 },
    { type: 'boulder', at: [33.2, 13.8], rot: 35 },
    { type: 'boulder', at: [31.6, 28.4], rot: 80 },
    { type: 'stump', at: [19, 15.6], rot: 0 },
    { type: 'stump', at: [25, 20.4], rot: 0 },
    { type: 'stump', at: [30, 15.4], rot: 0 },
    { type: 'stump', at: [22.6, 24.2], rot: 0 },
    { type: 'logPile', at: [26.8, 15.6], rot: 0 },
    { type: 'logPile', at: [18.6, 20.6], rot: 0 },
    { type: 'logPile', at: [35.4, 24.8], rot: 90 },
    { type: 'van', at: [5.0, 20.0], rot: 90 },

    // the sawmill: the head saw, logs waiting for it, the bench
    { type: 'sawBench', at: [44.0, 7.2], rot: 0 },
    { type: 'logPile', at: [41.2, 5.2], rot: 0 },
    { type: 'crateStack', at: [49.6, 5.0], rot: 0 },
    { type: 'barrel', at: [39.0, 13.2], rot: 0 },
    { type: 'workbench', at: [47.6, 13.3], rot: 0 },
    { type: 'toolChest', at: [50.3, 9.4], rot: 90 },
    { type: 'pallet', at: [40.6, 9.6], rot: 15 },
    // its office and store
    { type: 'desk', at: [55.6, 6.6], rot: 90 },
    { type: 'officeChair', at: [54.7, 6.6], rot: 270 },
    { type: 'cabinet', at: [51.6, 8.4], rot: 90 },
    { type: 'crateStack', at: [56, 10.4], rot: 0 },
    { type: 'barrel', at: [56.4, 13.2], rot: 0 },
    { type: 'pallet', at: [52.4, 13.0], rot: 0 },
    { type: 'crate', at: [54.2, 11.6], rot: 25 },

    // the log yard
    { type: 'logStack', at: [41.4, 17.6], rot: 0 },
    { type: 'logStack', at: [52.6, 19.0], rot: 0 },
    { type: 'logPile', at: [47.4, 17.0], rot: 0 },
    { type: 'forklift', at: [50.6, 15.6], rot: 90 },
    { type: 'woodpile', at: [56.2, 16.0], rot: 90 },

    // the lodge: common room, kitchen, bunks, washroom, pantry
    { type: 'table', at: [44.4, 24.4], rot: 0 },
    { type: 'chair', at: [43.4, 23.6], rot: 0 },
    { type: 'chair', at: [45.4, 25.2], rot: 180 },
    { type: 'armchair', at: [41.2, 23.2], rot: 135 },
    { type: 'stove', at: [48.3, 26.2], rot: 270 },
    { type: 'counter', at: [51.6, 22.6], rot: 0 },
    { type: 'stove', at: [55.6, 22.6], rot: 0 },
    { type: 'fridge', at: [56.4, 25.8], rot: 270 },
    { type: 'bunkBed', at: [55.6, 29.0], rot: 0 },
    { type: 'bunkBed', at: [55.6, 33.6], rot: 0 },
    { type: 'bunkBed', at: [51.0, 34.0], rot: 0 },
    { type: 'bunkBed', at: [55.6, 31.3], rot: 0 },
    { type: 'wardrobe', at: [50.2, 30.0], rot: 90 },
    { type: 'nightstand', at: [54.0, 34.4], rot: 0 },
    { type: 'table', at: [52.6, 25.2], rot: 0 },
    { type: 'chair', at: [51.4, 25.2], rot: 90 },
    { type: 'chair', at: [53.8, 25.2], rot: 270 },
    { type: 'sink', at: [53.9, 22.6], rot: 0 },
    { type: 'bench', at: [38.6, 27.2], rot: 90 },
    { type: 'woodpile', at: [38.9, 29.6], rot: 90 },
    { type: 'toilet', at: [48.3, 34.2], rot: 270 },
    { type: 'washbasin', at: [45.6, 31.6], rot: 90 },
    { type: 'crateStack', at: [42.8, 34.1], rot: 0 },
    { type: 'barrel', at: [44.2, 34.2], rot: 0 },
    { type: 'cabinet', at: [44.5, 30.8], rot: 270 },

    // the tool shed
    { type: 'workbench', at: [27, 30.4], rot: 0 },
    { type: 'toolChest', at: [29.4, 27.0], rot: 270 },
    { type: 'barrel', at: [24.8, 30.4], rot: 0 },
  ],

  defense: {
    A: [
      // Anchor at the hall's back by the store door: the west door across the saw, the south door.
      { at: [49.6, 12.8], facing: -158 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // Deep in the hall behind the crates: the west door across the saw.
      // (1 nov: by the west window, on top of the door, the attackers won 21-22 % here.)
      { at: [47.6, 5.6], facing: 200 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'scan', from: 160 * DEG, to: 220 * DEG, period: 6, reactsToNoise: true } },
      // In the yard by the logs: the road's end; falls back into the hall.
      { at: [46.0, 15.6], facing: 180 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true, rotate: { to: [47.2, 12.6], look: 180 * DEG } } },
      // The store: the office's north door.
      { at: [55.4, 11.6], facing: -120 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: -150 * DEG, to: -90 * DEG, period: 6, reactsToNoise: true } },
    ],
    B: [
      // Anchor in the kitchen by its door: the common room at an angle.
      // (1 nov: at the kitchen's far end the attackers won 55-58 % here.)
      { at: [51.6, 23.4], facing: 190 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // In the common room's corner: the porch door.
      { at: [47.8, 23.2], facing: 165 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'hold', reactsToNoise: true } },
      // In the yard by the logs: the road's end; falls back into the common room.
      { at: [44.4, 19.8], facing: 180 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true, rotate: { to: [47.6, 27.6], look: 180 * DEG } } },
      // The bunk room: the washroom door.
      { at: [53.2, 31.8], facing: 180 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: 150 * DEG, to: 210 * DEG, period: 6, reactsToNoise: true } },
    ],
  },

  // Noisy floor: gravel where the road meets the yard and by the lodge's porch, the saw's steel plate.
  debris: [
    { kind: 'gravel', rect: [33.0, 16.8, 3.0, 2.4] },
    { kind: 'metal', rect: [38.8, 6.6, 1.4, 1.6] },
    { kind: 'gravel', rect: [36.8, 24.2, 2.2, 2.0] },
  ],

  aiBarricades: {
    A: ['aserradero-norte'], // 1 nov: on the yard door the attackers won 40-43 % here
    B: ['despensa-oeste'],
  },

  aiTraps: {
    A: [[39.8, 9.6], [44.0, 12.8]],
    B: [[41.4, 25.4], [46.2, 23.4]],
  },

  cameraMounts: [
    { id: 'patio', at: [56.6, 14.6], facing: 160 * DEG }, // the log yard from its east end
    { id: 'sierra', at: [50.6, 4.6], facing: 150 * DEG }, // the hall: the saw and the west door
    { id: 'callejon', at: [56.6, 1.6], facing: 180 * DEG }, // the north alley, end to end
    { id: 'comun', at: [48.6, 22.6], facing: 150 * DEG }, // the common room: the porch door
    { id: 'porche', at: [39.4, 21.6], facing: 120 * DEG }, // the porch and the pantry's back door
    { id: 'camino', at: [36.2, 15.0], facing: 175 * DEG }, // the road out to the forest
    { id: 'literas', at: [56.6, 34.6], facing: -150 * DEG }, // the bunk room and the washroom's door
  ],

  aiCameras: {
    A: ['sierra', 'patio'],
    B: ['comun', 'porche'],
  },

  aiEntries: {
    A: { sendero: 2, camino: 1 },
    B: { arroyo: 2, camino: 1 },
  },

  camera: { start: [8, 18], height: 22, frame: [1, 11.5, 26, 13], defendFrame: [34, 1, 23, 34] },
};
