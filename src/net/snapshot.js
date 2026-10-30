// What of a Simulation changes during a round (the rest, the compiled map and the world's grid,
// is rebuilt from the map and the round's options). Shared by the state hash (stateHash.js) and,
// later, the snapshot a client sends to resync a phone that drifted.

const STATIC = new Set(['compiled', 'world', 'events', 'teams', 'site', 'entry']);

/** The sim's dynamic state as plain data (references to static map data replaced by ids). */
export function stateOf(sim) {
  const s = {};
  for (const k of Object.keys(sim)) if (!STATIC.has(k)) s[k] = sim[k];
  s.siteId = sim.site.id;
  s.entryId = sim.entry.id;
  s.doors = sim.doors.map(({ def, ...d }) => d);
  return s;
}
