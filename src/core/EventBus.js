// Tiny synchronous publish/subscribe bus. The simulation never calls it
// directly: it queues events and the Game flushes them here after each step,
// so listeners (render, audio, UI) can never re-enter the simulation.

export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(type, fn) {
    let list = this.handlers.get(type);
    if (!list) this.handlers.set(type, (list = []));
    list.push(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    const list = this.handlers.get(type);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  emit(type, payload) {
    const list = this.handlers.get(type);
    if (list) for (let i = 0; i < list.length; i++) list[i](payload);
    const any = this.handlers.get('*');
    if (any) for (let i = 0; i < any.length; i++) any[i](type, payload);
  }
}
