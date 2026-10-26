// Dashed preview of the leg a click would add (path-found, desktop hover).
// Cached per (cell, route length, unit) so the A* runs only when it changes.
// Hidden while time runs, while editing is off and over an operator.
import { NAV } from '../config/balance.js';
import { routeTail } from '../sim/queries.js';
import { canEditRoutes, isPlanningTime } from '../session/Session.js';

export class RoutePreview {
  constructor(session) {
    this.session = session;
    this.cell = -1;
  }

  invalidate() {
    this.cell = -1;
  }

  /** @param unit selected unit or null; world = cursor on the floor or null */
  update(sim, unit, world, overUnit) {
    const ui = this.session.ui;
    if (!unit || overUnit || !world || !canEditRoutes(this.session) || !isPlanningTime(this.session)) {
      ui.hoverPath = null;
      this.cell = -1;
      return;
    }
    const nav = sim.world.nav;
    const key = nav.cellIndex(world.x, world.y) * 1000 + unit.route.length + unit.id * 7;
    if (key === this.cell) return;
    this.cell = key;
    const tail = routeTail(unit);
    const path = nav.findPath(tail.x, tail.y, world.x, world.y, NAV.snapRadius);
    if (!path) {
      ui.hoverPath = null;
      return;
    }
    const pts = [tail.x, tail.y];
    for (const p of path) pts.push(p.x, p.y);
    ui.hoverPath = pts;
  }
}
