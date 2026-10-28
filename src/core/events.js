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
  ENTRY_CHOSEN: 'entryChosen', // {entry}: the attackers start from another entry (preparation)
  // Buy and defender set-up (sim/prep.js)
  ROLE_CHANGED: 'roleChanged', // {unitId, role, points}: an operator changed class (buy phase / preparation)
  SCOUT_PULSE: 'scoutPulse', // {unitId, x, y, radius, found}: an Explorador's turn-end sweep (found: defenders detected)
  GEAR_CHANGED: 'gearChanged', // {unitId, item, count, points}: bought or given back (buy phase / preparation)
  SITE_CHOSEN: 'siteChosen', // {site}: the defenders moved the bomb (and reset their set-up to that site's)
  SETUP_CHANGED: 'setupChanged', // {unitId, kind:'place'|'watch'}: a defender placed or given a watch order
  BARRICADE_SET: 'barricadeSet', // {doorId, on}
  WIRE_SET: 'wireSet', // {doorId, on}: barbed wire laid / taken up in the preparation (sim/wires.js)
  WIRE_SPOTTED: 'wireSpotted', // {doorId, x, y}: the attackers found one
  WIRE_CROSSED: 'wireCrossed', // {unitId, doorId, x, y}: an attacker stepped into it (noise)
  WIRE_CUT: 'wireCut', // {unitId, doorId, x, y}: a blast cleared it
  // Barricades in the assault (sim/barricades.js)
  BARRICADE_SPOTTED: 'barricadeSpotted', // {doorId, x, y}: the attackers found one
  BARRICADE_HIT: 'barricadeHit', // {unitId, doorId, x, y}: a blow while breaking it
  BARRICADE_BROKEN: 'barricadeBroken', // {unitId, doorId, x, y, how:'bash'|'breach'}
  // Recon drone (sim/drone.js)
  DRONE_LAUNCHED: 'droneLaunched', // {x, y, seconds}
  DRONE_DESTROYED: 'droneDestroyed', // {x, y, shooterId}
  DRONE_ENDED: 'droneEnded', // {reason:'time'|'recalled'|'destroyed'}
  // Door entries (sim/entries.js)
  CHARGE_PLANT: 'chargePlant', // {unitId, doorId, x, y, time}: starts planting a breach charge
  CHARGE_READY: 'chargeReady', // {unitId, doorId}
  CHARGE_FIRE: 'chargeFire', // {unitId, doorId, x, y, fuse}: the release; it blows after `fuse`
  CHARGE_BLAST: 'chargeBlast', // {unitId, doorId, x, y, dirX, dirY (into the room)}
  GRENADE_THROWN: 'grenadeThrown', // {id, kind:'flash'|'frag', unitId, x, y, viaX, viaY, toX, toY, flight}
  GRENADE_DETONATE: 'grenadeDetonate', // {id, kind, unitId, x, y}
  BLINDED: 'blinded', // {unitId, team, seconds, cause:'flash'|'blast'|'kick', x, y}
  TRAP_SPRUNG: 'trapSprung', // {trapId, unitId (the one caught), ownerId, x, y}
  TRAP_FOUND: 'trapFound', // {trapId, x, y, by: 'sight' | 'drone' | 'scout'}: the attackers know where a trap is
  TRAP_DESTROYED: 'trapDestroyed', // {trapId, unitId (who broke it), x, y}
  CAMERA_FOUND: 'cameraFound', // {cameraId, x, y, byDrone}: the attackers know where a defender camera is
  CAMERA_SPOT: 'cameraSpot', // {cameraId, unitId, x, y}: a camera saw an attacker and told the defenders
  CAMERA_DESTROYED: 'cameraDestroyed', // {cameraId, unitId, x, y}: an attacker shot it
  CAMERA_SET: 'cameraSet', // {mount, on}: the defenders put a camera up on a mount (or took it down)
  BOMB_SPOTTED: 'bombSpotted', // {unitId, site, x, y}: the attackers found the bomb
  DEFUSE_START: 'defuseStart', // {unitId, x, y}
  DEFUSE_ABORT: 'defuseAbort', // {unitId}
  BOMB_DEFUSED: 'bombDefused', // {unitId, x, y}
  BOMB_EXPLODED: 'bombExploded', // {x, y}: the timer reached 0 (the defenders win)
  ROUND_END: 'roundEnd', // {winner, reason}
  ROUND_PHASE: 'roundPhase', // {phase: sim/round.js PHASE, previous, turn}: the round changed phase
  ORDER_REJECTED: 'orderRejected', // {unitId, reason: REJECT code (sim/orders.js)}
  ROUTE_CHANGED: 'routeChanged', // {unitId, kind, moved?: {from, to}} (moved: the decided point is at another index now)

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
  DRONE_STICK: 'droneStick', // {x, y}: the on-screen drone stick (ui/DroneStick.js -> input/DroneController.js)
  // {code, count}: a transient flow message for the player (session -> HUD toast, text in ui/texts.js T.notice)
  NOTICE: 'notice',
});
