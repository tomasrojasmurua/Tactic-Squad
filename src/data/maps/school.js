// "Operación Liceo" — a secondary school at night, pure data (meters, x right, y down).
//
//  A school closed for the night (58 × 36 m). Layout:
//    west   the street (attacker side): a school bus, parked cars; three gates in the
//           school's fence (the courts, the front steps, the car park) onto the front yard
//    north  the classroom wing: two classrooms, the library (site A) and the staff room
//    middle the long corridor, lockers on both walls, end to end
//    south  the entrance hall, the office (no light), the canteen and the gym (site B)
//           with its changing room and the equipment store (no light)
//
// The corridor is the spine: every room opens on it, and it sees from one end to the other.
// The classrooms and the canteen are the slow ways around it.
//
// Same format as training.js (see its header for the conventions).

const DEG = Math.PI / 180;

/** A classroom's desks (three rows of three, each with its chair) from its west wall `x0`. */
function classroom(x0) {
  const out = [];
  for (const dx of [2.6, 4.8, 7.0]) {
    for (const y of [6.6, 8.6, 10.6]) {
      out.push({ type: 'schoolDesk', at: [x0 + dx, y], rot: 0 });
      out.push({ type: 'chair', at: [x0 + dx, y + 0.55], rot: 180 });
    }
  }
  out.push({ type: 'teacherDesk', at: [x0 + 4.8, 4.9], rot: 180 });
  return out;
}

export default {
  id: 'school',
  name: 'Operación Liceo',
  size: { w: 58, h: 36 },

  // Pale school walls, a green baseboard (render only).
  palette: { wall: '#cfc8b4', exterior: '#8a8273', baseboard: '#3e5a46' },

  traits: ['Un pasillo largo que lo ve todo', 'Aulas y comedor: los caminos lentos', 'De noche: secretaría y depósito a oscuras'],
  siteNames: { A: 'la biblioteca', B: 'el gimnasio' },
  siteTraits: {
    A: ['Dos puertas al pasillo, aula 2 y profesores', 'Estanterías altas: rincones cerrados', 'Mesas de lectura frente a la bomba'],
    B: ['Pasillo, comedor y vestuarios', 'Una sala grande con gradas', 'El depósito a oscuras, detrás'],
  },

  walls: [
    // the school's fence: around the map, and its gate line on the street
    { a: [1, 1], b: [57, 1], t: 0.3, kind: 'fence' },
    { a: [1, 35], b: [57, 35], t: 0.3, kind: 'fence' },
    { a: [1, 1], b: [1, 35], t: 0.3, kind: 'fence' },
    { a: [57, 1], b: [57, 35], t: 0.3, kind: 'fence' },
    { a: [12, 1], b: [12, 35], t: 0.3, kind: 'fence' },
    // the building's shell
    { a: [16, 4], b: [57, 4], t: 0.4 },
    { a: [16, 33], b: [57, 33], t: 0.4 },
    { a: [16, 4], b: [16, 33], t: 0.4 },
    // the classroom wing | the corridor | the south rooms
    { a: [16, 13], b: [57, 13] },
    { a: [16, 17], b: [57, 17] },
    { a: [25, 4], b: [25, 13] },
    { a: [34, 4], b: [34, 13] },
    { a: [47, 4], b: [47, 13] },
    { a: [24, 17], b: [24, 33] },
    { a: [16, 25], b: [24, 25] },
    { a: [37, 17], b: [37, 33] },
    { a: [51, 17], b: [51, 33] },
    { a: [51, 26], b: [57, 26] },
  ],

  doors: [
    // The school's three gates
    { id: 'reja-canchas', at: [12, 9], axis: 'v', width: 1.4, hinge: 'min' },
    { id: 'reja-escalinata', at: [12, 21], axis: 'v', width: 1.6, hinge: 'max' },
    { id: 'reja-estacionamiento', at: [12, 31.6], axis: 'v', width: 1.4, hinge: 'min' },
    // Into the building
    { id: 'aula1-patio', at: [16, 9], axis: 'v', width: 1.2, hinge: 'min' },
    { id: 'entrada-liceo', at: [16, 21], axis: 'v', width: 1.6, hinge: 'max' },
    { id: 'secretaria-patio', at: [16, 30], axis: 'v', width: 1.0, hinge: 'min' },
    // The classroom wing on the corridor
    { id: 'aula1-pasillo', at: [20.6, 13], axis: 'h', width: 1.2, hinge: 'min' },
    { id: 'aula2-pasillo', at: [29.6, 13], axis: 'h', width: 1.2, hinge: 'min' },
    { id: 'biblioteca-oeste', at: [37.4, 13], axis: 'h', width: 1.5, hinge: 'max', barricade: true },
    { id: 'biblioteca-este', at: [44.0, 13], axis: 'h', width: 1.5, hinge: 'min', barricade: true },
    { id: 'profesores-pasillo', at: [52.0, 13], axis: 'h', width: 1.2, hinge: 'max', barricade: true },
    { id: 'aula2-biblioteca', at: [34, 8.6], axis: 'v', width: 1.2, hinge: 'min', barricade: true },
    { id: 'biblioteca-profesores', at: [47, 6.4], axis: 'v', width: 1.0, hinge: 'max', barricade: true },
    // The south rooms
    { id: 'hall-secretaria', at: [20, 25], axis: 'h', width: 1.0, hinge: 'min' },
    { id: 'hall-comedor', at: [24, 21], axis: 'v', width: 1.1, hinge: 'max' },
    { id: 'comedor-pasillo', at: [30.6, 17], axis: 'h', width: 1.6, hinge: 'min', barricade: true },
    { id: 'comedor-gimnasio', at: [37, 27], axis: 'v', width: 1.4, hinge: 'min', barricade: true },
    { id: 'gimnasio-pasillo', at: [44.0, 17], axis: 'h', width: 1.8, hinge: 'max', barricade: true },
    { id: 'gimnasio-vestuarios', at: [51, 21.4], axis: 'v', width: 1.0, hinge: 'min', barricade: true },
    { id: 'vestuarios-pasillo', at: [54.0, 17], axis: 'h', width: 1.0, hinge: 'max', barricade: true },
    { id: 'gimnasio-deposito', at: [51, 30.0], axis: 'v', width: 1.1, hinge: 'max', barricade: true },
    // From the yards around the building: the canteen and the gym from the south, the staff room from the courts
    { id: 'comedor-patio', at: [30.0, 33], axis: 'h', width: 1.4, hinge: 'min' },
    { id: 'gimnasio-patio', at: [42.0, 33], axis: 'h', width: 1.6, hinge: 'max', barricade: true },
    { id: 'profesores-cancha', at: [53.4, 4], axis: 'h', width: 1.0, hinge: 'min', barricade: true },
  ],

  // The entrance hall opens on the corridor under an arch.
  openings: [
    { id: 'arco-hall', at: [20, 17], axis: 'h', width: 2.4 },
  ],

  windows: [
    { id: 'ventana-aula1', at: [16, 6.0], axis: 'v', width: 1.6 },
    { id: 'ventana-hall', at: [16, 18.4], axis: 'v', width: 1.4 },
    { id: 'ventana-secretaria', at: [16, 27.4], axis: 'v', width: 1.4 },
    { id: 'ventana-comedor', at: [24, 29.6], axis: 'v', width: 1.4 },
  ],

  rooms: [
    { id: 'sitioA', rect: [35.4, 5.0, 10.4, 7.0] },
    { id: 'sitioB', rect: [39.6, 20.4, 9.0, 11.0] },
    { id: 'calle', rect: [1, 1, 11, 34] },
    { id: 'explanada', rect: [12, 1, 4, 34] },
    { id: 'aula1', rect: [16, 4, 9, 9] },
    { id: 'aula2', rect: [25, 4, 9, 9] },
    { id: 'biblioteca', rect: [34, 4, 13, 9] },
    { id: 'profesores', rect: [47, 4, 10, 9] },
    { id: 'pasillo', rect: [16, 13, 41, 4] },
    { id: 'hallLiceo', rect: [16, 17, 8, 8] },
    { id: 'secretaria', rect: [16, 25, 8, 8] },
    { id: 'comedor', rect: [24, 17, 13, 16] },
    { id: 'gimnasio', rect: [37, 17, 14, 16] },
    { id: 'vestuarios', rect: [51, 17, 6, 9] },
    { id: 'deposito', rect: [51, 26, 6, 7] },
    { id: 'cancha', rect: [16, 1, 41, 3] },
    { id: 'patioSur', rect: [16, 33, 41, 2] },
  ],

  // Rooms with no light at night (config/balance.js NIGHT): seen into only up close or with a flashlight.
  dark: ['secretaria', 'deposito'],

  floors: [
    { rect: [1, 1, 56, 34], material: 'courtAsphalt' },
    { rect: [12, 1, 4, 34], material: 'terraceStone' },
    { rect: [16, 33, 41, 2], material: 'terraceStone' },
    { rect: [16, 1, 41, 3], material: 'terraceStone' },
    { rect: [16, 4, 18, 9], material: 'classroomTiles' },
    { rect: [34, 4, 13, 9], material: 'libraryCarpet' },
    { rect: [47, 4, 10, 9], material: 'officeCarpet' },
    { rect: [16, 13, 41, 4], material: 'schoolLino' },
    { rect: [16, 17, 8, 8], material: 'lobbyMarble' },
    { rect: [16, 25, 8, 8], material: 'officeCarpet' },
    { rect: [24, 17, 13, 16], material: 'schoolLino' },
    { rect: [37, 17, 14, 16], material: 'gymWood' },
    { rect: [51, 17, 6, 9], material: 'bathTiles' },
    { rect: [51, 26, 6, 7], material: 'siteConcrete' },
  ],

  zones: { spawn: { rect: [3, 17, 6, 6] } },

  sites: [
    { id: 'A', rect: [35.4, 5.0, 10.4, 7.0], bomb: [40.6, 8.6] },
    { id: 'B', rect: [39.6, 20.4, 9.0, 11.0], bomb: [44.0, 28.4] },
  ],

  entries: [
    {
      id: 'canchas',
      door: 'reja-canchas',
      frame: [1, 2, 26, 13],
      spawns: [
        { at: [9.4, 8.2], facing: 0 },
        { at: [9.4, 9.8], facing: 0 },
        { at: [8.0, 9.0], facing: 0 },
        { at: [8.0, 7.4], facing: 0 }, // 4.º (2v2)
      ],
    },
    {
      id: 'escalinata',
      door: 'reja-escalinata',
      frame: [1, 14.5, 26, 13],
      spawns: [
        { at: [9.4, 20.2], facing: 0 },
        { at: [9.4, 21.8], facing: 0 },
        { at: [8.0, 21.0], facing: 0 },
        { at: [8.0, 19.4], facing: 0 }, // 4.º (2v2)
      ],
    },
    {
      id: 'estacionamiento',
      door: 'reja-estacionamiento',
      frame: [1, 22, 26, 13],
      spawns: [
        { at: [9.4, 30.8], facing: 0 },
        { at: [9.4, 32.4], facing: 0 },
        { at: [8.0, 31.6], facing: 0 },
        { at: [8.0, 30.0], facing: 0 }, // 4.º (2v2)
      ],
    },
  ],
  defaultEntry: 'escalinata',

  deployment: {
    line: [[30, 1], [30, 35]],
    attackers: [[1, 1, 11, 34]],
    defenders: [[30, 1, 27, 34]],
  },

  paint: [
    { kind: 'site', rect: [35.4, 5.0, 10.4, 7.0], text: 'A', color: '#f2c230' },
    { kind: 'site', rect: [39.6, 20.4, 9.0, 11.0], text: 'B', color: '#f2c230' },
    { kind: 'arrow', at: [33.0, 15.0], size: 1.2, rot: 0, text: 'A', color: '#f2c230' },
    { kind: 'arrow', at: [34.6, 25.0], size: 1.2, rot: 0, text: 'B', color: '#f2c230' },
    { kind: 'text', at: [6.0, 15.0], size: 0.62, text: 'DESPLIEGUE', color: '#e8e2d0' },
    { kind: 'text', at: [26.0, 15.0], size: 0.5, text: 'PASILLO', color: '#3a3a36' },
    { kind: 'text', at: [30.6, 2.4], size: 0.5, text: 'CANCHA', color: '#e8e2d0' },
    { kind: 'stripes', rect: [12.4, 19.6, 0.5, 2.8], color: '#e3b51e' },
  ],

  props: [
    // the street: the school bus, parked cars, bins
    { type: 'trailer', at: [5.0, 13.4], rot: 90, color: '#e3b51e' },
    { type: 'car', at: [3.6, 24.6], rot: 90, color: '#2f6db0' },
    { type: 'car', at: [3.6, 30.4], rot: 90, color: '#d6d2c8' },
    { type: 'bin', at: [10.8, 3.2], rot: 0 },
    { type: 'bin', at: [10.8, 34.0], rot: 0 },
    { type: 'dumpster', at: [6.6, 3.4], rot: 0 },
    // the front yard
    { type: 'bench', at: [14.0, 14.6], rot: 90 },
    { type: 'bench', at: [14.0, 25.6], rot: 90 },
    { type: 'planter', at: [14.0, 3.4], rot: 90 },
    { type: 'planter', at: [14.0, 33.4], rot: 90 },
    { type: 'bollard', at: [13.4, 18.4], rot: 0 },
    { type: 'bollard', at: [13.4, 24.2], rot: 0 },

    // the classrooms
    ...classroom(16),
    ...classroom(25),
    { type: 'bookshelf', at: [23.4, 12.6], rot: 180 },
    { type: 'bookshelf', at: [32.2, 12.6], rot: 180 },
    // the library: shelves in rows, reading tables
    { type: 'bookshelf', at: [36.2, 4.4], rot: 0 },
    { type: 'bookshelf', at: [44.4, 4.4], rot: 0 },
    { type: 'bookshelf', at: [38.6, 6.3], rot: 90 },
    { type: 'bookshelf', at: [42.6, 6.3], rot: 90 },
    { type: 'bookshelf', at: [46.6, 10.4], rot: 270 },
    { type: 'table', at: [39.4, 10.6], rot: 0 },
    { type: 'table', at: [42.8, 10.6], rot: 0 },
    { type: 'chair', at: [39.0, 11.4], rot: 180 },
    { type: 'chair', at: [43.2, 11.4], rot: 180 },
    { type: 'chair', at: [39.8, 9.8], rot: 0 },
    // the staff room
    { type: 'table', at: [52.0, 8.6], rot: 0 },
    { type: 'chair', at: [51.0, 8.6], rot: 90 },
    { type: 'chair', at: [53.0, 8.6], rot: 270 },
    { type: 'sofa', at: [50.2, 4.8], rot: 0 },
    { type: 'vending', at: [56.3, 11.6], rot: 270 },
    { type: 'counter', at: [55.6, 7.4], rot: 270 },

    // the corridor: lockers on both walls, between the doors
    { type: 'lockers', at: [25.0, 13.45], rot: 0 },
    { type: 'lockers', at: [33.6, 13.45], rot: 0 },
    { type: 'lockers', at: [48.6, 13.45], rot: 0 },
    { type: 'lockers', at: [25.8, 16.55], rot: 180 },
    { type: 'lockers', at: [36.4, 16.55], rot: 180 },
    { type: 'lockers', at: [49.0, 16.55], rot: 180 },
    { type: 'plant', at: [56.4, 15.0], rot: 0 },

    // the entrance hall
    { type: 'counter', at: [22.8, 23.6], rot: 270 },
    { type: 'bench', at: [18.0, 24.4], rot: 0 },
    { type: 'plant', at: [16.6, 17.6], rot: 0 },
    // the office (no light)
    { type: 'desk', at: [20.0, 28.0], rot: 0 },
    { type: 'officeChair', at: [20.0, 28.9], rot: 180 },
    { type: 'desk', at: [20.0, 31.4], rot: 180 },
    { type: 'cabinet', at: [23.4, 26.6], rot: 270 },
    { type: 'cabinet', at: [23.4, 32.2], rot: 270 },

    // the canteen: long tables, the serving line, a vending machine
    ...[[27.6, 20.8], [31.8, 20.8], [27.6, 24.4], [31.8, 24.4], [27.6, 28.0], [31.8, 28.0]].flatMap(([x, y]) => [
      { type: 'table', at: [x, y], rot: 0 },
      { type: 'chair', at: [x - 0.5, y - 0.75], rot: 0 },
      { type: 'chair', at: [x + 0.5, y + 0.75], rot: 180 },
    ]),
    { type: 'counter', at: [25.6, 32.4], rot: 0 },
    { type: 'counter', at: [34.6, 32.4], rot: 0 },
    { type: 'vending', at: [36.4, 18.4], rot: 270 },

    // the gym: stands, benches, the ball cart and the mats' crates
    { type: 'bleachers', at: [49.8, 26.0], rot: 270 },
    { type: 'bench', at: [39.4, 31.8], rot: 0 },
    { type: 'bench', at: [46.6, 21.4], rot: 0 },
    { type: 'crateStack', at: [49.6, 18.6], rot: 0 },
    { type: 'rack', at: [46.4, 23.6], rot: 90 }, // the ball rack: the corridor door from the far corner
    { type: 'crateStack', at: [41.0, 27.8], rot: 0 }, // the mats' crates: the canteen door from the far corner
    { type: 'laundryCart', at: [40.6, 25.0], rot: 20 },
    { type: 'crate', at: [42.6, 22.6], rot: 15 },
    { type: 'palletStack', at: [45.2, 24.6], rot: 0, color: '#2f6db0' }, // stacked mats
    { type: 'palletStack', at: [39.8, 29.0], rot: 90, color: '#b0402e' },
    { type: 'bench', at: [45.4, 30.4], rot: 0 },
    // the changing room
    { type: 'lockers', at: [56.5, 21.6], rot: 270 },
    { type: 'bench', at: [54.0, 22.0], rot: 90 },
    // the equipment store (no light)
    { type: 'crateStack', at: [56.0, 32.0], rot: 0 },
    { type: 'rack', at: [54.4, 27.0], rot: 0 },
    { type: 'barrel', at: [52.0, 32.3], rot: 0 },
  ],

  defense: {
    A: [
      // Anchor in the library's north-east corner: both corridor doors across the tables.
      { at: [45.6, 5.6], facing: 126 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // Behind the west shelves: the door from classroom 2 and the west corridor door.
      { at: [36.4, 6.2], facing: 80 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'scan', from: 40 * DEG, to: 170 * DEG, period: 6, reactsToNoise: true } },
      // In the corridor by the library: sweeps it, west to east, without chasing noises.
      // (1 nov: holding the west end fixed the attackers won 36 % here; inside the library, 55-63 %.)
      { at: [41.0, 15.0], facing: 180 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'scan', from: 150 * DEG, to: 250 * DEG, period: 5, reactsToNoise: false } },
      // The staff room: the library's east door.
      { at: [50.4, 10.6], facing: -150 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: 150 * DEG, to: 230 * DEG, period: 6, reactsToNoise: true } },
    ],
    B: [
      // Anchor in the gym's south-east corner: the canteen door and the corridor doors.
      { at: [48.4, 31.6], facing: -150 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // Inside the gym by the corridor's double door, off its line: the door up close and the canteen's.
      // (1 nov: by the canteen door the attackers won 29-38 % here.)
      { at: [41.4, 20.6], facing: 200 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'hold', reactsToNoise: false } },
      // In the canteen: the hall's door; falls back into the gym.
      { at: [34.6, 22.0], facing: 180 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true, rotate: { to: [40.6, 29.6], look: 180 * DEG } } },
      // The changing room: the corridor door.
      { at: [53.6, 24.6], facing: -110 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: -150 * DEG, to: -60 * DEG, period: 6, reactsToNoise: true } },
    ],
  },

  // Noisy floor: broken glass under the hall's window, the gym's steel grating by the store,
  // gravel at the car park gate.
  debris: [
    { kind: 'glass', rect: [16.4, 17.8, 1.6, 1.4] },
    { kind: 'metal', rect: [49.4, 29.4, 1.4, 1.4] },
    { kind: 'gravel', rect: [12.6, 30.4, 2.6, 2.4] },
  ],

  aiBarricades: {
    A: ['aula2-biblioteca'],
    B: ['gimnasio-patio'],
  },

  aiTraps: {
    A: [[38.0, 11.6], [35.2, 10.4]],
    B: [[38.4, 25.6], [44.0, 18.6]],
  },

  cameraMounts: [
    { id: 'pasillo-este', at: [56.6, 13.4], facing: 180 * DEG }, // the corridor, end to end
    { id: 'biblioteca', at: [46.6, 4.6], facing: 140 * DEG }, // the library: its corridor doors
    { id: 'gimnasio', at: [50.6, 17.4], facing: 135 * DEG }, // the gym from its north-east corner
    { id: 'comedor', at: [36.6, 17.4], facing: 135 * DEG }, // the canteen from its north-east corner
    { id: 'hall', at: [23.6, 17.4], facing: 135 * DEG }, // the entrance hall
    { id: 'profesores', at: [56.6, 4.4], facing: 150 * DEG }, // the staff room and the library's east door
    { id: 'deposito', at: [56.6, 32.6], facing: -150 * DEG }, // the equipment store
  ],

  aiCameras: {
    A: ['biblioteca', 'pasillo-este'],
    B: ['gimnasio', 'comedor'],
  },

  aiEntries: {
    A: { canchas: 2, escalinata: 1 },
    B: { estacionamiento: 1, escalinata: 1, canchas: 1 },
  },

  camera: { start: [8, 20], height: 22, frame: [1, 14.5, 26, 13], defendFrame: [28, 3, 29, 32] },
};
