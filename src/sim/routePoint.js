// The one shape of a route point (unit.route[i]), shared by every system
// that writes routes (orders, the squad file, the unstuck repath).
//   user      placed by the player (look, hold, entry, pace live on these)
//   look      facing on arrival (radians) or null
//   hold      waits there for a GO group (code 'A' | 'B' | 'C')
//   entry     how he goes through the doorway next to it (sim/entries.js), entryDoor = that doorway
//   ask       a "?" before a closed door the route crosses (door = that doorway)
//   pace      'sneak' on the leg ending here (MOVE.sneakFactor), null = normal
//   toss      {item, x, y}: on arrival (or on the GO of the hold there) he throws a flash /
//             grenade / smoke to that point (sim/entries.js armToss)
//   pause     s he stands there (looking at `look`) before going on: "asomarse y volver"
//   back      the point he goes back to after such a peek (orders.js setPeek)
//   beside    a stack beside a door frame, not in front of it (orders.js stackBeside; door = that doorway)
//   waitDoor  doorway a teammate decided: he waits here until that teammate's entry is done
//             (queries.js doorClaimed), then goes through; -1 = none
export function routePoint(x, y, over = null) {
  const p = { x, y, user: false, look: null, hold: false, code: null, entry: null, entryDoor: -1, ask: false, door: -1, pace: null, toss: null, pause: 0, back: false, beside: false, waitDoor: -1 };
  return over ? Object.assign(p, over) : p;
}
