// Characters (alive and dead) and the bomb. Pure presentation: reads sim
// units, keeps per-unit animation state (walk cycle, recoil, hit flash,
// death fall) and draws rigid parts with the lit shader. Allocation-free
// per frame: poses are written into per-unit scratch objects.
import * as mat4 from '../../core/mat4.js';
import { lerp, lerpAngle, clamp, hexToRgb } from '../../core/math.js';
import { FX, CHARACTER_SCALE, ANIMATION, WEAPON_MODELS, ROLE_GEAR, TEAM_GEAR } from '../../config/render.js';
import { CHARACTER } from '../../config/materials.js';
import { ShaderProgram } from '../gl/ShaderProgram.js';
import { Mesh } from '../gl/Mesh.js';
import { LIT_LAYOUT } from '../geometry/MeshBuilder.js';
import { buildCharacterGeometry, createPose, standingPose, deadPose, blendPose, PART_NAMES } from '../geometry/character.js';
import { LIT_VS, LIT_FS } from '../shaders/lit.js';
import { applyLit } from '../sceneUniforms.js';
import { bombKnownTo } from '../../sim/queries.js';

const PART_MESH = {
  legL: 'leg',
  legR: 'leg',
  torso: 'torso',
  patchL: 'patch',
  patchR: 'patch',
  armR: 'arm',
  armL: 'arm',
  handR: 'hand',
  handL: 'hand',
};
const BASIS_INDICES = [0, 1, 2, 4, 5, 6, 8, 9, 10];
const gunLength = (weaponId) => WEAPON_MODELS[weaponId].length;

export class UnitLayer {
  constructor(gl) {
    this.gl = gl;
    this.prog = new ShaderProgram(gl, LIT_VS, LIT_FS, 'lit-units');
    const geo = buildCharacterGeometry();
    const mk = (data) => new Mesh(gl, LIT_LAYOUT, { data });
    this.meshes = {};
    for (const [team, parts] of Object.entries(geo.teams)) {
      this.meshes[team] = {};
      for (const [k, v] of Object.entries(parts)) this.meshes[team][k] = mk(v);
    }
    this.guns = {};
    for (const [k, v] of Object.entries(geo.guns)) this.guns[k] = mk(v);
    this.bombMesh = mk(geo.bomb);
    this.root = mat4.create();
    this.part = mat4.create();
    this.model = mat4.create();
    this.state = new Map();
    this.patchColors = new Map();
    this.scratchPos = { x: 0, y: 0, facing: 0 };
  }

  reset() {
    this.state.clear();
  }

  stateOf(u) {
    let s = this.state.get(u.id);
    if (!s) {
      s = {
        walkPhase: 0,
        walkAmount: 0,
        recoil: 0,
        flash: 0,
        lastDist: u.distanceWalked,
        deathT: 0,
        deathFacing: 0,
        deathX: 0,
        deathY: 0,
        seed: (u.id * 0.6180339) % 1,
        aim: 0,
        reload: 0,
        anim: { walkPhase: 0, walkAmount: 0, recoil: 0, aim: 0, reload: 0, reloadT: 0, time: 0 },
        gear: null,
        pose: createPose(), // pose drawn this frame
        restPose: null, // standing still (start of the death fall)
        deadPose: null, // lying on the floor
      };
      this.state.set(u.id, s);
    }
    return s;
  }

  // --- hooks called by the FX director ---
  onShot(unitId) {
    const s = this.state.get(unitId);
    if (s) s.recoil = 1;
  }

  onHit(unitId) {
    const s = this.state.get(unitId);
    if (s) s.flash = 1;
  }

  /** Smoothed interpolated transform of a unit (also used by overlay/labels). */
  pose(u, alpha) {
    return this.poseInto(u, alpha, { x: 0, y: 0, facing: 0 });
  }

  /** Same as pose() but writes into `out` (no allocation). */
  poseInto(u, alpha, out) {
    out.x = lerp(u.prevX, u.x, alpha);
    out.y = lerp(u.prevY, u.y, alpha);
    out.facing = lerpAngle(u.prevFacing, u.facing, alpha);
    return out;
  }

  draw(frame, sim) {
    const p = this.prog.use();
    applyLit(p, frame);
    const dt = frame.worldDt;
    for (const u of sim.units) {
      const s = this.stateOf(u);
      s.recoil = Math.max(0, s.recoil - dt * ANIMATION.recoilRecovery);
      s.flash = Math.max(0, s.flash - dt / FX.hitFlashSeconds);
      const visibleToPlayer = u.team === frame.viewer || !u.alive || u.seenByEnemy;
      if (!visibleToPlayer) continue;
      this.drawUnit(p, u, s, frame);
    }
    this.drawBomb(p, frame, sim);
    p.f4('uTint', 0, 0, 0, 0);
    p.f3('uColorMul', 1, 1, 1);
  }

  drawUnit(p, u, s, frame) {
    const meshes = this.meshes[u.team];
    const pos = this.poseInto(u, frame.alpha, this.scratchPos);
    let rootX = pos.x;
    let rootY = pos.y;
    let rootYaw = pos.facing;
    let partsPose;

    if (u.alive) {
      const moved = u.distanceWalked - s.lastDist;
      s.lastDist = u.distanceWalked;
      s.walkPhase += moved * ANIMATION.walkCyclePerMeter;
      const target = u.moving && frame.simulating ? 1 : 0;
      s.walkAmount += (target - s.walkAmount) * Math.min(1, frame.worldDt * ANIMATION.walkBlendSpeed);
      const k = frame.worldDt;
      const aimTarget = u.target >= 0 || s.recoil > 0 ? 1 : 0;
      s.aim += (aimTarget - s.aim) * Math.min(1, k * ANIMATION.aimBlendSpeed);
      const reloading = u.reloadTimer > 0;
      s.reload += ((reloading ? 1 : 0) - s.reload) * Math.min(1, k * ANIMATION.reloadBlendSpeed);
      const a = s.anim;
      a.walkPhase = s.walkPhase;
      a.walkAmount = s.walkAmount;
      a.recoil = s.recoil;
      a.aim = s.aim;
      a.reload = s.reload;
      if (reloading) a.reloadT = 1 - u.reloadTimer / u.weapon.reloadTime;
      a.time = frame.worldTime + s.seed * 10;
      partsPose = standingPose(s.pose, a, gunLength(u.weaponId));
      p.f1('uFogEnabled', u.team === frame.viewer ? 0 : 1);
    } else {
      if (s.deathT === 0) {
        s.deathFacing = pos.facing;
        s.deathX = u.x;
        s.deathY = u.y;
      }
      s.deathT = Math.min(1, s.deathT + frame.worldDt / FX.deathFallSeconds);
      const e = s.deathT * s.deathT; // accelerating fall
      const slide = ANIMATION.deathSlide * (1 - (1 - s.deathT) ** 2);
      rootX = s.deathX + Math.cos(u.deathAngle) * slide;
      rootY = s.deathY + Math.sin(u.deathAngle) * slide;
      rootYaw = lerpAngle(s.deathFacing, u.deathAngle, clamp(s.deathT * ANIMATION.deathTurnSpeed, 0, 1));
      if (!s.restPose) s.restPose = standingPose(createPose(), s.anim, gunLength(u.weaponId));
      if (!s.deadPose) s.deadPose = deadPose(createPose(), s.seed);
      partsPose = blendPose(s.pose, s.restPose, s.deadPose, e);
      p.f1('uFogEnabled', 1);
    }

    mat4.fromTransform(this.root, rootX, rootY, 0, rootYaw);
    scaleBasis(this.root, CHARACTER_SCALE);
    const tint = ANIMATION.hitTint;
    p.f4('uTint', tint[0], tint[1], tint[2], s.flash * ANIMATION.hitTintStrength);
    const patch = this.patchColor(u);
    const gear = s.gear || (s.gear = this.gearMeshes(u));

    for (const name of PART_NAMES) {
      const t = partsPose[name];
      let mesh;
      if (name === 'gun') mesh = this.guns[u.weaponId];
      else if (name === 'head') mesh = gear.head;
      else if (name === 'pack') mesh = gear.pack;
      else mesh = meshes[PART_MESH[name]];
      if (!mesh) continue;
      const isPatch = name === 'patchL' || name === 'patchR';
      p.f3('uColorMul', isPatch ? patch[0] : 1, isPatch ? patch[1] : 1, isPatch ? patch[2] : 1);
      mat4.fromTransform(this.part, t.x, t.y, t.z, t.yaw, t.pitch, t.sx);
      mat4.multiply(this.model, this.root, this.part);
      p.mat4('uModel', this.model);
      mesh.draw();
      if (name === 'pack' && gear.extra) gear.extra.draw();
    }

  }

  /** Head / pack / extra meshes for the unit's role (silhouette per class). */
  gearMeshes(u) {
    const g = ROLE_GEAR[u.role] || TEAM_GEAR[u.team];
    const m = this.meshes[u.team];
    return { head: m[`head_${g.head}`], pack: m[`pack_${g.pack}`], extra: g.extra ? m[`extra_${g.extra}`] : null };
  }

  patchColor(u) {
    let c = this.patchColors.get(u.id);
    if (!c) {
      c = hexToRgb(CHARACTER[u.team].patch ?? u.color); // a side's own patch color, else the operator's
      this.patchColors.set(u.id, c);
    }
    return c;
  }

  drawBomb(p, frame, sim) {
    const b = sim.bomb;
    if (!bombKnownTo(sim, frame.viewer)) return; // the attackers must find it
    p.f1('uFogEnabled', 1);
    p.f4('uTint', 0, 0, 0, 0);
    p.f3('uColorMul', 1, 1, 1);
    mat4.fromTransform(this.model, b.x, b.y, 0, ANIMATION.bombYaw);
    p.mat4('uModel', this.model);
    this.bombMesh.draw();
  }
}

/** Uniformly scales the rotation part of a transform (keeps translation). */
function scaleBasis(m, s) {
  for (const i of BASIS_INDICES) m[i] *= s;
}
