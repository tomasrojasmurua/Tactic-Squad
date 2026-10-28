// Door Kickers style orders: select operators, click/drag routes, set
// facing, holds for GO codes. Exposes device-independent actions (tap,
// beginDraw/drawTo/endDraw/cancelDraw, beginLook/lookTo/endLook) used by
// MouseKeyController (mouse + keyboard) and TouchController. Emits commands on the
// bus, stamped with the player's side (session.team); never mutates the
// simulation directly (it only *reads* it for previews and picking).
//
// In the defender's set-up (preparation, playing the defenders) the same
// gestures place instead of drawing: a tap or a drag puts the selected
// defender there (placeUnit) and the facing gesture turns his watch order.
//
// A freehand drag is one "stroke": beginStroke / endStroke commands bracket
// it, so the sim straightens it on release (no wobble) and a gesture that
// turns out to be a pinch can remove it whole (cancelStroke).
// Helpers: input/picking.js (what is under a screen point), input/RoutePreview.js (hover leg).
import { EV } from '../core/events.js';
import { POINTER, TOUCH, DOOR_TAP } from '../config/input.js';
import { NAV } from '../config/balance.js';
import { routeTail, lastUserIndex, controllableUnit, entryDoorwayAt, entryModeFits, gearLeft, ENTRY_GEAR, teamUnits, doorwayNear, HERE } from '../sim/queries.js';
import { ENTRY } from '../config/balance.js';
import { canEditRoutes, targetIndex, isDefenderSetup, inRecon } from '../session/Session.js';
import { watchOf, watchOrder } from '../session/watch.js';
import { unitAt, waypointAt, nearTail, pickRadius, segmentAt } from './picking.js';
import { RoutePreview } from './RoutePreview.js';

export class PlanningController {
  constructor({ bus, camera, session, getSim }) {
    this.bus = bus;
    this.camera = camera;
    this.session = session;
    this.getSim = getSim;
    this.draw = null; // {lastX, lastY, added, unitId, px, py, touch}
    this.look = null; // {x, y, unitId, index}
    this.move = null; // {unitId, index, insert}: a waypoint (or a new one) being dragged
    this.preview = new RoutePreview(session);
    this.edgeSince = 0; // s the drawing pointer has rested at the screen edge
  }

  get canEdit() {
    return canEditRoutes(this.session);
  }

  get busy() {
    return !!(this.draw || this.look || this.move);
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

  /**
   * What a press at a screen point grabs (selected operator's plan first):
   *   unit      the selected operator          -> drag draws his route (from its end)
   *   tail      the end of his route           -> drag continues it
   *   waypoint  one of his user waypoints      -> drag moves it; tap opens the door picker on it
   *   segment   a stretch of his route         -> drag inserts a waypoint there
   *   other     another operator of the side   -> tap selects him
   *   ground    nothing of the plan            -> drag pans the camera; tap adds a waypoint
   */
  grab(px, py, touch = false) {
    const hit = this.unitAt(px, py, touch);
    const u = this.selectedUnit();
    if (hit && (!u || hit.id !== u.id)) return { kind: 'other', unit: hit };
    if (!u) return { kind: 'ground' };
    if (hit) return { kind: 'unit', unit: u };
    if (u.route.length && this.nearTail(px, py, touch ? TOUCH.tailPickPx : POINTER.tailPickPx)) return { kind: 'tail', unit: u };
    const w = this.world(px, py);
    const radius = touch ? this.pickRadius(TOUCH.waypointPickMinRadius, TOUCH.waypointPickPx) : this.pickRadius(POINTER.waypointPickRadius, POINTER.waypointPickPx);
    const wp = waypointAt(u, w.x, w.y, radius);
    if (wp >= 0) return { kind: 'waypoint', unit: u, index: wp };
    const seg = segmentAt(u, w.x, w.y, radius * 0.6);
    if (seg >= 0) return { kind: 'segment', unit: u, index: seg };
    return { kind: 'ground', unit: u };
  }

  // ------------------------------------------------------------ actions

  /** Tap / click: select an operator, open the door picker on a waypoint, otherwise add a waypoint. */
  tap(px, py, touch = false) {
    if (!this.canEdit) return false;
    if (this.session.ui.tossPick) return this.placeToss(px, py);
    const g = this.grab(px, py, touch);
    if (g.kind === 'other') {
      this.select(g.unit.id);
      return true;
    }
    if (g.kind === 'waypoint') {
      this.request(`door_${g.unit.id}_${g.index}`);
      return true;
    }
    if (g.kind === 'tail') {
      // A tap on the end of the route opens its menu (a double tap adds no point on top of it).
      const last = lastUserIndex(g.unit);
      if (last >= 0) this.request(`door_${g.unit.id}_${last}`);
      return true;
    }
    const u = this.selectedUnit();
    if (!u) return false;
    if (isDefenderSetup(this.session)) return this.place(u, px, py);
    if (g.kind === 'unit') {
      // Tapping the selected operator: his menu on the spot he stands on (throw / wait from here).
      this.request(`door_${u.id}_${HERE}`);
      return true;
    }
    // A second tap on the last point (double tap, shaky finger) adds nothing.
    if (u.route.length && this.nearTail(px, py, touch ? TOUCH.duplicatePointPx : POINTER.duplicatePointPx)) return true;
    const w = this.world(px, py);
    const k = this.doorAt(w.x, w.y, touch);
    if (k >= 0) return this.stackAt(u, k);
    this.command({ type: 'addWaypoint', unitId: u.id, x: w.x, y: w.y, user: true });
    return true;
  }

  /** Index of the doorway (with a door) a tap on the floor at (x, y) lands on, or -1. */
  doorAt(x, y, touch) {
    const sim = this.getSim();
    const d = doorwayNear(sim.world, x, y, 2);
    if (!d) return -1;
    const k = sim.world.doorways.indexOf(d);
    if (k >= sim.doors.length) return -1; // an open passage: a tap there is just a point
    const across = Math.abs((x - d.cx) * d.normalX + (y - d.cy) * d.normalY);
    const along = Math.abs((x - d.cx) * d.normalY - (y - d.cy) * d.normalX);
    const slack = touch ? DOOR_TAP.touch : DOOR_TAP.pointer;
    return across <= slack && along <= d.length / 2 + slack * 0.5 ? k : -1;
  }

  /**
   * A tap on a door: he stacks on the near side of it (ENTRY.askDistance from
   * the wall, the side his route reaches first) and the door wheel opens on
   * that point. Already stacked there: the wheel just opens.
   */
  stackAt(u, k) {
    const sim = this.getSim();
    const d = sim.world.doorways[k];
    const tail = routeTail(u);
    const last = lastUserIndex(u);
    let best = null;
    for (const side of [-1, 1]) {
      const x = d.cx + d.normalX * side * ENTRY.askDistance;
      const y = d.cy + d.normalY * side * ENTRY.askDistance;
      if (last >= 0 && Math.hypot(u.route[last].x - x, u.route[last].y - y) < 0.3) {
        this.request(`door_${u.id}_${last}`);
        return true;
      }
      const path = sim.world.nav.findPath(tail.x, tail.y, x, y, NAV.snapRadius);
      if (!path || !path.length) continue;
      let len = 0;
      let a = tail;
      for (const q of path) {
        len += Math.hypot(q.x - a.x, q.y - a.y);
        a = q;
      }
      if (!best || len < best.len) best = { x, y, len };
    }
    if (!best) {
      this.command({ type: 'addWaypoint', unitId: u.id, x: d.cx, y: d.cy, user: true }); // rejected: tells why
      return true;
    }
    // The wheel opens on the new point once the sim reports it added (SessionController, EV.ROUTE_CHANGED).
    this.session.ui.wheelAt = { unitId: u.id, x: best.x, y: best.y };
    this.command({ type: 'addWaypoint', unitId: u.id, x: best.x, y: best.y, user: true });
    return true;
  }

  /**
   * Starts a freehand route: from the selected operator (when he has no route)
   * or from his route's end — the drag began on one of them (grab()).
   */
  beginDraw(px, py, touch = false) {
    const u = this.selectedUnit();
    if (!u || !this.canEdit) return false;
    if (isDefenderSetup(this.session)) return this.place(u, px, py);
    this.command({ type: 'beginStroke', unitId: u.id });
    // From the operator (no route yet) or from the end of his route: a drag elsewhere pans the camera.
    const start = routeTail(u);
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

  /**
   * Dragging a waypoint (or a stretch of route: a new waypoint there) to
   * another place: a ghost follows the pointer and the order is given on
   * release (sim/orders.js moveWaypoint / insertWaypoint).
   */
  beginMove(grab, px, py) {
    if (!this.canEdit || !grab.unit) return false;
    this.move = { unitId: grab.unit.id, index: grab.index, insert: grab.kind === 'segment' };
    this.moveTo(px, py);
    return true;
  }

  moveTo(px, py) {
    if (!this.move) return;
    const w = this.world(px, py);
    this.session.ui.movePreview = { unitId: this.move.unitId, index: this.move.index, insert: this.move.insert, x: w.x, y: w.y };
  }

  endMove(px, py) {
    if (!this.move) return;
    const w = this.world(px, py);
    const m = this.move;
    this.command({ type: m.insert ? 'insertWaypoint' : 'moveWaypoint', unitId: m.unitId, index: m.index, x: w.x, y: w.y });
    this.cancel();
  }

  /**
   * Squad route: the other living operators follow the selected one in file
   * (sim/follow.js) — one route for the squad. Again: each one is back on
   * his own (the route he had stays).
   */
  toggleSquad() {
    const u = this.selectedUnit();
    if (!u || !this.canEdit) return true;
    const sim = this.getSim();
    const others = teamUnits(sim, this.session.team).filter((o) => o.alive && o !== u);
    const all = others.length && others.every((o) => o.follow && o.follow.leader === u.id);
    if (u.follow) this.command({ type: 'unfollow', unitId: u.id }); // the new leader leads
    others.forEach((o, i) => {
      if (all) this.command({ type: 'unfollow', unitId: o.id });
      else this.command({ type: 'follow', unitId: o.id, leaderId: u.id, rank: i + 1 });
    });
    return true;
  }

  /** Shift + click on an operator: he joins (or leaves) the selected one's file. */
  toggleFollower(unitId) {
    const u = this.selectedUnit();
    const sim = this.getSim();
    const o = controllableUnit(sim, unitId, this.session.team);
    if (!u || !o || o === u || !this.canEdit) return true;
    if (o.follow && o.follow.leader === u.id) {
      this.command({ type: 'unfollow', unitId: o.id });
      return true;
    }
    if (u.follow) this.command({ type: 'unfollow', unitId: u.id });
    const rank = teamUnits(sim, this.session.team).filter((f) => f.alive && f.follow && f.follow.leader === u.id).length + 1;
    this.command({ type: 'follow', unitId: o.id, leaderId: u.id, rank });
    return true;
  }

  /** Pace of the targeted leg (the tapped waypoint's, else the last one): sneak <-> normal. */
  togglePace() {
    const u = this.selectedUnit();
    if (!u || !this.canEdit) return true;
    const i = targetIndex(this.session, u);
    if (i < 0) {
      this.command({ type: 'setPace', unitId: u.id, pace: 'sneak' }); // rejected without a waypoint: tells why
      return true;
    }
    this.command({ type: 'setPace', unitId: u.id, pace: u.route[i].pace === 'sneak' ? null : 'sneak', index: i });
    return true;
  }

  /** Menu "Asomarse y volver" on the targeted point (or the way back of one): on <-> off. */
  togglePeek() {
    const u = this.selectedUnit();
    if (!u || !this.canEdit) return true;
    const i = targetIndex(this.session, u);
    if (i < 0) return true;
    let k = i;
    if (u.route[i].back) for (k = i - 1; k >= 0 && !(u.route[k].user && !u.route[k].ask); k--);
    const on = !(k >= 0 && u.route[k].pause > 0);
    // The menu stays on the peek point (the way back is added after it).
    this.session.pointTarget = { unitId: u.id, index: k >= 0 ? k : i };
    this.command({ type: 'setPeek', unitId: u.id, on, index: i });
    return true;
  }

  /** Cubrir zona (attackers): where he stands (the menu on himself) or at the end of his route. */
  toggleCover() {
    const u = this.selectedUnit();
    if (!u || !this.canEdit) return true;
    const t = this.session.pointTarget;
    const here = (t && t.unitId === u.id && t.index === HERE) || !u.route.length;
    const i = lastUserIndex(u);
    const on = !(here ? u.cover : i >= 0 && u.route[i].cover);
    this.command({ type: 'setCover', unitId: u.id, on, index: here ? HERE : i });
    return true;
  }

  /** Pace of the targeted leg: 'sneak' or null (normal). */
  setPace(pace) {
    const u = this.selectedUnit();
    if (!u || !this.canEdit) return true;
    const i = targetIndex(this.session, u);
    if (i < 0) return true;
    this.keepTarget(u, i, u.route[i]);
    this.command({ type: 'setPace', unitId: u.id, pace, index: i });
    return true;
  }

  /**
   * Menu "Lanzar": the targeted point throws `item` (flash / frag / smoke).
   * Pressing the item it already throws removes the throw; otherwise the next
   * tap on the map is the target (placeToss).
   */
  pickToss(item) {
    const u = this.selectedUnit();
    if (!u || !this.canEdit) return true;
    if (this.here(u)) {
      const ui = this.session.ui;
      ui.tossPick = ui.tossPick && ui.tossPick.item === item ? null : { unitId: u.id, index: HERE, item };
      if (ui.tossPick) this.request('tossAim');
      return true;
    }
    const i = targetIndex(this.session, u);
    if (i < 0) return true;
    const p = u.route[i];
    this.keepTarget(u, i, p);
    const ui = this.session.ui;
    if (ui.tossPick && ui.tossPick.item === item) ui.tossPick = null; // pressed again while aiming: cancel
    else if (p.toss && p.toss.item === item) this.command({ type: 'setToss', unitId: u.id, item: null, index: i });
    else {
      ui.tossPick = { unitId: u.id, index: i, item };
      this.request('tossAim');
    }
    return true;
  }

  /** Esc / the menu's × while aiming: no throw is set, the menu is back. */
  cancelToss() {
    this.session.ui.tossPick = null;
    return true;
  }

  /** The tap after "Lanzar": that is where the throw lands (sim keeps it within ENTRY.tossRange). */
  placeToss(px, py) {
    const ui = this.session.ui;
    const tp = ui.tossPick;
    ui.tossPick = null;
    const u = this.getSim().units[tp.unitId];
    if (!u || !u.alive || tp.index >= u.route.length) return true;
    const w = this.world(px, py);
    this.session.pointTarget = { unitId: u.id, index: tp.index === HERE ? 0 : tp.index }; // "here" is his first point now
    this.command({ type: 'setToss', unitId: u.id, item: tp.item, x: w.x, y: w.y, index: tp.index });
    return true;
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
    if (lp && lp.valid && inRecon(this.getSim(), this.session)) {
      // Recon: the operators are placed and aimed after it.
    } else if (lp && lp.valid && isDefenderSetup(this.session)) {
      // Set-up: the facing of his watch order (same mode, centred on the new angle).
      const u = this.getSim().units[this.look.unitId];
      const w = watchOf(u);
      this.command({ type: 'setWatch', unitId: u.id, watch: watchOrder(w.mode === 'patrol' ? 'alert' : w.mode, lp.angle, w.fallback) });
    } else if (lp && lp.valid) this.command({ type: 'setLook', unitId: this.look.unitId, angle: lp.angle, index: this.look.index });
    this.cancel();
  }

  /**
   * Set-up: the selected defender stands at the point (his facing and watch
   * order stay) — or, in trap mode with the Trampero selected, he lays a trap
   * there (or picks his own up).
   */
  place(u, px, py) {
    if (inRecon(this.getSim(), this.session)) return true; // his operators come after the recon
    const w = this.world(px, py);
    if (this.session.ui.trapMode && u.role === 'trapper') this.command({ type: 'placeTrap', unitId: u.id, x: w.x, y: w.y });
    else this.command({ type: 'placeUnit', unitId: u.id, x: w.x, y: w.y });
    return true;
  }

  cancel() {
    this.draw = null;
    this.look = null;
    this.move = null;
    this.session.ui.drawing = false;
    this.session.ui.lookPreview = null;
    this.session.ui.movePreview = null;
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
    this.preview.update(this.getSim(), this.canEdit && !isDefenderSetup(this.session) ? this.selectedUnit() : null, world, overUnit);
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

  /**
   * How the selected operator goes through the door next to his last
   * waypoint (null / 'none' = just open it). Choosing the mode already set
   * clears it. An entry usually waits for a GO: a waypoint without a hold
   * gets one (code A) so the team can be synchronized.
   */
  setEntry(mode) {
    const u = this.selectedUnit();
    if (!u || !this.canEdit) return true;
    const i = targetIndex(this.session, u);
    if (i < 0) return true;
    const p = u.route[i];
    this.keepTarget(u, i, p);
    // On a "?" door point every press is a decision ("Abrir" too); elsewhere the active mode toggles off.
    const next = mode === 'none' || (mode === p.entry && !p.ask) ? null : mode;
    this.command({ type: 'setEntry', unitId: u.id, mode: next, index: i });
    // A door point waits for nobody unless the player says when; a plain stack waits for GO A.
    if (next && !p.hold && !p.ask && entryModeFits(this.getSim(), entryDoorwayAt(this.getSim().world, p.x, p.y), next)) {
      this.command({ type: 'setHold', unitId: u.id, code: ENTRY.goCodes[0], index: i });
    }
    return true;
  }

  /** Keyboard: next entry mode that fits (open -> kick -> crack -> flash -> grenade -> charge -> open). */
  cycleEntry() {
    const u = this.selectedUnit();
    if (!u || !this.canEdit) return true;
    const i = targetIndex(this.session, u);
    if (i < 0) return true;
    const sim = this.getSim();
    const p = u.route[i];
    const k = p.door >= 0 ? p.door : entryDoorwayAt(sim.world, p.x, p.y);
    if (k < 0) {
      this.command({ type: 'setEntry', unitId: u.id, mode: 'kick', index: i }); // rejected: tells why
      return true;
    }
    const order = [null, ...ENTRY.modes];
    let at = order.indexOf(p.entry || null);
    for (let n = 0; n < order.length; n++) {
      at = (at + 1) % order.length;
      const m = order[at];
      const item = m && ENTRY_GEAR[m];
      if (m === null || (entryModeFits(sim, k, m) && (!item || gearLeft(u, item, i) > 0))) {
        this.setEntry(m === null ? 'none' : m);
        return true;
      }
    }
    return true;
  }

  /** When he goes through the door of the targeted point: right away (null) or with GO `code`. */
  setWhen(code) {
    const u = this.selectedUnit();
    if (!u || !this.canEdit) return true;
    if (this.here(u)) {
      if (code === null) return true; // "now" from where he stands: nothing to set
      this.session.pointTarget = { unitId: u.id, index: 0 };
      this.command({ type: 'setHold', unitId: u.id, code, index: HERE });
      return true;
    }
    const i = targetIndex(this.session, u);
    if (i < 0) return true;
    this.keepTarget(u, i, u.route[i]);
    this.command({ type: 'setHold', unitId: u.id, code, index: i });
    return true;
  }

  /** Is the menu on the spot u stands on (a tap on him), not on a point of his route? */
  here(u) {
    const t = this.session.pointTarget;
    return !!t && t.unitId === u.id && t.index === HERE;
  }

  /** Deciding on a tapped point (a "?" stops being one): the menu stays on it, not on the last waypoint. */
  keepTarget(u, i, p) {
    const t = this.session.pointTarget;
    if (p.ask || (t && t.unitId === u.id && t.index === i)) this.session.pointTarget = { unitId: u.id, index: i };
  }

  /** H: the targeted waypoint waits for GO A -> B -> C -> no wait. */
  toggleHold() {
    const u = this.selectedUnit();
    if (!u || !this.canEdit) return true;
    const i = targetIndex(this.session, u);
    if (i < 0 || i === lastUserIndex(u)) {
      this.command({ type: 'toggleHold', unitId: u.id }); // rejected without a waypoint: tells why
      return true;
    }
    const p = u.route[i];
    this.keepTarget(u, i, p);
    const codes = ENTRY.goCodes;
    const next = p.hold ? codes.indexOf(p.code || codes[0]) + 1 : 0;
    this.command({ type: 'setHold', unitId: u.id, code: next < codes.length ? codes[next] : null, index: i });
    return true;
  }
}
