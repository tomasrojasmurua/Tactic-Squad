// A client's side of the lockstep (the part of OnlineSession with no screen and no socket): turns
// the server's messages into calls on its Simulation, and its own orders into messages. The
// socket (Connection.js) or a test hands it `receive(msg)`; it hands back `send(msg)`.
//
//   decision phase: the player's own orders apply at once (the planning shows them) and go to the
//     server; the opponent's arrive with `cierre`, when every client advances its sim together.
//   live phase: orders do NOT apply when given; the server stamps them with a step nobody ran yet
//     and sends them back to everybody (`orden`). The sim runs only up to the step the server
//     granted (`pasos`), so every phone sees the same orders at the same step.
import { phaseTick } from '../sim/round.js';
import { hashSim } from './stateHash.js';

const LIVE = new Set(['drone', 'exec']);

export class LockstepClient {
  /**
   * @param deps.send       (msg) => void, to the server
   * @param deps.createSim  (start) => Simulation, from the server's `start` message
   */
  constructor({ send, createSim }) {
    this.send = send;
    this.createSim = createSim;
    this.sim = null;
    this.me = -1;
    this.team = null;
    this.n = 0;
    this.hasta = 0;
    this.deadline = null; // ms left in the decision phase when `fase` arrived (null: no limit)
    this.finished = false;
    this.desync = null;
    this.replaying = false;
  }

  get phase() {
    return this.sim ? this.sim.phase : null;
  }

  /** May the player plan now (a decision phase of this round is open)? */
  get deciding() {
    return !!this.sim && !this.replaying && ['buy', 'prep', 'plan'].includes(this.sim.phase);
  }

  receive(msg) {
    switch (msg.t) {
      case 'hola': this.me = msg.id; return;
      case 'registro': return this.replay(msg);
      case 'start': return this.onStart(msg);
      case 'fase': this.deadline = msg.restan; return;
      case 'cierre': return this.onClose(msg);
      case 'pasos': if (msg.n === this.n) this.hasta = msg.hasta; return;
      case 'orden': if (msg.n === this.n && this.sim) this.sim.enqueue(msg.cmd); return;
      case 'desync': this.desync = msg; return;
      case 'fin': this.finished = true; return;
      default:
    }
  }

  onStart(msg) {
    this.sim = this.createSim(msg);
    this.team = msg.equipos[this.me] ?? this.team;
    this.n = 0;
    this.hasta = 0;
  }

  /** A reconnection: the same messages again from the start; nothing is sent until it is over. */
  replay({ yo, mensajes }) {
    this.me = yo;
    this.replaying = true;
    this.sim = null;
    for (const m of mensajes) {
      this.receive(m);
      if (m.t === 'pasos' || m.t === 'cierre') this.pump(Infinity);
    }
    this.replaying = false;
    this.pump(Infinity);
    // The last report may never have reached the server: sent again (a stale or repeated one is ignored).
    if (this.sim && this.n > 0) this.send({ t: 'estado', n: this.n - 1, fase: this.sim.phase, h: hashSim(this.sim) });
  }

  /** The player's order. In a decision phase it applies now; in a live one it waits for the echo. */
  command(cmd) {
    if (!this.sim || this.replaying) return;
    const mine = { ...cmd, team: this.team };
    if (this.deciding) this.sim.enqueue(mine);
    this.send({ t: 'ordenes', n: this.n, lista: [mine] });
  }

  ready() {
    if (this.deciding) this.send({ t: 'listo', n: this.n });
  }

  onClose(msg) {
    if (msg.n !== this.n || !this.sim) return;
    for (const { p, lista } of msg.ordenes) {
      if (p === this.me && !this.replaying) continue; // already applied when given
      for (const cmd of lista) this.sim.enqueue(cmd);
    }
    this.sim.advancePhase();
    this.hasta = 0;
    this.report();
  }

  /** Runs the live phase up to the granted step. Returns the steps run. */
  pump(max = 8) {
    const sim = this.sim;
    let steps = 0;
    while (sim && LIVE.has(sim.phase) && phaseTick(sim) < this.hasta && steps < max) {
      sim.step();
      steps++;
    }
    if (steps && !LIVE.has(sim.phase)) {
      this.report();
      this.hasta = 0;
    }
    return steps;
  }

  /** Tells the server which phase this sim is in and its hash; then the phase counter moves on. */
  report() {
    if (!this.sim) return;
    const n = this.n++;
    if (!this.replaying) this.send({ t: 'estado', n, fase: this.sim.phase, h: hashSim(this.sim) });
  }
}
