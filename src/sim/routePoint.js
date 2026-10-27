// The one shape of a route point (unit.route[i]), shared by every system
// that writes routes (orders, the squad file, the unstuck repath).
//   user      placed by the player (look, hold, entry, pace live on these)
//   look      facing on arrival (radians) or null
//   hold      waits there for a GO group (code 'A' | 'B' | 'C')
//   entry     how he goes through the doorway next to it (sim/entries.js), entryDoor = that doorway
//   ask       a "?" before a closed door the route crosses (door = that doorway)
//   pace      'sneak' on the leg ending here (MOVE.sneakFactor), null = normal
export function routePoint(x, y, over = null) {
  const p = { x, y, user: false, look: null, hold: false, code: null, entry: null, entryDoor: -1, ask: false, door: -1, pace: null };
  return over ? Object.assign(p, over) : p;
}
