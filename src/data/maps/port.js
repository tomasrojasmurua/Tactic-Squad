// "Operación Puerto" — the open map, pure data (meters, x right, y down).
//
//  Layout:  truck staging (attacker spawn, west) | a container terminal: the
//           quay along the north edge, the container yard (site A, open, at
//           its east end), the truck lane, and two buildings along the south:
//           the customs house (inspection hall, office, archive) and the cold
//           store (loading hall, and the cold room with site B).
//
// What it rewards (the map's reading, `traits`):
//   - half the map is outside: long straight lanes between container rows
//     (the quay, 31 m; the middle lane, 23 m; the truck lane) and cover that
//     is not a wall (Tirador on both sides, Escudo to cross a lane);
//   - site A is open, reached from three lanes, with no door to hold
//     (Asaltante, Escudo / Vigía, Merodeador between the stacks);
//   - site B is the opposite: a cold room with two heavy doors inside a
//     closed building (Ancla, Trampero / Brecha, Granadero).
//
// Same format as warehouse.js (see its header for the conventions).

const DEG = Math.PI / 180;

export default {
  id: 'port',
  name: 'Operación Puerto',
  size: { w: 40, h: 28 },

  // Grey concrete walls, a sea-green baseboard (render only).
  palette: { wall: '#a9aeac', exterior: '#6f7775', baseboard: '#2f4a46' },

  // The map's reading on its card before the game (ui/MapPreview.js; hotel.js has the format).
  traits: ['Medio mapa al aire libre, entre contenedores', 'Carriles largos y rectos: el muelle tiene 31 m', 'Un sitio abierto y otro tras dos puertas'],
  siteNames: { A: 'el patio de contenedores', B: 'la cámara de frío' },
  siteTraits: {
    A: ['Sin puertas: se llega por el muelle, el carril del medio o la explanada', 'Contenedores y cajas: cobertura que no es pared', 'Se ve de lejos y se cruza al descubierto'],
    B: ['Dos puertas pesadas, las dos desde la bodega', 'A la bodega se entra por el andén, la puerta del frente o la aduana', 'Estanterías altas: rincones a dos metros'],
  },

  walls: [
    // the quay's railing (the water is north of it) and the truck staging's fence
    { a: [1, 1], b: [39, 1], t: 0.3, kind: 'fence' },
    { a: [1, 1], b: [1, 26], t: 0.3, kind: 'fence' },
    { a: [1, 26], b: [8, 26], t: 0.3, kind: 'fence' },
    // the terminal's fence: west (the gates) and east
    { a: [8, 1], b: [8, 17], t: 0.3, kind: 'fence' },
    { a: [39, 1], b: [39, 17], t: 0.3, kind: 'fence' },
    // the two buildings' shell
    { a: [8, 17], b: [39, 17], t: 0.4 },
    { a: [8, 26], b: [39, 26], t: 0.4 },
    { a: [8, 17], b: [8, 26], t: 0.4 },
    { a: [39, 17], b: [39, 26], t: 0.4 },
    { a: [23, 17], b: [23, 26], t: 0.4 }, // firewall: customs | cold store
    // customs: inspection hall | office over archive
    { a: [16, 17], b: [16, 26] },
    { a: [16, 21.4], b: [23, 21.4] },
    // cold store: the cold room (site B) in the south-east corner
    { a: [31, 19.4], b: [39, 19.4], t: 0.3 },
    { a: [31, 19.4], b: [31, 26], t: 0.3 },
  ],

  // `barricade`: the 7 doors the defenders may block (the cold store's and the customs offices').
  doors: [
    // From the staging: the quay gate, the wicket in the truck gate, the customs door
    { id: 'muelle', at: [8, 2.6], axis: 'v', width: 1.2, hinge: 'min' },
    { id: 'porton', at: [8, 14.8], axis: 'v', width: 1.3, hinge: 'max' },
    { id: 'aduana', at: [8, 21.5], axis: 'v', width: 1.2, hinge: 'min' },
    // Customs
    { id: 'aduana-patio', at: [12.5, 17], axis: 'h', width: 1.2, hinge: 'min' },
    { id: 'insp-oficina', at: [16, 19.2], axis: 'v', width: 1.0, hinge: 'min', barricade: true },
    { id: 'insp-archivo', at: [16, 24.0], axis: 'v', width: 1.0, hinge: 'max', barricade: true },
    { id: 'oficina-archivo', at: [20.2, 21.4], axis: 'h', width: 0.95, hinge: 'min' },
    // Cold store: the dock door and the front door from the truck lane, the door from the archive
    { id: 'carga', at: [27.0, 17], axis: 'h', width: 1.4, hinge: 'min', barricade: true },
    { id: 'bodega', at: [35.4, 17], axis: 'h', width: 1.3, hinge: 'max', barricade: true },
    { id: 'aduana-bodega', at: [23, 24.4], axis: 'v', width: 1.0, hinge: 'max', barricade: true },
    // The cold room's two heavy doors
    { id: 'camara', at: [31, 22.8], axis: 'v', width: 1.3, hinge: 'min', barricade: true },
    { id: 'camara-norte', at: [36.6, 19.4], axis: 'h', width: 1.2, hinge: 'max', barricade: true },
  ],

  // The customs office looks out on the truck lane.
  windows: [{ id: 'ventana-aduana', at: [19.6, 17], axis: 'h', width: 1.6 }],

  rooms: [
    { id: 'explanada', rect: [0, 0, 8, 28] },
    { id: 'sitioA', rect: [31.4, 3.6, 7.2, 4.8] },
    { id: 'sitioB', rect: [32.0, 20.2, 6.4, 5.2] },
    { id: 'muelle', rect: [8, 1, 31, 2.4] },
    { id: 'contenedores', rect: [8, 3.4, 31, 7.8] },
    { id: 'carril', rect: [8, 11.2, 31, 5.8] },
    { id: 'inspeccion', rect: [8, 17, 8, 9] },
    { id: 'oficinaAduana', rect: [16, 17, 7, 4.4] },
    { id: 'archivo', rect: [16, 21.4, 7, 4.6] },
    { id: 'camara', rect: [31, 19.4, 8, 6.6] },
    { id: 'bodega', rect: [23, 17, 16, 9] },
  ],

  floors: [
    { rect: [0, 0, 40, 1], material: 'harborWater' },
    { rect: [1, 1, 7, 25], material: 'yardAsphalt' },
    { rect: [8, 1, 31, 2.4], material: 'quayConcrete' },
    { rect: [8, 3.4, 31, 7.8], material: 'portConcrete' },
    { rect: [8, 11.2, 31, 5.8], material: 'yardAsphalt' },
    { rect: [8, 17, 8, 9], material: 'customsTiles' },
    { rect: [16, 17, 7, 9], material: 'customsCarpet' },
    { rect: [23, 17, 16, 9], material: 'siteConcrete' },
    { rect: [31, 19.4, 8, 6.6], material: 'coldFloor' },
  ],

  zones: {
    spawn: { rect: [2.5, 11, 5, 6] },
  },

  // A: the open stacking area at the yard's east end. B: the cold room, behind its racks.
  sites: [
    { id: 'A', rect: [31.4, 3.6, 7.2, 4.8], bomb: [36.4, 6.0] },
    { id: 'B', rect: [32.0, 20.2, 6.4, 5.2], bomb: [37.0, 24.4] },
  ],

  entries: [
    {
      id: 'muelle',
      door: 'muelle',
      spawns: [
        { at: [6.4, 2.2], facing: 0 },
        { at: [6.4, 3.6], facing: 0 },
        { at: [5.0, 3.0], facing: 0 },
      ],
    },
    {
      id: 'porton',
      door: 'porton',
      spawns: [
        { at: [6.2, 14.2], facing: 0 },
        { at: [6.2, 15.6], facing: 0 },
        { at: [4.8, 14.9], facing: 0 },
      ],
    },
    {
      id: 'aduana',
      door: 'aduana',
      spawns: [
        { at: [6.2, 20.8], facing: 0 },
        { at: [6.2, 22.2], facing: 0 },
        { at: [4.8, 21.5], facing: 0 },
      ],
    },
  ],
  defaultEntry: 'porton',

  // Defenders set up east of the line: the yard and the truck lane past the
  // middle of the container rows, the customs offices and the whole cold store.
  deployment: {
    line: [[22, 1], [22, 17], [16, 17], [16, 26]],
    attackers: [[1, 1, 7, 25]],
    defenders: [[22, 1, 17, 16], [16, 17, 23, 9]],
  },

  paint: [
    { kind: 'site', rect: [31.4, 3.6, 7.2, 4.8], text: 'A', color: '#f2c230' },
    { kind: 'site', rect: [32.0, 20.2, 6.4, 5.2], text: 'B', color: '#f2c230' },
    { kind: 'arrow', at: [23.6, 7.2], size: 1.2, rot: 0, text: 'A', color: '#f2c230' },
    { kind: 'arrow', at: [24.0, 12.4], size: 1.1, rot: 0, text: 'B', color: '#f2c230' },
    { kind: 'text', at: [4.0, 16.0], size: 0.62, text: 'DESPLIEGUE', color: '#e8e2d0' },
    { kind: 'stripes', rect: [6.9, 12.2, 0.5, 5.2], color: '#e3b51e' },
  ],

  props: [
    // --- truck staging: a queue of trucks, the gatehouse, barriers
    { type: 'trailer', at: [2.9, 6.8], rot: 90, color: '#2f6db0' },
    { type: 'van', at: [2.7, 21.0], rot: 90 },
    { type: 'guardBooth', at: [6.9, 11.0], rot: 270 },
    { type: 'barrier', at: [6.6, 17.6], rot: 0 },
    { type: 'barrier', at: [6.6, 24.8], rot: 0 },
    { type: 'cone', at: [7.2, 12.9], rot: 0 },
    { type: 'cone', at: [7.2, 16.6], rot: 0 },
    { type: 'bin', at: [1.6, 25.3], rot: 0 },

    // --- the quay: bollards along the edge, a coil of mooring line
    ...[11, 17, 23, 29, 35].map((x) => ({ type: 'bollard', at: [x, 1.45], rot: 0 })),
    { type: 'crateStack', at: [15.5, 2.75], rot: 0 },
    { type: 'crateStack', at: [26.0, 1.85], rot: 0 },
    { type: 'barrel', at: [27.2, 1.6], rot: 0 },
    { type: 'pallet', at: [12.6, 2.75], rot: 0 },

    // --- container rows (north y 3.4-5.8, south y 8.6-11.0) and the lane between them
    { type: 'container', at: [12.8, 4.6], rot: 0, color: '#b0402e' },
    { type: 'containerStack', at: [20.4, 4.6], rot: 0, color: '#2f6db0' },
    { type: 'container', at: [28.0, 4.6], rot: 0, color: '#3f7f52' },
    { type: 'container', at: [12.0, 9.8], rot: 0, color: '#c98a2a' },
    { type: 'containerStack', at: [19.6, 9.8], rot: 0, color: '#8e8a84' },
    { type: 'container', at: [27.0, 9.8], rot: 0, color: '#2f6db0' },
    { type: 'containerStack', at: [36.0, 9.8], rot: 0, color: '#b0402e' },
    { type: 'barrel', at: [16.2, 7.6], rot: 0 },
    { type: 'barrel', at: [16.8, 7.9], rot: 0 },
    { type: 'crate', at: [24.4, 7.0], rot: 0 },
    { type: 'crateStack', at: [30.2, 7.4], rot: 0 },

    // --- site A: the stacking area, crates and a forklift
    { type: 'crateStack', at: [33.0, 4.4], rot: 0 },
    { type: 'crate', at: [34.3, 7.6], rot: 0 },
    { type: 'forklift', at: [38.0, 5.2], rot: 0 },
    { type: 'pallet', at: [35.6, 4.2], rot: 0 },
    { type: 'barrel', at: [32.2, 7.8], rot: 0 },

    // --- the truck lane: a parked trailer, a forklift, jersey barriers
    { type: 'trailer', at: [17.0, 14.0], rot: 0, color: '#d6d2c8' },
    { type: 'barrier', at: [27.6, 13.0], rot: 0 },
    { type: 'barrier', at: [33.4, 14.4], rot: 0 },
    { type: 'forklift', at: [24.0, 15.4], rot: 90 },
    { type: 'crateStack', at: [30.2, 16.0], rot: 0 },
    { type: 'crate', at: [11.2, 16.1], rot: 0 },
    { type: 'cone', at: [37.4, 12.6], rot: 0 },

    // --- customs: inspection hall (scanner, tables, seized goods)
    { type: 'xrayScanner', at: [10.6, 19.6], rot: 0 },
    { type: 'counter', at: [14.6, 19.8], rot: 90 },
    { type: 'officeChair', at: [15.3, 19.8], rot: 270 },
    { type: 'table', at: [11.0, 23.6], rot: 0 },
    { type: 'table', at: [13.8, 23.6], rot: 0 },
    { type: 'crateStack', at: [9.0, 25.2], rot: 0 },
    { type: 'crate', at: [10.4, 25.3], rot: 0 },
    { type: 'barrel', at: [15.4, 25.4], rot: 0 },
    { type: 'bench', at: [9.0, 17.6], rot: 0 },
    // office
    { type: 'desk', at: [18.2, 20.5], rot: 180 },
    { type: 'officeChair', at: [18.2, 19.75], rot: 0 },
    { type: 'desk', at: [21.6, 20.5], rot: 180 },
    { type: 'officeChair', at: [21.6, 19.75], rot: 0 },
    { type: 'cabinet', at: [22.6, 17.55], rot: 180 },
    { type: 'cabinet', at: [22.0, 17.55], rot: 180 },
    { type: 'plant', at: [16.5, 17.5], rot: 0 },
    // archive
    { type: 'bookshelf', at: [17.3, 25.6], rot: 180 },
    { type: 'bookshelf', at: [19.5, 25.6], rot: 180 },
    { type: 'bookshelf', at: [21.0, 23.0], rot: 90 },
    { type: 'cabinet', at: [16.5, 22.0], rot: 90 },
    { type: 'cabinet', at: [16.5, 22.6], rot: 90 },

    // --- cold store: loading hall
    { type: 'forklift', at: [26.0, 20.8], rot: 0 },
    { type: 'rack', at: [27.4, 23.6], rot: 0 },
    { type: 'crateStack', at: [24.2, 25.2], rot: 0 },
    { type: 'crateStack', at: [25.6, 25.2], rot: 0 },
    { type: 'crate', at: [29.6, 25.3], rot: 0 },
    { type: 'pallet', at: [28.8, 19.4], rot: 0 },
    { type: 'crateStack', at: [30.0, 18.2], rot: 0 },
    { type: 'crate', at: [38.2, 18.2], rot: 0 },
    { type: 'pallet', at: [33.0, 18.2], rot: 0 },

    // --- the cold room (site B): racks of boxes, the evaporators
    { type: 'coldRack', at: [33.6, 21.0], rot: 0 },
    { type: 'coldRack', at: [33.6, 25.4], rot: 180 },
    { type: 'coldRack', at: [37.6, 21.4], rot: 0 },
    { type: 'crate', at: [35.0, 23.8], rot: 0 },
    { type: 'evaporator', at: [38.75, 23.6], rot: 270 },
    { type: 'evaporator', at: [31.25, 20.6], rot: 90 },
  ],

  // Defender set-up per site (warehouse.js has the format). The first three are played.
  defense: {
    A: [
      // Anchor behind the forklift, down the middle lane.
      { at: [37.8, 7.0], facing: 178 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // On the quay at the end of the containers, watching where the quay opens on the site.
      { at: [31.8, 2.0], facing: -150 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'hold', reactsToNoise: true } },
      // On the apron, watching the gap into the site from the truck lane.
      { at: [33.0, 12.4], facing: 180 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true } },
      { at: [37.0, 12.0], facing: -160 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: 170 * DEG, to: 230 * DEG, period: 6, reactsToNoise: true } },
    ],
    B: [
      // Anchor in the cold room's corner, on the west door.
      { at: [38.0, 25.2], facing: -161 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // Behind the racks, on the north door (lays the traps).
      { at: [35.4, 22.6], facing: -60 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'hold', reactsToNoise: true } },
      // In the loading hall by the archive door, facing the dock door across the hall.
      { at: [24.4, 21.0], facing: 20 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true } },
      // The customs office, at its window on the truck lane.
      { at: [21.0, 18.0], facing: -100 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: -130 * DEG, to: -60 * DEG, period: 6, reactsToNoise: true } },
    ],
  },

  aiBarricades: {
    A: ['insp-oficina', 'aduana-bodega', 'carga'],
    B: ['aduana-bodega', 'carga', 'insp-archivo'],
  },

  // The Trampero's traps: in the gaps into site A, past the cold room's doors.
  aiTraps: {
    A: [[31.6, 9.8], [31.0, 2.2]],
    B: [[31.8, 22.8], [36.6, 20.2]],
  },

  cameraMounts: [
    { id: 'grua', at: [38.6, 1.4], facing: 165 * DEG }, // the quay and site A from the crane's corner
    { id: 'carril-medio', at: [38.6, 7.2], facing: 180 * DEG }, // down the middle lane
    { id: 'anden', at: [38.6, 16.6], facing: -170 * DEG }, // down the truck lane
    { id: 'porton', at: [8.4, 16.6], facing: -15 * DEG }, // the truck gate from inside (found early)
    { id: 'bodega', at: [23.4, 17.4], facing: 40 * DEG }, // the loading hall: the dock door and the cold room's
    { id: 'camara', at: [38.6, 19.8], facing: 150 * DEG }, // the cold room and site B
    { id: 'archivo', at: [22.6, 25.6], facing: -140 * DEG }, // the archive: the door from the inspection hall
  ],

  aiCameras: {
    A: ['grua', 'anden'],
    B: ['camara', 'bodega'],
  },

  // The attacking AI: A along the quay or the truck lane; B through customs or the truck lane.
  aiEntries: {
    A: { muelle: 2, porton: 1 },
    B: { aduana: 2, porton: 1 },
  },

  camera: { start: [12.0, 13.0], height: 22, frame: [1.0, 1.0, 23, 25], defendFrame: [15.5, 1.0, 24, 25] },
};
