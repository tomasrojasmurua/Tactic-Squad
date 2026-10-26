// Unit factory. A unit is a plain data object; systems in sim/* mutate it.
// Everything that varies per operator comes from its ROLE (config/operators.js):
// systems read u.maxHp, u.mods.*, u.vision and u.ability — never a hard-coded
// per-unit value — so new roles need no changes here.
import { UNIT, VISION } from '../config/balance.js';
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

export function createUnit({ id, team, slot, name, color, x, y, facing, role: roleId, weaponId, behavior = null, carriesBomb = false }) {
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
    vision: r.vision, // {fov, range} used by perception and the fog of war
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
    route: [], // [{x, y, user, look: angle|null, hold: bool}]
    strokeStart: 0, // route length when the current freehand stroke began (orders.js)
    waitingGo: false,
    lookOverride: null, // angle held while walking the current leg
    idleLook: null, // angle to face once the route is done
    stun: 0, // seconds frozen (door breach beat)
    moving: false,
    wasMoving: false, // moving on the previous tick (followers read it)
    heading: facing, // direction of the last step taken
    speedFraction: 0, // current walking speed / MOVE.speed (scales the moving spread)
    stillTime: 0, // s standing still without turning (aim set after MOVE.settleTime)
    stepAccum: 0,
    distanceWalked: 0,

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
    ai: { patrolIndex: 0, wait: 0, baseFacing: facing, repath: 0, noiseX: 0, noiseY: 0, rotating: null, rotated: false },

    carriesBomb,
    planting: false,
    deathTime: -1,
    killerId: -1,
    deathAngle: 0,
    deathCause: null, // {code, killerId, room, ...} filled by sim/debrief.js at death
    stats: { kills: 0, shots: 0, hits: 0 },
  };
}
