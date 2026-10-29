// "Operación Embajada" — the map of information, pure data (meters, x right, y down).
//
//  Layout:  the street (attacker spawn, west) | a residence around a courtyard:
//           the west wing (garage, the entrance passage, the kitchen), the
//           library and the secretariat to the north, the dining room and
//           the drawing room to the south, and a gallery that runs all the
//           way round the courtyard. The office (site A) closes the courtyard
//           on the east, with the gallery passing behind it.
//
// What it rewards (the map's reading, `traits`):
//   - the gallery is a full loop: whoever rotates around it shows up behind
//     the enemy (Merodeador; Explorador hears him coming; bad for Escudo,
//     flanked by the ring);
//   - every side of the courtyard has windows: the gallery, and the office
//     itself, see across it (Vigía with cameras on the gallery, Tirador
//     defensor from the office; smoke and gas blind them);
//   - the main gate opens straight onto the courtyard, in plain view;
//   - site B, the dining room, is open on three sides (hard to anchor).
//
// Same format as warehouse.js (see its header for the conventions).

const DEG = Math.PI / 180;

export default {
  id: 'embassy',
  name: 'Operación Embajada',
  size: { w: 40, h: 28 },

  // Warm sandstone walls, a walnut baseboard (render only).
  palette: { wall: '#c8b897', exterior: '#8c7a60', baseboard: '#4f3b28' },

  // The map's reading on its card before the game (ui/MapPreview.js; hotel.js has the format).
  traits: ['Una galería que da la vuelta completa al patio', 'Ventanas al patio por los cuatro lados', 'La portada da al patio, a la vista de todos'],
  siteNames: { A: 'el despacho', B: 'el comedor' },
  siteTraits: {
    A: ['Dos puertas: la galería norte y la galería este', 'Dos ventanas al patio: se ve y lo ven', 'La galería pasa por detrás'],
    B: ['Abierto por tres lados: la cocina, la galería y el salón', 'Mesa larga: cobertura baja', 'Se llega desde la galería por cualquier lado del anillo'],
  },

  walls: [
    // the street's fence
    { a: [1, 2], b: [8, 2], t: 0.3, kind: 'fence' },
    { a: [1, 26], b: [8, 26], t: 0.3, kind: 'fence' },
    { a: [1, 2], b: [1, 26], t: 0.3, kind: 'fence' },
    // the residence's shell
    { a: [8, 2], b: [39, 2], t: 0.4 },
    { a: [8, 26], b: [39, 26], t: 0.4 },
    { a: [8, 2], b: [8, 26], t: 0.4 },
    { a: [39, 2], b: [39, 26], t: 0.4 },
    // west wing: garage | entrance passage | kitchen, and its wall on the gallery
    { a: [14.6, 2], b: [14.6, 26] },
    { a: [8, 12.6], b: [14.6, 12.6] },
    { a: [8, 15.4], b: [14.6, 15.4] },
    // north rooms: library | secretariat, over the north gallery
    { a: [14.6, 6.6], b: [39, 6.6] },
    { a: [26, 2], b: [26, 6.6] },
    // the courtyard and the office, inside the gallery's ring
    { a: [17, 9], b: [35.4, 9] },
    { a: [17, 19], b: [35.4, 19] },
    { a: [17, 9], b: [17, 19] },
    { a: [29, 9], b: [29, 19] },
    { a: [35.4, 9], b: [35.4, 19] },
    // south rooms: dining room | drawing room, under the south gallery
    { a: [14.6, 21.4], b: [39, 21.4] },
    { a: [27, 21.4], b: [27, 26] },
  ],

  // `barricade`: the 7 doors the defenders may block (the office's, the dining room's and the kitchen's and garage's onto the gallery).
  doors: [
    // From the street: the garage's side door, the main gate, the kitchen's service door
    { id: 'garaje', at: [8, 6.0], axis: 'v', width: 1.2, hinge: 'min' },
    { id: 'portada', at: [8, 14.0], axis: 'v', width: 1.4, hinge: 'min' },
    { id: 'entrada-cocina', at: [8, 22.4], axis: 'v', width: 1.1, hinge: 'max' },
    // West wing onto the gallery and the rooms
    { id: 'garaje-biblioteca', at: [14.6, 4.3], axis: 'v', width: 1.0, hinge: 'min' },
    { id: 'garaje-galeria', at: [14.6, 9.6], axis: 'v', width: 1.1, hinge: 'max', barricade: true },
    { id: 'cocina-galeria', at: [14.6, 18.2], axis: 'v', width: 1.0, hinge: 'min', barricade: true },
    { id: 'cocina-comedor', at: [14.6, 23.7], axis: 'v', width: 1.1, hinge: 'max', barricade: true },
    // North rooms
    { id: 'biblioteca', at: [20.0, 6.6], axis: 'h', width: 1.1, hinge: 'min' },
    { id: 'biblioteca-secretaria', at: [26, 4.3], axis: 'v', width: 1.0, hinge: 'max' },
    { id: 'secretaria', at: [30.0, 6.6], axis: 'h', width: 1.1, hinge: 'max' },
    { id: 'secretaria-este', at: [37.2, 6.6], axis: 'h', width: 1.0, hinge: 'min' },
    // The courtyard's doors
    { id: 'patio-norte', at: [23.0, 9], axis: 'h', width: 1.2, hinge: 'min' },
    { id: 'patio-sur', at: [23.0, 19], axis: 'h', width: 1.2, hinge: 'max' },
    // The office (site A): from the north gallery and from the east gallery
    { id: 'despacho-norte', at: [32.2, 9], axis: 'h', width: 1.1, hinge: 'max', barricade: true },
    { id: 'despacho-este', at: [35.4, 15.8], axis: 'v', width: 1.1, hinge: 'min', barricade: true },
    // South rooms
    { id: 'comedor-salon', at: [27, 23.7], axis: 'v', width: 1.4, hinge: 'min', barricade: true },
    { id: 'salon-galeria', at: [33.0, 21.4], axis: 'h', width: 1.1, hinge: 'max', barricade: true },
  ],

  // The entrance passage opens on the west gallery, and the gallery on the
  // courtyard through an arch; the dining room is open to the south gallery.
  openings: [
    { id: 'zaguan', at: [14.6, 14.0], axis: 'v', width: 2.0 },
    { id: 'arco-patio', at: [17, 14.0], axis: 'v', width: 2.0 },
    { id: 'comedor-galeria', at: [20.8, 21.4], axis: 'h', width: 2.4 },
  ],

  // Windows onto the courtyard on all four sides (the office's included).
  windows: [
    { id: 'ventana-gn1', at: [20.0, 9], axis: 'h', width: 1.4 },
    { id: 'ventana-gn2', at: [26.0, 9], axis: 'h', width: 1.4 },
    { id: 'ventana-gs1', at: [20.0, 19], axis: 'h', width: 1.4 },
    { id: 'ventana-gs2', at: [26.0, 19], axis: 'h', width: 1.4 },
    { id: 'ventana-go1', at: [17, 11.2], axis: 'v', width: 1.4 },
    { id: 'ventana-go2', at: [17, 16.8], axis: 'v', width: 1.4 },
    { id: 'ventana-despacho1', at: [29, 11.6], axis: 'v', width: 1.4 },
    { id: 'ventana-despacho2', at: [29, 16.4], axis: 'v', width: 1.4 },
  ],

  rooms: [
    { id: 'sitioA', rect: [29.6, 9.6, 5.2, 8.8] },
    { id: 'sitioB', rect: [15.4, 21.8, 11.0, 3.8] },
    { id: 'calle', rect: [0, 0, 8, 28] },
    { id: 'garaje', rect: [8, 2, 6.6, 10.6] },
    { id: 'zaguan', rect: [8, 12.6, 6.6, 2.8] },
    { id: 'cocina', rect: [8, 15.4, 6.6, 10.6] },
    { id: 'patio', rect: [17, 9, 12, 10] },
    { id: 'despacho', rect: [29, 9, 6.4, 10] },
    { id: 'biblioteca', rect: [14.6, 2, 11.4, 4.6] },
    { id: 'secretaria', rect: [26, 2, 13, 4.6] },
    { id: 'comedor', rect: [14.6, 21.4, 12.4, 4.6] },
    { id: 'salon', rect: [27, 21.4, 12, 4.6] },
    { id: 'galeria', rect: [14.6, 6.6, 24.4, 14.8] },
  ],

  floors: [
    { rect: [1, 2, 7, 24], material: 'yardAsphalt' },
    { rect: [8, 2, 6.6, 10.6], material: 'siteConcrete' },
    { rect: [8, 12.6, 6.6, 2.8], material: 'marbleTiles' },
    { rect: [8, 15.4, 6.6, 10.6], material: 'kitchenChecker' },
    { rect: [14.6, 6.6, 24.4, 14.8], material: 'galleryTiles' },
    { rect: [17, 9, 12, 10], material: 'courtyardStone' },
    { rect: [29, 9, 6.4, 10], material: 'loungeWood' },
    { rect: [30.0, 12.2, 4.4, 3.6], material: 'embassyRug' },
    { rect: [14.6, 2, 11.4, 4.6], material: 'loungeWood' },
    { rect: [17.6, 3.4, 5.2, 2.4], material: 'suiteRug' },
    { rect: [26, 2, 13, 4.6], material: 'embassyCarpet' },
    { rect: [14.6, 21.4, 12.4, 4.6], material: 'suiteWood' },
    { rect: [17.4, 22.6, 6.8, 2.8], material: 'redRug' },
    { rect: [27, 21.4, 12, 4.6], material: 'suiteWood' },
    { rect: [30.4, 22.4, 5.2, 3.0], material: 'embassyRug' },
  ],

  zones: {
    spawn: { rect: [2.5, 11, 5, 6] },
  },

  // A: the office, by the desk. B: the dining room, at the end of the table.
  sites: [
    { id: 'A', rect: [29.6, 9.6, 5.2, 8.8], bomb: [33.6, 17.4] },
    { id: 'B', rect: [15.4, 21.8, 11.0, 3.8], bomb: [25.2, 24.8] },
  ],

  entries: [
    {
      id: 'garaje',
      door: 'garaje',
      spawns: [
        { at: [6.2, 5.4], facing: 0 },
        { at: [6.2, 6.8], facing: 0 },
        { at: [4.8, 6.1], facing: 0 },
      ],
    },
    {
      id: 'portada',
      door: 'portada',
      spawns: [
        { at: [6.2, 13.3], facing: 0 },
        { at: [6.2, 14.7], facing: 0 },
        { at: [4.8, 14.0], facing: 0 },
      ],
    },
    {
      id: 'cocina',
      door: 'entrada-cocina',
      spawns: [
        { at: [6.2, 21.7], facing: 0 },
        { at: [6.2, 23.1], facing: 0 },
        { at: [4.8, 22.4], facing: 0 },
      ],
    },
  ],
  defaultEntry: 'portada',

  // Defenders set up east of the west wing: the gallery's whole ring and every room off it.
  deployment: {
    line: [[14.6, 2], [14.6, 26]],
    attackers: [[1, 2, 7, 24]],
    defenders: [[14.6, 2, 24.4, 24]],
  },

  paint: [
    { kind: 'site', rect: [29.6, 9.6, 5.2, 8.8], text: 'A', color: '#f2c230' },
    { kind: 'site', rect: [15.4, 21.8, 11.0, 3.8], text: 'B', color: '#f2c230' },
    { kind: 'text', at: [4.4, 9.4], size: 0.62, text: 'DESPLIEGUE', color: '#e8e2d0' },
    { kind: 'stripes', rect: [6.9, 11.4, 0.5, 5.2], color: '#e3b51e' },
  ],

  props: [
    // --- the street: the ambassador's car, bollards, flags at the gate
    { type: 'sedan', at: [3.2, 20.0], rot: 90, color: '#1d2126' },
    { type: 'flagPole', at: [7.3, 11.6], rot: 0 },
    { type: 'flagPole', at: [7.3, 16.4], rot: 0 },
    ...[3.8, 8.6, 19.0, 24.2].map((y) => ({ type: 'bollard', at: [7.4, y], rot: 0 })),
    { type: 'planter', at: [2.2, 3.2], rot: 0 },
    { type: 'bin', at: [1.6, 25.3], rot: 0 },

    // --- garage: the embassy car, shelving, tools
    { type: 'sedan', at: [11.4, 7.2], rot: 90, color: '#2b3a52' },
    { type: 'rack', at: [8.65, 10.4], rot: 90 },
    { type: 'crateStack', at: [13.7, 11.7], rot: 0 },
    { type: 'barrel', at: [8.8, 2.8], rot: 0 },
    { type: 'barrel', at: [9.5, 2.8], rot: 0 },

    // --- entrance passage: plants by the gate
    { type: 'plant', at: [9.0, 13.0], rot: 0 },
    { type: 'plant', at: [9.0, 15.0], rot: 0 },

    // --- kitchen
    { type: 'counter', at: [10.2, 15.85], rot: 0 },
    { type: 'counter', at: [9.8, 25.55], rot: 180 },
    { type: 'stove', at: [11.4, 25.55], rot: 180 },
    { type: 'sink', at: [12.5, 25.55], rot: 180 },
    { type: 'fridge', at: [13.8, 25.4], rot: 180 },
    { type: 'table', at: [11.4, 19.8], rot: 0 },
    { type: 'chair', at: [10.8, 19.0], rot: 0 },
    { type: 'chair', at: [12.0, 20.6], rot: 180 },

    // --- library
    ...[16.0, 18.1, 20.2, 22.3].map((x) => ({ type: 'bookshelf', at: [x, 2.45], rot: 0 })),
    { type: 'table', at: [20.2, 4.6], rot: 0 },
    { type: 'chair', at: [19.6, 5.4], rot: 180 },
    { type: 'chair', at: [20.8, 3.8], rot: 0 },
    { type: 'armchair', at: [24.9, 5.5], rot: 0 },
    { type: 'globe', at: [24.9, 3.0], rot: 0 },

    // --- secretariat
    { type: 'desk', at: [28.6, 3.6], rot: 0 },
    { type: 'officeChair', at: [28.6, 4.4], rot: 180 },
    { type: 'desk', at: [32.4, 3.6], rot: 0 },
    { type: 'officeChair', at: [32.4, 4.4], rot: 180 },
    { type: 'cabinet', at: [38.4, 2.6], rot: 270 },
    { type: 'cabinet', at: [38.4, 3.2], rot: 270 },
    { type: 'plant', at: [35.4, 2.6], rot: 0 },

    // --- the gallery: benches, plants at the corners, the flags of the hall of honor
    { type: 'plant', at: [15.1, 7.1], rot: 0 },
    { type: 'plant', at: [15.1, 20.9], rot: 0 },
    { type: 'bench', at: [25.0, 6.95], rot: 0 },
    { type: 'bench', at: [28.2, 21.05], rot: 180 },
    { type: 'plant', at: [38.5, 7.1], rot: 0 },
    { type: 'plant', at: [38.5, 20.9], rot: 0 },
    { type: 'flagStand', at: [38.5, 13.0], rot: 0 },
    { type: 'flagStand', at: [38.5, 14.6], rot: 0 },
    { type: 'bench', at: [38.65, 10.6], rot: 270 },
    { type: 'bench', at: [38.65, 17.6], rot: 270 },

    // --- courtyard: the fountain and four planters
    { type: 'fountain', at: [23.0, 14.0], rot: 0 },
    { type: 'planter', at: [19.8, 11.2], rot: 0 },
    { type: 'planter', at: [26.2, 11.2], rot: 0 },
    { type: 'planter', at: [19.8, 16.8], rot: 0 },
    { type: 'planter', at: [26.2, 16.8], rot: 0 },

    // --- the office (site A)
    { type: 'execDesk', at: [32.4, 11.6], rot: 180 },
    { type: 'officeChair', at: [32.4, 10.8], rot: 0 },
    { type: 'armchair', at: [31.8, 13.3], rot: 180 },
    { type: 'armchair', at: [33.0, 13.3], rot: 180 },
    { type: 'bookshelf', at: [35.1, 11.6], rot: 270 },
    { type: 'flagStand', at: [34.8, 9.6], rot: 0 },
    { type: 'sofa', at: [29.9, 17.4], rot: 90 },
    { type: 'coffeeTable', at: [31.1, 17.4], rot: 90 },
    { type: 'globe', at: [34.8, 18.4], rot: 0 },

    // --- dining room (site B): the long table, the sideboard
    { type: 'table', at: [20.8, 24.0], rot: 0, size: [5.0, 1.2] },
    ...[18.9, 20.1, 21.3, 22.5].flatMap((x) => [{ type: 'chair', at: [x, 23.1], rot: 0 }, { type: 'chair', at: [x, 24.9], rot: 180 }]),
    { type: 'chair', at: [17.9, 24.0], rot: 90 },
    { type: 'chair', at: [23.7, 24.0], rot: 270 },
    { type: 'counter', at: [17.4, 25.6], rot: 180 },
    { type: 'plant', at: [26.5, 21.9], rot: 0 },

    // --- drawing room
    { type: 'piano', at: [37.6, 23.6], rot: 270 },
    { type: 'sofa', at: [33.0, 25.5], rot: 180 },
    { type: 'armchair', at: [30.8, 23.9], rot: 90 },
    { type: 'coffeeTable', at: [33.0, 24.0], rot: 0 },
    { type: 'plant', at: [27.5, 25.5], rot: 0 },
    { type: 'floorLamp', at: [35.0, 25.5], rot: 0 },
  ],

  // Defender set-up per site (warehouse.js has the format). The first three are played.
  defense: {
    A: [
      // Anchor by the sofa, on both doors (the north one far, the east one close).
      { at: [30.8, 16.4], facing: -40 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // In the east gallery, on the corner the north gallery turns.
      { at: [37.4, 14.0], facing: -100 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'hold', reactsToNoise: true } },
      // In the north gallery, facing the garage's way in.
      { at: [22.0, 8.0], facing: 170 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true } },
      { at: [37.4, 20.2], facing: 180 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: 160 * DEG, to: 220 * DEG, period: 6, reactsToNoise: true } },
    ],
    B: [
      // Anchor at the end of the table, on the kitchen door and the gallery opening.
      { at: [26.2, 25.3], facing: -160 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // In the drawing room, on the door from the gallery.
      { at: [33.0, 23.4], facing: -90 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'hold', reactsToNoise: true } },
      // At the south-west corner of the gallery, on the kitchen's door.
      { at: [18.6, 20.4], facing: 0, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true } },
      { at: [23.0, 18.2], facing: -90 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: -130 * DEG, to: -50 * DEG, period: 6, reactsToNoise: true } },
    ],
  },

  aiBarricades: {
    A: ['despacho-norte', 'garaje-galeria', 'cocina-comedor'],
    B: ['cocina-comedor', 'salon-galeria', 'garaje-galeria'],
  },

  // The Trampero's traps: past the office's doors, at the dining room's ways in.
  aiTraps: {
    A: [[32.2, 9.8], [34.6, 15.8]],
    B: [[15.4, 23.7], [20.8, 22.2]],
  },

  cameraMounts: [
    { id: 'galeria-norte', at: [38.6, 7.0], facing: 180 * DEG }, // the whole north gallery
    { id: 'galeria-sur', at: [38.6, 21.0], facing: 180 * DEG }, // the whole south gallery
    { id: 'galeria-oeste', at: [15.0, 21.0], facing: -90 * DEG }, // the west gallery and the passage
    { id: 'patio', at: [28.6, 18.6], facing: -150 * DEG }, // the courtyard from its corner
    { id: 'despacho', at: [35.0, 18.6], facing: -125 * DEG }, // the office: both doors
    { id: 'comedor', at: [26.6, 25.6], facing: -165 * DEG }, // the dining room
    { id: 'zaguan', at: [14.2, 13.0], facing: 160 * DEG }, // the main gate from inside (found early)
  ],

  aiCameras: {
    A: ['galeria-norte', 'despacho'],
    B: ['comedor', 'galeria-sur'],
  },

  // The attacking AI: A through the garage (the north gallery) or the gate; B through the kitchen or the gate.
  aiEntries: {
    A: { garaje: 2, portada: 1 },
    B: { cocina: 2, portada: 1 },
  },

  camera: { start: [12.0, 13.6], height: 21, frame: [1.0, 2.0, 22, 24], defendFrame: [14.0, 1.5, 25.5, 25] },
};
