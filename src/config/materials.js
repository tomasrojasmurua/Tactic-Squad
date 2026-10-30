// Visual palette: floor patterns, walls, props and characters. Pure data.
// Owner: visual.

/** Floor pattern ids understood by the floor shader (render/shaders/floor.js). */
export const FLOOR_PATTERN = Object.freeze({
  checker: 0,
  tiles: 1,
  wood: 2,
  carpet: 3,
  concrete: 4,
  asphalt: 5,
  rug: 6,
  water: 7,
});

/** Floor materials referenced by maps. scale = tile/plank size in meters. */
export const FLOORS = Object.freeze({
  kitchenChecker: { pattern: 'checker', a: '#8cc97a', b: '#7aa3dc', scale: 0.85 },
  hallLino: { pattern: 'checker', a: '#a9aeb3', b: '#93999f', scale: 0.6 },
  bathTiles: { pattern: 'tiles', a: '#e6edf0', b: '#9fb3bd', scale: 0.32 },
  officeCarpet: { pattern: 'carpet', a: '#4f8a62', b: '#3e6f4e', scale: 1.0 },
  loungeWood: { pattern: 'wood', a: '#b07a45', b: '#5e3a1c', scale: 0.24 },
  siteConcrete: { pattern: 'concrete', a: '#8e918b', b: '#6d706a', scale: 3.0 },
  yardAsphalt: { pattern: 'asphalt', a: '#4a4d52', b: '#3a3c40', scale: 1.0 },
  redRug: { pattern: 'rug', a: '#9b2f35', b: '#e2c27a', scale: 1.0 },
  // hotel (data/maps/hotel.js)
  hotelCarpet: { pattern: 'carpet', a: '#6e2430', b: '#561b26', scale: 0.7 },
  roomCarpet: { pattern: 'carpet', a: '#b4a283', b: '#9f8e70', scale: 1.0 },
  suiteWood: { pattern: 'wood', a: '#8a5a36', b: '#4a2c16', scale: 0.2 },
  suiteRug: { pattern: 'rug', a: '#2c4a6e', b: '#d8c27a', scale: 1.0 },
  laundryTiles: { pattern: 'tiles', a: '#dbe5e9', b: '#a7bcc6', scale: 0.4 },
  serviceLino: { pattern: 'checker', a: '#9aa0a3', b: '#8a9094', scale: 0.5 },
  lobbyMarble: { pattern: 'checker', a: '#d9d2c3', b: '#b9ae99', scale: 1.2 },
  kitchenTiles: { pattern: 'tiles', a: '#d7dcd8', b: '#a9b2ad', scale: 0.3 },
  terraceStone: { pattern: 'tiles', a: '#b9a98c', b: '#9b8c72', scale: 0.6 },
  // port (data/maps/port.js)
  harborWater: { pattern: 'water', a: '#16323d', b: '#24505c', scale: 1.0 },
  quayConcrete: { pattern: 'concrete', a: '#a39d90', b: '#7d776b', scale: 4.0 },
  portConcrete: { pattern: 'concrete', a: '#8f918c', b: '#6a6c67', scale: 6.0 },
  customsTiles: { pattern: 'tiles', a: '#c9ccc4', b: '#9ea39a', scale: 0.5 },
  customsCarpet: { pattern: 'carpet', a: '#4a5b6e', b: '#3b4a5b', scale: 1.0 },
  coldFloor: { pattern: 'concrete', a: '#b8c6cc', b: '#93a5ad', scale: 2.0 },
});

export const WALL = Object.freeze({
  side: '#8a9099',
  top: '#060607',
  exteriorSide: '#6b7079',
  exteriorThickness: 0.35, // m: thicker walls are the building shell
  baseboard: '#3d4148',
  baseboardHeight: 0.14, // m
  baseboardOut: 0.025, // m it sticks out of the wall face
  fence: '#9a9384',
  fenceMesh: '#5f5d57',
  fenceTop: '#3a3935',
  fenceRail: '#b4ad9d',
  fencePostSpacing: 2.4, // m
  sill: '#7d848d', // window sill (map `windows`): its sides
  sillTop: '#bcd3e0', // its top, pale like glass so it reads as a window from above
  sillFrame: '#2a2d31', // the thin frame along its edges
});

export const DOOR = Object.freeze({
  slab: '#8a5a32',
  top: '#a7774a',
  handle: '#d8c48a',
  trim: '#7a4e2a',
});

/** Shared prop colors (render/geometry/props.js picks from here). */
export const PROP_COLORS = Object.freeze({
  woodDark: '#6b4425',
  wood: '#9a6a3c',
  woodLight: '#c99a62',
  metal: '#9aa1a8',
  metalDark: '#555b62',
  black: '#1b1c1f',
  white: '#eef1f3',
  porcelain: '#dfe7ea',
  fabricGreen: '#3f6b55',
  fabricGrey: '#5b616b',
  fabricRed: '#8e3a35',
  leaf: '#3f8f3a',
  leafDark: '#2c6a2a',
  pot: '#a65a3a',
  crate: '#b08550',
  crateDark: '#7c5a33',
  barrel: '#3b6aa0',
  barrelRed: '#a63a32',
  screen: '#8fd3ff',
  van: '#d9dcd5',
  vanDark: '#2c2f33',
  hazard: '#e3b51e',
  cone: '#ff7b1c',
  vending: '#c0392b',
  fridge: '#d6dde0',
});

/** Character palettes per team. Attackers: warm olive + operator-colored
 * shoulder pads; defenders: urban blue-grey, red caps and red armbands. */
export const CHARACTER = Object.freeze({
  attackers: {
    uniform: '#7a7853',
    shoulders: '#8d8a62',
    sleeve: '#6b6946',
    vest: '#59603a',
    vestTop: '#6c7546',
    pouch: '#4b522f',
    pouchTop: '#5f6a3b',
    collar: '#3d4226',
    pads: '#34372a',
    gloves: '#2b2b28',
    boots: '#2e2a22',
    helmet: '#5b6640',
    helmetTop: '#77845a',
    mount: '#222428',
    mountTop: '#3d4046',
    cap: '#5b6640',
    capTop: '#77845a',
    pack: '#495030',
    packTop: '#5d673e',
    roll: '#6c684f',
    rollTop: '#8b866b',
  },
  defenders: {
    uniform: '#394357',
    shoulders: '#465169',
    sleeve: '#333c4e',
    vest: '#1e232c',
    vestTop: '#2c323d',
    pouch: '#181c23',
    pouchTop: '#262b35',
    collar: '#131518',
    pads: '#15171b',
    gloves: '#141518',
    boots: '#121316',
    helmet: '#2a303b',
    helmetTop: '#3d4554',
    mount: '#16171a',
    mountTop: '#2a2c31',
    cap: '#8c2722',
    capTop: '#b8352c',
    pack: '#1d2129',
    packTop: '#2b303a',
    roll: '#2b2f37',
    rollTop: '#3a3f49',
    patch: '#d63a2f',
  },
  skin: '#c8956f',
  visor: '#15191f',
  visorTop: '#3a4a5a',
  charge: '#4a4a40',
  chargeTop: '#5d5d50',
  chargeTape: '#e0b52a',
  antenna: '#1a1b1e',
  gun: '#1e1f23',
  gunTop: '#5c616b',
  gunAccent: '#34363c',
  gunAccentTop: '#585c65',
  optic: '#111215',
});

export const BOMB_COLOR = Object.freeze({ body: '#2a2c22', top: '#3a3d2f', tape: '#c9a227', light: '#ff3020', panel: '#111', screen: '#3fae5a' });

/** Class gear drawn as its own mesh (render/geometry/character.js): the Escudo's shield, the Ancla's barrier. */
export const GEAR_COLOR = Object.freeze({
  shield: Object.freeze({ body: '#2f363c', top: '#a9b7c4', viewport: '#16222b', stripe: '#c9cdd1' }),
  parapet: Object.freeze({ body: '#454b42', top: '#6c7566', feet: '#2b2f2a', stripe: '#c9a227' }),
});

/**
 * What a bullet hits when it ends at a prop; walls are plaster. Resolved once
 * by the sim (sim/queries.js struckSurface -> EV.SHOT.material), so FX and
 * audio always agree on the material.
 */
export const SURFACE_PROBE = 0.25; // m: an impact this close to a door slab / prop / fence takes its material
export const DOOR_SURFACE = 'wood';
export const FENCE_SURFACE = 'metal';
export const PROP_SURFACE = Object.freeze({
  desk: 'wood',
  bookshelf: 'wood',
  counter: 'wood',
  table: 'wood',
  chair: 'wood',
  crate: 'wood',
  crateStack: 'wood',
  pallet: 'wood',
  tvStand: 'wood',
  cabinet: 'metal',
  stove: 'metal',
  sink: 'metal',
  fridge: 'metal',
  vending: 'metal',
  barrel: 'metal',
  rack: 'metal',
  van: 'metal',
  bin: 'metal',
  bench: 'metal',
  sofa: 'fabric',
  armchair: 'fabric',
  officeChair: 'fabric',
  plant: 'fabric',
  toilet: 'ceramic',
  washbasin: 'ceramic',
  stallWall: 'plaster',
  barrier: 'plaster',
  // v2 maps
  containerStack3: 'metal',
  reefer: 'metal',
  containerOpen: 'metal',
  containerDented: 'metal',
  reachStacker: 'metal',
  craneLeg: 'metal',
  generator: 'metal',
  longRack: 'metal',
  palletStack: 'wood',
  workbench: 'wood',
  toolChest: 'metal',
  charger: 'metal',
  dumpster: 'metal',
  car: 'metal',
  column: 'plaster',
  receptionDesk: 'wood',
  barCounter: 'wood',
  backBar: 'wood',
  roundTable: 'wood',
  piano: 'wood',
  kitchenRange: 'metal',
  serviceTrolley: 'metal',
});

/** Impact recipe per surface: spark streaks, dust puffs (rgb) and debris chips. */
export const SURFACE_FX = Object.freeze({
  plaster: { sparks: 3, puffs: 3, dust: [0.82, 0.8, 0.76], chips: 4, chipStretch: 1, chipColors: [[0.72, 0.72, 0.7], [0.55, 0.56, 0.58]] },
  wood: { sparks: 1, puffs: 2, dust: [0.66, 0.52, 0.36], chips: 6, chipStretch: 2.6, chipColors: [[0.62, 0.42, 0.22], [0.78, 0.58, 0.34]] },
  metal: { sparks: 10, puffs: 1, dust: [0.6, 0.6, 0.62], chips: 0, chipStretch: 1, chipColors: [[0.5, 0.5, 0.5]] },
  fabric: { sparks: 0, puffs: 4, dust: [0.85, 0.83, 0.78], chips: 3, chipStretch: 1, chipColors: [[0.92, 0.9, 0.86]] },
  ceramic: { sparks: 2, puffs: 2, dust: [0.9, 0.92, 0.93], chips: 6, chipStretch: 1.3, chipColors: [[0.93, 0.95, 0.96], [0.8, 0.86, 0.88]] },
});
