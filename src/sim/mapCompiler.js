// Turns map DATA (src/data/maps/*) into runtime geometry: wall boxes with
// door/opening gaps cut out, door hinges, prop footprints, zones and the
// round data (bomb sites, attacker entries, deployment halves, barricade slots).
// Pure: no DOM, no WebGL. Output is consumed by World (sim) and by render.
import { PROPS } from '../data/props.js';
import { DOORS, MAP_FORMAT, PREP } from '../config/balance.js';
import { boxFromRect, pointAabbDistance } from '../core/geom.js';

const DEFAULT_WALL_T = MAP_FORMAT.wallThickness;
const ON_WALL_TOLERANCE = MAP_FORMAT.onWallTolerance;

export function compileMap(def) {
  const gaps = [
    ...def.doors.map((d) => ({ ...d, isDoor: true })),
    ...(def.openings || []).map((o) => ({ ...o, isDoor: false })),
  ];

  const walls = [];
  for (const w of def.walls) walls.push(...cutWall(w, gaps));

  const doors = def.doors.map((d, i) => compileDoor(d, i, def.walls));
  const props = def.props.map(compileProp);
  const zones = {};
  for (const [key, z] of Object.entries(def.zones || {})) zones[key] = { ...z, box: boxFromRect(z.rect) };
  // Every passable gap in a wall (doors and doorless openings): used to aim
  // through doorways while approaching them and to snap planned points.
  const doorways = gaps.map((g) => ({
    cx: g.at[0],
    cy: g.at[1],
    length: g.width,
    normalX: g.axis === 'v' ? 1 : 0,
    normalY: g.axis === 'v' ? 0 : 1,
    isDoor: g.isDoor,
    id: g.id ?? null,
  }));
  // Named areas (debrief: "fell in the kitchen"). First match wins.
  const rooms = (def.rooms || []).map((r) => ({ id: r.id, box: boxFromRect(r.rect) }));
  const sites = def.sites.map((s) => ({ id: s.id, rect: s.rect, box: boxFromRect(s.rect), bombX: s.bomb[0], bombY: s.bomb[1] }));
  const doorIds = new Set(def.doors.map((d) => d.id));
  for (const e of def.entries) if (!doorIds.has(e.door)) throw new Error(`Entrada ${e.id}: puerta desconocida ${e.door}`);
  for (const s of def.sites) if (!def.defense[s.id]) throw new Error(`Sitio ${s.id} sin defensa`);
  const deployment = {
    line: def.deployment.line,
    attackers: def.deployment.attackers.map(boxFromRect),
    defenders: def.deployment.defenders.map(boxFromRect),
  };

  // Doors the defenders may barricade (ids): marked `barricade` in the map and touching their half.
  const barricadeSlots = def.doors
    .filter((d) => d.barricade && deployment.defenders.some((b) => pointAabbDistance(d.at[0], d.at[1], b) <= PREP.barricadeReach))
    .map((d) => d.id);
  // The AI defenders' barricade options per site (sim/prep.js aiPrepare).
  const aiBarricades = def.aiBarricades || {};
  for (const [site, ids] of Object.entries(aiBarricades)) {
    for (const id of ids) if (!barricadeSlots.includes(id)) throw new Error(`aiBarricades ${site}: ${id} no se puede atrancar`);
  }
  // The attacking AI's entries per site, with weights (sim/aiAttack.js pickEntry).
  const aiEntries = def.aiEntries || {};
  for (const [site, weights] of Object.entries(aiEntries)) {
    for (const id of Object.keys(weights)) if (!def.entries.some((e) => e.id === id)) throw new Error(`aiEntries ${site}: entrada desconocida ${id}`);
  }

  // Defender cameras per site (sim/cameras.js): {at, facing, fov?, range?}.
  const cameras = def.aiCameras || {};
  for (const [site, list] of Object.entries(cameras)) {
    if (!def.sites.some((s) => s.id === site)) throw new Error(`aiCameras: sitio desconocido ${site}`);
    for (const c of list) if (!Array.isArray(c.at) || !Number.isFinite(c.facing)) throw new Error(`aiCameras ${site}: cámara sin at / facing`);
  }

  // Trampero's traps per site (sim/traps.js): [x, y] points.
  const traps = def.aiTraps || {};
  for (const [site, list] of Object.entries(traps)) {
    if (!def.sites.some((s) => s.id === site)) throw new Error(`aiTraps: sitio desconocido ${site}`);
    for (const p of list) if (!Array.isArray(p) || p.length !== 2) throw new Error(`aiTraps ${site}: trampa sin [x, y]`);
  }

  return {
    id: def.id,
    name: def.name,
    width: def.size.w,
    height: def.size.h,
    walls,
    doors,
    props,
    zones,
    doorways,
    rooms,
    floors: def.floors,
    paint: def.paint || [],
    sites,
    entries: def.entries,
    defaultEntry: def.defaultEntry ?? def.entries[0].id,
    defense: def.defense,
    deployment,
    barricadeSlots,
    aiBarricades,
    aiEntries,
    cameras,
    traps,
    camera: def.camera,
  };
}

/** Splits one wall line into boxes, removing the gaps that lie on it. */
function cutWall(w, gaps) {
  const t = w.t ?? DEFAULT_WALL_T;
  const horizontal = w.a[1] === w.b[1];
  const fixed = horizontal ? w.a[1] : w.a[0];
  const lo = Math.min(horizontal ? w.a[0] : w.a[1], horizontal ? w.b[0] : w.b[1]) - t / 2;
  const hi = Math.max(horizontal ? w.a[0] : w.a[1], horizontal ? w.b[0] : w.b[1]) + t / 2;

  // Gaps on this wall line, as [start, end] along the wall axis.
  const cuts = gaps
    .filter((g) => (g.axis === 'h') === horizontal)
    .filter((g) => Math.abs((horizontal ? g.at[1] : g.at[0]) - fixed) < ON_WALL_TOLERANCE)
    .map((g) => {
      const c = horizontal ? g.at[0] : g.at[1];
      return [c - g.width / 2, c + g.width / 2];
    })
    .filter(([s, e]) => e > lo && s < hi)
    .sort((p, q) => p[0] - q[0]);

  const spans = [];
  let cursor = lo;
  for (const [s, e] of cuts) {
    if (s > cursor) spans.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < hi) spans.push([cursor, hi]);

  return spans
    .filter(([s, e]) => e - s > MAP_FORMAT.minWallSpan)
    .map(([s, e]) => ({
      box: horizontal
        ? { minX: s, maxX: e, minY: fixed - t / 2, maxY: fixed + t / 2 }
        : { minX: fixed - t / 2, maxX: fixed + t / 2, minY: s, maxY: e },
      thickness: t,
      kind: w.kind || 'wall',
    }));
}

function wallThicknessAt(door, walls) {
  const horizontal = door.axis === 'h';
  for (const w of walls) {
    const wh = w.a[1] === w.b[1];
    if (wh !== horizontal) continue;
    const fixed = wh ? w.a[1] : w.a[0];
    if (Math.abs((horizontal ? door.at[1] : door.at[0]) - fixed) < ON_WALL_TOLERANCE) return w.t ?? DEFAULT_WALL_T;
  }
  return DEFAULT_WALL_T;
}

function compileDoor(d, index, walls) {
  const [cx, cy] = d.at;
  const half = d.width / 2;
  const t = wallThicknessAt(d, walls);
  const vertical = d.axis === 'v';
  const atMin = d.hinge !== 'max';
  // Hinge position and the closed direction (hinge -> free end).
  const hingeX = vertical ? cx : atMin ? cx - half : cx + half;
  const hingeY = vertical ? (atMin ? cy - half : cy + half) : cy;
  const closedAngle = vertical ? (atMin ? Math.PI / 2 : -Math.PI / 2) : atMin ? 0 : Math.PI;
  // Normal of the wall plane, used to decide the swing side.
  const normalX = vertical ? 1 : 0;
  const normalY = vertical ? 0 : 1;
  const halfT = DOORS.thickness / 2;
  return {
    id: d.id ?? `door${index}`,
    index,
    cx,
    cy,
    hingeX,
    hingeY,
    length: d.width,
    closedAngle,
    normalX,
    normalY,
    wallThickness: t,
    // Blocking box while closed (thin slab in the middle of the wall).
    closedBox: vertical
      ? { minX: cx - halfT, maxX: cx + halfT, minY: cy - half, maxY: cy + half }
      : { minX: cx - half, maxX: cx + half, minY: cy - halfT, maxY: cy + halfT },
  };
}

function compileProp(p, index) {
  const spec = PROPS[p.type];
  if (!spec) throw new Error(`Prop desconocido en el mapa: ${p.type}`);
  const w = p.size ? p.size[0] : spec.w;
  const d = p.size ? p.size[1] : spec.d;
  const rot = ((p.rot || 0) % 360 + 360) % 360;
  // Collision footprints are axis aligned: snap to the nearest quarter turn.
  const quarter = Math.round(rot / 90) % 2 === 1;
  const fw = quarter ? d : w;
  const fd = quarter ? w : d;
  const [x, y] = p.at;
  return {
    index,
    type: p.type,
    x,
    y,
    rot: (rot * Math.PI) / 180,
    w,
    d,
    h: spec.h,
    color: p.color,
    blocksMove: !!spec.blocksMove,
    blocksVision: !!spec.blocksVision,
    box: { minX: x - fw / 2, maxX: x + fw / 2, minY: y - fd / 2, maxY: y + fd / 2 },
  };
}
