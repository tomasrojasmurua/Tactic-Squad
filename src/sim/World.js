// Static world geometry + the dynamic door segments, in the form the
// simulation needs: collision boxes, a flat segment list for LOS/bullets
// and a navigation grid.
import { pushBoxEdges } from '../core/geom.js';
import { NAV, COVER } from '../config/balance.js';
import { NavGrid } from './NavGrid.js';

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
    this.moveBlockers = [...this.wallBoxes, ...this.propBlockers];
    // Low cover: solid furniture you can see and shoot over (see COVER).
    this.lowCover = compiled.props.filter((p) => p.blocksMove && !p.blocksVision && p.h >= COVER.minHeight).map((p) => p.box);

    // Flat LOS/bullet segment list: box edges (walls, vision-blocking props,
    // map border), then one slot (4 floats) per door slab.
    const segs = [];
    for (const b of this.wallBoxes) pushBoxEdges(segs, b);
    for (const p of compiled.props) if (p.blocksVision) pushBoxEdges(segs, p.box);
    pushBoxEdges(segs, { minX: 0, minY: 0, maxX: this.width, maxY: this.height });
    this.staticSegmentCount = segs.length;

    this.segments = new Float64Array(segs.length + compiled.doors.length * 4);
    this.segments.set(segs);
    this.segmentCount = this.segments.length;
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
      this.segments[o++] = d.def.hingeX + Math.cos(a) * len;
      this.segments[o++] = d.def.hingeY + Math.sin(a) * len;
    }
    this.segmentsVersion++;
  }
}
