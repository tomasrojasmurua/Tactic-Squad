// Top-down soldier built from a handful of rigid parts, plus the poses
// (walking, low ready, aiming, reloading, lying dead) that the UnitLayer
// blends. Local frame: facing +x, +y is the unit's right side, z up.
//
// Silhouette first: from above a player reads the helmet/cap (with a front
// bump that shows where the head points), shoulders, vest, pack and a gun
// with a light top face. Gear (head, pack, extra) comes from the operator
// role (config/render.js ROLE_GEAR), so future classes differ by outline.
import { CHARACTER as C, BOMB_COLOR, GEAR_COLOR } from '../../config/materials.js';
import { PARAPET } from '../../config/balance.js';
import { TEAMS } from '../../config/squad.js';
import { MeshBuilder } from './MeshBuilder.js';

const HEAD_STYLES = ['helmet', 'heavy', 'cap', 'beanie'];
const PACK_STYLES = ['large', 'small', 'none'];
const EXTRA_KINDS = ['charges', 'antenna', 'tools'];

const mk = (fn) => {
  const m = new MeshBuilder();
  fn(m);
  return m.toFloat32();
};

/** Geometry per part. Parts are built around their own pivot. */
function teamParts(team) {
  const p = C[team];
  const parts = {};
  parts.leg = mk((m) => {
    m.box(0, 0, 0.06, 0.15, 0.14, 0.56, p.uniform, { top: p.uniform });
    m.box(0.05, 0, 0, 0.25, 0.15, 0.12, p.boots, { top: p.boots });
    m.box(0.085, 0, 0.3, 0.05, 0.12, 0.12, p.pads, { top: p.pads }); // knee pad
  });
  parts.torso = mk((m) => {
    m.box(0, 0, 0, 0.26, 0.44, 0.4, p.uniform, { top: p.shoulders }); // shirt + shoulders (narrow enough for a stack, #13)
    m.box(0.01, 0, 0.05, 0.34, 0.35, 0.33, p.vest, { top: p.vestTop }); // plate carrier
    for (const y of [-0.105, 0, 0.105]) m.box(0.18, y, 0.12, 0.05, 0.085, 0.15, p.pouch, { top: p.pouchTop }); // mag pouches
    m.box(0.06, 0, 0.38, 0.1, 0.17, 0.03, p.collar); // collar
    m.box(-0.18, 0, 0.12, 0.04, 0.3, 0.22, p.vest, { top: p.vestTop }); // back plate
  });
  parts.arm = mk((m) => m.box(0, 0, -0.045, 1, 0.075, 0.08, p.uniform, { top: p.sleeve }));
  parts.hand = mk((m) => m.box(0, 0, -0.045, 0.09, 0.09, 0.09, p.gloves));
  parts.patch = mk((m) => m.box(0, 0, -0.01, 0.17, 0.12, 0.06, '#ffffff'));

  // Head styles: all share a skin neck/face disc; the cover differs.
  const face = (m) => m.frustum(0, 0, 0, 0.1, 0.105, 0.12, C.skin, { sides: 8, top: C.skin });
  parts.head_helmet = mk((m) => {
    face(m);
    m.frustum(-0.012, 0, 0.08, 0.158, 0.118, 0.14, p.helmet, { sides: 10, top: p.helmetTop, sx: 1.08 });
    m.box(0.15, 0, 0.13, 0.06, 0.09, 0.07, p.mount, { top: p.mountTop }); // NVG mount: front bump
    for (const s of [-1, 1]) m.box(-0.01, s * 0.15, 0.06, 0.09, 0.04, 0.09, p.pack); // ear cups
  });
  parts.head_heavy = mk((m) => {
    face(m);
    m.frustum(-0.01, 0, 0.07, 0.172, 0.128, 0.16, p.helmet, { sides: 10, top: p.helmetTop, sx: 1.1 });
    m.box(0.165, 0, 0.04, 0.05, 0.27, 0.15, C.visor, { top: C.visorTop }); // ballistic visor
  });
  parts.head_cap = mk((m) => {
    face(m);
    m.frustum(-0.01, 0, 0.09, 0.128, 0.108, 0.08, p.cap, { sides: 9, top: p.capTop });
    m.box(0.15, 0, 0.12, 0.12, 0.17, 0.02, p.cap, { top: p.capTop }); // brim: shows the gaze
  });
  parts.head_beanie = mk((m) => {
    face(m);
    m.frustum(-0.01, 0, 0.08, 0.13, 0.09, 0.12, p.cap, { sides: 9, top: p.capTop });
  });

  parts.pack_large = mk((m) => {
    m.box(0, 0, 0, 0.17, 0.33, 0.36, p.pack, { top: p.packTop });
    m.box(-0.02, 0, 0.36, 0.11, 0.35, 0.07, p.roll, { top: p.rollTop }); // bedroll
    m.box(-0.1, 0.12, 0.08, 0.05, 0.09, 0.16, p.pouch, { top: p.pouchTop });
  });
  parts.pack_small = mk((m) => m.box(0.02, 0, 0.04, 0.12, 0.27, 0.26, p.pack, { top: p.packTop }));
  parts.pack_none = mk(() => {});

  parts.extra_charges = mk((m) => {
    for (const y of [-0.08, 0.08]) {
      m.box(-0.1, y, 0.2, 0.08, 0.12, 0.2, C.charge, { top: C.chargeTop });
      m.box(-0.1, y, 0.4, 0.085, 0.125, 0.012, C.chargeTape);
    }
  });
  parts.extra_antenna = mk((m) => {
    m.box(-0.06, -0.12, 0.2, 0.06, 0.06, 0.62, C.antenna, { top: C.antenna });
    m.box(-0.06, -0.12, 0.82, 0.03, 0.03, 0.03, '#d24a3c');
  });
  parts.extra_tools = mk((m) => {
    m.box(-0.08, 0.1, 0.12, 0.1, 0.14, 0.2, C.charge, { top: C.chargeTop });
    m.box(-0.08, -0.1, 0.32, 0.36, 0.04, 0.04, C.antenna, { yaw: 0.6 });
  });
  return parts;
}

/** Gun silhouettes keyed by weapon id; the top face is lighter so it reads on dark floors. */
export function gunMesh(kind) {
  const m = new MeshBuilder();
  const g = C.gun;
  const top = { top: C.gunTop };
  const a = C.gunAccent;
  if (kind === 'rifle') {
    m.box(0.3, 0, -0.04, 0.46, 0.075, 0.085, g, top); // receiver + handguard
    m.box(0.0, 0, -0.06, 0.18, 0.065, 0.09, a, { top: C.gunAccentTop }); // stock
    m.box(0.64, 0, -0.02, 0.24, 0.035, 0.035, g, top); // barrel
    m.box(0.78, 0, -0.02, 0.05, 0.05, 0.05, g, top); // muzzle device
    m.box(0.32, 0, -0.17, 0.08, 0.055, 0.14, g, { yaw: 0 }); // mag
    m.box(0.2, 0, 0.045, 0.12, 0.05, 0.035, a, { top: C.optic }); // optic
  } else if (kind === 'smg') {
    m.box(0.22, 0, -0.04, 0.34, 0.08, 0.085, g, top);
    m.box(0.45, 0, -0.02, 0.14, 0.04, 0.04, g, top);
    m.box(0.52, 0, -0.025, 0.06, 0.055, 0.055, g, top); // suppressor-ish tip
    m.box(0.25, 0, -0.18, 0.055, 0.05, 0.16, a);
    m.box(0.02, 0, -0.03, 0.12, 0.05, 0.05, a, { top: C.gunAccentTop });
    m.box(0.2, 0, 0.04, 0.08, 0.045, 0.03, a, { top: C.optic });
  } else if (kind === 'pistol') {
    m.box(0.18, 0, -0.03, 0.22, 0.055, 0.065, g, top);
    m.box(0.12, 0, -0.1, 0.055, 0.05, 0.08, a);
  } else if (kind === 'dmr') {
    m.box(0.32, 0, -0.04, 0.5, 0.075, 0.085, g, top); // receiver + long handguard
    m.box(0.02, 0, -0.06, 0.2, 0.065, 0.09, a, { top: C.gunAccentTop }); // stock
    m.box(0.72, 0, -0.02, 0.3, 0.034, 0.034, g, top); // barrel
    m.box(0.33, 0, -0.16, 0.07, 0.05, 0.11, g); // short mag
    m.box(0.26, 0, 0.05, 0.22, 0.05, 0.04, a, { top: C.optic }); // scope
  } else {
    m.box(0.36, 0, -0.04, 0.56, 0.075, 0.085, g, top);
    m.box(0.04, 0, -0.05, 0.22, 0.07, 0.09, a, { top: C.gunAccentTop });
    m.box(0.82, 0, -0.02, 0.36, 0.032, 0.032, g, top);
    m.cylinder(0.36, 0, 0.04, 0.038, 0.05, a, { sides: 8, top: C.optic });
    m.box(0.36, 0, 0.05, 0.3, 0.055, 0.045, a, { top: C.optic });
  }
  return m.toFloat32();
}

export function buildCharacterGeometry() {
  return {
    teams: Object.fromEntries(TEAMS.map((team) => [team, teamParts(team)])), // palette per side (materials.js CHARACTER)
    guns: { rifle: gunMesh('rifle'), smg: gunMesh('smg'), pistol: gunMesh('pistol'), dmr: gunMesh('dmr'), sniper: gunMesh('sniper') },
    bomb: mk((m) => {
      m.box(0, 0, 0, 0.34, 0.24, 0.12, BOMB_COLOR.body, { top: BOMB_COLOR.top });
      m.box(-0.08, 0, 0.12, 0.05, 0.25, 0.005, BOMB_COLOR.tape);
      m.box(0.08, 0, 0.12, 0.05, 0.25, 0.005, BOMB_COLOR.tape);
      m.box(0.0, -0.05, 0.12, 0.09, 0.07, 0.02, BOMB_COLOR.panel, { top: BOMB_COLOR.screen });
      m.box(0.0, 0.07, 0.12, 0.03, 0.03, 0.03, BOMB_COLOR.light);
    }),
    // The Escudo's ballistic shield, in the unit's space (x forward): a tall steel slab with its viewport.
    shield: mk((m) => {
      const S = GEAR_COLOR.shield;
      m.box(0.4, -0.02, 0.18, 0.09, 0.6, 1.12, S.body, { top: S.top });
      m.box(0.43, -0.02, 1.0, 0.012, 0.3, 0.1, S.viewport); // the visor
      m.box(0.43, -0.02, 0.62, 0.012, 0.4, 0.05, S.stripe, { top: S.stripe }); // POLICÍA-style band, no lettering
    }),
    // The Ancla's portable barrier, in world metres (x forward = its facing): a low steel mantlet on feet.
    parapet: mk((m) => {
      const S = GEAR_COLOR.parapet;
      const w = PARAPET.width;
      m.box(0, 0, 0, 0.1, w, PARAPET.height, S.body, { top: S.top });
      for (const y of [-w * 0.38, w * 0.38]) m.box(-0.14, y, 0, 0.3, 0.06, 0.08, S.feet);
      m.box(0.055, 0, PARAPET.height - 0.14, 0.01, w * 0.94, 0.06, S.stripe, { top: S.stripe });
    }),
  };
}

export { HEAD_STYLES, PACK_STYLES, EXTRA_KINDS };

// --------------------------------------------------------------------------
// Poses. A pose is {partName: {x, y, z, yaw, pitch, sx}} in unit-local space.
// `sx` scales the unit-length arm along x (1 for every other part).
// Pose functions write into an existing pose (createPose) so animating every
// character each frame allocates nothing.

export const PART_NAMES = ['legL', 'legR', 'pack', 'torso', 'armR', 'armL', 'handR', 'handL', 'gun', 'patchL', 'patchR', 'head'];

export function createPose() {
  const pose = {};
  for (const name of PART_NAMES) pose[name] = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, sx: 1 };
  return pose;
}

function set(t, x, y, z, yaw = 0, pitch = 0) {
  t.x = x;
  t.y = y;
  t.z = z;
  t.yaw = yaw;
  t.pitch = pitch;
  t.sx = 1;
}

/** A unit-length box stretched from (x0, y0) to (x1, y1) at height z. */
function limb(t, x0, y0, x1, y1, z) {
  t.x = (x0 + x1) / 2;
  t.y = (y0 + y1) / 2;
  t.z = z;
  t.yaw = Math.atan2(y1 - y0, x1 - x0);
  t.pitch = 0;
  t.sx = Math.hypot(x1 - x0, y1 - y0);
}

/**
 * Alive pose. `a` = {walkPhase (rad), walkAmount 0..1, recoil 0..1,
 * aim 0..1 (0 = low ready, 1 = shouldered), reload 0..1 (blend), reloadT 0..1
 * (progress), time (s, idle sway)}; gunLen in meters.
 */
export function standingPose(out, a, gunLen) {
  const walk = a.walkAmount;
  const stride = 0.17 * walk;
  const sw = Math.sin(a.walkPhase) * stride;
  const bob = Math.abs(Math.sin(a.walkPhase)) * 0.03 * walk;
  const breathe = Math.sin(a.time * 2.1) * 0.006 * (1 - walk);
  const aim = a.aim;
  const low = 1 - aim;
  const kick = -0.07 * a.recoil;
  const sway = Math.sin(a.walkPhase) * 0.05 * walk;
  const blade = -0.12 * aim; // aimed: shoulders turn a little, like a real stance

  set(out.legL, sw + 0.02 * aim, -0.11, 0, 0.12 * aim);
  set(out.legR, -sw - 0.03 * aim, 0.12, 0, 0.12 * aim);
  set(out.torso, kick * 0.3, 0, 0.62 + bob + breathe, sway + blade);
  set(out.pack, -0.21 + kick * 0.3, 0, 0.69 + bob + breathe, sway + blade);
  const sy = Math.cos(sway + blade);
  const sx = Math.sin(sway + blade);
  set(out.patchL, -0.01 + 0.22 * sx, -0.2 * sy, 1.04 + bob, sway + blade);
  set(out.patchR, -0.01 - 0.22 * sx, 0.2 * sy, 1.04 + bob, sway + blade);

  // Gun: low ready points across the body and a bit down; aimed = straight.
  const rl = a.reload;
  const gunYaw = -0.36 * low + 0.55 * rl * Math.sin(a.reloadT * Math.PI);
  const gx = 0.16 + kick + 0.04 * aim;
  const gy = 0.055 + 0.03 * low;
  const gz = 1.04 - 0.07 * low + bob + 0.03 * rl;
  set(out.gun, gx, gy, gz, gunYaw);
  const c = Math.cos(gunYaw);
  const s = Math.sin(gunYaw);
  const grip = 0.14;
  const fore = Math.min(0.46, 0.02 + gunLen * 0.55);
  const hrx = gx + c * grip;
  const hry = gy + s * grip + 0.025;
  let hlx = gx + c * fore;
  let hly = gy + s * fore - 0.02;
  // Reload: the support hand travels to the vest pouches and back.
  const dip = Math.sin(a.reloadT * Math.PI) * rl;
  hlx += (0.2 - hlx) * dip;
  hly += (-0.13 - hly) * dip;
  limb(out.armR, -0.02 + 0.2 * sx, 0.23 * sy, hrx, hry, 1.0 + bob);
  limb(out.armL, -0.02 - 0.2 * sx, -0.23 * sy, hlx, hly, 1.0 + bob);
  set(out.handR, hrx, hry, gz - 0.02);
  set(out.handL, hlx, hly, gz - 0.02 - 0.06 * dip);
  set(out.head, 0.02 + kick * 0.2, 0, 1.06 + bob + breathe, 0.5 * blade + 0.15 * dip);
  return out;
}

/** Lying on the back; `seed` 0..1 varies the sprawl. Fall direction is +x. */
export function deadPose(out, seed) {
  const s = seed - 0.5;
  const half = Math.PI / 2;
  set(out.legL, -0.2, -0.12 - s * 0.1, 0.07, -0.18 + s * 0.3, -half);
  set(out.legR, -0.2, 0.12, 0.07, 0.22 + s * 0.2, -half);
  set(out.torso, -0.22, 0, 0.15, s * 0.2, half);
  set(out.pack, -0.24, 0, 0.01, 0, half);
  set(out.patchL, 0.12, -0.25, 0.18);
  set(out.patchR, 0.12, 0.25, 0.18);
  limb(out.armR, 0.12, 0.24, 0.28 + s * 0.2, 0.62, 0.06);
  limb(out.armL, 0.12, -0.24, 0.42, -0.5 - s * 0.2, 0.06);
  set(out.handR, 0.28 + s * 0.2, 0.62, 0.05);
  set(out.handL, 0.42, -0.5 - s * 0.2, 0.05);
  set(out.gun, 0.1 + s * 0.4, 0.72, 0.05, 0.9 + s * 1.5);
  set(out.head, 0.24, s * 0.06, 0.13, s, half);
  return out;
}

/** out = lerp(a, b, t) per part and channel. */
export function blendPose(out, a, b, t) {
  for (const k of PART_NAMES) {
    const pa = a[k];
    const pb = b[k];
    const o = out[k];
    o.x = pa.x + (pb.x - pa.x) * t;
    o.y = pa.y + (pb.y - pa.y) * t;
    o.z = pa.z + (pb.z - pa.z) * t;
    o.yaw = pa.yaw + (pb.yaw - pa.yaw) * t;
    o.pitch = pa.pitch + (pb.pitch - pa.pitch) * t;
    o.sx = pa.sx + (pb.sx - pa.sx) * t;
  }
  return out;
}
