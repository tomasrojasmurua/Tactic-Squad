// "Operación Embajada" — an embassy compound at night, pure data (meters, x right, y down).
//
//  A walled embassy on a quiet avenue (58 × 36 m). Layout:
//    west   the avenue (attacker side): diplomatic cars, a bus stop; the compound's wall with
//           three ways in: the service gate (north), the main gate (centre), the garden gate (south)
//    north  the service lane along the wall, and the chancery: reception with its security
//           scanner, the consular hall, the offices, the archive (no light) and the
//           communications room (site A)
//    middle the front garden with its driveway, and the inner garden between the two buildings
//    south  the ambassador's residence: the salon (site B), the dining room, the study, the
//           kitchen, the pantry (no light) and the suite
//
// The inner garden joins the two sites outside; the service lane is the chancery's back way.
//
// Same format as training.js (see its header for the conventions).

const DEG = Math.PI / 180;

export default {
  id: 'embassy',
  name: 'Operación Embajada',
  size: { w: 58, h: 36 },

  // Cream stucco walls, a dark green baseboard (render only).
  palette: { wall: '#ddd3bd', exterior: '#8c826e', baseboard: '#2f4a3a' },

  traits: ['Un recinto con jardines y dos edificios', 'El jardín interior une los dos sitios', 'Un pasillo de servicio por detrás'],
  siteNames: { A: 'la sala de comunicaciones', B: 'el salón' },
  siteTraits: {
    A: ['Sala consular, archivo y pasillo de servicio', 'Racks de servidores: rincones angostos', 'El archivo de al lado está a oscuras'],
    B: ['Entrada, jardín interior y comedor', 'Sofás y piano: cobertura baja', 'La cocina y la despensa, detrás'],
  },

  walls: [
    // the compound's wall: around the map, and its line on the avenue
    { a: [1, 1], b: [57, 1], t: 0.3, kind: 'fence' },
    { a: [1, 35], b: [57, 35], t: 0.3, kind: 'fence' },
    { a: [1, 1], b: [1, 35], t: 0.3, kind: 'fence' },
    { a: [57, 1], b: [57, 35], t: 0.3, kind: 'fence' },
    { a: [12, 1], b: [12, 35], t: 0.3, kind: 'fence' },
    // the chancery: reception | consular hall over the offices | communications over the archive
    { a: [24, 4], b: [57, 4], t: 0.4 },
    { a: [24, 16], b: [57, 16], t: 0.4 },
    { a: [24, 4], b: [24, 16], t: 0.4 },
    { a: [32, 4], b: [32, 16] },
    { a: [44, 4], b: [44, 16] },
    { a: [32, 10], b: [57, 10] },
    // the residence: salon | dining room | study over the kitchen | pantry | suite
    { a: [30, 21], b: [57, 21], t: 0.4 },
    { a: [30, 21], b: [30, 35], t: 0.4 },
    { a: [42, 21], b: [42, 28] },
    { a: [50, 21], b: [50, 28] },
    { a: [30, 28], b: [57, 28] },
    { a: [40, 28], b: [40, 35] },
    { a: [45, 28], b: [45, 35] },
  ],

  doors: [
    // The compound's three ways in
    { id: 'acceso-servicio', at: [12, 2.6], axis: 'v', width: 1.4, hinge: 'min' },
    { id: 'porton-principal', at: [12, 17.6], axis: 'v', width: 1.8, hinge: 'max' },
    { id: 'acceso-jardin', at: [12, 30.6], axis: 'v', width: 1.4, hinge: 'min' },
    // The chancery
    { id: 'cancilleria-entrada', at: [24, 11.2], axis: 'v', width: 1.6, hinge: 'max' },
    { id: 'recepcion-consular', at: [32, 7.0], axis: 'v', width: 1.2, hinge: 'min' },
    { id: 'recepcion-oficinas', at: [32, 13.0], axis: 'v', width: 1.1, hinge: 'max' },
    { id: 'consular-oficinas', at: [38.0, 10], axis: 'h', width: 1.1, hinge: 'min' },
    { id: 'consular-comunicaciones', at: [44, 7.0], axis: 'v', width: 1.2, hinge: 'max', barricade: true },
    { id: 'oficinas-archivo', at: [44, 13.0], axis: 'v', width: 1.0, hinge: 'min', barricade: true },
    { id: 'archivo-comunicaciones', at: [51.4, 10], axis: 'h', width: 1.1, hinge: 'max', barricade: true },
    { id: 'comunicaciones-servicio', at: [53.6, 4], axis: 'h', width: 1.1, hinge: 'min', barricade: true },
    { id: 'oficinas-jardin', at: [38.0, 16], axis: 'h', width: 1.2, hinge: 'max', barricade: true },
    { id: 'archivo-jardin', at: [54.0, 16], axis: 'h', width: 1.0, hinge: 'min', barricade: true },
    // The residence
    { id: 'residencia-entrada', at: [30, 24.4], axis: 'v', width: 1.6, hinge: 'min', barricade: true },
    { id: 'salon-jardin', at: [36.4, 21], axis: 'h', width: 1.8, hinge: 'max', barricade: true },
    { id: 'salon-comedor', at: [42, 24.6], axis: 'v', width: 1.3, hinge: 'min', barricade: true },
    { id: 'comedor-estudio', at: [50, 24.6], axis: 'v', width: 1.0, hinge: 'max', barricade: true },
    { id: 'estudio-jardin', at: [53.6, 21], axis: 'h', width: 1.0, hinge: 'min', barricade: true },
    { id: 'salon-cocina', at: [35.0, 28], axis: 'h', width: 1.1, hinge: 'min', barricade: true },
    { id: 'cocina-despensa', at: [40, 31.6], axis: 'v', width: 1.0, hinge: 'max', barricade: true },
    { id: 'despensa-suite', at: [45, 31.6], axis: 'v', width: 1.0, hinge: 'min', barricade: true },
    { id: 'comedor-suite', at: [47.6, 28], axis: 'h', width: 1.0, hinge: 'max', barricade: true },
    { id: 'cocina-jardin', at: [30, 31.4], axis: 'v', width: 1.0, hinge: 'max', barricade: true },
  ],

  openings: [],

  windows: [
    { id: 'ventana-recepcion', at: [24, 6.6], axis: 'v', width: 1.6 },
    { id: 'ventana-oficinas', at: [27.6, 16], axis: 'h', width: 1.6 },
    { id: 'ventana-consular', at: [38.0, 4], axis: 'h', width: 1.8 },
    { id: 'ventana-salon', at: [30, 26.6], axis: 'v', width: 1.4 },
    { id: 'ventana-comedor', at: [46.0, 21], axis: 'h', width: 1.6 },
  ],

  rooms: [
    { id: 'sitioA', rect: [44.6, 4.6, 11.8, 4.8] },
    { id: 'sitioB', rect: [30.6, 21.6, 10.8, 5.8] },
    { id: 'avenida', rect: [1, 1, 11, 34] },
    { id: 'servicio', rect: [12, 1, 45, 3] },
    { id: 'jardinDelantero', rect: [12, 4, 12, 31] },
    { id: 'recepcionEmbajada', rect: [24, 4, 8, 12] },
    { id: 'consular', rect: [32, 4, 12, 6] },
    { id: 'oficinasEmbajada', rect: [32, 10, 12, 6] },
    { id: 'comunicaciones', rect: [44, 4, 13, 6] },
    { id: 'archivo', rect: [44, 10, 13, 6] },
    { id: 'jardinInterior', rect: [24, 16, 33, 5] },
    { id: 'salon', rect: [30, 21, 12, 7] },
    { id: 'comedorEmbajada', rect: [42, 21, 8, 7] },
    { id: 'estudio', rect: [50, 21, 7, 7] },
    { id: 'cocinaEmbajada', rect: [30, 28, 10, 7] },
    { id: 'despensaEmbajada', rect: [40, 28, 5, 7] },
    { id: 'suiteEmbajador', rect: [45, 28, 12, 7] },
    { id: 'jardinSur', rect: [24, 21, 6, 14] },
  ],

  // Rooms with no light at night (config/balance.js NIGHT): seen into only up close or with a flashlight.
  dark: ['archivo', 'despensaEmbajada'],

  floors: [
    { rect: [1, 1, 11, 34], material: 'yardAsphalt' },
    { rect: [12, 1, 45, 34], material: 'lawn' },
    { rect: [12, 1, 45, 3], material: 'terraceStone' },
    { rect: [12, 16.4, 12, 2.4], material: 'terraceStone' }, // the driveway
    { rect: [21.6, 9.8, 2.4, 9.0], material: 'terraceStone' },
    { rect: [24, 16, 33, 1.6], material: 'terraceStone' }, // the inner garden's path
    { rect: [24, 4, 8, 12], material: 'lobbyMarble' },
    { rect: [32, 4, 12, 6], material: 'customsTiles' },
    { rect: [32, 10, 12, 6], material: 'officeCarpet' },
    { rect: [44, 4, 13, 6], material: 'serviceLino' },
    { rect: [44, 10, 13, 6], material: 'serviceLino' },
    { rect: [30, 21, 12, 7], material: 'suiteWood' },
    { rect: [31.4, 22.2, 7.2, 4.6], material: 'suiteRug' },
    { rect: [42, 21, 8, 7], material: 'suiteWood' },
    { rect: [50, 21, 7, 7], material: 'hotelCarpet' },
    { rect: [30, 28, 10, 7], material: 'kitchenTiles' },
    { rect: [40, 28, 5, 7], material: 'serviceLino' },
    { rect: [45, 28, 12, 7], material: 'roomCarpet' },
  ],

  zones: { spawn: { rect: [3, 15, 6, 6] } },

  sites: [
    { id: 'A', rect: [44.6, 4.6, 11.8, 4.8], bomb: [50.0, 7.2] },
    { id: 'B', rect: [30.6, 21.6, 10.8, 5.8], bomb: [38.0, 24.0] },
  ],

  entries: [
    {
      id: 'lateral',
      door: 'acceso-servicio',
      frame: [1, 1, 26, 13],
      spawns: [
        { at: [9.4, 2.0], facing: 0 },
        { at: [9.4, 3.6], facing: 0 },
        { at: [8.0, 2.8], facing: 0 },
        { at: [8.0, 4.4], facing: 0 }, // 4.º (2v2)
      ],
    },
    {
      id: 'avenida',
      door: 'porton-principal',
      frame: [1, 11, 26, 13],
      spawns: [
        { at: [9.4, 16.8], facing: 0 },
        { at: [9.4, 18.4], facing: 0 },
        { at: [8.0, 17.6], facing: 0 },
        { at: [8.0, 16.0], facing: 0 }, // 4.º (2v2)
      ],
    },
    {
      id: 'jardin',
      door: 'acceso-jardin',
      frame: [1, 22, 26, 13],
      spawns: [
        { at: [9.4, 29.8], facing: 0 },
        { at: [9.4, 31.4], facing: 0 },
        { at: [8.0, 30.6], facing: 0 },
        { at: [8.0, 32.2], facing: 0 }, // 4.º (2v2)
      ],
    },
  ],
  defaultEntry: 'avenida',

  deployment: {
    line: [[28, 1], [28, 35]],
    attackers: [[1, 1, 11, 34]],
    defenders: [[28, 1, 29, 34]],
  },

  paint: [
    { kind: 'site', rect: [44.6, 4.6, 11.8, 4.8], text: 'A', color: '#f2c230' },
    { kind: 'site', rect: [30.6, 21.6, 10.8, 5.8], text: 'B', color: '#f2c230' },
    { kind: 'arrow', at: [20.0, 11.2], size: 1.2, rot: 0, text: 'A', color: '#f2c230' },
    { kind: 'arrow', at: [26.6, 24.4], size: 1.2, rot: 0, text: 'B', color: '#f2c230' },
    { kind: 'text', at: [6.0, 24.0], size: 0.62, text: 'DESPLIEGUE', color: '#e8e2d0' },
    { kind: 'text', at: [34.0, 2.4], size: 0.5, text: 'SERVICIO', color: '#e8e2d0' },
    { kind: 'text', at: [46.0, 18.6], size: 0.5, text: 'JARDÍN', color: '#e8e2d0' },
    { kind: 'stripes', rect: [12.4, 16.4, 0.5, 2.4], color: '#e3b51e' },
  ],

  props: [
    // the avenue: diplomatic cars, a van, the bus stop
    { type: 'car', at: [4.0, 8.8], rot: 90, color: '#1b1c1f' },
    { type: 'car', at: [4.0, 24.6], rot: 90, color: '#1b1c1f' },
    { type: 'van', at: [4.2, 13.4], rot: 90 },
    { type: 'bench', at: [10.6, 22.6], rot: 90 },
    { type: 'bin', at: [10.8, 33.8], rot: 0 },
    { type: 'bin', at: [10.8, 6.0], rot: 0 },
    // the service lane: the generator, the bins
    { type: 'generator', at: [44.0, 2.2], rot: 0 },
    { type: 'dumpster', at: [30.0, 2.3], rot: 0 },
    { type: 'crateStack', at: [20.0, 2.3], rot: 0 },
    // the front garden: the guard post, hedges, the parked official car, the fountain's planters
    { type: 'guardBooth', at: [14.6, 14.2], rot: 0 },
    { type: 'car', at: [19.0, 21.6], rot: 0, color: '#1b1c1f' },
    { type: 'bush', at: [16.2, 7.0], rot: 0 },
    { type: 'bush', at: [19.6, 5.6], rot: 60 },
    { type: 'bush', at: [15.4, 26.6], rot: 30 },
    { type: 'bush', at: [20.6, 28.4], rot: 90 },
    { type: 'bush', at: [17.0, 32.6], rot: 10 },
    { type: 'bush', at: [25.4, 33.4], rot: 40 },
    { type: 'pine', at: [15.4, 9.4], rot: 0 },
    { type: 'pine', at: [22.2, 25.0], rot: 40 },
    { type: 'pine', at: [16.4, 30.0], rot: 80 },
    { type: 'pine', at: [26.6, 30.6], rot: 20 },
    { type: 'planter', at: [18.0, 11.6], rot: 0 },
    { type: 'planter', at: [18.0, 13.4], rot: 0 },
    { type: 'bollard', at: [21.0, 15.8], rot: 0 },
    { type: 'bollard', at: [21.0, 19.4], rot: 0 },
    { type: 'bench', at: [26.6, 23.6], rot: 90 },

    // reception: the security scanner, the desk, the waiting sofa
    { type: 'xrayScanner', at: [27.4, 13.6], rot: 0 },
    { type: 'receptionDesk', at: [29.0, 6.4], rot: 180 },
    { type: 'sofa', at: [25.6, 5.6], rot: 90 },
    { type: 'plant', at: [31.4, 15.4], rot: 0 },
    { type: 'plant', at: [24.6, 15.4], rot: 0 },
    // the consular hall: the counters and the benches of the queue
    { type: 'counter', at: [40.8, 4.6], rot: 180 },
    { type: 'counter', at: [42.8, 4.6], rot: 180 },
    { type: 'bench', at: [36.0, 7.2], rot: 0 },
    { type: 'bench', at: [36.0, 8.8], rot: 0 },
    { type: 'barrier', at: [39.8, 7.0], rot: 90 },
    // the offices
    { type: 'desk', at: [35.4, 12.6], rot: 0 },
    { type: 'officeChair', at: [35.4, 13.5], rot: 180 },
    { type: 'desk', at: [41.0, 13.4], rot: 0 },
    { type: 'officeChair', at: [41.0, 14.3], rot: 180 },
    { type: 'cabinet', at: [43.5, 11.0], rot: 270 },
    { type: 'bookshelf', at: [35.6, 15.6], rot: 180 },
    // the communications room: server racks, the operators' desks
    { type: 'rack', at: [47.6, 5.0], rot: 0 },
    { type: 'rack', at: [56.4, 6.4], rot: 90 },
    { type: 'desk', at: [53.6, 8.8], rot: 180 },
    { type: 'officeChair', at: [53.6, 7.9], rot: 0 },
    { type: 'cabinet', at: [45.0, 9.4], rot: 90 },
    // the archive (no light): rows of shelves
    { type: 'bookshelf', at: [48.0, 13.0], rot: 90 },
    { type: 'bookshelf', at: [51.0, 13.4], rot: 90 },
    { type: 'cabinet', at: [56.4, 12.6], rot: 270 },
    { type: 'cabinet', at: [56.4, 13.6], rot: 270 },

    // the inner garden: hedges, a table under the trees, benches
    { type: 'bush', at: [27.6, 19.6], rot: 0 },
    { type: 'bush', at: [44.0, 19.4], rot: 45 },
    { type: 'bush', at: [49.6, 18.8], rot: 20 },
    { type: 'roundTable', at: [32.6, 18.8], rot: 0 },
    { type: 'chair', at: [31.8, 18.8], rot: 90 },
    { type: 'chair', at: [33.4, 18.8], rot: 270 },
    { type: 'bench', at: [40.4, 19.6], rot: 0 },
    { type: 'planter', at: [56.0, 19.0], rot: 90 },
    { type: 'pine', at: [47.0, 19.2], rot: 10 },
    { type: 'pine', at: [29.4, 17.8], rot: 50 },

    // the salon: sofas, the piano, the low tables
    { type: 'sofa', at: [33.4, 22.2], rot: 0 },
    { type: 'armchair', at: [39.8, 22.8], rot: 200 },
    { type: 'coffeeTable', at: [33.4, 23.8], rot: 0 },
    { type: 'piano', at: [39.8, 26.4], rot: 270 },
    { type: 'floorLamp', at: [31.0, 22.0], rot: 0 },
    // the dining room
    { type: 'table', at: [45.2, 24.4], rot: 0 },
    { type: 'table', at: [46.8, 24.4], rot: 0 },
    { type: 'chair', at: [44.8, 23.6], rot: 0 },
    { type: 'chair', at: [47.2, 23.6], rot: 0 },
    { type: 'chair', at: [44.8, 25.2], rot: 180 },
    { type: 'chair', at: [47.2, 25.2], rot: 180 },
    { type: 'cabinet', at: [49.5, 27.4], rot: 270 },
    // the study
    { type: 'hotelDesk', at: [54.6, 25.6], rot: 180 },
    { type: 'armchair', at: [51.6, 22.4], rot: 135 },
    { type: 'bookshelf', at: [56.6, 23.0], rot: 270 },
    // the kitchen
    { type: 'kitchenRange', at: [33.6, 34.4], rot: 0 },
    { type: 'counter', at: [37.2, 34.4], rot: 0 },
    { type: 'fridge', at: [39.4, 29.0], rot: 270 },
    { type: 'table', at: [34.6, 31.4], rot: 0 },
    // the pantry (no light)
    { type: 'rack', at: [42.4, 34.4], rot: 0 },
    { type: 'crateStack', at: [44.2, 29.0], rot: 0 },
    // the suite
    { type: 'bed', at: [54.6, 32.0], rot: 270 },
    { type: 'nightstand', at: [56.4, 29.6], rot: 270 },
    { type: 'wardrobe', at: [49.0, 34.4], rot: 0 },
    { type: 'armchair', at: [47.2, 33.6], rot: 45 },
  ],

  defense: {
    A: [
      // Anchor by the archive's door: the consular door across the racks.
      // (1 nov: in the far corner the attackers won 43-44 % here.)
      { at: [50.6, 9.2], facing: 200 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // Beside the consular door, off its line: it up close, and the archive's door.
      { at: [46.0, 8.6], facing: 210 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'hold', reactsToNoise: true } },
      // In the offices: reception's door (he holds there, no falling back).
      { at: [38.0, 13.0], facing: 180 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true } },
      // The archive: its garden door and the offices'.
      { at: [53.0, 14.6], facing: 200 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: 160 * DEG, to: 260 * DEG, period: 6, reactsToNoise: true } },
    ],
    B: [
      // Anchor behind the piano: the residence's entrance across the salon.
      { at: [40.8, 25.0], facing: 185 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // In the salon's corner by the garden doors.
      { at: [31.2, 27.2], facing: -40 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'hold', reactsToNoise: true } },
      // In the inner garden: the path from the front garden; falls back into the salon.
      { at: [41.0, 18.4], facing: 180 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true, rotate: { to: [38.0, 24.0], look: 180 * DEG } } },
      // The dining room: the salon's door.
      { at: [48.6, 22.4], facing: 180 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: 150 * DEG, to: 210 * DEG, period: 6, reactsToNoise: true } },
    ],
  },

  // Noisy floor: the service lane's gravel, the comms room's steel floor plates, glass from a
  // broken pane under the salon's window.
  debris: [
    { kind: 'gravel', rect: [14.0, 1.4, 3.0, 2.2] },
    { kind: 'metal', rect: [49.0, 5.0, 1.6, 1.4] },
    { kind: 'glass', rect: [28.0, 25.8, 1.6, 1.6] },
  ],

  aiBarricades: {
    A: ['consular-comunicaciones'],
    B: ['salon-jardin'],
  },

  aiTraps: {
    A: [[45.4, 7.0], [50.6, 9.2]],
    B: [[31.4, 24.4], [36.4, 22.0]],
  },

  cameraMounts: [
    { id: 'comunicaciones', at: [56.6, 4.4], facing: 155 * DEG }, // the comms room: the consular door
    { id: 'consular', at: [43.6, 4.4], facing: 150 * DEG }, // the consular hall
    { id: 'recepcion', at: [31.6, 4.4], facing: 150 * DEG }, // reception and the scanner
    { id: 'jardin-interior', at: [56.6, 16.6], facing: 180 * DEG }, // the inner garden, end to end
    { id: 'salon', at: [41.6, 21.4], facing: 150 * DEG }, // the salon: the entrance and the garden doors
    { id: 'servicio', at: [56.6, 1.4], facing: 180 * DEG }, // the service lane, end to end
    { id: 'suite', at: [56.6, 34.6], facing: -150 * DEG }, // the suite and the pantry's door
  ],

  aiCameras: {
    A: ['comunicaciones', 'consular'],
    B: ['salon', 'jardin-interior'],
  },

  aiEntries: {
    A: { lateral: 2, avenida: 1 },
    B: { jardin: 1, avenida: 1, lateral: 1 },
  },

  camera: { start: [8, 18], height: 22, frame: [1, 11, 26, 13], defendFrame: [26, 2, 31, 32] },
};
