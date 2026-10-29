// "Operación Hotel" — the map of doors, pure data (meters, x right, y down).
//
//  Layout:  service yard (attacker spawn, west) | one hotel floor: a 23 m
//           corridor with rooms 701-705 to the north, the housekeeping room,
//           the laundry (site B) and rooms 707-706 to the south, and the
//           suite at the end of the corridor (bedroom north, living room with site A).
//
// What it rewards (the map's reading, data/maps/hotel.js `traits`):
//   - the corridor is long and straight, with almost no cover: whoever walks
//     it in the open is shot from the suite door (Escudo, Tirador defensor);
//   - the suite has only two ways in, both doors: its double door at the end
//     of the corridor and the connecting door from 705 (Brecha, Ancla);
//   - rooms connected by doors (701-702-703, 704-705-suite, 707-laundry,
//     housekeeping-laundry): closed doors with no windows, where knowing what
//     is behind is the whole fight (Explorador, Trampero);
//   - no loop around a site and no windows (bad for Merodeador and Tirador).
//
// Same format as warehouse.js (see its header for the conventions).

const DEG = Math.PI / 180;

// A standard north room between walls x = a and x = b: bed against the outer
// wall, desk on the east wall, armchair and lamp on the west, and by the
// corridor the entry: a wardrobe on one side, the bathroom on the other (its
// walls are `bathroomWalls`, its doorway `bathroomOpening`). Whoever waits in
// the bathroom or behind the wardrobe is not seen from the corridor door.
const northRoom = (a, b, { tv = false } = {}) => [
  { type: 'bed', at: [a + 2.4, 3.27], rot: 0 },
  { type: 'nightstand', at: [a + 1.3, 2.45], rot: 0 },
  { type: 'nightstand', at: [a + 3.5, 2.45], rot: 0 },
  { type: 'hotelDesk', at: [b - 0.5, 8.4], rot: 270 },
  { type: 'officeChair', at: [b - 1.15, 8.4], rot: 90 },
  { type: 'wardrobe', at: [a + 0.47, 10.75], rot: 90 },
  { type: 'armchair', at: [a + 0.7, 7.6], rot: 90 },
  { type: 'floorLamp', at: [a + 0.45, 8.6], rot: 0 },
  ...(tv ? [{ type: 'tvStand', at: [b - 0.4, 5.6], rot: 270 }] : []),
  // bathroom
  { type: 'shower', at: [b - 0.6, 10.65], rot: 0 },
  { type: 'toilet', at: [b - 0.45, 12.2], rot: 270 },
  { type: 'washbasin', at: [b - 1.75, 10.42], rot: 0 },
];

// The same room on the south side of the corridor (bed against the south wall).
const southRoom = (a, b, { tv = false } = {}) => [
  { type: 'bed', at: [a + 2.4, 24.73], rot: 180 },
  { type: 'nightstand', at: [a + 1.3, 25.55], rot: 180 },
  { type: 'nightstand', at: [a + 3.5, 25.55], rot: 180 },
  { type: 'hotelDesk', at: [b - 0.5, 19.8], rot: 270 },
  { type: 'officeChair', at: [b - 1.15, 19.8], rot: 90 },
  { type: 'wardrobe', at: [a + 0.47, 17.25], rot: 90 },
  { type: 'armchair', at: [a + 0.7, 19.2], rot: 90 },
  { type: 'floorLamp', at: [a + 0.45, 20.2], rot: 0 },
  ...(tv ? [{ type: 'tvStand', at: [a + 0.4, 22.6], rot: 90 }] : []),
  // bathroom
  { type: 'shower', at: [b - 0.6, 17.35], rot: 0 },
  { type: 'toilet', at: [b - 0.45, 15.8], rot: 270 },
  { type: 'washbasin', at: [b - 1.75, 17.58], rot: 180 },
];

// A room's bathroom: 2.2 m wide against its east wall, on the corridor side.
const BATH_W = 2.2;
const bathroomWalls = (b, north) =>
  north
    ? [{ a: [b - BATH_W, 10.0], b: [b, 10.0] }, { a: [b - BATH_W, 10.0], b: [b - BATH_W, 12.8] }]
    : [{ a: [b - BATH_W, 18.0], b: [b, 18.0] }, { a: [b - BATH_W, 15.2], b: [b - BATH_W, 18.0] }];
const bathroomOpening = (room, b, north) => ({ id: `banio${room}`, at: [b - BATH_W, north ? 11.55 : 16.45], axis: 'v', width: 0.8 });
const bathroomRoom = (b, north) => ({ id: 'banio', rect: north ? [b - BATH_W, 10.0, BATH_W, 2.8] : [b - BATH_W, 15.2, BATH_W, 2.8] });

// [room number, east wall x, north side?]
const ROOMS = [[701, 13, true], [702, 17.5, true], [703, 22, true], [704, 26.5, true], [705, 31, true], [707, 26, false], [706, 31, false]];

export default {
  id: 'hotel',
  name: 'Operación Hotel',
  size: { w: 40, h: 28 },

  // Cream walls with a dark wood baseboard (render only).
  palette: { wall: '#b9ad97', exterior: '#857a6a', baseboard: '#4a3324' },

  // The map's reading on its card before the game (ui/MapPreview.js): three
  // features, and per site what tapping it on the plan shows. No class named.
  traits: ['Pasillo recto de 23 m, casi sin cobertura', 'Habitaciones comunicadas por puertas, sin ventanas', 'Sin un circuito alrededor de los sitios'],
  siteNames: { A: 'la suite', B: 'la lavandería' },
  siteTraits: {
    A: ['Solo dos puertas: la del pasillo, tras un recibidor', 'y la que la comunica con la 705', 'Sofá y sillones: cobertura baja'],
    B: ['Sin puerta al pasillo', 'Se llega por el oficio o por la 707', 'Secadoras y estanterías tapan la vista'],
  },

  walls: [
    // building exterior
    { a: [8, 2], b: [39, 2], t: 0.4 },
    { a: [8, 26], b: [39, 26], t: 0.4 },
    { a: [8, 2], b: [8, 26], t: 0.4 },
    { a: [39, 2], b: [39, 26], t: 0.4 },
    // corridor
    { a: [8, 12.8], b: [31, 12.8] },
    { a: [8, 15.2], b: [31, 15.2] },
    // north rooms 701-705
    { a: [13, 2], b: [13, 12.8] },
    { a: [17.5, 2], b: [17.5, 12.8] },
    { a: [22, 2], b: [22, 12.8] },
    { a: [26.5, 2], b: [26.5, 12.8] },
    // suite: its west wall, and bedroom | living room
    { a: [31, 2], b: [31, 26] },
    { a: [31, 11], b: [39, 11] },
    { a: [31, 15.6], b: [33.4, 15.6] }, // the suite's entry: a short hall past the door
    // south: housekeeping | laundry | 707 | 706
    { a: [14, 15.2], b: [14, 26] },
    { a: [21, 15.2], b: [21, 26] },
    { a: [26, 15.2], b: [26, 26] },
    // the rooms' bathrooms
    ...ROOMS.flatMap(([, b, north]) => bathroomWalls(b, north)),
    // service yard fence (low)
    { a: [1, 4], b: [8, 4], t: 0.3, kind: 'fence' },
    { a: [1, 24], b: [8, 24], t: 0.3, kind: 'fence' },
    { a: [1, 4], b: [1, 24], t: 0.3, kind: 'fence' },
  ],

  // `barricade`: the 8 doors the defenders may block (the ones that decide a site's ways in).
  doors: [
    // From the yard: the fire escape (room 701), the lobby door (the corridor) and the service door (housekeeping)
    { id: 'incendios', at: [8, 6.0], axis: 'v', width: 1.1, hinge: 'min' },
    { id: 'vestibulo', at: [8, 14.0], axis: 'v', width: 1.3, hinge: 'min' },
    { id: 'servicio', at: [8, 20.5], axis: 'v', width: 1.1, hinge: 'max' },
    // Room doors on the corridor
    { id: 'h701', at: [9.3, 12.8], axis: 'h', width: 1.0, hinge: 'min' },
    { id: 'h702', at: [14.3, 12.8], axis: 'h', width: 1.0, hinge: 'min' },
    { id: 'h703', at: [18.8, 12.8], axis: 'h', width: 1.0, hinge: 'min' },
    { id: 'h704', at: [23.3, 12.8], axis: 'h', width: 1.0, hinge: 'min' },
    { id: 'h705', at: [27.8, 12.8], axis: 'h', width: 1.0, hinge: 'min' },
    { id: 'oficio', at: [12.0, 15.2], axis: 'h', width: 1.1, hinge: 'max', barricade: true },
    { id: 'h707', at: [22.3, 15.2], axis: 'h', width: 1.0, hinge: 'max', barricade: true },
    { id: 'h706', at: [27.3, 15.2], axis: 'h', width: 1.0, hinge: 'max' },
    // The suite's door at the end of the corridor
    { id: 'suite', at: [31, 14.0], axis: 'v', width: 1.4, hinge: 'min', barricade: true },
    // Connecting doors
    { id: 'h701-702', at: [13, 5.6], axis: 'v', width: 0.95, hinge: 'min', barricade: true },
    { id: 'h702-703', at: [17.5, 5.6], axis: 'v', width: 0.95, hinge: 'min' },
    { id: 'h704-705', at: [26.5, 5.6], axis: 'v', width: 0.95, hinge: 'min', barricade: true },
    { id: 'h705-suite', at: [31, 5.6], axis: 'v', width: 0.95, hinge: 'max', barricade: true },
    { id: 'oficio-lav', at: [14, 22.0], axis: 'v', width: 1.1, hinge: 'max', barricade: true },
    { id: 'lav-707', at: [21, 21.0], axis: 'v', width: 1.0, hinge: 'min', barricade: true },
  ],

  // The suite's bedroom opens on its living room.
  openings: [{ id: 'arco-suite', at: [35.0, 11], axis: 'h', width: 2.0 }, ...ROOMS.map(([n, b, north]) => bathroomOpening(n, b, north))],

  rooms: [
    { id: 'patio', rect: [0, 0, 8, 28] },
    { id: 'sitioA', rect: [32.4, 16.2, 6.2, 7.4] },
    { id: 'sitioB', rect: [14.6, 18.0, 6.0, 7.4] },
    { id: 'pasillo', rect: [8, 12.8, 23, 2.4] },
    ...ROOMS.map(([, b, north]) => bathroomRoom(b, north)),
    { id: 'hab701', rect: [8, 2, 5, 10.8] },
    { id: 'hab702', rect: [13, 2, 4.5, 10.8] },
    { id: 'hab703', rect: [17.5, 2, 4.5, 10.8] },
    { id: 'hab704', rect: [22, 2, 4.5, 10.8] },
    { id: 'hab705', rect: [26.5, 2, 4.5, 10.8] },
    { id: 'dormitorio', rect: [31, 2, 8, 9] },
    { id: 'suite', rect: [31, 11, 8, 15] },
    { id: 'oficio', rect: [8, 15.2, 6, 10.8] },
    { id: 'lavanderia', rect: [14, 15.2, 7, 10.8] },
    { id: 'hab707', rect: [21, 15.2, 5, 10.8] },
    { id: 'hab706', rect: [26, 15.2, 5, 10.8] },
  ],

  floors: [
    { rect: [1, 4, 7, 20], material: 'yardAsphalt' },
    { rect: [8, 2, 23, 10.8], material: 'roomCarpet' },
    { rect: [21, 15.2, 10, 10.8], material: 'roomCarpet' },
    { rect: [8, 15.2, 6, 10.8], material: 'serviceLino' },
    { rect: [14, 15.2, 7, 10.8], material: 'laundryTiles' },
    { rect: [31, 2, 8, 24], material: 'suiteWood' },
    { rect: [33.6, 17.7, 4.0, 3.4], material: 'suiteRug' },
    { rect: [33.9, 4.4, 3.0, 1.6], material: 'suiteRug' },
    { rect: [8, 12.8, 23, 2.4], material: 'hotelCarpet' },
  ],

  zones: {
    spawn: { rect: [2.5, 11, 5, 6] },
  },

  // A: the suite's living room, behind the sofa. B: the laundry, by the washers.
  sites: [
    { id: 'A', rect: [32.4, 16.2, 6.2, 7.4], bomb: [37.0, 22.4] },
    { id: 'B', rect: [14.6, 18.0, 6.0, 7.4], bomb: [17.4, 23.4] },
  ],

  entries: [
    {
      id: 'incendios',
      door: 'incendios',
      spawns: [
        { at: [6.2, 5.4], facing: 0 },
        { at: [6.2, 6.8], facing: 0 },
        { at: [4.8, 6.4], facing: 0 },
      ],
    },
    {
      id: 'vestibulo',
      door: 'vestibulo',
      spawns: [
        { at: [4.8, 12.8], facing: 0 },
        { at: [4.8, 14.2], facing: 0 },
        { at: [4.8, 15.6], facing: 0 },
      ],
    },
    {
      id: 'servicio',
      door: 'servicio',
      spawns: [
        { at: [6.2, 20.0], facing: 0 },
        { at: [6.2, 21.4], facing: 0 },
        { at: [4.8, 21.2], facing: 0 },
      ],
    },
  ],
  defaultEntry: 'vestibulo',

  // Defenders set up east of the line: rooms 702-705, the suite, the corridor
  // past the housekeeping door and the whole south side from the laundry on.
  deployment: {
    line: [[13, 2], [13, 12.8], [14, 12.8], [14, 26]],
    attackers: [[1, 4, 7, 20]],
    defenders: [[13, 2, 26, 10.8], [14, 12.8, 25, 13.2]],
  },

  paint: [
    { kind: 'site', rect: [32.4, 16.2, 6.2, 7.4], text: 'A', color: '#f2c230' },
    { kind: 'site', rect: [14.6, 18.0, 6.0, 7.4], text: 'B', color: '#f2c230' },
    { kind: 'arrow', at: [26.0, 14.0], size: 1.2, rot: 0, text: 'A', color: '#f2c230' },
    { kind: 'arrow', at: [12.0, 14.0], size: 1.0, rot: Math.PI / 2, text: 'B', color: '#f2c230' },
    { kind: 'text', at: [3.6, 9.4], size: 0.62, text: 'DESPLIEGUE', color: '#e8e2d0' },
    { kind: 'stripes', rect: [6.9, 11.4, 0.5, 5.2], color: '#e3b51e' },
  ],

  props: [
    // --- service yard: the hotel van, barriers, the fire escape's landing
    { type: 'van', at: [4.0, 18.0], rot: 0 },
    { type: 'barrier', at: [3.2, 4.8], rot: 0 },
    { type: 'cone', at: [7.1, 9.0], rot: 0 },
    { type: 'cone', at: [7.1, 17.3], rot: 0 },
    { type: 'bin', at: [1.6, 22.9], rot: 0 },
    { type: 'bin', at: [2.2, 23.3], rot: 0 },
    { type: 'laundryCart', at: [2.4, 15.0], rot: 90 },

    // --- rooms 701-705 (north)
    ...northRoom(8, 13),
    ...northRoom(13, 17.5),
    ...northRoom(17.5, 22, { tv: true }),
    ...northRoom(22, 26.5, { tv: true }),
    ...northRoom(26.5, 31),

    // --- corridor: a luggage cart and a housekeeping cart, the only cover in 23 m
    { type: 'luggageCart', at: [17.0, 14.65], rot: 0 },
    { type: 'laundryCart', at: [25.2, 13.35], rot: 0 },

    // --- housekeeping (oficio): linen, carts, ice machine
    { type: 'linenShelf', at: [10.0, 15.62], rot: 0 },
    { type: 'laundryCart', at: [9.3, 24.9], rot: 0 },
    { type: 'laundryCart', at: [10.8, 24.9], rot: 0 },
    { type: 'vending', at: [13.0, 25.35], rot: 180 },
    { type: 'counter', at: [13.5, 18.6], rot: 270 },
    { type: 'bin', at: [8.5, 16.6], rot: 0 },

    // --- laundry (site B)
    { type: 'washer', at: [14.9, 25.4], rot: 180 },
    { type: 'washer', at: [15.7, 25.4], rot: 180 },
    { type: 'washer', at: [16.5, 25.4], rot: 180 },
    { type: 'dryerStack', at: [18.5, 25.4], rot: 180 },
    { type: 'dryerStack', at: [19.35, 25.4], rot: 180 },
    { type: 'linenShelf', at: [16.0, 15.62], rot: 0 },
    { type: 'linenShelf', at: [19.2, 15.62], rot: 0 },
    { type: 'table', at: [17.6, 19.6], rot: 0 },
    { type: 'laundryCart', at: [15.4, 19.2], rot: 90 },
    { type: 'laundryCart', at: [19.6, 23.0], rot: 0 },
    { type: 'counter', at: [20.5, 17.4], rot: 270 },

    // --- rooms 707-706 (south)
    ...southRoom(21, 26),
    ...southRoom(26, 31, { tv: true }),

    // --- suite bedroom
    { type: 'bed', at: [35.4, 3.32], rot: 0, size: [2.0, 2.1] },
    { type: 'nightstand', at: [33.95, 2.45], rot: 0 },
    { type: 'nightstand', at: [36.85, 2.45], rot: 0 },
    { type: 'bench', at: [35.4, 5.1], rot: 0 },
    { type: 'wardrobe', at: [38.47, 7.0], rot: 270 },
    { type: 'hotelDesk', at: [31.5, 9.4], rot: 90 },
    { type: 'officeChair', at: [32.15, 9.4], rot: 270 },
    { type: 'armchair', at: [38.2, 10.1], rot: 270 },
    { type: 'plant', at: [38.4, 2.6], rot: 0 },

    // --- suite living room (site A)
    { type: 'sofa', at: [34.6, 19.4], rot: 90 },
    { type: 'coffeeTable', at: [36.0, 19.4], rot: 90 },
    { type: 'tvStand', at: [38.5, 19.4], rot: 270 },
    { type: 'armchair', at: [36.0, 17.4], rot: 180 },
    { type: 'counter', at: [38.45, 13.3], rot: 270 },
    { type: 'fridge', at: [38.4, 15.0], rot: 270 },
    { type: 'armchair', at: [33.4, 12.2], rot: 0 },
    { type: 'plant', at: [31.6, 11.7], rot: 0 },
    { type: 'table', at: [34.2, 24.6], rot: 0 },
    { type: 'chair', at: [33.6, 23.8], rot: 0 },
    { type: 'chair', at: [34.8, 23.8], rot: 0 },
    { type: 'chair', at: [33.6, 25.4], rot: 180 },
    { type: 'chair', at: [34.8, 25.4], rot: 180 },
    { type: 'floorLamp', at: [31.6, 25.4], rot: 0 },
    { type: 'floorLamp', at: [38.5, 25.4], rot: 0 },
  ],

  // Defender set-up per site (warehouse.js has the format). The first three are played.
  defense: {
    A: [
      // Anchor beside the armchair: pre-aims the mouth of the suite's entry
      // hall from across the room (whoever steps out sees him at once: a fair
      // duel, won by the flash). The connecting door from 705, through the
      // bedroom, is the other way in.
      { at: [37.2, 17.0], facing: -142 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // Bedroom guard on the connecting door, behind the partition: he does not
      // see the suite door (lays the traps; on the first firefight he comes to the living room).
      { at: [33.6, 8.4], facing: -128 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'hold', reactsToNoise: true, rotate: { to: [36.4, 14.2], look: 180 * DEG } } },
      // Third defender in the suite's entry hall, beside the door: whoever
      // comes down the corridor and through it meets him at arm's length.
      { at: [34.2, 12.2], facing: 180 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true } },
      // Room 705, facing the connecting door from 704.
      { at: [29.3, 8.9], facing: -130 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: -150 * DEG, to: -100 * DEG, period: 6, reactsToNoise: true } },
    ],
    B: [
      // Anchor behind the dryers, pre-aiming the housekeeping door. Blind to
      // the door from 707 just above him: that is the flank.
      { at: [20.3, 24.2], facing: -161 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // By the linen shelves, on the door from 707 (lays the traps).
      { at: [14.8, 17.0], facing: 33 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'hold', reactsToNoise: true } },
      // Third defender at the corridor's east end, looking down it toward the lobby.
      { at: [25.5, 14.0], facing: 180 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true } },
      // Room 707, facing its corridor door.
      { at: [24.8, 20.6], facing: -115 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: -140 * DEG, to: -95 * DEG, period: 6, reactsToNoise: true } },
    ],
  },

  aiBarricades: {
    A: ['h704-705', 'h701-702', 'oficio-lav'],
    B: ['oficio-lav', 'h701-702', 'h705-suite'],
  },

  // The Trampero's traps: just past the doors into each site.
  aiTraps: {
    A: [[32.1, 14.0], [32.0, 5.6]],
    B: [[15.0, 22.0], [20.1, 21.0]],
  },

  cameraMounts: [
    { id: 'pasillo-fondo', at: [30.6, 13.1], facing: 180 * DEG }, // the whole corridor from the suite door
    { id: 'vestibulo', at: [8.45, 15.0], facing: -8 * DEG }, // the corridor from the lobby door (found early)
    { id: 'suite', at: [38.6, 25.6], facing: -135 * DEG }, // the living room: the suite door and site A
    { id: 'dormitorio', at: [38.6, 2.4], facing: 157 * DEG }, // the bedroom: the connecting door from 705
    { id: 'hab705', at: [30.6, 2.4], facing: 135 * DEG }, // room 705 from its far corner
    { id: 'lavanderia', at: [20.6, 25.6], facing: -150 * DEG }, // the laundry: the housekeeping door and site B
    { id: 'hab707', at: [25.6, 25.6], facing: -120 * DEG }, // room 707: its corridor door and the laundry door
  ],

  aiCameras: {
    A: ['pasillo-fondo', 'dormitorio'],
    B: ['lavanderia', 'hab707'],
  },

  // The attacking AI: A through the lobby (the corridor) or the service door;
  // B through the lobby (707) or the fire escape, away from the barricaded housekeeping door.
  aiEntries: {
    A: { vestibulo: 2, servicio: 1 },
    B: { vestibulo: 2, incendios: 1 },
  },

  camera: { start: [12.5, 13.6], height: 21, frame: [1.5, 4.5, 21, 19], defendFrame: [12.5, 2.5, 27, 23] },
};
