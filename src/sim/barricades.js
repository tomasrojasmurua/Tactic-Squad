// Barricades in the assault. A barricaded door (door.barricaded, put up by
// the defenders in the preparation: sim/prep.js) stays shut: it blocks
// bodies, sight, bullets and the drone, and cannot be opened, cracked or
// kicked open. An attacker who tries any of that starts breaking it
// instead (unit.bash): BARRICADE.breakTime standing at it, loud blows,
// paused while he fights. A breach charge blows it at once. Either way the
// doorway is then clear. Defenders never break their own.
//
// The attackers only know a barricade once one of them (or the drone) has
// seen it or run into it: sim.intel.barricades (door indices), read by the
// views (sim/view.js teamView) and the renderer.
import { BARRICADE, COMBAT } from '../config/balance.js';
import { EV } from '../core/events.js';
import { canSee } from './vision.js';
import { alertAiUnit } from './ai.js';
import { isAiControlled } from './queries.js';
import { destroyDoor } from './doors.js';

export function createIntel() {
  return { barricades: new Set(), wires: new Set() }; // door indices the attackers know are barricaded / wired (sim/wires.js)
}

/** Closed boxes of the barricaded doors (what stops the drone). */
export function barricadeBoxes(sim, out) {
  out.length = 0;
  for (const d of sim.doors) if (d.barricaded) out.push(d.def.closedBox);
  return out;
}

/** u ran into a barricade (opening, kicking, cracking it): he starts breaking it. */
export function startBash(sim, door, u) {
  if (u.team === 'defenders' || u.bash) return;
  u.bash = { door: door.def.index, t: BARRICADE.breakTime * u.mods.bash, next: 0 };
  learn(sim, door);
}

/** Once per tick for a unit breaking a barricade (before movement: he does not move meanwhile). */
export function updateBash(sim, u, dt) {
  const b = u.bash;
  const door = sim.doors[b.door];
  if (!door.barricaded) {
    u.bash = null; // someone else broke it (or blew it)
    return;
  }
  if (u.target >= 0 || u.blind > 0) return; // fighting / dazed: the work waits
  b.next -= dt;
  if (b.next <= 0) {
    b.next += BARRICADE.hitEvery;
    sim.emit(EV.BARRICADE_HIT, { unitId: u.id, doorId: door.def.id, x: door.def.cx, y: door.def.cy });
    alertNear(sim, u, door.def.cx, door.def.cy);
  }
  b.t -= dt;
  if (b.t <= 0) breakBarricade(sim, door, u, 'bash');
}

/** The barricade is gone (broken or blown by a charge): the doorway is clear. */
export function breakBarricade(sim, door, u, how) {
  door.barricaded = false;
  destroyDoor(sim, door);
  sim.intel.barricades.delete(door.def.index);
  for (const o of sim.units) if (o.bash && o.bash.door === door.def.index) o.bash = null;
  sim.emit(EV.BARRICADE_BROKEN, { unitId: u ? u.id : -1, doorId: door.def.id, x: door.def.cx, y: door.def.cy, how });
}

const cfg = { fov: 0, range: BARRICADE.spotRange };
const probe = { x: 0, y: 0 };

/** An attacker's eye ({x, y, facing}, field of view `fov`) finds the barricades it sees. */
export function spotBarricades(sim, eye, fov) {
  cfg.fov = fov;
  for (const door of sim.doors) {
    if (!door.barricaded || sim.intel.barricades.has(door.def.index)) continue;
    const d = door.def;
    // Aim a hand's width in front of the slab, on the eye's side (the slab itself blocks the ray).
    const side = Math.sign((eye.x - d.cx) * d.normalX + (eye.y - d.cy) * d.normalY) || 1;
    probe.x = d.cx + d.normalX * side * 0.12;
    probe.y = d.cy + d.normalY * side * 0.12;
    if (canSee(sim.world, eye, probe.x, probe.y, cfg)) learn(sim, door);
  }
}

function learn(sim, door) {
  const i = door.def.index;
  if (sim.intel.barricades.has(i)) return;
  sim.intel.barricades.add(i);
  sim.emit(EV.BARRICADE_SPOTTED, { doorId: door.def.id, x: door.def.cx, y: door.def.cy });
}

function alertNear(sim, u, x, y) {
  const r2 = BARRICADE.hearing * BARRICADE.hearing;
  for (const o of sim.units) {
    if (!o.alive || o.team === u.team || !isAiControlled(sim, o)) continue;
    if ((o.x - x) ** 2 + (o.y - y) ** 2 <= r2) alertAiUnit(o, x, y, COMBAT.alertDuration, true);
  }
}
