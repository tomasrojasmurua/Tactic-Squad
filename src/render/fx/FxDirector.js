// Turns simulation events into visual juice: tracers, muzzle flashes and
// lights, smoke, casings, surface-aware impacts (plaster dust, wood
// splinters, metal sparks), blood spray/decals, door breach dust, grenade
// and breach-charge blasts, camera shake, plus planning feedback pings
// (selection, waypoints, GO).
// Cosmetic randomness uses Math.random on purpose (never feeds the sim).
import { EV } from '../../core/events.js';
import { FX, HEIGHTS, CHARACTER_SCALE, WEAPON_MODELS } from '../../config/render.js';
import { SHAPE } from './Particles.js';
import { BLOOD_KIND } from '../layers/DecalLayer.js';
import { spawnImpact } from './impacts.js';
import { enemyTeam } from '../../sim/queries.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class FxDirector {
  constructor(bus, { particles, decals, units, overlay, camera, clock, realClock, viewer }) {
    this.viewer = viewer; // { team }: the side this screen plays (session), never a literal
    this.particles = particles;
    this.decals = decals;
    this.units = units;
    this.overlay = overlay;
    this.camera = camera;
    this.clock = clock; // () => world time (s), frozen while paused
    this.realClock = realClock; // () => real time (s), for UI feedback
    this.lights = [];
    this.sim = null;

    bus.on(EV.SHOT, (e) => this.onShot(e));
    bus.on(EV.HIT, (e) => this.onHit(e));
    bus.on(EV.DEATH, (e) => this.onDeath(e));
    bus.on(EV.DOOR_OPEN, (e) => this.onDoor(e));
    bus.on(EV.RELOAD, (e) => this.onReload(e));
    bus.on(EV.SPOTTED, (e) => {
      if (e.team === enemyTeam(this.viewer.team)) this.overlay.onSpotted(e.unitId, this.clock());
    });
    bus.on(EV.ROUTE_CHANGED, (e) => this.onRoute(e));
    bus.on(EV.GO_CODE, () => this.onGo());
    bus.on(EV.HOLD_REACHED, (e) => this.pingUnit(e.unitId, 'hold'));
    bus.on(EV.GRENADE_DETONATE, (e) => (e.kind === 'flash' ? this.onFlash(e) : this.onBlast(e.x, e.y, 0, 0, FX.shake.frag)));
    bus.on(EV.CHARGE_BLAST, (e) => this.onBreach(e));
  }

  /** True for a unit of the side this screen plays. */
  isOwn(u) {
    return !!u && u.team === this.viewer.team;
  }

  setSim(sim) {
    this.sim = sim;
    this.lights.length = 0;
  }

  addLight(x, y, radius, intensity, color, life) {
    this.lights.push({ x, y, radius, intensity, color, life, age: 0 });
  }

  update(dt) {
    // Age and compact in place (no per-frame array).
    const list = this.lights;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      l.age += dt;
      if (l.age < l.life) list[n++] = l;
    }
    list.length = n;
  }

  // ------------------------------------------------------------ planning feedback
  onRoute(e) {
    const u = this.sim && this.sim.units[e.unitId];
    if (!u) return;
    if (e.kind === 'add' || e.kind === 'promote') {
      const tail = u.route[u.route.length - 1];
      if (tail && tail.user) this.overlay.ping(tail.x, tail.y, 'waypoint', u.id, this.realClock());
    } else if (e.kind === 'hold' || e.kind === 'look') {
      const tail = u.route.length ? u.route[u.route.length - 1] : u;
      this.overlay.ping(tail.x, tail.y, e.kind, u.id, this.realClock());
    } else if (e.kind === 'clear') {
      this.overlay.ping(u.x, u.y, 'clear', u.id, this.realClock());
    }
  }

  onGo() {
    for (const u of this.sim.teams[this.viewer.team]) if (u.alive) this.overlay.ping(u.x, u.y, 'go', u.id, this.realClock());
  }

  pingUnit(unitId, kind) {
    const u = this.sim && this.sim.units[unitId];
    if (this.isOwn(u)) this.overlay.ping(u.x, u.y, kind, u.id, this.realClock());
  }

  // ------------------------------------------------------------ combat
  muzzle(e) {
    const u = this.sim.units[e.unitId];
    const facing = u ? u.facing : e.angle;
    const len = (0.2 + (u ? WEAPON_MODELS[u.weaponId].length : 0.6) * 0.96) * CHARACTER_SCALE;
    const c = Math.cos(facing);
    const s = Math.sin(facing);
    const side = 0.055 * CHARACTER_SCALE;
    return { x: e.x + c * len - s * side, y: e.y + s * len + c * side, facing };
  }

  onShot(e) {
    const P = this.particles;
    const m = this.muzzle(e);
    const z = HEIGHTS.muzzle;
    const dx = e.toX - m.x;
    const dy = e.toY - m.y;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    this.units.onShot(e.unitId);

    // Tracer (the whole flight is shown at once, Redie style) + a faint smoke trail.
    if (len > 0.2) {
      P.spawn({
        x: m.x + dx / 2, y: m.y + dy / 2, z, size: [len / 2, FX.tracerWidth], rot: ang, color: [1, 0.95, 0.75, 1],
        life: FX.tracerLife, shape: SHAPE.streak, additive: true,
      });
      P.spawn({
        x: m.x + dx / 2, y: m.y + dy / 2, z, size: [len / 2, FX.tracerWidth * 0.45], rot: ang, color: [1, 1, 1, 0.9],
        life: FX.tracerLife * 0.6, shape: SHAPE.streak, additive: true,
      });
      P.spawn({
        x: m.x + dx / 2, y: m.y + dy / 2, z: z - 0.02, size: [len / 2, FX.trailWidth], rot: ang, color: [0.85, 0.85, 0.82, 0.16],
        life: FX.trailLife, shape: SHAPE.beam,
      });
    }
    // Muzzle flash: a hot core, a randomized star and a floor glow, plus a light.
    const flash = FX.flashSize * rand(0.85, 1.25);
    P.spawn({
      x: m.x, y: m.y, z: z + 0.02, size: [flash, flash * rand(0.45, 0.65)], rot: e.angle + rand(-0.08, 0.08),
      color: [1, 0.74, 0.3, 1], life: FX.flashLife, shape: SHAPE.star, additive: true,
    });
    P.spawn({
      x: m.x, y: m.y, z: z + 0.03, size: [0.14, 0.14], color: [1, 1, 0.92, 1], life: FX.flashLife * 0.8, shape: SHAPE.puff,
      additive: true,
    });
    P.spawn({
      x: m.x, y: m.y, z: 0.05, size: [FX.flashGlow, FX.flashGlow], color: [1, 0.6, 0.25, 0.35], life: FX.flashLife * 1.6,
      shape: SHAPE.puff, additive: true,
    });
    const L = FX.muzzleLight;
    this.addLight(m.x, m.y, L.radius, L.intensity, L.color, L.life);

    // Smoke
    for (let i = 0; i < FX.smokePerShot; i++) {
      P.spawn({
        x: m.x + rand(-0.05, 0.05),
        y: m.y + rand(-0.05, 0.05),
        z: z + 0.05,
        vx: Math.cos(e.angle) * rand(0.2, 0.7) + rand(-0.15, 0.15),
        vy: Math.sin(e.angle) * rand(0.2, 0.7) + rand(-0.15, 0.15),
        drag: 1.5,
        size: [0.12, 0.12],
        grow: rand(0.35, 0.6),
        rot: rand(0, 6),
        spin: rand(-1, 1),
        color: [0.8, 0.8, 0.78, 0.32],
        life: rand(FX.smokeLife[0], FX.smokeLife[1]),
        shape: SHAPE.puff,
      });
    }

    // Shell casing, ejected to the right.
    const c = Math.cos(m.facing);
    const s = Math.sin(m.facing);
    const side = rand(1.4, 2.4);
    P.spawn({
      x: m.x - c * 0.4,
      y: m.y - s * 0.4,
      z: z,
      vx: -s * side - c * rand(0, 0.6),
      vy: c * side - s * rand(0, 0.6),
      vz: rand(1.2, 2.0),
      gravity: 1,
      bounce: 0.35,
      size: [0.05, 0.02],
      rot: rand(0, 6),
      spin: rand(-25, 25),
      color: [0.93, 0.72, 0.28, 1],
      life: FX.casingLife,
      fade: false,
      fadeOutLast: 2,
      shape: SHAPE.rect,
    });

    // The sim resolved what was struck (wall, door, prop, fence) and, for low cover, its top height.
    if (e.hit === 'wall') spawnImpact(this, e.toX, e.toY, ang, e.material, e.impactZ >= 0 ? e.impactZ : HEIGHTS.muzzle);

    // Recoil kick on the camera for our own squad.
    if (e.team === this.viewer.team) this.camera.addShake(FX.shake.ownShot);
  }

  onHit(e) {
    const P = this.particles;
    const time = this.clock();
    const dir = Math.atan2(e.dirY, e.dirX);
    this.units.onHit(e.unitId);
    const victim = this.sim.units[e.unitId];
    if (this.isOwn(victim)) this.camera.addShake(FX.shake.hitTaken);

    const n = FX.bloodDropsHit + (e.headshot ? 8 : 0);
    for (let i = 0; i < n; i++) {
      const a = dir + rand(-0.55, 0.55);
      const v = rand(1.5, 6);
      const r = rand(0.025, 0.065);
      P.spawn({
        x: e.x,
        y: e.y,
        z: rand(0.8, 1.2),
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        vz: rand(0, 2),
        gravity: 1,
        size: [r, r],
        color: [0.9, 0.02, 0.03, 1],
        life: 3,
        fade: false,
        shape: SHAPE.dot,
        onLand: (p) => this.decals.addBlood({
          x: p.x, y: p.y, sx: p.size[0] * 2.4, kind: BLOOD_KIND.drop, growTime: 0.05, time: this.clock(),
        }),
      });
    }
    // Red mist burst through the exit side.
    for (let i = 0; i < 3; i++) {
      P.spawn({
        x: e.x, y: e.y, z: 1.0, vx: Math.cos(dir + rand(-0.3, 0.3)) * rand(0.6, 1.4),
        vy: Math.sin(dir + rand(-0.3, 0.3)) * rand(0.6, 1.4), drag: 3, size: [0.14, 0.14], grow: e.headshot ? 1.6 : 0.9,
        color: [0.85, 0.04, 0.05, 0.42], life: rand(0.35, 0.55), shape: SHAPE.puff,
      });
    }

    const big = e.headshot ? 1.35 : 1;
    this.decals.addBlood({
      x: e.x + Math.cos(dir) * 0.75 * big,
      y: e.y + Math.sin(dir) * 0.75 * big,
      sx: 0.75 * big,
      sy: 0.45 * big,
      angle: dir,
      kind: BLOOD_KIND.splatter,
      growTime: 0.1,
      time,
    });
  }

  onDeath(e) {
    const time = this.clock();
    const victim = this.sim.units[e.unitId];
    this.camera.addShake(this.isOwn(victim) ? FX.shake.death * 1.5 : FX.shake.death);
    const cx = e.x + Math.cos(e.angle) * 0.35;
    const cy = e.y + Math.sin(e.angle) * 0.35;
    this.decals.addBlood({ x: cx, y: cy, sx: 1.0, angle: Math.random() * 6, kind: BLOOD_KIND.pool, growTime: 2.8, time });
    this.decals.addBlood({
      x: e.x + Math.cos(e.angle) * 1.3, y: e.y + Math.sin(e.angle) * 1.3, sx: 1.15, sy: 0.6, angle: e.angle,
      kind: BLOOD_KIND.splatter, growTime: 0.12, time,
    });
    if (victim && !this.isOwn(victim)) this.overlay.ping(e.x, e.y, 'kill', e.unitId, this.realClock());
  }

  onDoor(e) {
    if (e.mode === 'crack') return; // eased ajar: no dust, no shake
    const P = this.particles;
    // Dust ring pushed out of the doorway + a few wood splinters.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rand(-0.2, 0.2);
      const v = rand(0.9, 1.6);
      P.spawn({
        x: e.x, y: e.y, z: rand(0.1, 1.2), vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.6, size: [0.12, 0.12],
        grow: rand(0.5, 0.9), rot: rand(0, 6), color: [0.74, 0.7, 0.62, 0.3], life: rand(0.6, 1.1), shape: SHAPE.puff,
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = rand(0, Math.PI * 2);
      P.spawn({
        x: e.x, y: e.y, z: rand(0.6, 1.6), vx: Math.cos(a) * rand(1, 2.5), vy: Math.sin(a) * rand(1, 2.5), vz: rand(0.5, 1.5),
        gravity: 1, bounce: 0.2, size: [rand(0.05, 0.09), 0.015], rot: a, spin: rand(-10, 10), color: [0.6, 0.4, 0.22, 1],
        life: FX.debrisLife, fade: false, fadeOutLast: 1.5, shape: SHAPE.rect,
      });
    }
    this.camera.addShake(FX.shake.door);
    this.overlay.ping(e.x, e.y, 'door', -1, this.realClock());
  }

  /** Flashbang: a white burst, a blinding light and a little smoke. */
  onFlash(e) {
    const P = this.particles;
    P.spawn({ x: e.x, y: e.y, z: 0.4, size: [1.6, 1.6], grow: 2.5, color: [1, 1, 0.95, 1], life: 0.18, shape: SHAPE.puff, additive: true });
    P.spawn({ x: e.x, y: e.y, z: 0.4, size: [0.7, 0.7], rot: rand(0, 6), color: [1, 1, 1, 1], life: 0.12, shape: SHAPE.star, additive: true });
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2);
      P.spawn({
        x: e.x, y: e.y, z: rand(0.1, 0.6), vx: Math.cos(a) * rand(0.3, 0.9), vy: Math.sin(a) * rand(0.3, 0.9), drag: 1.8, size: [0.2, 0.2],
        grow: rand(0.8, 1.4), rot: rand(0, 6), spin: rand(-1, 1), color: [0.88, 0.88, 0.86, 0.3], life: rand(1.6, 2.6), shape: SHAPE.puff,
      });
    }
    const L = FX.flashLight;
    this.addLight(e.x, e.y, L.radius, L.intensity, L.color, L.life);
    this.camera.addShake(FX.shake.flash);
  }

  /** Explosion (frag grenade, breach charge): fire, smoke, debris thrown along (dirX, dirY) if given, a scorch. */
  onBlast(x, y, dirX, dirY, shake) {
    const P = this.particles;
    P.spawn({ x, y, z: 0.5, size: [1.1, 1.1], grow: 2.2, color: [1, 0.72, 0.32, 1], life: 0.16, shape: SHAPE.puff, additive: true });
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(1.5, 4);
      P.spawn({
        x, y, z: rand(0.2, 0.8), vx: Math.cos(a) * v + dirX * 2, vy: Math.sin(a) * v + dirY * 2, drag: 4, size: [0.3, 0.3], grow: rand(0.6, 1.2),
        rot: rand(0, 6), color: [1, rand(0.45, 0.65), 0.2, 0.85], life: rand(0.18, 0.3), shape: SHAPE.puff, additive: true,
      });
    }
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2);
      P.spawn({
        x, y, z: rand(0.2, 1.2), vx: Math.cos(a) * rand(0.4, 1.4) + dirX, vy: Math.sin(a) * rand(0.4, 1.4) + dirY, drag: 1.4, size: [0.35, 0.35],
        grow: rand(0.9, 1.6), rot: rand(0, 6), spin: rand(-0.8, 0.8), color: [0.22, 0.21, 0.2, 0.55], life: rand(2.2, 3.6), shape: SHAPE.puff,
      });
    }
    for (let i = 0; i < 16; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(2, 6);
      P.spawn({
        x, y, z: rand(0.2, 1.0), vx: Math.cos(a) * v + dirX * 3, vy: Math.sin(a) * v + dirY * 3, vz: rand(1, 3), gravity: 1, bounce: 0.25,
        size: [rand(0.03, 0.07), 0.02], rot: a, spin: rand(-15, 15), color: [0.25, 0.23, 0.2, 1], life: FX.debrisLife, fade: false, fadeOutLast: 2,
        shape: SHAPE.rect,
      });
    }
    const L = FX.blastLight;
    this.addLight(x, y, L.radius, L.intensity, L.color, L.life);
    this.camera.addShake(shake);
  }

  /** Breach charge: the blast pushed into the room, plus the door's splinters. */
  onBreach(e) {
    this.onBlast(e.x, e.y, e.dirX, e.dirY, FX.shake.breach);
    const P = this.particles;
    for (let i = 0; i < 14; i++) {
      const a = Math.atan2(e.dirY, e.dirX) + rand(-0.9, 0.9);
      const v = rand(2.5, 6);
      P.spawn({
        x: e.x, y: e.y, z: rand(0.3, 1.8), vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(0.5, 2), gravity: 1, bounce: 0.2,
        size: [rand(0.08, 0.22), rand(0.02, 0.05)], rot: a, spin: rand(-12, 12), color: [0.55, 0.37, 0.2, 1], life: FX.debrisLife, fade: false,
        fadeOutLast: 1.5, shape: SHAPE.rect,
      });
    }
    this.overlay.ping(e.x, e.y, 'door', -1, this.realClock());
  }

  onReload(e) {
    const u = this.sim.units[e.unitId];
    if (!u) return;
    this.particles.spawn({
      x: e.x + Math.cos(u.facing) * 0.25, y: e.y + Math.sin(u.facing) * 0.25, z: 0.9, vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3),
      vz: 0.3, gravity: 1, bounce: 0.2, size: [0.08, 0.035], rot: u.facing + 1.2, spin: rand(-4, 4), color: [0.12, 0.12, 0.13, 1],
      life: 20, fade: false, fadeOutLast: 2, shape: SHAPE.rect,
    });
  }
}
