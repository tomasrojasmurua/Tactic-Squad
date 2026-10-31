// "Operación Hotel" — Hotel Miramar, ground floor; pure data (meters, x right, y down).
// Design notes: docs/diseno/mapas-v2.md (4.2).
//
//  A four-star seaside hotel at night (56 × 34 m). Layout:
//    west   the street (attacker side): the lobby's door and the service stairs' door
//    north  the guest wing: rooms 101-106 along a 28 m corridor, the suite (site A) at its end
//    middle the lobby (columns, reception, the lifts), the linen room and the office,
//           the bar (site B) and the kitchen
//    south  the terrace on the garden: loungers, planters, the bar's windows
//
// Three lanes: the corridor (doors on both sides, trolleys for cover), the
// lobby (open, columns) and the terrace (outside, looking in through the
// bar's windows). The kitchen joins the two sites from the inside: the
// bar's swing door and the suite's room-service door.
//
// Same format as training.js (see its header for the conventions).

const DEG = Math.PI / 180;

// A guest room between walls x = a and x = b on the north side of the corridor
// (y 1 to 8.6): the bed against the outer wall, the bathroom by the corridor
// (on the east, or the west when `mirror`), the corridor door on the other side.
// No two alike: `twin` beds, a `tv`, a desk on the free wall, a `case` left open.
const ROOM_Y = 8.6;
const BATH_W = 2.0;
const BATH_Y = 6.0;
const roomDoorX = (a, b, mirror) => (mirror ? b - 0.9 : a + 0.9);
const bathX = (a, b, mirror) => (mirror ? a : b - BATH_W); // west edge of the bathroom
function roomWalls(a, b, mirror) {
  const x0 = bathX(a, b, mirror);
  const inner = mirror ? x0 + BATH_W : x0; // the bathroom's wall inside the room
  return [{ a: [x0, BATH_Y], b: [x0 + BATH_W, BATH_Y] }, { a: [inner, BATH_Y], b: [inner, ROOM_Y] }];
}
function roomOpening(n, a, b, mirror) {
  const x0 = bathX(a, b, mirror);
  return { id: `banio${n}`, at: [mirror ? x0 + BATH_W : x0, 6.95], axis: 'v', width: 0.8 };
}
function roomProps(a, b, { mirror = false, twin = false, tv = false, desk = null, lounge = true, mess = false } = {}) {
  const mid = (a + b) / 2;
  const bx = bathX(a, b, mirror);
  const out = twin
    ? [
        { type: 'bed', at: [mid - 1.05, 2.3], rot: 0, size: [1.0, 2.05] },
        { type: 'bed', at: [mid + 1.05, 2.3], rot: 0, size: [1.0, 2.05] },
        { type: 'nightstand', at: [mid, 1.45], rot: 0 },
      ]
    : [
        { type: 'bed', at: [mid, 2.3], rot: 0 },
        { type: 'nightstand', at: [mid - 1.1, 1.45], rot: 0 },
        { type: 'nightstand', at: [mid + 1.1, 1.45], rot: 0 },
      ];
  // the wardrobe against the bathroom's outer wall, facing the room
  out.push({ type: 'wardrobe', at: [bx + BATH_W / 2, BATH_Y - 0.48], rot: 180, size: [1.3, 0.6] });
  if (desk === 'west') out.push({ type: 'hotelDesk', at: [a + 0.45, 4.3], rot: 90 }, { type: 'officeChair', at: [a + 1.05, 4.3], rot: 270 });
  if (desk === 'east') out.push({ type: 'hotelDesk', at: [b - 0.45, 4.3], rot: 270 }, { type: 'officeChair', at: [b - 1.05, 4.3], rot: 90 });
  if (lounge) {
    const lx = mirror ? b - 0.75 : a + 0.75;
    out.push({ type: 'armchair', at: [lx, 6.6], rot: mirror ? 270 : 90 });
  }
  if (tv) out.push({ type: 'tvStand', at: [mid, 5.5 - 0.6], rot: 180, size: [1.2, 0.45] });
  if (mess) out.push({ type: 'luggageCart', at: [mid + (mirror ? 0.6 : -0.6), 4.4], rot: 15 });
  // bathroom
  const r = mirror ? bx + 0.62 : bx + BATH_W - 0.62;
  out.push(
    { type: 'shower', at: [r, 6.62], rot: 0 },
    { type: 'toilet', at: [r + (mirror ? -0.02 : 0.02), 8.0], rot: mirror ? 90 : 270 },
    { type: 'washbasin', at: [mirror ? bx + BATH_W - 0.4 : bx + 0.4, 8.05], rot: mirror ? 270 : 90 },
  );
  return out;
}

// [number, west wall, east wall, mirror]
const ROOMS = [[101, 12, 16.6, false], [102, 16.6, 21.2, true], [103, 21.2, 25.8, false], [104, 25.8, 30.4, true], [105, 30.4, 35, false], [106, 35, 40, true]];

export default {
  id: 'hotel',
  name: 'Operación Hotel',
  size: { w: 56, h: 34 },

  // Cream walls with a dark wood baseboard (render only).
  palette: { wall: '#b9ad97', exterior: '#857a6a', baseboard: '#4a3324' },

  traits: ['Un pasillo de 28 m con puertas a los lados', 'Vestíbulo con columnas y terraza a la vista', 'La cocina une los dos sitios por dentro'],
  siteNames: { A: 'la suite', B: 'el bar' },
  siteTraits: {
    A: ['Puertas del pasillo, la 106 y room service', 'Tabique entre dormitorio y salón: rincones', 'Ninguna ventana a la calle'],
    B: ['Cuatro accesos: arco, office, cocina, terraza', 'Barra y mesas bajas, una columna alta', 'Ventanas a la terraza: se dispara desde fuera'],
  },

  walls: [
    // building shell
    { a: [7, 1], b: [55, 1], t: 0.4 },
    { a: [7, 27], b: [55, 27], t: 0.4 },
    { a: [7, 1], b: [7, 27], t: 0.4 },
    { a: [55, 1], b: [55, 27], t: 0.4 },
    // the corridor, the guest rooms and the service stairs
    { a: [12, 8.6], b: [40, 8.6] },
    { a: [7, 11], b: [55, 11] },
    { a: [12, 1], b: [12, 11] },
    ...ROOMS.slice(1).map(([, a]) => ({ a: [a, 1], b: [a, 8.6] })),
    ...ROOMS.flatMap(([, a, b, m]) => roomWalls(a, b, m)),
    // the suite: its west wall, the bedroom's partition and the entry nook
    { a: [40, 1], b: [40, 11] },
    { a: [47, 1], b: [47, 5.4] },
    { a: [40, 8.4], b: [42.2, 8.4] },
    // the lifts' core in the lobby
    { a: [13, 13], b: [17, 13] },
    { a: [13, 11], b: [13, 13] },
    { a: [17, 11], b: [17, 13] },
    // lobby | linen room + office | bar | kitchen
    { a: [24, 11], b: [24, 27] },
    { a: [24, 14.5], b: [42, 14.5] },
    { a: [33, 11], b: [33, 14.5] },
    { a: [42, 11], b: [42, 27] },
    // street and garden fences
    { a: [1, 1], b: [7, 1], t: 0.3, kind: 'fence' },
    { a: [1, 1], b: [1, 33], t: 0.3, kind: 'fence' },
    { a: [1, 33], b: [55, 33], t: 0.3, kind: 'fence' },
    { a: [55, 27], b: [55, 33], t: 0.3, kind: 'fence' },
    { a: [7, 27], b: [7, 33], t: 0.3, kind: 'fence' },
  ],

  doors: [
    // From outside
    { id: 'vestibulo', at: [7, 19.0], axis: 'v', width: 1.6, hinge: 'min' },
    { id: 'servicio', at: [7, 5.2], axis: 'v', width: 1.1, hinge: 'max' },
    { id: 'jardin', at: [11.4, 27], axis: 'h', width: 1.4, hinge: 'min' },
    // Guest wing
    { id: 'escalera', at: [12, 9.8], axis: 'v', width: 1.1, hinge: 'max' },
    ...ROOMS.map(([n, a, b, m]) => ({ id: `h${n}`, at: [roomDoorX(a, b, m), ROOM_Y], axis: 'h', width: 0.95, hinge: m ? 'max' : 'min', barricade: n >= 104 })),
    { id: 'h101-102', at: [16.6, 4.6], axis: 'v', width: 0.9, hinge: 'min' },
    { id: 'h105-106', at: [35, 3.0], axis: 'v', width: 0.9, hinge: 'max', barricade: true },
    { id: 'h106-suite', at: [40, 4.0], axis: 'v', width: 0.9, hinge: 'min', barricade: true },
    { id: 'suite', at: [40, 9.8], axis: 'v', width: 1.4, hinge: 'min', barricade: true },
    // Service rooms
    { id: 'lenceria', at: [27.6, 11], axis: 'h', width: 1.0, hinge: 'min', barricade: true },
    { id: 'lenceria-vestibulo', at: [24, 12.8], axis: 'v', width: 1.0, hinge: 'max', barricade: true },
    { id: 'oficina', at: [36.8, 11], axis: 'h', width: 1.0, hinge: 'max', barricade: true },
    { id: 'oficina-bar', at: [40.6, 14.5], axis: 'h', width: 1.0, hinge: 'min', barricade: true },
    { id: 'room-service', at: [44.8, 11], axis: 'h', width: 1.1, hinge: 'min', barricade: true },
    { id: 'vaiven', at: [42, 21.2], axis: 'v', width: 1.3, hinge: 'max', barricade: true },
    { id: 'bar-terraza', at: [32.6, 27], axis: 'h', width: 1.4, hinge: 'max', barricade: true },
    { id: 'cocina-terraza', at: [51.4, 27], axis: 'h', width: 1.2, hinge: 'min', barricade: true },
  ],

  openings: [
    { id: 'ascensores', at: [20.4, 11], axis: 'h', width: 2.8 },
    { id: 'arco-bar', at: [24, 20.4], axis: 'v', width: 2.6 },
    { id: 'reja-jardin', at: [7, 30.0], axis: 'v', width: 2.4 },
    ...ROOMS.map(([n, a, b, m]) => roomOpening(n, a, b, m)),
  ],

  windows: [
    { id: 'ventana-vestibulo-n', at: [7, 15.0], axis: 'v', width: 1.6 },
    { id: 'ventana-vestibulo-s', at: [7, 23.6], axis: 'v', width: 1.6 },
    { id: 'ventana-vestibulo-jardin', at: [18.6, 27], axis: 'h', width: 2.0 },
    { id: 'ventana-bar-o', at: [27.4, 27], axis: 'h', width: 2.0 },
    { id: 'ventana-bar-e', at: [38.0, 27], axis: 'h', width: 2.0 },
  ],

  rooms: [
    { id: 'sitioA', rect: [40.4, 1.2, 6.4, 7.0] },
    { id: 'sitioB', rect: [30.4, 15.0, 9.8, 6.4] },
    { id: 'calle', rect: [0, 0, 7, 34] },
    { id: 'terraza', rect: [7, 27, 49, 7] },
    { id: 'escalera', rect: [7, 1, 5, 10] },
    ...ROOMS.flatMap(([n, a, b, m]) => [{ id: 'banio', rect: [bathX(a, b, m), BATH_Y, BATH_W, ROOM_Y - BATH_Y] }, { id: `hab${n}`, rect: [a, 1, b - a, ROOM_Y - 1] }]),
    { id: 'pasillo', rect: [12, 8.6, 28, 2.4] },
    { id: 'suite', rect: [40, 1, 15, 10] },
    { id: 'lenceria', rect: [24, 11, 9, 3.5] },
    { id: 'oficinaHotel', rect: [33, 11, 9, 3.5] },
    { id: 'vestibulo', rect: [7, 11, 17, 16] },
    { id: 'bar', rect: [24, 14.5, 18, 12.5] },
    { id: 'cocina', rect: [42, 11, 13, 16] },
  ],

  floors: [
    { rect: [1, 1, 6, 32], material: 'yardAsphalt' },
    { rect: [7, 27, 48, 6], material: 'terraceStone' },
    { rect: [7, 1, 5, 10], material: 'serviceLino' },
    { rect: [12, 1, 28, 7.6], material: 'roomCarpet' },
    ...ROOMS.map(([, a, b, m]) => ({ rect: [bathX(a, b, m), BATH_Y, BATH_W, ROOM_Y - BATH_Y], material: 'laundryTiles' })),
    { rect: [12, 8.6, 28, 2.4], material: 'hotelCarpet' },
    { rect: [40, 1, 15, 10], material: 'suiteWood' },
    { rect: [42.6, 5.8, 3.6, 2.6], material: 'suiteRug' },
    { rect: [7, 11, 17, 16], material: 'lobbyMarble' },
    { rect: [24, 11, 18, 3.5], material: 'serviceLino' },
    { rect: [24, 14.5, 18, 12.5], material: 'suiteWood' },
    { rect: [26.4, 21.4, 4.6, 3.6], material: 'redRug' },
    { rect: [42, 11, 13, 16], material: 'kitchenTiles' },
  ],

  zones: { spawn: { rect: [2, 16, 4, 6] } },

  // A: the suite's living room, behind the sofa. B: the bar, between the counter and the back bar.
  sites: [
    { id: 'A', rect: [40.4, 1.2, 6.4, 7.0], bomb: [46.0, 3.0] },
    { id: 'B', rect: [30.4, 15.0, 9.8, 6.4], bomb: [36.6, 16.0] },
  ],

  entries: [
    {
      id: 'servicio',
      door: 'servicio',
      frame: [1, 1, 24, 13],
      spawns: [
        { at: [4.6, 4.6], facing: 0 },
        { at: [4.6, 6.0], facing: 0 },
        { at: [3.2, 5.3], facing: 0 },
        { at: [3.2, 3.9], facing: 0 }, // 4.º (2v2)
      ],
    },
    {
      id: 'vestibulo',
      door: 'vestibulo',
      frame: [1, 12, 25, 14],
      spawns: [
        { at: [4.6, 18.3], facing: 0 },
        { at: [4.6, 19.7], facing: 0 },
        { at: [3.2, 19.0], facing: 0 },
        { at: [3.2, 17.6], facing: 0 }, // 4.º (2v2)
      ],
    },
    {
      id: 'terraza',
      door: 'jardin',
      frame: [1, 20, 25, 14],
      spawns: [
        { at: [10.8, 30.0], facing: -90 * DEG },
        { at: [12.2, 30.0], facing: -90 * DEG },
        { at: [11.5, 31.4], facing: -90 * DEG },
        { at: [10.1, 31.4], facing: -90 * DEG }, // 4.º (2v2)
      ],
    },
  ],
  defaultEntry: 'vestibulo',

  // Defenders: everything east of x = 24 (and the guest wing from room 103), the terrace's east end.
  deployment: {
    line: [[21.2, 1], [21.2, 11], [24, 11], [24, 27], [26, 27], [26, 33]],
    attackers: [[1, 1, 6, 32], [7, 27, 9, 6]],
    defenders: [[21.2, 1, 33.8, 10], [24, 11, 31, 16], [26, 27, 29, 6]],
  },

  paint: [
    { kind: 'site', rect: [40.4, 1.2, 6.4, 7.0], text: 'A', color: '#f2c230' },
    { kind: 'site', rect: [30.4, 15.0, 9.8, 6.4], text: 'B', color: '#f2c230' },
    { kind: 'arrow', at: [31.0, 9.8], size: 1.1, rot: 0, text: 'A', color: '#f2c230' },
    { kind: 'arrow', at: [20.4, 20.4], size: 1.1, rot: 0, text: 'B', color: '#f2c230' },
    { kind: 'text', at: [3.8, 31.8], size: 0.6, text: 'DESPLIEGUE', color: '#e8e2d0' },
    { kind: 'stripes', rect: [5.6, 16.6, 0.5, 4.8], color: '#e3b51e' },
    { kind: 'text', at: [15.0, 12.0], size: 0.4, text: 'ASCENSORES', color: '#e8e2d0' },
    ...ROOMS.map(([n, a, b, m]) => ({ kind: 'text', at: [roomDoorX(a, b, m) + (m ? -1.2 : 1.2), 9.25], size: 0.36, text: `${n}`, color: '#d8c27a' })),
  ],

  props: [
    // --- the street: the hotel's shuttle at the kerb, a taxi waiting, planters by the door
    { type: 'van', at: [3.4, 10.2], rot: 90 },
    { type: 'car', at: [3.4, 27.0], rot: 90, color: '#e0a321' },
    { type: 'planter', at: [5.8, 15.6], rot: 90 },
    { type: 'planter', at: [5.8, 22.6], rot: 90 },
    { type: 'bollard', at: [2.0, 16.4], rot: 0 },
    { type: 'bollard', at: [2.0, 21.6], rot: 0 },
    { type: 'bin', at: [1.7, 2.0], rot: 0 },
    { type: 'dumpster', at: [4.4, 1.9], rot: 0 },

    // --- service stairs: the flight (railing), housekeeping's stock
    { type: 'rack', at: [8.5, 2.9], rot: 90, size: [2.6, 0.8] },
    { type: 'laundryCart', at: [10.6, 2.2], rot: 0 },
    { type: 'linenShelf', at: [11.55, 6.0], rot: 270, size: [1.6, 0.45] },

    // --- the guest wing: no two rooms alike
    ...roomProps(12, 16.6, { desk: 'west', tv: true }),
    ...roomProps(16.6, 21.2, { mirror: true, twin: true, lounge: false }),
    ...roomProps(21.2, 25.8, { desk: 'west', mess: true }),
    ...roomProps(25.8, 30.4, { mirror: true, tv: true, desk: 'east' }),
    ...roomProps(30.4, 35, { desk: 'west', tv: true }),
    ...roomProps(35, 40, { mirror: true, mess: true, lounge: false }),
    // the corridor: a housekeeping cart, a room-service trolley left outside 104, a plant
    { type: 'laundryCart', at: [23.8, 9.15], rot: 0 },
    { type: 'serviceTrolley', at: [29.0, 10.5], rot: 0 },

    // --- the suite: the bedroom behind its partition, the living room, the dining corner
    { type: 'bed', at: [50.6, 2.3], rot: 0, size: [2.0, 2.1] },
    { type: 'nightstand', at: [49.2, 1.45], rot: 0 },
    { type: 'nightstand', at: [52.0, 1.45], rot: 0 },
    { type: 'wardrobe', at: [54.5, 7.4], rot: 270 },
    { type: 'armchair', at: [48.0, 7.2], rot: 45 },
    { type: 'sofa', at: [44.4, 5.2], rot: 0 },
    { type: 'coffeeTable', at: [44.4, 6.6], rot: 0 },
    { type: 'tvStand', at: [44.4, 8.0], rot: 180 },
    { type: 'armchair', at: [41.0, 6.4], rot: 90 },
    { type: 'table', at: [43.6, 2.4], rot: 0 },
    { type: 'chair', at: [43.0, 3.2], rot: 270 },
    { type: 'chair', at: [44.2, 3.2], rot: 270 },
    { type: 'plant', at: [46.4, 1.6], rot: 0 },
    { type: 'floorLamp', at: [40.5, 1.5], rot: 0 },
    { type: 'hotelDesk', at: [52.4, 10.4], rot: 180 },
    { type: 'officeChair', at: [52.4, 9.75], rot: 0 },

    // --- the lobby: four columns, reception by the lifts, the lounge, a luggage cart left by the door
    { type: 'column', at: [12.0, 16.0], rot: 0 },
    { type: 'column', at: [19.0, 16.0], rot: 0 },
    { type: 'column', at: [12.0, 23.0], rot: 0 },
    { type: 'column', at: [19.0, 23.0], rot: 0 },
    { type: 'receptionDesk', at: [9.0, 13.2], rot: 0 },
    { type: 'officeChair', at: [8.4, 12.3], rot: 180 },
    { type: 'officeChair', at: [9.8, 12.3], rot: 200 },
    { type: 'bookshelf', at: [9.0, 11.4], rot: 180, size: [1.6, 0.4] },
    { type: 'sofa', at: [15.6, 20.0], rot: 90 },
    { type: 'coffeeTable', at: [16.9, 20.0], rot: 90 },
    { type: 'armchair', at: [18.3, 19.0], rot: 270 },
    { type: 'armchair', at: [18.3, 21.0], rot: 250 },
    { type: 'luggageCart', at: [9.6, 21.6], rot: 20 },
    { type: 'plant', at: [7.6, 26.4], rot: 0 },
    { type: 'plant', at: [23.4, 26.4], rot: 0 },
    { type: 'plant', at: [23.4, 11.6], rot: 0 },
    { type: 'bench', at: [15.0, 26.5], rot: 0 },
    { type: 'planter', at: [22.6, 23.4], rot: 90 },

    // --- linen room and office
    { type: 'linenShelf', at: [27.4, 14.0], rot: 0 },
    { type: 'linenShelf', at: [30.6, 14.0], rot: 0 },
    { type: 'laundryCart', at: [31.8, 11.9], rot: 0 },
    { type: 'washer', at: [25.2, 11.6], rot: 0 },
    { type: 'desk', at: [34.6, 13.4], rot: 180 },
    { type: 'officeChair', at: [34.6, 12.6], rot: 0 },
    { type: 'cabinet', at: [41.5, 11.8], rot: 270 },
    { type: 'cabinet', at: [41.5, 12.45], rot: 270 },
    { type: 'bookshelf', at: [39.4, 11.4], rot: 0, size: [1.6, 0.4] },

    // --- the bar (site B): the counter and the back bar, stools, tables, the piano, a column
    { type: 'backBar', at: [35.4, 14.9], rot: 0, size: [4.0, 0.45] },
    { type: 'barCounter', at: [35.4, 17.6], rot: 0 },
    { type: 'barCounter', at: [32.95, 16.4], rot: 90, size: [1.7, 0.7] },
    { type: 'barStool', at: [34.0, 18.4], rot: 0 },
    { type: 'barStool', at: [35.2, 18.4], rot: 0 },
    { type: 'barStool', at: [36.6, 18.4], rot: 0 },
    { type: 'column', at: [30.0, 20.4], rot: 0 },
    { type: 'roundTable', at: [27.0, 16.4], rot: 0 },
    { type: 'chair', at: [27.0, 15.5], rot: 90 },
    { type: 'chair', at: [27.8, 16.8], rot: 200 },
    { type: 'roundTable', at: [36.2, 22.0], rot: 0 },
    { type: 'chair', at: [35.3, 22.2], rot: 0 },
    { type: 'chair', at: [37.1, 21.6], rot: 160 },
    { type: 'roundTable', at: [39.4, 24.6], rot: 0 },
    { type: 'chair', at: [39.4, 25.5], rot: 270 },
    { type: 'roundTable', at: [33.6, 25.0], rot: 0 },
    { type: 'sofa', at: [28.7, 23.2], rot: 90, size: [2.2, 0.9] },
    { type: 'coffeeTable', at: [27.4, 23.2], rot: 90 },
    { type: 'piano', at: [25.2, 25.6], rot: 90 },
    { type: 'plant', at: [41.4, 26.4], rot: 0 },
    { type: 'plant', at: [24.7, 15.1], rot: 0 },

    // --- the kitchen: the ranges, two islands, the fridges, room service's trolley on its way out
    { type: 'kitchenRange', at: [49.6, 11.6], rot: 0 },
    { type: 'counter', at: [52.8, 11.5], rot: 0 },
    { type: 'counter', at: [47.6, 16.4], rot: 0, size: [3.0, 0.9] },
    { type: 'counter', at: [47.6, 21.0], rot: 0, size: [3.0, 0.9] },
    { type: 'fridge', at: [54.35, 15.0], rot: 270 },
    { type: 'fridge', at: [54.35, 16.0], rot: 270 },
    { type: 'sink', at: [54.45, 20.0], rot: 270, size: [1.6, 0.65] },
    { type: 'rack', at: [54.4, 24.6], rot: 90 },
    { type: 'serviceTrolley', at: [44.6, 13.2], rot: 90 },
    { type: 'bin', at: [42.6, 26.4], rot: 0 },
    { type: 'barrel', at: [48.0, 26.4], rot: 0 },

    // --- the terrace: loungers, tables under the bar's windows, planters
    { type: 'planter', at: [16.0, 27.7], rot: 0 },
    { type: 'planter', at: [22.2, 27.7], rot: 0 },
    { type: 'sunLounger', at: [16.4, 31.6], rot: 0 },
    { type: 'sunLounger', at: [19.4, 31.4], rot: 10 },
    { type: 'sunLounger', at: [22.6, 31.6], rot: -5 },
    { type: 'roundTable', at: [28.6, 29.8], rot: 0 },
    { type: 'chair', at: [27.8, 29.6], rot: 0 },
    { type: 'chair', at: [29.4, 30.2], rot: 180 },
    { type: 'roundTable', at: [36.4, 29.6], rot: 0 },
    { type: 'chair', at: [36.4, 30.5], rot: 270 },
    { type: 'planter', at: [42.6, 30.4], rot: 90 },
    { type: 'sunLounger', at: [46.6, 31.4], rot: 0 },
    { type: 'sunLounger', at: [49.8, 31.6], rot: 0 },
    { type: 'planter', at: [54.2, 30.0], rot: 90 },
    { type: 'bin', at: [53.6, 27.7], rot: 0 },
  ],

  defense: {
    A: [
      // Anchor in the bedroom's doorway, past the partition: the living room and its doors at an angle.
      { at: [49.2, 6.4], facing: -168 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // By the room-service door, the kitchen side covered; lays the traps.
      { at: [46.2, 9.6], facing: 160 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'scan', from: 140 * DEG, to: 215 * DEG, period: 6, reactsToNoise: true } },
      // In the suite's living room, on its doors (31 oct, with the suppression: the attackers won 41/38 % here).
      { at: [44.0, 3.8], facing: 180 * DEG, weapon: 'smg', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true } },
      // The office, on the corridor door.
      { at: [38.0, 13.4], facing: -120 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: -150 * DEG, to: -90 * DEG, period: 6, reactsToNoise: true } },
    ],
    B: [
      // Anchor behind the counter's end: the arch from the lobby square on, the terrace door at an angle.
      { at: [38.8, 16.2], facing: 165 * DEG, weapon: 'rifle', role: 'anchor', behavior: { type: 'hold', reactsToNoise: false } },
      // By the column: the terrace door and the windows.
      { at: [31.4, 19.6], facing: 110 * DEG, weapon: 'rifle', role: 'trapper', behavior: { type: 'scan', from: 70 * DEG, to: 170 * DEG, period: 6, reactsToNoise: true } },
      // In the kitchen by the swing door; falls back into the bar.
      { at: [45.0, 23.8], facing: -150 * DEG, weapon: 'rifle', role: 'roamer', behavior: { type: 'hold', reactsToNoise: true, rotate: { to: [39.6, 20.0], look: 180 * DEG } } },
      // The linen room, on the lobby's service door.
      { at: [28.6, 12.8], facing: 180 * DEG, weapon: 'rifle', behavior: { type: 'scan', from: 150 * DEG, to: 210 * DEG, period: 6, reactsToNoise: true } },
    ],
  },

  // Noisy floor: the bar's broken window glass on the terrace, glass in the corridor by the suite's
  // door (a broken picture frame), the kitchen's steel floor by its terrace door.
  debris: [
    { kind: 'glass', rect: [31.2, 27.6, 2.8, 1.8] },
    { kind: 'glass', rect: [37.2, 9.2, 2.2, 1.2] },
    { kind: 'metal', rect: [50.2, 25.2, 2.4, 1.4] },
  ],

  aiBarricades: {
    A: ['suite'],
    B: ['bar-terraza', 'cocina-terraza', 'oficina-bar'],
  },

  aiTraps: {
    A: [[41.0, 9.8], [41.0, 4.0]],
    B: [[25.4, 20.4], [32.6, 26.0]],
  },

  cameraMounts: [
    { id: 'pasillo', at: [39.6, 8.95], facing: 178 * DEG }, // the corridor from the suite's door
    { id: 'vestibulo', at: [23.6, 26.6], facing: -140 * DEG }, // the lobby from its south-east corner
    { id: 'suite', at: [46.6, 1.4], facing: 140 * DEG }, // the suite's living room: its three doors
    { id: 'bar', at: [41.6, 26.6], facing: -150 * DEG }, // the bar from its south-east corner: the arch and the counter
    { id: 'terraza', at: [54.6, 27.4], facing: 172 * DEG }, // the terrace, end to end
    { id: 'cocina', at: [54.6, 26.6], facing: -135 * DEG }, // the kitchen: the swing door and room service
    { id: 'lenceria', at: [32.6, 11.4], facing: 160 * DEG }, // the linen room: its two doors
  ],

  aiCameras: {
    A: ['pasillo', 'suite'],
    B: ['bar', 'terraza'],
  },

  aiEntries: {
    A: { servicio: 2, vestibulo: 1 },
    B: { vestibulo: 4, terraza: 1 },
  },

  camera: { start: [12, 19], height: 21, frame: [1, 12, 25, 14], defendFrame: [24, 1, 31, 26] },
};
