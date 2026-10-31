// The touch radial menu (hold, slide, release: ui/RadialMenu.js draws it): what can be chosen for
// a point of a route or for the operator himself. Pure rules, tested headless.
//
// Every option keeps its place on an 8-slot ring (0 = up, clockwise) whatever the context, so
// the hand learns it: a flash is always to the right, a grenade down-right, a smoke down.
//
//   door point  how he goes through: open (up), kick, flash, grenade, charge (down), crack, fiber
//               camera (the Explorador), and where he looks after
//   point       pace (up), cover, flash, grenade, smoke, incendiaria / gas, peek, look
//   himself     squad in file (up), cover, and the throws from where he stands
//
//   option = {id, slot, action, enabled, active, item?, mode?}
//   action: the EV.REQUEST that applies it once the point is targeted (SessionController.radialApply)
import { controllableUnit, entryDoorwayAt, entryModeFits, gearLeft, ENTRY_GEAR, lastUserIndex, HERE, buyableItems } from '../sim/queries.js';

export const RADIAL = Object.freeze({
  slots: 8,
  radiusPx: 84, // the ring's radius (option centers)
  deadPx: 24, // around the center nothing is chosen (a shaky finger)
  maxPx: 170, // beyond this the finger has left the menu: release cancels
});

const DOOR_SLOTS = Object.freeze({ none: 0, kick: 1, flash: 2, frag: 3, breach: 4, slow: 5, cam: 6 });
const TOSS_SLOTS = Object.freeze({ flash: 2, frag: 3, smoke: 4, molotov: 5, gas: 5 });

function tossOptions(u, at, p) {
  const out = [];
  for (const item of ['flash', 'frag', 'smoke', 'molotov', 'gas']) {
    const left = gearLeft(u, item, at);
    const has = !!(p && p.toss && p.toss.item === item);
    if (left <= 0 && !has && (item === 'gas' || !buyableItems(u.team).includes(item))) continue; // not his kind of item
    if (item === 'molotov' && u.gear.gas > 0) continue; // one slot for the two: the one he carries
    out.push({ id: `toss_${item}`, slot: TOSS_SLOTS[item], action: `toss_${item}`, item, enabled: left > 0 || has, active: has, count: Math.max(0, left) });
  }
  return out;
}

/**
 * The radial's options for point `index` of operator `unitId`'s route (HERE: the spot he stands
 * on), or null when there is no menu there. {kind: 'door' | 'point' | 'here', options}
 */
export function radialOptions(sim, session, unitId, index) {
  const u = controllableUnit(sim, unitId, session.team);
  if (!u) return null;
  if (index === HERE) {
    const options = [{ id: 'squad', slot: 0, action: 'squad', enabled: sim.teams[u.team].some((o) => o.alive && o !== u), active: false }];
    if (u.team === 'attackers' && !u.route.length) options.push({ id: 'cover', slot: 1, action: 'cover', enabled: true, active: !!u.cover });
    options.push(...tossOptions(u, -1, null));
    return { kind: 'here', options };
  }
  const p = u.route[index];
  if (!p || !p.user) return null;
  const k = p.door >= 0 ? p.door : entryDoorwayAt(sim.world, p.x, p.y);
  const last = lastUserIndex(u);
  const look = { id: 'look', slot: 7, action: 'lookPick', enabled: true, active: false };
  if (k >= 0) {
    const current = p.ask || p.toss ? null : p.entry || 'none';
    const options = [];
    for (const [mode, slot] of Object.entries(DOOR_SLOTS)) {
      if (mode === 'cam' && u.ability !== 'fiberCam') continue;
      const item = ENTRY_GEAR[mode] || null;
      const left = item ? gearLeft(u, item, index) : -1;
      const enabled = mode === 'none' || (entryModeFits(sim, k, mode, u) && (!item || left > 0 || current === mode));
      options.push({ id: `entry_${mode}`, slot, action: `entry_${mode}`, mode, enabled, active: current === mode, count: item ? Math.max(0, left) : null });
    }
    options.push(look);
    return { kind: 'door', options };
  }
  const sneak = p.pace === 'sneak';
  const options = [{ id: 'pace', slot: 0, action: sneak ? 'pace_normal' : 'pace_sneak', enabled: true, active: sneak }];
  const peeking = p.pause > 0;
  if (u.team === 'attackers' && index === last && !peeking) options.push({ id: 'cover', slot: 1, action: 'cover', enabled: true, active: !!p.cover });
  options.push(...tossOptions(u, index, p));
  if (peeking || (!p.ask && index === last)) options.push({ id: 'peek', slot: 6, action: 'peek', enabled: true, active: peeking });
  options.push(look);
  return { kind: 'point', options };
}

/** Screen offset of a slot's center from the ring's center. */
export function slotOffset(slot, radius = RADIAL.radiusPx) {
  const a = (slot / RADIAL.slots) * Math.PI * 2;
  return { x: Math.sin(a) * radius, y: -Math.cos(a) * radius };
}

/**
 * The option under the finger at (dx, dy) from the center: the enabled one whose slot is nearest
 * in angle (within half a slot), or -1 (the dead center, too far out, or a gap / a disabled one).
 */
export function radialHover(options, dx, dy) {
  const d = Math.hypot(dx, dy);
  if (d < RADIAL.deadPx || d > RADIAL.maxPx) return -1;
  const a = Math.atan2(dx, -dy); // 0 = up, clockwise
  const s = ((a / (Math.PI * 2)) * RADIAL.slots + RADIAL.slots) % RADIAL.slots;
  let best = -1;
  let bestD = 0.5;
  options.forEach((o, i) => {
    const diff = Math.abs(((s - o.slot + RADIAL.slots * 1.5) % RADIAL.slots) - RADIAL.slots / 2);
    if (diff <= bestD) {
      best = i;
      bestD = diff;
    }
  });
  return best >= 0 && options[best].enabled ? best : -1;
}

/** How far a radial on the screen must stay from its edges (px) to show its whole ring. */
export const radialMargin = () => RADIAL.radiusPx + 30;

