// Unit factory. A unit is a plain data object; systems in sim/* mutate it.
// Everything that varies per operator comes from its ROLE (config/operators.js):
// systems read u.maxHp, u.mods.*, u.vision and u.ability — never a hard-coded
// per-unit value — so new roles need no changes here.
import { UNIT, VISION, NIGHT } from '../config/balance.js';
import { WEAPONS } from '../config/weapons.js';
import { ROLES, BASE_MODIFIERS } from '../config/operators.js';

/** Resolved role data shared by every unit of that role (frozen, cached). */
const resolvedRoles = new Map();
function resolveRole(roleId, team) {
  const key = `${roleId}:${team}`;
  let r = resolvedRoles.get(key);
  if (r) return r;
  const role = ROLES[roleId];
  if (!role) throw new Error(`Rol desconocido: ${roleId}`);
  const mods = Object.freeze({ ...BASE_MODIFIERS, ...role.modifiers });
  const base = VISION[team];
  // Unmodified roles share the team's vision object (exactly the old values).
  const vision = mods.visionFov === 1 && mods.visionRange === 1 ? base : Object.freeze({ fov: base.fov * mods.visionFov, range: base.range * mods.visionRange });
  r = Object.freeze({ id: roleId, role, mods, vision, maxHp: role.maxHp ?? UNIT.maxHp });
  resolvedRoles.set(key, r);
  return r;
}

export function createUnit({ id, team, slot, name, color, x, y, facing, role: roleId, weaponId, behavior = null }) {
  const r = resolveRole(roleId, team);
  weaponId = weaponId || r.role.weapon;
  const weapon = WEAPONS[weaponId];
  if (!weapon) throw new Error(`Arma desconocida: ${weaponId}`);
  return {
    id,
    team,
    slot,
    name,
    role: roleId,
    mods: r.mods, // multiplicative modifiers (speed, turnRate, reaction, spread, vision*)
    vision: r.vision, // {fov, range} used by perception and the fog of war (narrowed by gas / the monitor: sim/perception.js)
    roleVision: r.vision, // the class's, unimpaired
    visionScratch: null, // reused by sim/perception.js impairedVision
    ability: r.role.ability, // id in sim/abilities/index.js, or null
    abilityState: null, // owned by the ability module
    color,
    x,
    y,
    prevX: x,
    prevY: y,
    facing,
    prevFacing: facing,
    radius: UNIT.radius,
    hp: r.maxHp,
    maxHp: r.maxHp,
    alive: true,

    weaponId,
    weapon,
    mag: weapon.magazine,
    reserve: weapon.reserve,
    reloadTimer: 0,
    fireCooldown: 0,
    burstLeft: weapon.burst[0],
    burstPause: 0,
    recoil: 0,

    // Orders
    // [{x, y, user, look: angle|null, hold: bool, code: GO code|null, entry: ENTRY mode|null, entryDoor: doorway index}]
    route: [],
    strokeStart: 0, // route length when the current freehand stroke began (orders.js)
    waitingGo: false,
    waitCode: null, // GO code he waits for (ENTRY.goCodes)
    waitDoor: -1, // doorway whose teammate's entry he waits for (route point waitDoor), -1 = none
    pause: 0, // s still standing on a peek point (waypoint.pause) before walking on
    goDelay: 0, // s released but still holding: a teammate's grenade / charge goes off first
    entry: null, // door entry in progress (sim/entries.js)
    gear: { flash: 0, frag: 0, smoke: 0, breach: 0, molotov: 0, ...r.role.gear }, // utility left (spent by entries / throws)
    wireDoor: -1, // the wired door he stands in (sim/wires.js), -1: none
    points: 0, // utility points left to buy with (buy phase / preparation: sim/prep.js)
    bash: null, // breaking a barricade: {door, t, next} (sim/barricades.js)
    blind: 0, // s flashed / stunned: sees nothing, does not shoot
    wounds: { leg: false, arm: false }, // lasting wounds (sim/wounds.js)
    bleed: 0, // m walked since his last blood drop
    light: NIGHT.on[team], // flashlight on (order 'light'; NIGHT): sees into the dark, and is seen from far
    reloadNow: false, // RECARGAR ordered: a fresh magazine at the next step (sim/combat.js)
    stress: 0, // 0-1 suppression (sim/stress.js): worse aim and reaction, a moment flat at the top
    stressCalm: 0, // s since the last thing that stressed him
    pinned: 0, // s flat on the floor (suppressed): he does not walk
    pinCooldown: 0,
    gassed: 0, // s still choking on tear gas (sim/gas.js): sees little, aims and reacts worse, coughs
    coughIn: 0, // s to his next cough while gassed
    monitor: false, // a Vigía looking at his camera monitor now (sim/cameras.js): cameras report at once, he barely watches his angle
    lookOverride: null, // angle held while walking the current leg
    idleLook: null, // angle to face once the route is done
    cover: false, // an attacker covering a zone once still: sweeps around idleLook (sim/orders.js setCover)
    stun: 0, // seconds frozen (door breach beat)
    moving: false,
    sneaking: false, // walked a 'sneak' leg this tick (quiet footsteps: MOVE.sneakHearing)
    follow: null, // squad route (sim/follow.js): {leader, rank} while he walks another's route
    wasMoving: false, // moving on the previous tick (followers read it)
    heading: facing, // direction of the last step taken
    speedFraction: 0, // current walking speed / MOVE.speed (scales the moving spread)
    stillTime: 0, // s standing still without turning (aim set after MOVE.settleTime)
    doorwayAt: -Infinity, // sim.time he last walked through a doorway (COMBAT.doorwayPenalty)
    pieUntil: -Infinity, // sim.time his "despejar por cortes" stops sharpening him (ENTRY.pie)
    mirror: true, // still has his mirror (an enemy may shoot it to pieces: ENTRY.mirror)
    stepAccum: 0,
    distanceWalked: 0,
    stuck: { t: 0, want: 0, x, y }, // walking without getting anywhere (pushed against a wall): sim/movement.js re-paths

    // Perception & combat
    visibleEnemies: [],
    seenByEnemy: false,
    seenByEnemyPrev: false,
    target: -1,
    reaction: 0,
    focused: false, // the current target appeared inside this unit's focus cone (pre-aimed)
    lastKnown: null, // {x, y, until}
    alertTimer: 0,
    alertX: 0,
    alertY: 0,

    behavior,
    ai: { patrolIndex: 0, wait: 0, baseFacing: facing, repath: 0, noiseX: 0, noiseY: 0, rotating: null, rotated: false, rotateTo: null, report: null, commanded: false },

    defusing: false, // working on the bomb (sim/objectives.js): still, not shooting
    deathTime: -1,
    killerId: -1,
    deathAngle: 0,
    deathCause: null, // {code, killerId, room, ...} filled by sim/debrief.js at death
    stats: { kills: 0, shots: 0, hits: 0 },
  };
}

/**
 * Changes an operator's class (buy phase, sim/prep.js setRole): stats,
 * vision, ability, health and the class's weapon (full) — the gear is the
 * caller's business (sim/prep.js: the class's kit and the points back).
 */
export function applyRole(u, roleId) {
  const r = resolveRole(roleId, u.team);
  u.role = roleId;
  u.mods = r.mods;
  u.vision = r.vision;
  u.roleVision = r.vision;
  u.ability = r.role.ability;
  u.abilityState = null;
  u.maxHp = r.maxHp;
  u.hp = r.maxHp;
  const weapon = WEAPONS[r.role.weapon];
  u.weaponId = r.role.weapon;
  u.weapon = weapon;
  u.mag = weapon.magazine;
  u.reserve = weapon.reserve;
  u.burstLeft = weapon.burst[0];
}

/** The gear a class starts with (counts per item). */
export function roleGear(roleId) {
  return { flash: 0, frag: 0, smoke: 0, breach: 0, molotov: 0, ...ROLES[roleId].gear };
}
