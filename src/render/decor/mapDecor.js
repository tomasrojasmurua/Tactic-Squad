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
});
