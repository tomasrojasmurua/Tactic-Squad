// Raw DOM input -> routed to controllers. Holds pointer position (CSS px
// relative to the canvas) and pressed keys; never touches game state.
import { PREVENT_DEFAULT_KEYS } from '../config/input.js';

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.handlers = [];
    // real: the last pointer seen was a mouse (edge scrolling only then).
    this.mouse = { x: 0, y: 0, inside: false, real: false };
    // Any finger, anywhere (HUD buttons, cards...), turns mouse behavior off.
    const touchSeen = (e) => {
      if (e.pointerType !== 'mouse') {
        this.mouse.real = false;
        this.mouse.inside = false;
      }
    };
    this.keys = new Set();
    this.listeners = [];

    const add = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this.listeners.push(() => target.removeEventListener(type, fn, opts));
    };
    add(window, 'pointerdown', touchSeen, { capture: true });
    add(canvas, 'pointerdown', (e) => this.pointer('onPointerDown', e));
    add(window, 'pointermove', (e) => this.pointer('onPointerMove', e));
    add(window, 'pointerup', (e) => this.pointer('onPointerUp', e));
    add(window, 'pointercancel', (e) => this.pointer('onPointerUp', e));
    // Only a real mouse is "inside": a finger's pointerenter would park the
    // mouse at a stale position and trigger edge scrolling on phones.
    add(canvas, 'pointerenter', (e) => (this.mouse.inside = e.pointerType === 'mouse' && this.mouse.real));
    add(canvas, 'pointerleave', () => (this.mouse.inside = false));
    add(canvas, 'contextmenu', (e) => e.preventDefault());
    add(canvas, 'wheel', (e) => {
      e.preventDefault();
      this.dispatch('onWheel', { ...this.local(e), deltaY: e.deltaY });
    }, { passive: false });
    add(window, 'keydown', (e) => this.key(e, true));
    add(window, 'keyup', (e) => this.key(e, false));
    add(window, 'blur', () => this.keys.clear());
  }

  /** Controllers are objects with optional onPointerDown/Move/Up, onWheel, onKeyDown/Up. */
  use(handler) {
    this.handlers.push(handler);
  }

  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  pointer(method, e) {
    const p = this.local(e);
    if (e.pointerType === 'touch') return this.touch(method, e, p);
    if (e.pointerType === 'mouse' && method === 'onPointerMove') {
      this.mouse.real = true;
      this.mouse.inside = p.x >= 0 && p.y >= 0 && p.x <= this.canvas.clientWidth && p.y <= this.canvas.clientHeight;
    }
    this.mouse.x = p.x;
    this.mouse.y = p.y;
    if (method === 'onPointerDown') {
      this.canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
    this.dispatch(method, { x: p.x, y: p.y, button: e.button, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });
  }

  /** Touch pointers go to onTouchDown/Move/Up handlers (multi-touch aware). */
  touch(method, e, p) {
    const map = { onPointerDown: 'onTouchDown', onPointerMove: 'onTouchMove', onPointerUp: 'onTouchUp' };
    if (method === 'onPointerDown') {
      this.canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
    this.mouse.inside = false;
    this.dispatch(map[method], { id: e.pointerId, x: p.x, y: p.y, t: e.timeStamp });
  }

  key(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (down) this.keys.add(e.code);
    else this.keys.delete(e.code);
    const handled = this.dispatch(down ? 'onKeyDown' : 'onKeyUp', { code: e.code, repeat: e.repeat, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });
    if (handled || PREVENT_DEFAULT_KEYS.includes(e.code)) e.preventDefault();
  }

  dispatch(method, payload) {
    let handled = false;
    for (const h of this.handlers) if (h[method] && h[method](payload)) handled = true;
    return handled;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  dispose() {
    for (const off of this.listeners) off();
  }
}

export const matches = (binding, code) => binding.includes(code);
