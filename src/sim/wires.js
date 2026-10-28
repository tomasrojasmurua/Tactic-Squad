// Barbed wire (alambre de púas): a defenders' reinforcement laid in the
// preparation across a doorway the map lets them barricade (barricadeSlots),
// PREP.wires per round, never on a barricaded one. It does not stop anyone
// and hurts no one: an attacker within WIRE.radius of the doorway walks at
// WIRE.slow of his speed, and stepping into it rattles (sim/noise.js 'wire';
// AI defenders within WIRE.hearing turn to it). The defenders know the gap
// and cross it freely. A grenade or a breach charge going off near it clears
// it. The attackers know a wire once one of them (or the drone) has seen it
// or walked into it: sim.intel.wires (door indices), like the barricades.
import { WIRE, PREP, COMBAT } from '../config/balance.js';
import { EV } from '../core/events.js';
import { canSee } from './vision.js';
import { alertAiUnit } from './ai.js';
import { isAiControlled } from './queries.js';

/** Doors wired now (indices into sim.doors). */
export function wiredDoors(sim) {
  const out = [];
  sim.doors.forEach((d, i) => d.wired && out.push(i));
  return out;
}

/** Lays (on) or takes up a wire on a door the map allows (`barricadeSlots`). Returns a REJECT code or null. */
export function setWire(sim, doorId, on) {
  const door = sim.doors.find((d) => d.def.id === doorId);
  if (!door || !sim.compiled.barricadeSlots.includes(doorId)) return 'badDoor';
  if (door.wired === !!on) return null;
  if (on && door.barricaded) return 'doorTaken';
  if (on && wiredDoors(sim).length >= PREP.wires) return 'tooManyWires';
  door.wired = !!on;
  sim.emit(EV.WIRE_SET, { doorId, on: !!on });
  return null;
}

/** The wired door u stands in (its index), or -1. */
function wireAt(sim, u) {
  const r2 = WIRE.radius * WIRE.radius;
  for (const door of sim.doors) {
    if (door.wired && (u.x - door.def.cx) ** 2 + (u.y - door.def.cy) ** 2 < r2) return door.def.index;
  }
  return -1;
}

/** Speed factor for u's walk (sim/movement.js): WIRE.slow for an attacker in a wire, else 1. */
export function wireFactor(sim, u) {
  return u.team === 'attackers' && wireAt(sim, u) >= 0 ? WIRE.slow : 1;
}

/** Once per tick after movement: an attacker stepping into a wire rattles it (and the attackers learn it). */
export function updateWires(sim) {
  for (const u of sim.teams.attackers) {
    if (!u.alive) continue;
    const k = wireAt(sim, u);
    if (k >= 0 && k !== u.wireDoor) {
      const d = sim.doors[k].def;
      learn(sim, sim.doors[k]);
      sim.emit(EV.WIRE_CROSSED, { unitId: u.id, doorId: d.id, x: u.x, y: u.y });
      const r2 = WIRE.hearing * WIRE.hearing;
      for (const o of sim.teams.defenders) {
        if (o.alive && isAiControlled(sim, o) && (o.x - u.x) ** 2 + (o.y - u.y) ** 2 <= r2) alertAiUnit(o, u.x, u.y, COMBAT.alertDuration);
      }
    }
    u.wireDoor = k;
  }
}

/** A blast at (x, y) (grenade, breach charge) clears the wires within `radius`. */
export function cutWiresNear(sim, x, y, radius, u) {
  const r2 = radius * radius;
  for (const door of sim.doors) {
    if (!door.wired || (door.def.cx - x) ** 2 + (door.def.cy - y) ** 2 > r2) continue;
    door.wired = false;
    sim.intel.wires.delete(door.def.index);
    sim.emit(EV.WIRE_CUT, { unitId: u ? u.id : -1, doorId: door.def.id, x: door.def.cx, y: door.def.cy });
  }
}

const cfg = { fov: 0, range: WIRE.spotRange };

/** An attacker's eye ({x, y, facing}, field of view `fov`) finds the wires it sees. */
export function spotWires(sim, eye, fov) {
  cfg.fov = fov;
  for (const door of sim.doors) {
    if (!door.wired || sim.intel.wires.has(door.def.index)) continue;
    if (canSee(sim.world, eye, door.def.cx, door.def.cy, cfg)) learn(sim, door);
  }
}

function learn(sim, door) {
  const i = door.def.index;
  if (sim.intel.wires.has(i)) return;
  sim.intel.wires.add(i);
  sim.emit(EV.WIRE_SPOTTED, { doorId: door.def.id, x: door.def.cx, y: door.def.cy });
}
