// Door Kickers style orders: select operators, click/drag routes, set
// facing, holds for GO codes. Exposes device-independent actions (tap,
// beginDraw/drawTo/endDraw/cancelDraw, beginLook/lookTo/endLook) used by
// MouseKeyController (mouse + keyboard) and TouchController. Emits commands on the
// bus, stamped with the player's side (session.team); never mutates the
// simulation directly (it only *reads* it for previews and picking).
//
// A freehand drag is one "stroke": beginStroke / endStroke commands bracket
// it, so the sim straightens it on release (no wobble) and a gesture that
// turns out to be a pinch can remove it whole (cancelStroke).
// Helpers: input/picking.js (what is under a screen point), input/RoutePreview.js (hover leg).
import { EV } from '../core/events.js';
import { POINTER, TOUCH } from '../config/input.js';
import { NAV } from '../config/balance.js';
import { routeTail, lastUserIndex, controllableUnit } from '../sim/queries.js';
import { canEditRoutes } from '../session/Session.js';
import { unitAt, waypointAt, nearTail, pickRadius } from './picking.js';
import { RoutePreview } from './RoutePreview.js';

export class PlanningController {
  constructor({ bus, camera, session, getSim }) {
    this.bus = bus;
    this.camera = camera;
    this.session = session;
    this.getSim = getSim;
    this.draw = null; // {lastX, lastY, added, unitId, px, py, touch}
    this.look = null; // {x, y, unitId, index}
    this.preview = new RoutePreview(session);
    this.edgeSince = 0; // s the drawing pointer has rested at the screen edge
  }

  get canEdit() {
    return canEditRoutes(this.session);
  }

  get busy() {
    return !!(this.draw || this.look);
  }

  selectedUnit() {
    return controllableUnit(this.getSim(), this.session.selectedId, this.session.team);
  }

  command(cmd) {
    cmd.team = this.session.team;
    this.bus.emit(EV.COMMAND, cmd);
  }

  select(unitId) {
    this.bus.emit(EV.SELECT, { unitId });
  }

  request(action) {
    this.bus.emit(EV.REQUEST, { action });
  }

  world(px, py) {
    return this.camera.screenToWorld(px, py, 0);
  }

  /** Living operator of the player's side under a screen point, or null. */
  unitAt(px, py, touch = false) {
    return unitAt(this.camera, this.getSim(), this.session.team, px, py, touch);
  }

  /** Index of the selected unit's user waypoint near a screen point (or -1). */
  waypointAt(px, py, radius) {
    const u = this.selectedUnit();
    if (!u) return -1;
    const w = this.world(px, py);
    return waypointAt(u, w.x, w.y, radius);
  }

  /** Is a screen point on the end of the selected unit's route (or on him, with no route)? */
  nearTail(px, py, pickPx) {
    const u = this.selectedUnit();
    if (!u) return false;
    const w = this.world(px, py);
    return nearTail(this.camera, u, w.x, w.y, pickPx);
  }

  pickRadius(meters, px) {
    return pickRadius(this.camera, meters, px);
  }

  // ------------------------------------------------------------ actions

  /** Tap / click: select an operator, otherwise add a waypoint. */
  tap(px, py, touch = false) {
    if (!this.canEdit) return false;
    const hit = this.unitAt(px, py, touch);
    if (hit) {
      this.select(hit.id);
      return true;
    }
    const u = this.selectedUnit();
    if (!u) return false;
    // A second tap on the last point (double tap, shaky finger) adds nothing.
    if (u.route.length && this.nearTail(px, py, touch ? TOUCH.duplicatePointPx : POINTER.duplicatePointPx)) return true;
    const w = this.world(px, py);
    this.command({ type: 'addWaypoint', unitId: u.id, x: w.x, y: w.y, user: true });
    return true;
  }

  /**
   * Starts a freehand route at a screen point: from the selected operator if
   * the drag starts on him, from the route's end if it starts there, else
   * from a new waypoint at the touch point (the route is extended to it).
   */
  beginDraw(px, py, touch = false) {
    const u = this.selectedUnit();
    if (!u || !this.canEdit) return false;
    const onUnit = this.unitAt(px, py, touch) === u;
    const onTail = this.nearTail(px, py, touch ? TOUCH.tailPickPx : POINTER.tailPickPx);
    this.command({ type: 'beginStroke', unitId: u.id });
    let start;
    if (onUnit && !u.route.length) start = u;
    else if (onUnit || onTail) start = routeTail(u);
    else {
      start = this.world(px, py);
      this.command({ type: 'addWaypoint', unitId: u.id, x: start.x, y: start.y, user: true });
    }
    this.draw = { lastX: start.x, lastY: start.y, added: 0, unitId: u.id, px, py, touch };
    this.edgeSince = 0;
    this.session.ui.drawing = true;
    this.session.ui.hoverPath = null;
    return true;
  }

  drawTo(px, py) {
    if (!this.draw) return;
    this.draw.px = px;
    this.draw.py = py;
    const w = this.world(px, py);
    if (Math.hypot(w.x - this.draw.lastX, w.y - this.draw.lastY) < NAV.dragSpacing) return;
    this.command({ type: 'addWaypoint', unitId: this.draw.unitId, x: w.x, y: w.y, user: false, quiet: true });
    this.draw.lastX = w.x;
    this.draw.lastY = w.y;
    this.draw.added++;
  }

  endDraw(px, py) {
    if (!this.draw) return;
    const id = this.draw.unitId;
    const w = this.world(px, py);
    const d = Math.hypot(w.x - this.draw.lastX, w.y - this.draw.lastY);
    if (d > POINTER.drawEndMinDistance) this.command({ type: 'addWaypoint', unitId: id, x: w.x, y: w.y, user: true });
    else if (this.draw.added > 0) this.command({ type: 'promoteLast', unitId: id });
    this.command({ type: 'endStroke', unitId: id });
    this.cancel();
  }

  /** Abandons the stroke being drawn and removes what it added. */
  cancelDraw() {
    if (!this.draw) return;
    this.command({ type: 'cancelStroke', unitId: this.draw.unitId });
    this.cancel();
  }

  /** Look mode anchored on a waypoint index (-1 = last user waypoint / the unit). */
  beginLook(px, py, index = -1) {
    const u = this.selectedUnit();
    if (!u || !this.canEdit) return false;
    const i = index >= 0 ? index : lastUserIndex(u);
    const anchor = i >= 0 ? u.route[i] : u;
    this.look = { x: anchor.x, y: anchor.y, unitId: u.id, index: i };
    this.lookTo(px, py);
    return true;
  }

  lookTo(px, py) {
    if (!this.look) return;
    const w = this.world(px, py);
    const dx = w.x - this.look.x;
    const dy = w.y - this.look.y;
    this.session.ui.lookPreview = { x: this.look.x, y: this.look.y, angle: Math.atan2(dy, dx), valid: Math.hypot(dx, dy) >= POINTER.lookMinDistance };
  }

  endLook() {
    if (!this.look) return;
    const lp = this.session.ui.lookPreview;
    if (lp && lp.valid) this.command({ type: 'setLook', unitId: this.look.unitId, angle: lp.angle, index: this.look.index });
    this.cancel();
  }

  cancel() {
    this.draw = null;
    this.look = null;
    this.session.ui.drawing = false;
    this.session.ui.lookPreview = null;
    this.preview.invalidate();
  }

  /**
   * Every frame (Game loop): while a route is drawn with a finger held near
   * the screen edge, the camera pans that way and the route keeps extending,
   * so long routes never require lifting the finger. (The mouse edge-scrolls
   * through CameraController.)
   */
  update(dt) {
    const d = this.draw;
    if (!d) return;
    const cam = this.camera;
    const edge = d.touch ? TOUCH.edgePanPx : POINTER.edgePanPx;
    const dx = d.px < edge ? -1 : d.px > cam.width - edge ? 1 : 0;
    const dy = d.py < edge ? -1 : d.py > cam.heightPx - edge ? 1 : 0;
    this.edgeSince = dx || dy ? this.edgeSince + dt : 0;
    if ((dx || dy) && d.touch && this.edgeSince * 1000 >= TOUCH.edgePanDelayMs) {
      const step = TOUCH.edgePanSpeed * cam.metersPerPixel(0) * cam.heightPx * Math.min(dt, 0.05);
      const len = Math.hypot(dx, dy);
      cam.pan((dx / len) * step, (dy / len) * step);
    }
    this.drawTo(d.px, d.py);
  }

  /** Dashed preview of the leg a click would add (desktop hover). */
  updateHoverPath(world, overUnit) {
    this.preview.update(this.getSim(), this.canEdit ? this.selectedUnit() : null, world, overUnit);
  }

  /** Invalidate the cached preview (route changed, selection changed, phase...). */
  refresh() {
    this.preview.invalidate();
    if (this.session.ui.cursorWorld && !this.session.touch) this.updateHoverPath(this.session.ui.cursorWorld, this.session.hoverUnitId >= 0);
    else this.session.ui.hoverPath = null;
  }

  undo() {
    const u = this.selectedUnit();
    if (u && this.canEdit) this.command({ type: 'undoWaypoint', unitId: u.id });
    return true;
  }

  clear() {
    const u = this.selectedUnit();
    if (u && this.canEdit) this.command({ type: 'clearRoute', unitId: u.id });
    return true;
  }

  toggleHold() {
    const u = this.selectedUnit();
    if (u && this.canEdit) this.command({ type: 'toggleHold', unitId: u.id });
    return true;
  }
}
