// Mouse + keyboard mapping onto the device-independent planning actions
// (input/PlanningController.js). What a left press does depends on what it
// grabs (PlanningController.grab):
//   the selected operator / his route's end   drag: draw the route
//   one of his waypoints                      drag: move it; click: door picker on it
//   a stretch of his route                    drag: a new waypoint there
//   another operator                          click: select him (shift: he joins / leaves the file)
//   the floor                                 drag: pan the camera; click: add a waypoint
// Right drag = facing. Number keys / Tab = selection; Backspace / X / H / E / Q / T = route edits.
import { KEYS, POINTER } from '../config/input.js';
import { matches } from './InputManager.js';
import { teamUnits } from '../sim/queries.js';

export class MouseKeyController {
  /** @param {import('./PlanningController.js').PlanningController} planning */
  constructor(planning, camera) {
    this.p = planning;
    this.camera = camera;
    this.press = null; // {x, y, grab, shift, mode: 'pending' | 'draw' | 'move' | 'pan'}
  }

  // ------------------------------------------------------------ mouse

  onPointerDown(e) {
    if (!this.p.canEdit) return false;
    if (e.button === 0) {
      const grab = this.p.grab(e.x, e.y);
      if (grab.kind === 'other') {
        if (e.shift) return this.p.toggleFollower(grab.unit.id);
        return this.p.tap(e.x, e.y);
      }
      this.press = { x: e.x, y: e.y, lastX: e.x, lastY: e.y, grab, mode: 'pending' };
      return true;
    }
    if (e.button === 2) return this.p.beginLook(e.x, e.y);
    return false;
  }

  onPointerMove(e) {
    this.p.session.ui.cursorWorld = this.p.world(e.x, e.y);
    const hover = this.p.unitAt(e.x, e.y);
    this.p.session.hoverUnitId = hover ? hover.id : -1;
    const pr = this.press;
    if (pr) {
      if (pr.mode === 'pending' && Math.hypot(e.x - pr.x, e.y - pr.y) >= POINTER.dragThresholdPx) this.beginDrag(pr);
      if (pr.mode === 'draw') this.p.drawTo(e.x, e.y);
      else if (pr.mode === 'move') this.p.moveTo(e.x, e.y);
      else if (pr.mode === 'pan') {
        const mpp = this.camera.metersPerPixel(0);
        this.camera.pan(-(e.x - pr.lastX) * mpp, -(e.y - pr.lastY) * mpp);
      }
      pr.lastX = e.x;
      pr.lastY = e.y;
      return true;
    }
    if (this.p.look) {
      this.p.lookTo(e.x, e.y);
      return true;
    }
    this.p.updateHoverPath(this.p.session.ui.cursorWorld, !!hover);
    return false;
  }

  /** The press became a drag: draw, move a waypoint, insert one, or pan — by what it grabbed. */
  beginDrag(pr) {
    const k = pr.grab.kind;
    if (this.p.session.ui.tossPick) pr.mode = 'pan'; // aiming a throw: a drag only looks around
    else if ((k === 'unit' || k === 'tail') && this.p.beginDraw(pr.x, pr.y)) pr.mode = 'draw';
    else if ((k === 'waypoint' || k === 'segment') && this.p.beginMove(pr.grab, pr.x, pr.y)) pr.mode = 'move';
    else pr.mode = 'pan';
  }

  onPointerUp(e) {
    if (e.button === 0 && this.press) {
      const pr = this.press;
      this.press = null;
      if (pr.mode === 'draw') this.p.endDraw(e.x, e.y);
      else if (pr.mode === 'move') this.p.endMove(e.x, e.y);
      else if (pr.mode === 'pending') this.p.tap(e.x, e.y);
      return true;
    }
    if (e.button === 2 && this.p.look) {
      this.p.endLook();
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ keyboard

  onKeyDown(e) {
    const squad = teamUnits(this.p.getSim(), this.p.session.team);
    const sel = KEYS.select.indexOf(e.code);
    if (sel >= 0) {
      const u = squad[sel];
      if (u && u.alive) this.p.select(u.id);
      return true;
    }
    if (matches(KEYS.cycle, e.code)) {
      const alive = squad.filter((u) => u.alive);
      if (alive.length) {
        const i = alive.findIndex((u) => u.id === this.p.session.selectedId);
        this.p.select(alive[(i + (e.shift ? alive.length - 1 : 1)) % alive.length].id);
      }
      return true;
    }
    if (matches(KEYS.deselect, e.code)) {
      if (this.p.session.ui.tossPick) this.p.cancelToss();
      else if (this.p.draw) this.p.cancelDraw();
      else this.p.cancel();
      this.press = null;
      return true;
    }
    if (!this.p.canEdit) return false;
    const u = this.p.selectedUnit();
    if (!u) return false;
    if (matches(KEYS.undo, e.code)) return this.p.undo();
    if (matches(KEYS.clear, e.code)) return this.p.clear();
    if (matches(KEYS.hold, e.code)) return this.p.toggleHold();
    if (matches(KEYS.entry, e.code)) return this.p.cycleEntry();
    if (matches(KEYS.squad, e.code)) return this.p.toggleSquad();
    if (matches(KEYS.pace, e.code)) return this.p.togglePace();
    return false;
  }
}
