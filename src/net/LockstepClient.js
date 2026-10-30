// A client's side of the lockstep (no screen, no socket): turns the server's messages
// (net/roomLogic.js) into calls on the round's Simulation, and the player's orders into messages.
// The socket (net/Connection.js) or a test hands it `receive(msg)`; it hands back `send(msg)`.
// The game (net/OnlineSession.js) listens to `on(type, data)`.
//
//   decision phase: the player's own orders apply at once (the planning shows them) and go to the
//     server; the opponent's arrive with `cierre`, when every client advances its sim together.
//   live phase: orders do NOT apply when given; the server stamps them with a step nobody ran yet
//     and sends them back to everybody (`orden`). The sim runs only up to the step the server
//     granted (`pasos`), so every phone applies the same orders at the same step.
//
// It also keeps the match (session/Match.js, from this player's side: `player` is him): both
// phones score each round from the same sim, so they agree on it without the server.
import { phaseTick } from '../sim/round.js';
import { createMatch, matchLoadout, endMatchRound } from '../session/Match.js';
import { hashSim } from './stateHash.js';
import { encodeSim, restoreSim } from './snapshot.js';

const LIVE = new Set(['drone', 'exec']);
const DECIDING = new Set(['buy', 'prep', 'plan', 'end']);
export const HUMANS = Object.freeze({ attackers: 'human', defenders: 'human' });

/** What the round's Simulation is built with (the same on every phone). */
export function onlineRound(start, round, match) {
  const roles = {};
  for (const [id, team] of Object.entries(round.equipos)) {
    const picks = start.roles && start.roles[id];
    if (picks && picks[team]) roles[team] = picks[team];
  }
  return {
    map: start.mapa,
    seed: round.semilla,
    round: round.ronda,
    options: { seed: round.semilla, controllers: HUMANS, roles, loadout: matchLoadout(match), lossBonus: match.lossBonus, stopOnContact: false },
  };
}

export class LockstepClient {
  /**
   * @param deps.send       (msg) => void, to the server
   * @param deps.createSim  ({map, seed, round, options}) => Simulation (a new round: the game shows it)
   * @param deps.buildSim   ({map, seed, round, options}) => Simulation (the same, only built: a snapshot's reference)
   * @param deps.on         (type, data) => void: 'hola' 'sala' 'round' 'advance' 'fase' 'resync' 'fin' 'lobby' 'abandono' 'error'
   */
  constructor({ send, createSim, buildSim = createSim, on = () => {} }) {
    this.send = send;
    this.createSim = createSim;
    this.buildSim = buildSim;
    this.on = on;
    this.sim = null;
    this.me = -1;
    this.token = null;
    this.team = null;
    this.start = null;
    this.match = null;
    this.n = 0;
    this.hasta = 0;
    this.fase = null; // the last `fase` message (deadline, who is ready)
    this.finished = false;
    this.desync = null;
    this.replaying = false;
  }

  get phase() {
    return this.sim ? this.sim.phase : null;
  }

  /**
   * May the player decide now: a decision phase of the round is open (the server announced it: an
   * order or a LISTO sent before would be stale there) and he has not said LISTO?
   */
  get deciding() {
    return !!this.sim && !this.replaying && DECIDING.has(this.sim.phase) && !!this.fase && this.fase.n === this.n && !this.isReady;
  }

  /** He said LISTO in the open phase (the server's list, or his own message on its way). */
  get isReady() {
    return this.readyAt === this.n || (!!this.fase && this.fase.n === this.n && this.fase.listos.includes(this.me));
  }

  receive(msg) {
    switch (msg.t) {
      case 'hola':
        this.me = msg.id;
        this.token = msg.token;
        return this.on('hola', msg);
      case 'sala': return this.on('sala', msg);
      case 'registro': return this.replay(msg);
      case 'start': return this.onStart(msg);
      case 'ronda': return this.onRound(msg);
      case 'fase':
        if (msg.n !== this.n) return;
        this.fase = msg;
        return this.on('fase', msg);
      case 'cierre': return this.onClose(msg);
      case 'pasos':
        if (msg.n !== this.n) return;
        this.hasta = msg.hasta;
        this.lastSteps = Date.now();
        return;
      case 'orden':
        if (msg.n === this.n && this.sim) this.sim.enqueue(msg.cmd);
        return;
      case 'foto':
        // The phones drifted apart and this one is the reference: its state for everybody.
        if (this.sim && msg.n === this.n - 1 && !this.replaying) this.send({ t: 'foto', n: msg.n, data: encodeSim(this.sim, this.buildSim(this.roundInfo)) });
        return;
      case 'resync':
        return this.onResync(msg);
      case 'abandono':
        return this.on('abandono', msg);
      case 'fin':
        if (msg.n !== this.n + 1) return; // closes the round's result (its phase `n`)
        this.n = msg.n;
        this.finished = true;
        return this.on('fin', msg);
      case 'lobby':
        this.sim = null;
        this.start = null;
        this.finished = false;
        return this.on('lobby', msg);
      case 'error': return this.on('error', msg);
      default:
    }
  }

  onStart(msg) {
    this.start = msg;
    this.n = 0;
    this.finished = false;
    this.desync = null;
    this.match = createMatch(msg.equipos[this.me], msg.duracion);
    this.newRound(msg);
  }

  onRound(msg) {
    if (msg.n !== this.n + 1 || !this.start) return; // closes the round's result (its phase `n`)
    this.n = msg.n;
    this.newRound(msg);
  }

  newRound(round) {
    this.team = round.equipos[this.me];
    this.hasta = 0;
    this.fase = null;
    this.readyAt = -1;
    this.roundInfo = onlineRound(this.start, round, this.match);
    this.sim = this.createSim(this.roundInfo);
    this.on('round', { round: round.ronda, team: this.team, replaying: this.replaying });
  }

  /** Everybody takes the reference phone's state (it already is, for that phone: a no-op there). */
  onResync(msg) {
    if (!this.sim || msg.n !== this.n - 1) return;
    this.desync = msg;
    restoreSim(this.sim, msg.data, this.buildSim(this.roundInfo));
    this.on('resync', msg);
  }

  /** A reconnection: the same messages again from the start; nothing is sent until it is over. */
  replay({ yo, mensajes }) {
    this.me = yo;
    this.replaying = true;
    this.sim = null;
    for (const m of mensajes) {
      this.receive(m);
      if (m.t === 'pasos') this.pump(Infinity);
    }
    this.replaying = false;
    this.pump(Infinity);
    // The last report may never have reached the server: sent again (a stale or repeated one is ignored).
    if (this.sim && this.n > 0) this.send(this.stateMsg(this.n - 1));
    this.on('advance', { replayed: true });
  }

  /** The player's order. In a decision phase it applies now; in a live one it waits for the echo. */
  command(cmd) {
    if (!this.sim || this.replaying || this.finished) return;
    const mine = { ...cmd, team: this.team };
    if (LIVE.has(this.sim.phase)) {
      this.send({ t: 'ordenes', n: this.n, lista: [mine] });
      return;
    }
    if (!this.deciding) return;
    this.sim.enqueue(mine);
    this.send({ t: 'ordenes', n: this.n, lista: [mine] });
  }

  /** LISTO: this side is done with the phase (the round's result, too). */
  ready() {
    if (!this.deciding) return;
    this.readyAt = this.n;
    this.send({ t: 'listo', n: this.n });
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
    this.on('advance', {});
  }

  /**
   * A nudge for the server's clock, if it is due (null otherwise): in a live phase when no `pasos`
   * came for a while, in a timed decision phase now and then. The server ticks with every message,
   * so its pace does not depend on a timer surviving the Durable Object's hibernation.
   */
  clockMsg(now = Date.now()) {
    if (!this.sim || this.replaying || this.finished) return null;
    const live = LIVE.has(this.sim.phase) && this.liveN === this.n;
    const quiet = live ? now - (this.lastSteps || 0) > 150 : this.fase && this.fase.restan !== null;
    if (!quiet || now - (this.lastClock || 0) < (live ? 100 : 1000)) return null;
    this.lastClock = now;
    return { t: 'reloj' };
  }

  /** Is the sim allowed one more step (a live phase, below the granted step)? */
  canStep() {
    const sim = this.sim;
    return !!sim && LIVE.has(sim.phase) && phaseTick(sim) < this.hasta;
  }

  /** Steps the server granted that this phone has not run yet (it runs faster to catch up). */
  get behind() {
    return this.sim && LIVE.has(this.sim.phase) ? this.hasta - phaseTick(this.sim) : 0;
  }

  /** After each step the game ran: the live phase may be over. */
  afterStep() {
    if (this.sim && !LIVE.has(this.sim.phase) && this.liveN === this.n) {
      this.hasta = 0;
      this.report();
    }
  }

  /** Runs the live phase up to the granted step (headless: tests, a reconnection). Returns the steps run. */
  pump(max = 8) {
    let steps = 0;
    while (steps < max && this.canStep()) {
      this.sim.step();
      steps++;
      this.afterStep();
    }
    return steps;
  }

  stateMsg(n) {
    const sim = this.sim;
    return { t: 'estado', n, fase: sim.phase, h: hashSim(sim), sigue: sim.phase === 'end' ? !this.match.over : undefined };
  }

  /** Tells the server which phase this sim is in now and its hash; then the phase counter moves on. */
  report() {
    if (!this.sim) return;
    if (this.sim.phase === 'end') endMatchRound(this.match, this.sim); // once: the round ends once
    const n = this.n++;
    this.liveN = LIVE.has(this.sim.phase) ? this.n : -1;
    if (!this.replaying) this.send(this.stateMsg(n));
  }
}
