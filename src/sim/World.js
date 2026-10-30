// Static world geometry + the dynamic door segments, in the form the
// simulation needs: collision boxes, a flat segment list for LOS/bullets
// and a navigation grid.
import { pushBoxEdges } from '../core/geom.js';
import { NAV, COVER, ENTRY } from '../config/balance.js';
import { NavGrid } from './NavGrid.js';
import { dcos, dsin } from '../core/dmath.js';

export class World {
  constructor(compiled) {
    this.map = compiled;
    this.width = compiled.width;
    this.height = compiled.height;
    this.zones = compiled.zones;
    this.doorways = compiled.doorways;
    this.rooms = compiled.rooms;

    this.wallBoxes = compiled.walls.map((w) => w.box);
    this.propBlockers = compiled.props.filter((p) => p.blocksMove).map((p) => p.box);
    // Window sills: nobody walks through a window, but sight, shots and throws go through.
    this.windowBoxes = (compiled.windows || []).map((w) => w.box);
    this.moveBlockers = [...this.wallBoxes, ...this.propBlockers, ...this.windowBoxes];
    // Low cover: solid furniture you can see and shoot over (see COVER), and the window sills.
    this.lowCover = [...compiled.props.filter((p) => p.blocksMove && !p.blocksVision && p.h >= COVER.minHeight).map((p) => p.box), ...this.windowBoxes];

    // Flat LOS/bullet segment list: box edges (walls, vision-blocking props,
    // map border), then one slot (4 floats) per door slab.
    const segs = [];
    for (const b of this.wallBoxes) pushBoxEdges(segs, b);
    for (const p of compiled.props) if (p.blocksVision) pushBoxEdges(segs, p.box);
    pushBoxEdges(segs, { minX: 0, minY: 0, maxX: this.width, maxY: this.height });
    this.staticSegmentCount = segs.length;

    // Then the smoke clouds (sim/smoke.js): they block sight but not bullets or blasts, so the
    // solid part (walls, props, doors: solidCount) is what bullets and explosions test.
    this.solidCount = segs.length + compiled.doors.length * 4;
    this.segments = new Float64Array(this.solidCount + ENTRY.smoke.max * ENTRY.smoke.sides * 4);
    this.segments.set(segs);
    this.segmentCount = this.solidCount;
    /** Bumped whenever a door slab moves: lets observers cache LOS-derived data. */
    this.segmentsVersion = 0;

    this.nav = new NavGrid(this.width, this.height, NAV.cellSize, this.moveBlockers, NAV.clearance);
  }

  /** Writes the current door slabs into the shared segment list. */
  updateDoorSegments(doors) {
    let o = this.staticSegmentCount;
    for (const d of doors) {
      const a = d.def.closedAngle + d.angle;
      const len = d.destroyed ? 0 : d.def.length; // a blown door leaves a zero-length slab (never blocks)
      this.segments[o++] = d.def.hingeX;
      this.segments[o++] = d.def.hingeY;
      this.segments[o++] = d.def.hingeX + dcos(a) * len;
      this.segments[o++] = d.def.hingeY + dsin(a) * len;
    }
    this.segmentsVersion++;
  }

  /** Writes the smoke clouds ({x, y, r}) as polygons after the solid segments (sight only). */
  updateSmokeSegments(clouds) {
    const n = ENTRY.smoke.sides;
    let o = this.solidCount;
    for (const c of clouds) {
      if (c.r <= 0.05) continue;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        this.segments[o++] = c.x + dcos(a0) * c.r;
        this.segments[o++] = c.y + dsin(a0) * c.r;
        this.segments[o++] = c.x + dcos(a1) * c.r;
        this.segments[o++] = c.y + dsin(a1) * c.r;
      }
    }
    this.segmentCount = o;
    this.segmentsVersion++;
  }
}
