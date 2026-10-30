// Purely cosmetic set dressing per map id, baked into the floor texture once
// (render/textures/floorDecor.js). Nothing here blocks movement or vision:
// gameplay furniture lives in data/maps. Owner: visual. Units: meters.
//
// kinds: tape {rect, color} | tapeLine {a, b, color, w} | stain {at, r, color, alpha}
//        drain {at} | papers {at, n, spread} | cable {pts} | tires {a, b}
//        parking {a, b} | stencil {at, text, size, rot, color} | hatch {rect}

export const MAP_DECOR = Object.freeze({
  // The tutorial's map (data/maps/training.js): the original Almacén's dressing.
  training: [
    // --- yard: parking bay lines, tire marks, oil, drain
    { kind: 'parking', a: [1.6, 10.1], b: [7.4, 10.1] },
    { kind: 'parking', a: [7.4, 5.4], b: [7.4, 10.1] },
    { kind: 'tires', a: [1.4, 6.6], b: [7.9, 6.9] },
    { kind: 'tires', a: [1.4, 8.3], b: [7.9, 8.1] },
    { kind: 'stain', at: [5.6, 8.9], r: 0.55, color: '#0d0e10', alpha: 0.55 },
    { kind: 'stain', at: [3.1, 19.2], r: 0.4, color: '#101113', alpha: 0.45 },
    { kind: 'drain', at: [6.2, 21.9] },
    // --- office: papers, cables under desks, coffee stain
    { kind: 'papers', at: [13.3, 5.6], n: 5, spread: 0.6 },
    { kind: 'papers', at: [17.0, 7.6], n: 3, spread: 0.4 },
    { kind: 'cable', pts: [[12.6, 3.7], [12.9, 3.2], [13.6, 2.4], [13.5, 2.22]] },
    { kind: 'cable', pts: [[16.6, 3.7], [16.9, 3.0], [17.8, 2.6], [18.79, 2.6]] },
    { kind: 'cable', pts: [[17.7, 9.3], [18.3, 9.6], [18.79, 9.7]] },
    { kind: 'stain', at: [15.1, 6.9], r: 0.22, color: '#3a2a18', alpha: 0.4 },
    // --- kitchen: grease near the stove, spill under the table
    { kind: 'stain', at: [22.8, 3.3], r: 0.5, color: '#3b3424', alpha: 0.35 },
    { kind: 'stain', at: [24.4, 7.9], r: 0.3, color: '#5a3b22', alpha: 0.35 },
    { kind: 'drain', at: [25.6, 9.6] },
    // --- corridor: worn centre line
    { kind: 'tapeLine', a: [10.4, 12.7], b: [27.6, 12.7], color: '#3f444a', w: 0.05 },
    // --- bathroom: drains and water marks
    { kind: 'drain', at: [13.0, 20.0] },
    { kind: 'stain', at: [12.5, 22.6], r: 0.6, color: '#7f97a3', alpha: 0.25 },
    // --- lounge: papers by the vending machines
    { kind: 'papers', at: [17.8, 24.4], n: 3, spread: 0.5 },
    { kind: 'stain', at: [26.0, 20.5], r: 0.35, color: '#2d1a0c', alpha: 0.35 },
    // --- bomb site hall: safety tape boxes, racks lanes, hatch, cables
    { kind: 'tape', rect: [37.2, 2.6, 1.6, 3.0], color: '#e3b51e' },
    { kind: 'tape', rect: [37.2, 18.0, 1.6, 6.5], color: '#e3b51e' },
    { kind: 'tape', rect: [29.3, 23.7, 4.2, 1.9], color: '#e8e2d0' },
    { kind: 'hatch', rect: [28.5, 14.2, 1.2, 4.0] },
    { kind: 'tapeLine', a: [29.0, 6.4], b: [38.0, 6.4], color: '#e3b51e', w: 0.08 },
    { kind: 'tapeLine', a: [29.0, 19.8], b: [36.4, 19.8], color: '#e3b51e', w: 0.08 },
    { kind: 'stain', at: [34.2, 21.4], r: 0.7, color: '#14130f', alpha: 0.5 },
    { kind: 'stain', at: [36.0, 7.2], r: 0.45, color: '#14130f', alpha: 0.4 },
    { kind: 'cable', pts: [[38.75, 12.0], [37.6, 12.4], [36.9, 13.6], [37.3, 15.0]] },
    { kind: 'drain', at: [33.5, 21.0] },
    { kind: 'stencil', at: [35.7, 24.9], text: 'CARGA', size: 0.55, rot: 0, color: '#e8e2d0' },
  ],
  // Operación Almacén v2 (data/maps/warehouse.js): Distribuidora Ferrol
  warehouse: [
    // --- car park: bays, oil, the van's tire marks
    ...[8.6, 11.2, 13.8, 23.4, 26.0].map((y) => ({ kind: 'parking', a: [1.6, y], b: [6.4, y] })),
    { kind: 'stain', at: [3.6, 14.6], r: 0.5, color: '#0d0e10', alpha: 0.5 },
    { kind: 'tires', a: [1.6, 9.0], b: [8.8, 17.6] },
    { kind: 'drain', at: [6.0, 31.6] },
    // --- the truck yard: dock bays, the trucks' tire marks, a spill under the blue rig
    { kind: 'tape', rect: [45.6, 1.4, 3.6, 6.4], color: '#e3b51e' },
    { kind: 'stencil', at: [47.4, 2.0], text: 'MUELLE 2', size: 0.4, rot: 0, color: '#e8e2d0' },
    { kind: 'tires', a: [12, 3.0], b: [41, 4.6] },
    { kind: 'tires', a: [12, 6.0], b: [44, 6.6] },
    { kind: 'stain', at: [36.2, 6.4], r: 0.7, color: '#0d0e10', alpha: 0.55 },
    { kind: 'hatch', rect: [44.4, 6.8, 6.0, 1.0] },
    // --- offices and reception: papers, cables, coffee
    { kind: 'papers', at: [13.6, 11.6], n: 5, spread: 0.6 },
    { kind: 'cable', pts: [[12.6, 10.0], [12.0, 9.0], [10.4, 9.0]] },
    { kind: 'stain', at: [15.0, 13.0], r: 0.2, color: '#3a2a18', alpha: 0.4 },
    { kind: 'tapeLine', a: [10.4, 18.0], b: [14.0, 18.0], color: '#3f444a', w: 0.05 },
    // --- break room
    { kind: 'stain', at: [16.4, 27.4], r: 0.35, color: '#5a3b22', alpha: 0.35 },
    { kind: 'papers', at: [13.8, 24.6], n: 2, spread: 0.3 },
    // --- the hall: aisle lines, the cross-aisle's walkway, forklift marks
    { kind: 'tapeLine', a: [22.6, 12.6], b: [41.4, 12.6], color: '#e3b51e', w: 0.08 },
    { kind: 'tapeLine', a: [22.6, 21.0], b: [41.4, 21.0], color: '#e3b51e', w: 0.08 },
    { kind: 'tapeLine', a: [22.6, 17.0], b: [41.4, 17.0], color: '#d8d2bf', w: 0.05 },
    { kind: 'tape', rect: [24.2, 18.2, 6.4, 1.6], color: '#e8e2d0' },
    { kind: 'stencil', at: [27.4, 18.0], text: 'INVENTARIO', size: 0.34, rot: 0, color: '#e8e2d0' },
    { kind: 'tires', a: [24, 21.4], b: [41, 20.6] },
    { kind: 'tires', a: [30, 11.8], b: [41.6, 12.4] },
    { kind: 'stain', at: [32.0, 22.0], r: 0.45, color: '#14130f', alpha: 0.45 },
    { kind: 'drain', at: [32.0, 25.0] },
    // --- the dock: staging boxes, the loading gap's hatch, oil by the forklift
    { kind: 'tape', rect: [45.8, 10.0, 3.0, 2.8], color: '#e8e2d0' },
    { kind: 'hatch', rect: [42.4, 11.1, 1.2, 2.4] },
    { kind: 'stain', at: [53.2, 11.8], r: 0.5, color: '#14130f', alpha: 0.5 },
    { kind: 'stencil', at: [50.4, 16.4], text: 'EXPEDICIÓN', size: 0.36, rot: 0, color: '#e3b51e' },
    // --- dispatch: waybills
    { kind: 'papers', at: [48.0, 19.8], n: 6, spread: 0.7 },
    { kind: 'cable', pts: [[47.2, 18.9], [46.0, 17.6], [44.0, 17.6]] },
    // --- the workshop: oil everywhere, the chargers' cables, the forklift's bay
    { kind: 'stain', at: [48.6, 26.6], r: 0.9, color: '#14130f', alpha: 0.55 },
    { kind: 'stain', at: [46.0, 23.2], r: 0.4, color: '#14130f', alpha: 0.45 },
    { kind: 'cable', pts: [[54.2, 23.4], [52.6, 24.2], [50.0, 25.0]] },
    { kind: 'cable', pts: [[54.2, 24.6], [53.0, 25.6], [52.0, 26.0]] },
    { kind: 'tape', rect: [46.4, 24.0, 4.4, 2.8], color: '#e3b51e' },
    { kind: 'drain', at: [44.6, 26.0] },
    // --- the alley: puddles, tire marks, the workshop's roller door apron
    { kind: 'stain', at: [24.0, 31.6], r: 0.8, color: '#22303a', alpha: 0.4 },
    { kind: 'stain', at: [38.6, 30.8], r: 0.6, color: '#22303a', alpha: 0.35 },
    { kind: 'tires', a: [12, 31.4], b: [44, 31.0] },
    { kind: 'hatch', rect: [46.4, 29.3, 3.0, 0.9] },
    { kind: 'drain', at: [30.0, 32.4] },
  ],
  // Operación Hotel v2 (data/maps/hotel.js): Hotel Miramar
  hotel: [
    // --- the street: the kerb, the taxi bay, a manhole
    { kind: 'tapeLine', a: [6.4, 1.4], b: [6.4, 32.6], color: '#d8d2bf', w: 0.12 },
    { kind: 'parking', a: [1.6, 24.4], b: [5.6, 24.4] },
    { kind: 'parking', a: [1.6, 29.6], b: [5.6, 29.6] },
    { kind: 'stencil', at: [3.6, 27.0], text: 'TAXI', size: 0.4, rot: 0, color: '#e3b51e' },
    { kind: 'drain', at: [3.2, 18.6] },
    { kind: 'stain', at: [3.4, 8.4], r: 0.5, color: '#0d0e10', alpha: 0.45 },
    // --- the corridor: the carpet's gold border
    { kind: 'tapeLine', a: [12.4, 8.95], b: [39.6, 8.95], color: '#b58a3c', w: 0.06 },
    { kind: 'tapeLine', a: [12.4, 10.65], b: [39.6, 10.65], color: '#b58a3c', w: 0.06 },
    { kind: 'papers', at: [29.4, 10.0], n: 2, spread: 0.3 },
    // --- the rooms: a few lived-in marks
    { kind: 'papers', at: [23.4, 4.6], n: 3, spread: 0.5 },
    { kind: 'stain', at: [37.6, 5.2], r: 0.3, color: '#5a3b22', alpha: 0.3 },
    { kind: 'papers', at: [14.0, 4.2], n: 2, spread: 0.3 },
    // --- the suite: wine on the rug, papers by the desk
    { kind: 'stain', at: [44.0, 7.2], r: 0.28, color: '#4a1018', alpha: 0.45 },
    { kind: 'papers', at: [52.4, 9.6], n: 3, spread: 0.4 },
    // --- the lobby: the rug's border, the brass line to the lifts
    { kind: 'tape', rect: [14.4, 18.0, 5.6, 4.0], color: '#b58a3c' },
    { kind: 'tapeLine', a: [8.0, 19.0], b: [23.0, 19.0], color: '#9a8a70', w: 0.05 },
    // --- the bar: spilled drinks, coasters
    { kind: 'stain', at: [35.0, 18.6], r: 0.3, color: '#4a1018', alpha: 0.4 },
    { kind: 'stain', at: [36.6, 22.6], r: 0.22, color: '#5a3b22', alpha: 0.35 },
    { kind: 'papers', at: [33.8, 25.4], n: 2, spread: 0.3 },
    // --- the kitchen: grease, drains, water
    { kind: 'stain', at: [49.6, 12.8], r: 0.6, color: '#3b3424', alpha: 0.35 },
    { kind: 'drain', at: [47.6, 18.8] },
    { kind: 'drain', at: [52.6, 23.6] },
    { kind: 'stain', at: [53.6, 20.4], r: 0.5, color: '#7f97a3', alpha: 0.25 },
    // --- the terrace: wet tiles by the pool's steps, a few leaves
    { kind: 'stain', at: [19.6, 30.6], r: 0.7, color: '#7f97a3', alpha: 0.22 },
    { kind: 'stain', at: [48.0, 30.6], r: 0.6, color: '#7f97a3', alpha: 0.22 },
    { kind: 'papers', at: [28.6, 30.6], n: 2, spread: 0.4 },
    { kind: 'drain', at: [40.0, 31.8] },
  ],
  // Operación Puerto v2 (data/maps/port.js): Terminal 3
  port: [
    // --- truck staging: lanes to the gates, tire marks, oil
    ...[16.0, 20.0, 26.0].map((y) => ({ kind: 'parking', a: [1.6, y], b: [8.6, y] })),
    { kind: 'tires', a: [1.4, 21.0], b: [11.6, 22.8] },
    { kind: 'tires', a: [1.4, 7.0], b: [11.6, 5.4] },
    { kind: 'stain', at: [4.8, 18.0], r: 0.6, color: '#0d0e10', alpha: 0.5 },
    { kind: 'drain', at: [7.6, 35.6] },
    // --- the quay: the yellow edge, the crane's rails, the berth's number
    { kind: 'tapeLine', a: [12.3, 3.45], b: [58.7, 3.45], color: '#e3b51e', w: 0.14 },
    { kind: 'tapeLine', a: [12.3, 4.0], b: [58.7, 4.0], color: '#5d5a52', w: 0.08 },
    { kind: 'tapeLine', a: [12.3, 5.2], b: [58.7, 5.2], color: '#5d5a52', w: 0.08 },
    { kind: 'stencil', at: [32.0, 4.6], text: 'ATRAQUE 3', size: 0.42, rot: 0, color: '#e8e2d0' },
    // --- the yard: slot numbers, the stripping area, the dented box's quarantine
    { kind: 'stencil', at: [14.4, 13.4], text: 'B-01', size: 0.36, rot: 0, color: '#e8e2d0' },
    { kind: 'stencil', at: [22.0, 11.2], text: 'B-04', size: 0.36, rot: 0, color: '#e8e2d0' },
    { kind: 'stencil', at: [46.6, 8.0], text: 'R-12', size: 0.36, rot: 0, color: '#e8e2d0' },
    { kind: 'tape', rect: [30.6, 11.6, 4.4, 4.8], color: '#e8e2d0' },
    { kind: 'stencil', at: [32.8, 16.8], text: 'DESCONSOLIDACIÓN', size: 0.28, rot: 0, color: '#e8e2d0' },
    { kind: 'tape', rect: [33.6, 15.4, 7.2, 3.8], color: '#c23b2c' },
    { kind: 'stencil', at: [37.2, 19.6], text: 'INSPECCIÓN', size: 0.3, rot: 0, color: '#c23b2c' },
    { kind: 'tires', a: [28, 8.2], b: [40, 9.0] },
    { kind: 'stain', at: [36.4, 9.8], r: 0.7, color: '#0d0e10', alpha: 0.45 },
    { kind: 'stain', at: [21.0, 15.0], r: 0.5, color: '#0d0e10', alpha: 0.35 },
    // --- the reefers: their power cables to the generator, the plug-in rack's markings
    { kind: 'cable', pts: [[49.2, 10.4], [48.8, 13.0], [48.6, 17.4]] },
    { kind: 'cable', pts: [[50.0, 16.6], [49.2, 17.4]] },
    { kind: 'hatch', rect: [47.8, 9.0, 1.0, 9.0] },
    // --- the truck lane: dashed center line, the docks' aprons
    ...[14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54].map((x) => ({ kind: 'tapeLine', a: [x, 22.4], b: [x + 2, 22.4], color: '#e8e2d0', w: 0.1 })),
    { kind: 'hatch', rect: [42.6, 24.0, 2.8, 0.9] },
    { kind: 'hatch', rect: [29.0, 24.0, 2.8, 0.9] },
    { kind: 'stencil', at: [44.0, 23.6], text: 'ANDÉN', size: 0.34, rot: 0, color: '#e3b51e' },
    { kind: 'tires', a: [12, 23.6], b: [58, 23.2] },
    // --- customs, consolidation, the cold store
    { kind: 'tape', rect: [12.6, 26.6, 2.0, 3.6], color: '#e3b51e' },
    { kind: 'papers', at: [21.4, 28.0], n: 4, spread: 0.5 },
    { kind: 'papers', at: [14.6, 34.0], n: 3, spread: 0.4 },
    { kind: 'tapeLine', a: [24.6, 29.4], b: [36.4, 29.4], color: '#e3b51e', w: 0.08 },
    { kind: 'tires', a: [25, 30.0], b: [36, 28.6] },
    { kind: 'tapeLine', a: [37.6, 28.6], b: [58.4, 28.6], color: '#e3b51e', w: 0.08 },
    { kind: 'stain', at: [40.0, 34.6], r: 0.5, color: '#14130f', alpha: 0.4 },
    { kind: 'drain', at: [53.0, 34.6] },
    { kind: 'stain', at: [55.4, 33.0], r: 0.9, color: '#e9f2f6', alpha: 0.35 },
    { kind: 'stain', at: [49.6, 35.4], r: 0.6, color: '#e9f2f6', alpha: 0.3 },
    { kind: 'stencil', at: [53.0, 30.0], text: '-22 °C', size: 0.34, rot: 0, color: '#2f6db0' },
  ],
});
