// Touch gestures (phones/tablets, landscape):
//   tap            select operator (generous radius) / door picker on a waypoint / add waypoint
//   1-finger drag  from an operator or his route's end: draw the route (near the
//                  screen edge the camera follows the finger); from a waypoint:
//                  move it; from a stretch of route: a new waypoint there;
//                  from anywhere else: pan the camera
//   long press     on a waypoint (a "?" too) or on the selected operator: the
//                  radial menu around the finger (session/radial.js) — slide to an
//                  option, lift to choose it (lifting in the middle: nothing);
//                  anywhere else: aim the facing of the route's last point
//   2 fingers      pan (centroid) + pinch zoom. A second finger that lands
//                  right after a stroke began cancels that stroke (it was the
//                  start of a pinch, not a drawing).
//   2-finger tap   (both fingers down and up quickly, barely moving): see the
//                  whole map; again = back to the previous view.
import { TOUCH } from '../config/input.js';
import { FLOW } from '../config/ui.js';
import { HERE } from '../sim/queries.js';
import { isDefenderSetup } from '../session/Session.js';

export class TouchController {
  constructor({ planning, camera, framing, session }) {
    this.planning = planning;
    this.camera = camera;
    this.framing = framing; // input/CameraFraming.js: pinch zoom limits and the whole-map view
    this.session = session;
    this.pointers = new Map();
    this.mode = 'none'; // none | pending | draw | look | pan1 | pinch | rest
    this.timer = 0;
    this.start = null; // {x, y, time} of the first finger
    this.drawStart = 0; // performance.now() when the stroke began
    this.last = { x: 0, y: 0 }; // last position of the drawing finger
    this.pinch = null;
    this.lookFromTimer = false;
    this.tap2 = null; // {t, moved, start} two-finger tap candidate
  }

  onTouchDown(e) {
    this.session.touch = true;
    this.session.lastTouchAt = performance.now(); // a touch brings the HUD back during a turn (ui/UI.js)
    this.session.ui.moreOpen = false; // a touch on the map closes the ⋯ menu
    this.pointers.set(e.id, { x: e.x, y: e.y });
    if (this.pointers.size === 1) {
      this.mode = 'pending';
      this.start = { x: e.x, y: e.y, time: e.t };
      this.last.x = e.x;
      this.last.y = e.y;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.longPress(), TOUCH.longPressMs);
      return true;
    }
    if (this.pointers.size === 2) {
      clearTimeout(this.timer);
      const pl = this.planning;
      if (this.mode === 'radial') pl.request('radialCancel'); // a second finger: a pinch after all
      if (this.mode === 'draw') {
        // Early second finger: the user meant to pinch. Late: keep what was drawn.
        if (performance.now() - this.drawStart < TOUCH.strokeCancelMs || pl.draw.added === 0) pl.cancelDraw();
        else pl.endDraw(this.last.x, this.last.y);
      } else {
        // A waypoint being dragged (or a look being aimed) is dropped: the second finger means pan / zoom.
        pl.cancel();
      }
      this.mode = 'pinch';
      this.pinch = this.measure();
      this.tap2 = { t: e.t, moved: 0, start: this.pinch };
    }
    return true;
  }

  onTouchMove(e) {
    const p = this.pointers.get(e.id);
    if (!p) return false;
    p.x = e.x;
    p.y = e.y;
    const pl = this.planning;
    switch (this.mode) {
      case 'radial':
        pl.request('radialMove', { x: e.x, y: e.y });
        break;
      case 'pending': {
        if (Math.hypot(e.x - this.start.x, e.y - this.start.y) < TOUCH.dragThresholdPx) break;
        clearTimeout(this.timer);
        this.beginDrag(e);
        break;
      }
      case 'draw':
        this.last.x = e.x;
        this.last.y = e.y;
        pl.drawTo(e.x, e.y);
        break;
      case 'move':
        pl.moveTo(e.x, e.y);
        break;
      case 'look':
        // The finger moved before the long-press time (the timer just ran
        // late on a busy frame): it is a drag, not a long press.
        if (this.lookFromTimer && e.t - this.start.time < TOUCH.longPressMs && Math.hypot(e.x - this.start.x, e.y - this.start.y) >= TOUCH.dragThresholdPx) {
          pl.cancel();
          this.lookFromTimer = false;
          this.beginDrag(e);
          break;
        }
        pl.lookTo(e.x, e.y);
        break;
      case 'pan1': {
        const mpp = this.camera.metersPerPixel(0);
        this.camera.pan(-(e.x - this.start.x) * mpp, -(e.y - this.start.y) * mpp);
        this.start.x = e.x;
        this.start.y = e.y;
        break;
      }
      case 'pinch':
        this.updatePinch();
        break;
      default:
    }
    return true;
  }

  onTouchUp(e) {
    const p = this.pointers.get(e.id);
    if (!p) return false;
    this.pointers.delete(e.id);
    clearTimeout(this.timer);
    const pl = this.planning;
    // Event timestamps, not timer order, decide tap vs long press: on a busy
    // main thread the long-press timer can fire before a quick tap's release
    // is processed. A finger lifted early was a tap, whatever the timer did.
    const quick = this.start && e.t - this.start.time < TOUCH.longPressMs;
    if (this.mode === 'look' && quick && this.lookFromTimer) {
      pl.cancel();
      this.mode = 'pending';
    }
    this.lookFromTimer = false;
    if (this.mode === 'radial') {
      pl.request('radialUp');
    } else if (this.mode === 'pending') {
      pl.tap(e.x, e.y, true);
    } else if (this.mode === 'draw') {
      pl.endDraw(e.x, e.y);
    } else if (this.mode === 'move') {
      pl.endMove(e.x, e.y);
    } else if (this.mode === 'look') {
      pl.endLook();
    } else if (this.mode === 'pinch' && this.pointers.size === 1) {
      this.mode = 'rest'; // ignore the remaining finger until it lifts
      this.checkTwoFingerTap(e.t);
      return true;
    }
    if (this.pointers.size === 0) this.mode = 'none';
    return true;
  }

  /**
   * The finger moved: what it started on decides (PlanningController.grab).
   * An operator: he is selected and his route drawn from its end. His
   * waypoint: it is moved. A stretch of his route: a new waypoint there.
   * Anything else (the floor): the camera pans — one finger is enough.
   */
  beginDrag(e) {
    const pl = this.planning;
    const s = this.start;
    // Aiming a throw: a drag only looks around (the tap that follows is the target).
    let grab = pl.canEdit && !this.session.ui.tossPick ? pl.grab(s.x, s.y, true) : { kind: 'ground' };
    if (grab.kind === 'other') {
      pl.select(grab.unit.id);
      grab = { kind: 'unit', unit: grab.unit };
    }
    if ((grab.kind === 'unit' || grab.kind === 'tail') && pl.beginDraw(s.x, s.y, true)) {
      this.mode = 'draw';
      this.drawStart = performance.now();
      this.last.x = e.x;
      this.last.y = e.y;
      pl.drawTo(e.x, e.y);
      return;
    }
    if ((grab.kind === 'waypoint' || grab.kind === 'segment') && pl.beginMove(grab, s.x, s.y)) {
      this.mode = 'move';
      pl.moveTo(e.x, e.y);
      return;
    }
    this.mode = 'pan1';
    this.onTouchMove({ id: e.id, x: e.x, y: e.y });
  }

  longPress() {
    if (this.mode !== 'pending' || this.pointers.size !== 1 || this.session.ui.tossPick || this.session.ui.lookPick) return;
    const pl = this.planning;
    const s = this.start;
    const onUnit = pl.unitAt(s.x, s.y, true);
    if (onUnit && onUnit.id !== this.session.selectedId) pl.select(onUnit.id);
    const u = pl.selectedUnit();
    if (!u) return;
    const mpp = this.camera.metersPerPixel(0);
    const radius = Math.max(TOUCH.waypointPickMinRadius, TOUCH.waypointPickPx * mpp);
    const wp = pl.waypointAt(s.x, s.y, radius);
    // On a point of his route, or on him: the radial (hold, slide, lift). Defenders setting up keep aiming.
    if (pl.canEdit && !isDefenderSetup(this.session) && (wp >= 0 || onUnit)) {
      pl.request('radialOpen', { unitId: u.id, index: wp >= 0 ? wp : HERE, x: s.x, y: s.y });
      if (this.session.ui.radial) {
        this.mode = 'radial';
        return;
      }
    }
    // Anywhere else: aim the end of the route toward the finger.
    if (!pl.beginLook(s.x, s.y, wp)) return;
    this.mode = 'look';
    this.lookFromTimer = true;
    if (navigator.vibrate) navigator.vibrate(TOUCH.hapticMs);
  }

  measure() {
    const [a, b] = [...this.pointers.values()];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  }

  updatePinch() {
    if (this.pointers.size < 2 || !this.pinch) return;
    const m = this.measure();
    if (this.tap2) {
      const s = this.tap2.start;
      this.tap2.moved = Math.max(this.tap2.moved, Math.hypot(m.cx - s.cx, m.cy - s.cy), Math.abs(m.d - s.d));
      if (this.tap2.moved < FLOW.overviewTapPx) return; // may still be a tap: the camera waits
    }
    const mpp = this.camera.metersPerPixel(0);
    this.camera.pan(-(m.cx - this.pinch.cx) * mpp, -(m.cy - this.pinch.cy) * mpp);
    this.framing.zoomImmediate(this.pinch.d / m.d, m.cx, m.cy);
    this.pinch = m;
  }

  /** First finger of a pinch lifted: a quick, still two-finger touch was a tap = see the whole map. */
  checkTwoFingerTap(t) {
    const tap = this.tap2;
    this.tap2 = null;
    if (tap && tap.moved < FLOW.overviewTapPx && t - tap.t < FLOW.overviewTapMs) this.planning.request('overview');
  }
}
