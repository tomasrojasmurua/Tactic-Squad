// Mouse + keyboard mapping onto the device-independent planning actions
// (input/PlanningController.js): left click / drag = route, right drag =
// facing, number keys / Tab = selection, Backspace / X / H = route edits.
import { KEYS } from '../config/input.js';
import { matches } from './InputManager.js';
import { teamUnits } from '../sim/queries.js';

export class MouseKeyController {
  /** @param {import('./PlanningController.js').PlanningController} planning */
  constructor(planning) {
    this.p = planning;
  }

  // ------------------------------------------------------------ mouse

  onPointerDown(e) {
    if (!this.p.canEdit) return false;
    if (e.button === 0) {
      const hit = this.p.unitAt(e.x, e.y);
      const sel = this.p.selectedUnit();
      if (hit && (!sel || hit.id !== sel.id)) return this.p.tap(e.x, e.y);
      if (!sel) return false;
      // A plain click adds its point on press (no drag needed); a click on the
      // route's end adds nothing, so double clicks never stack points.
      return this.p.beginDraw(e.x, e.y);
    }
    if (e.button === 2) return this.p.beginLook(e.x, e.y);
    return false;
  }

  onPointerMove(e) {
    this.p.session.ui.cursorWorld = this.p.world(e.x, e.y);
    const hover = this.p.unitAt(e.x, e.y);
    this.p.session.hoverUnitId = hover ? hover.id : -1;
    if (this.p.draw) {
      this.p.drawTo(e.x, e.y);
      return true;
    }
    if (this.p.look) {
      this.p.lookTo(e.x, e.y);
      return true;
    }
    this.p.updateHoverPath(this.p.session.ui.cursorWorld, !!hover);
    return false;
  }

  onPointerUp(e) {
    if (e.button === 0 && this.p.draw) {
      this.p.endDraw(e.x, e.y);
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
      if (this.p.draw) this.p.cancelDraw();
      else this.p.cancel();
      return true;
    }
    if (!this.p.canEdit) return false;
    const u = this.p.selectedUnit();
    if (!u) return false;
    if (matches(KEYS.undo, e.code)) return this.p.undo();
    if (matches(KEYS.clear, e.code)) return this.p.clear();
    if (matches(KEYS.hold, e.code)) {
      this.p.command({ type: 'toggleHold', unitId: u.id });
      return true;
    }
    if (matches(KEYS.entry, e.code)) return this.p.cycleEntry();
    return false;
  }
}
