// Canonical event names. Simulation events describe facts that happened in
// the world; session/ui events are requests or state changes outside it.

export const EV = Object.freeze({
  // --- emitted by the simulation (flushed after each fixed step) ---
  // {unitId, team, weaponId, x, y, angle, toX, toY, hit:'unit'|'wall'|'none', victimId, cover (struck low cover),
  //  material: 'flesh'|'none'|config/materials.js surface, impactZ (m, -1 = bullet height), mag (rounds left)}
  SHOT: 'shot',
  HIT: 'hit', // {unitId, team, role, attackerId, x, y, dirX, dirY, damage, headshot, part:'head'|'torso'|'limb', covered, lethal, blast?}
  DEATH: 'death', // {unitId, killerId, x, y, angle, team}
  FOOTSTEP: 'footstep', // {unitId, team, x, y, speed (m/s)}
  DOOR_OPEN: 'doorOpen', // {doorId, unitId, x, y, mode:'kick'|'push'|'crack'}
  RELOAD: 'reload', // {unitId, weaponId, x, y}
  SPOTTED: 'spotted', // {unitId, byTeam, x, y}
  HOLD_REACHED: 'holdReached', // {unitId, code}
  GO_CODE: 'goCode', // {released, code}
  // Door entries (sim/entries.js)
  CHARGE_PLANT: 'chargePlant', // {unitId, doorId, x, y, time}: starts planting a breach charge
  CHARGE_READY: 'chargeReady', // {unitId, doorId}
  CHARGE_FIRE: 'chargeFire', // {unitId, doorId, x, y, fuse}: the release; it blows after `fuse`
  CHARGE_BLAST: 'chargeBlast', // {unitId, doorId, x, y, dirX, dirY (into the room)}
  GRENADE_THROWN: 'grenadeThrown', // {id, kind:'flash'|'frag', unitId, x, y, viaX, viaY, toX, toY, flight}
  GRENADE_DETONATE: 'grenadeDetonate', // {id, kind, unitId, x, y}
  BLINDED: 'blinded', // {unitId, team, seconds, cause:'flash'|'blast'|'kick', x, y}
  BOMB_SPOTTED: 'bombSpotted', // {unitId, site, x, y}: the attackers found the bomb
  DEFUSE_START: 'defuseStart', // {unitId, x, y}
  DEFUSE_ABORT: 'defuseAbort', // {unitId}
  BOMB_DEFUSED: 'bombDefused', // {unitId, x, y}
  ROUND_END: 'roundEnd', // {winner, reason}
  ORDER_REJECTED: 'orderRejected', // {unitId, reason: REJECT code (sim/orders.js)}
  ROUTE_CHANGED: 'routeChanged', // {unitId, kind}

  // --- session / UI ---
  COMMAND: 'command', // a sim command object, queued for the simulation
  SELECT: 'select', // {unitId}
  PHASE: 'phase', // {phase, previous}
  // {action}: start | toggle | execute | go | defuse | hold | undo | clear |
  //           restart | newPlan | help | mute | music | focus | fullscreen  (session/SessionController.js)
  REQUEST: 'request',
  ROUND_RESET: 'roundReset', // {sim}
  UI_SOUND: 'uiSound', // {name}
  MUTE_CHANGED: 'muteChanged', // {muted}
  MUSIC_CHANGED: 'musicChanged', // {on}
  // {code, count}: a transient flow message for the player (session -> HUD toast, text in ui/texts.js T.notice)
  NOTICE: 'notice',
});
