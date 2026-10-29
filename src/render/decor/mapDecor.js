// Purely cosmetic set dressing per map id, baked into the floor texture once
// (render/textures/floorDecor.js). Nothing here blocks movement or vision:
// gameplay furniture lives in data/maps. Owner: visual. Units: meters.
//
// kinds: tape {rect, color} | tapeLine {a, b, color, w} | stain {at, r, color, alpha}
//        drain {at} | papers {at, n, spread} | cable {pts} | tires {a, b}
//        parking {a, b} | stencil {at, text, size, rot, color} | hatch {rect}

export const MAP_DECOR = Object.freeze({
  warehouse: [
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
  hotel: [
    // --- service yard: the van's bay, tire marks, a drain, the doors stenciled
    { kind: 'parking', a: [1.6, 16.5], b: [7.2, 16.5] },
    { kind: 'parking', a: [1.6, 19.6], b: [7.2, 19.6] },
    { kind: 'tires', a: [1.4, 17.4], b: [7.6, 17.7] },
    { kind: 'stain', at: [5.4, 18.9], r: 0.5, color: '#0d0e10', alpha: 0.5 },
    { kind: 'drain', at: [2.4, 11.0] },
    { kind: 'stencil', at: [6.6, 4.75], text: 'INCENDIOS', size: 0.34, rot: 0, color: '#e8e2d0' },
    { kind: 'stencil', at: [6.4, 23.25], text: 'SERVICIO', size: 0.34, rot: 0, color: '#e8e2d0' },
    // --- corridor: the carpet's gold border
    { kind: 'tapeLine', a: [8.4, 13.12], b: [30.6, 13.12], color: '#b58a3c', w: 0.06 },
    { kind: 'tapeLine', a: [8.4, 14.88], b: [30.6, 14.88], color: '#b58a3c', w: 0.06 },
    { kind: 'tapeLine', a: [8.4, 13.24], b: [30.6, 13.24], color: '#3a1118', w: 0.03 },
    { kind: 'tapeLine', a: [8.4, 14.76], b: [30.6, 14.76], color: '#3a1118', w: 0.03 },
    // --- rooms: a few lived-in marks
    { kind: 'papers', at: [20.0, 9.6], n: 3, spread: 0.4 },
    { kind: 'stain', at: [24.0, 7.2], r: 0.3, color: '#5a3b22', alpha: 0.3 },
    { kind: 'papers', at: [28.6, 21.0], n: 2, spread: 0.3 },
    // --- housekeeping and laundry: water, drains, lint
    { kind: 'drain', at: [11.0, 21.0] },
    { kind: 'drain', at: [17.6, 22.0] },
    { kind: 'stain', at: [15.8, 24.4], r: 0.7, color: '#7f97a3', alpha: 0.28 },
    { kind: 'stain', at: [18.9, 24.6], r: 0.45, color: '#7f97a3', alpha: 0.22 },
    { kind: 'tape', rect: [14.5, 24.75, 5.4, 1.0], color: '#e8e2d0' },
    // --- the suite: papers by the desk, wine on the rug
    { kind: 'papers', at: [32.6, 8.6], n: 3, spread: 0.4 },
    { kind: 'stain', at: [36.8, 20.6], r: 0.28, color: '#4a1018', alpha: 0.45 },
    { kind: 'cable', pts: [[38.75, 18.6], [38.2, 18.2], [38.4, 17.6]] },
  ],
  port: [
    // --- truck staging: lanes to the gate, tire marks, oil
    { kind: 'parking', a: [1.6, 12.4], b: [6.6, 12.4] },
    { kind: 'parking', a: [1.6, 17.0], b: [6.6, 17.0] },
    { kind: 'tires', a: [1.4, 14.2], b: [7.6, 14.9] },
    { kind: 'stain', at: [3.2, 11.6], r: 0.6, color: '#0d0e10', alpha: 0.5 },
    { kind: 'drain', at: [5.6, 24.4] },
    // --- the quay: the yellow safety edge, the crane rails, stenciled berth
    { kind: 'tapeLine', a: [8.3, 1.45], b: [38.7, 1.45], color: '#e3b51e', w: 0.14 },
    { kind: 'tapeLine', a: [8.3, 2.35], b: [38.7, 2.35], color: '#5d5a52', w: 0.08 },
    { kind: 'tapeLine', a: [8.3, 3.25], b: [38.7, 3.25], color: '#5d5a52', w: 0.08 },
    { kind: 'stencil', at: [21.8, 2.8], text: 'MUELLE 3', size: 0.42, rot: 0, color: '#e8e2d0' },
    // --- container yard: slot numbers painted on the concrete, the lane's center line
    { kind: 'stencil', at: [9.4, 7.2], text: 'C-01', size: 0.36, rot: 0, color: '#e8e2d0' },
    { kind: 'stencil', at: [30.4, 7.2], text: 'C-04', size: 0.36, rot: 0, color: '#e8e2d0' },
    { kind: 'tapeLine', a: [8.3, 7.2], b: [22.0, 7.2], color: '#d8d2bf', w: 0.06 },
    { kind: 'stain', at: [18.0, 6.6], r: 0.55, color: '#0d0e10', alpha: 0.4 },
    { kind: 'stain', at: [35.0, 4.6], r: 0.45, color: '#0d0e10', alpha: 0.35 },
    // --- truck lane: dashed center line, the dock's hatched apron, stop line
    ...[9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map((x) => ({ kind: 'tapeLine', a: [x, 13.6], b: [x + 1.6, 13.6], color: '#e8e2d0', w: 0.1 })),
    { kind: 'hatch', rect: [25.6, 15.8, 2.8, 1.0] },
    { kind: 'hatch', rect: [34.2, 15.8, 2.4, 1.0] },
    { kind: 'tires', a: [8.4, 15.1], b: [27.0, 15.5] },
    { kind: 'stencil', at: [27.0, 15.4], text: 'ANDÉN', size: 0.36, rot: 0, color: '#e3b51e' },
    // --- customs: queue line to the scanner, papers on the desks
    { kind: 'tape', rect: [8.5, 18.7, 4.0, 1.8], color: '#e3b51e' },
    { kind: 'papers', at: [12.6, 23.6], n: 4, spread: 0.6 },
    { kind: 'papers', at: [18.6, 18.6], n: 3, spread: 0.4 },
    { kind: 'cable', pts: [[21.6, 21.0], [22.2, 21.2], [22.75, 21.2]] },
    // --- cold store: forklift lanes, frost on the cold room's floor, drains
    { kind: 'tapeLine', a: [23.4, 22.4], b: [30.6, 22.4], color: '#e3b51e', w: 0.08 },
    { kind: 'tires', a: [24.0, 19.2], b: [30.6, 22.0] },
    { kind: 'drain', at: [35.0, 22.4] },
    { kind: 'stain', at: [37.6, 23.6], r: 0.8, color: '#e9f2f6', alpha: 0.35 },
    { kind: 'stain', at: [32.2, 22.8], r: 0.6, color: '#e9f2f6', alpha: 0.3 },
    { kind: 'stencil', at: [34.0, 19.95], text: '-22 °C', size: 0.34, rot: 0, color: '#2f6db0' },
  ],
  embassy: [
    // --- the street: parking bays along the curb, tire marks, a drain, the gates stenciled
    { kind: 'parking', a: [1.6, 17.4], b: [6.8, 17.4] },
    { kind: 'parking', a: [1.6, 23.6], b: [6.8, 23.6] },
    { kind: 'tires', a: [1.4, 9.8], b: [7.6, 10.4] },
    { kind: 'stain', at: [3.8, 21.2], r: 0.5, color: '#0d0e10', alpha: 0.45 },
    { kind: 'drain', at: [6.8, 3.0] },
    ...[3, 6, 9, 12, 15, 18, 21, 24].map((y) => ({ kind: 'tapeLine', a: [1.7, y], b: [1.7, y + 1.4], color: '#e8e2d0', w: 0.1 })),
    // --- garage: the car's bay, oil, tires
    { kind: 'parking', a: [9.0, 3.4], b: [9.0, 10.6] },
    { kind: 'stain', at: [11.4, 8.4], r: 0.55, color: '#0d0e10', alpha: 0.5 },
    { kind: 'tires', a: [10.6, 11.8], b: [10.6, 3.0] },
    { kind: 'drain', at: [13.6, 11.6] },
    // --- kitchen: grease by the stove, a drain, a spill
    { kind: 'stain', at: [11.6, 24.6], r: 0.45, color: '#3b3424', alpha: 0.35 },
    { kind: 'drain', at: [13.6, 19.6] },
    { kind: 'stain', at: [12.4, 20.8], r: 0.3, color: '#7f97a3', alpha: 0.3 },
    // --- library and secretariat: papers, cables under the desks
    { kind: 'papers', at: [19.8, 4.6], n: 3, spread: 0.4 },
    { kind: 'papers', at: [29.4, 4.4], n: 4, spread: 0.5 },
    { kind: 'papers', at: [33.6, 4.2], n: 3, spread: 0.5 },
    { kind: 'cable', pts: [[29.0, 3.4], [29.2, 2.6], [29.6, 2.22]] },
    { kind: 'cable', pts: [[33.6, 3.4], [33.8, 2.6], [34.2, 2.22]] },
    // --- courtyard: water marks around the fountain, a drain
    { kind: 'stain', at: [23.0, 14.0], r: 1.9, color: '#6f7d84', alpha: 0.18 },
    { kind: 'drain', at: [27.8, 18.2] },
    // --- office: papers off the desk
    { kind: 'papers', at: [33.0, 11.4], n: 4, spread: 0.6 },
    { kind: 'cable', pts: [[33.0, 10.6], [34.2, 10.0], [34.9, 9.8]] },
    // --- dining room: wine spilled by the table
    { kind: 'stain', at: [22.4, 23.0], r: 0.25, color: '#5a1620', alpha: 0.4 },
  ],
});
