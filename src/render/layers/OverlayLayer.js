// Tactical overlay: planned routes, waypoints, facing arrows, GO holds,
// door entries, grenades in flight, flashed units, FOV edges, selection
// rings, contact markers, defuse progress, where each operator gets to in
// the next 5 s turn (while planning) and the noise heard of the enemy.
// `drawGround` runs before walls/units (depth-tested rings & shadows),
// `drawTop` runs last, over everything (routes must always be readable).
// Rebuilt every frame (animated dashes/pulses), so it is written to avoid
// garbage: colors come from a small rotating pool, points and poses from
// scratch buffers. A pooled color is valid until 16 more are requested,
// which is always enough because ShapeBatch consumes colors immediately.
import { HEIGHTS, OVERLAY } from '../../config/render.js';
import { GO_GROUPS } from '../../config/ui.js';
import { ENTRY, MOVE, ROUND, NOISE, DRONE, CAMERA } from '../../config/balance.js';
import { teamView } from '../../sim/view.js';
import { visibilityPolygon } from '../../sim/vision.js';
import { hexToRgb, lerp, lerpAngle } from '../../core/math.js';
import { grenadeAt, tossLanding, tossDoorway, HERE } from '../../sim/queries.js';
import { ShaderProgram } from '../gl/ShaderProgram.js';
import { ShapeBatch } from '../gl/ShapeBatch.js';
import { FLAT_VS, FLAT_FS } from '../shaders/flat.js';
import { OverlayPings } from './OverlayPings.js';
import { ContactMarkers } from './ContactMarkers.js';
import { rgba, BLACK, WHITE, withAlpha } from './overlayColors.js';

const LOOK_PREVIEW_RGB = [1, 1, 1];
const DRONE_RGB = hexToRgb('#8fe36b');
const TOSS_DANGER_RGB = [1, 0.33, 0.3]; // a grenade that would reach its own thrower
const BARRICADE_RGBA = [1, 0.69, 0.18, 0.95];
const WIRE_RGBA = [0.78, 0.82, 0.86, 0.95]; // barbed wire: steel grey
const SIDES = [-1, 1];

export class OverlayLayer {
  constructor(gl) {
    this.gl = gl;
    this.prog = new ShaderProgram(gl, FLAT_VS, FLAT_FS, 'overlay');
    this.ground = new ShapeBatch(gl);
    this.top = new ShapeBatch(gl);
    this.colors = new Map();
    this.goColors = new Map(); // GO group code -> rgb
    this.markers = new ContactMarkers();
    this.pose = { x: 0, y: 0, facing: 0 }; // scratch interpolated pose
    this.gpos = { x: 0, y: 0, k: 0 }; // scratch grenade position
    this.land = { x: 0, y: 0, reach: 0 }; // scratch throw landing (tossMarker)
    this.camPoly = []; // scratch camera fields of view (cameras), one per camera
    this.ghosts = []; // free camera mounts' fields of view (cached: mountGhosts)
    this.ghostKey = '';
    this.ghostSim = null;
    this.routePts = []; // scratch flat polyline
    this.linkPts = [0, 0, 0, 0]; // scratch entry link
    this.tossPts = []; // scratch throw path (2 or 3 points)
    this.conePts = []; // scratch outline of a camera's view
    this.routeOrder = []; // own operators, selected last
    this.pings = new OverlayPings();
    this.lastSelected = -1;
    this.sim = null;
    this.unitLayer = null;
    this.alpha = 1;
    this.colorOf = (id) => {
      const u = this.sim && id >= 0 ? this.sim.units[id] : null;
      return u && u.team === this.viewer ? this.rgb(u) : null;
    };
    this.posOf = (id) => {
      const u = this.sim && id >= 0 ? this.sim.units[id] : null;
      return u && u.alive ? this.unitLayer.poseInto(u, this.alpha, this.pose) : null;
    };
  }

  reset() {
    this.markers.reset();
    this.pings.clear();
    this.lastSelected = -1;
  }

  /** Feedback ring (see OverlayPings / config/render.js PINGS). */
  ping(x, y, kind, unitId, time) {
    this.pings.add(x, y, kind, unitId, time);
  }

  onSpotted(unitId, time) {
    this.markers.onSpotted(unitId, time);
  }

  rgb(u) {
    let c = this.colors.get(u.id);
    if (!c) this.colors.set(u.id, (c = hexToRgb(u.color)));
    return c;
  }

  build(frame, sim, session, unitLayer, vision) {
    const g = this.ground;
    const t = this.top;
    g.reset();
    t.reset();
    const mpp = frame.camera.metersPerPixel(0);
    const time = frame.time;
    const selected = session.selectedId;
    const editable = session.phase === 'prep' || session.phase === 'planning';
    this.planning = editable;

    const own = (this.viewer = frame.viewer); // the side this screen plays (session.team)
    const R = OVERLAY.unitRing;
    this.markers.trackContacts(sim, unitLayer, frame);
    this.sim = sim;
    this.unitLayer = unitLayer;
    this.alpha = frame.alpha;
    if (selected !== this.lastSelected) {
      if (selected >= 0 && sim.units[selected]) this.ping(sim.units[selected].x, sim.units[selected].y, 'select', selected, time);
      this.lastSelected = selected;
    }

    // --- ground: shadows, rings
    for (const u of sim.units) {
      if (!u.alive) continue;
      const enemyHidden = u.team !== own && !u.seenByEnemy;
      if (enemyHidden) continue;
      const p = unitLayer.poseInto(u, frame.alpha, this.pose);
      // Soft contact shadow, offset along the light.
      g.circle(p.x + 0.08, p.y + 0.1, R.shadow, BLACK(0.4), 20, BLACK(0));
      const c = this.rgb(u); // ring color comes from the unit (operator color / its side's color)
      if (u.team === own) {
        if (u.id === selected) {
          const pulse = 0.8 + 0.2 * Math.sin(time * 5);
          g.circle(p.x, p.y, R.selected, withAlpha(c, 0.2), 28, withAlpha(c, 0.05));
          g.ring(p.x, p.y, R.selected, 4.6 * mpp, BLACK(0.45), 44);
          g.ring(p.x, p.y, R.selected, 3 * mpp, withAlpha(c, pulse), 44);
          const spin = time * OVERLAY.selectTickSpeed;
          for (let i = 0; i < 4; i++) {
            const a = spin + (i * Math.PI) / 2;
            g.arc(p.x, p.y, R.selectTicks, 3 * mpp, a - 0.18, a + 0.18, withAlpha(c, 0.9), 8);
          }
        } else {
          g.ring(p.x, p.y, R.own, 3.6 * mpp, BLACK(0.3), 32);
          g.ring(p.x, p.y, R.own, 2 * mpp, withAlpha(c, 0.7), 32);
        }
        if (session.hoverUnitId === u.id && u.id !== selected) g.ring(p.x, p.y, R.hover, 1.6 * mpp, WHITE(0.6), 32);
        if (u.blind > 0) g.ring(p.x, p.y, R.blind, 3 * mpp, rgba(1, 0.96, 0.62, 0.55 + 0.4 * Math.sin(time * 18)), 32);
      } else {
        g.ring(p.x, p.y, R.enemy, 3.6 * mpp, BLACK(0.35), 32);
        g.ring(p.x, p.y, R.enemy, 2.4 * mpp, withAlpha(c, 0.9), 32);
        if (u.blind > 0) g.ring(p.x, p.y, R.blind, 3 * mpp, rgba(1, 0.96, 0.62, 0.55 + 0.4 * Math.sin(time * 18)), 32);
        // facing tick: where the defender is looking
        const fx = Math.cos(p.facing);
        const fy = Math.sin(p.facing);
        const [t0, t1] = R.enemyTick;
        g.tri(p.x + fx * t1, p.y + fy * t1, p.x + fx * t0 - fy * 0.12, p.y + fy * t0 + fx * 0.12, p.x + fx * t0 + fy * 0.12, p.y + fy * t0 - fx * 0.12, withAlpha(c, 0.9));
      }
    }

    // --- top: FOV edges, routes
    for (const u of sim.units) {
      if (u.team !== own || !u.alive) continue;
      const c = this.rgb(u);
      const poly = vision.polygons.get(u.id);
      if (poly) this.coneEdges(t, poly, c, u.id === selected, u.vision.fov);
    }
    // Draw non-selected routes first so the selected one sits on top.
    const order = this.routeOrder;
    order.length = 0;
    for (const u of sim.teams[own]) if (u.alive && u.id !== selected) order.push(u);
    for (const u of sim.teams[own]) if (u.alive && u.id === selected) order.push(u);
    for (const u of order) this.route(t, u, unitLayer.poseInto(u, frame.alpha, this.pose), mpp, time, u.id === selected);

    this.cameras(t, g, sim, own, mpp, time, own === 'defenders' && (session.phase === 'prep' || session.phase === 'drone'));
    this.traps(t, sim, own, mpp);
    this.fires(t, sim, frame);
    this.smokes(t, sim, frame);
    this.grenades(t, sim, frame, mpp);
    if (own === 'attackers') this.drone(t, g, sim, vision, frame, mpp, time);
    this.barricades(t, sim, own, mpp);
    this.wires(t, sim, own, mpp);
    if (session.phase !== 'title') this.noise(g, teamView(sim, own), sim.turn, mpp, time);
    if (editable) this.planningPreview(t, sim, session, mpp);
    this.markers.contacts(t, sim, unitLayer, frame, mpp, own);
    this.markers.bomb(t, sim, unitLayer, frame, mpp);
    this.pings.draw(t, time, mpp, this.colorOf, this.posOf, rgba);

    g.upload();
    t.upload();
  }

  /** The attackers' recon drone (drone phase): body, spinning rotors, its cone; a red cross where it was shot down. */
  drone(t, g, sim, vision, frame, mpp, time) {
    const d = sim.drone;
    if (!d) return;
    if (!d.active) {
      if (d.end === 'destroyed' && sim.turn <= 1) {
        const k = 0.16;
        t.line(d.x - k, d.y - k, d.x + k, d.y + k, 3 * mpp, rgba(1, 0.25, 0.2, 0.85));
        t.line(d.x - k, d.y + k, d.x + k, d.y - k, 3 * mpp, rgba(1, 0.25, 0.2, 0.85));
      }
      return;
    }
    const x = lerp(d.prevX, d.x, frame.alpha);
    const y = lerp(d.prevY, d.y, frame.alpha);
    const f = lerpAngle(d.prevFacing, d.facing, frame.alpha);
    const poly = vision.polygons.get(-1);
    if (poly) this.coneEdges(t, poly, DRONE_RGB, true, DRONE.fov);
    g.circle(x + 0.05, y + 0.07, 0.3, BLACK(0.35), 16, BLACK(0));
    const r = DRONE.radius;
    for (let i = 0; i < 4; i++) {
      const a = f + Math.PI / 4 + (i * Math.PI) / 2;
      const rx = x + Math.cos(a) * r * 1.25;
      const ry = y + Math.sin(a) * r * 1.25;
      t.circle(rx, ry, r * 0.55, BLACK(0.55), 12);
      const spin = time * 40 + i;
      t.line(rx - Math.cos(spin) * r * 0.5, ry - Math.sin(spin) * r * 0.5, rx + Math.cos(spin) * r * 0.5, ry + Math.sin(spin) * r * 0.5, 1.6 * mpp, withAlpha(DRONE_RGB, 0.8));
    }
    t.circle(x, y, r * 0.75, rgba(0.08, 0.1, 0.12, 0.95), 16);
    t.ring(x, y, r * 0.75, 2 * mpp, withAlpha(DRONE_RGB, 1), 20);
    t.line(x, y, x + Math.cos(f) * r * 1.6, y + Math.sin(f) * r * 1.6, 2.4 * mpp, withAlpha(DRONE_RGB, 1));
  }

  /** Barricades the viewer's side knows of: a hatched bar across the doorway. */
  barricades(t, sim, own, mpp) {
    for (const door of sim.doors) {
      if (!door.barricaded || (own === 'attackers' && !sim.intel.barricades.has(door.def.index))) continue;
      const d = door.def;
      const tx = d.normalY; // along the wall
      const ty = -d.normalX;
      const h = d.length / 2 + 0.08;
      const nx = d.normalX * 0.2;
      const ny = d.normalY * 0.2;
      t.line(d.cx - tx * h, d.cy - ty * h, d.cx + tx * h, d.cy + ty * h, 7 * mpp, BLACK(0.6));
      t.line(d.cx - tx * h, d.cy - ty * h, d.cx + tx * h, d.cy + ty * h, 4 * mpp, BARRICADE_RGBA);
      for (let k = -1; k <= 1; k++) {
        const cx = d.cx + tx * h * 0.6 * k;
        const cy = d.cy + ty * h * 0.6 * k;
        t.line(cx - nx - tx * 0.12, cy - ny - ty * 0.12, cx + nx + tx * 0.12, cy + ny + ty * 0.12, 3 * mpp, BARRICADE_RGBA);
      }
    }
  }

  /** Barbed wire the viewer's side knows of: a zigzag coil across the doorway (sim/wires.js). */
  wires(t, sim, own, mpp) {
    for (const door of sim.doors) {
      if (!door.wired || (own === 'attackers' && !sim.intel.wires.has(door.def.index))) continue;
      const d = door.def;
      const tx = d.normalY; // along the wall
      const ty = -d.normalX;
      const h = d.length / 2 + 0.1;
      const n = 7;
      let px = d.cx - tx * h;
      let py = d.cy - ty * h;
      for (let k = 1; k <= n; k++) {
        const s = -h + (2 * h * k) / n;
        const off = (k % 2 ? 1 : -1) * 0.22;
        const x = d.cx + tx * s + d.normalX * off;
        const y = d.cy + ty * s + d.normalY * off;
        t.line(px, py, x, y, 5 * mpp, BLACK(0.55));
        t.line(px, py, x, y, 2.4 * mpp, WIRE_RGBA);
        px = x;
        py = y;
      }
    }
  }

  coneEdges(t, poly, c, selected, fov) {
    const half = fov / 2;
    const L = OVERLAY.coneEdgeLength;
    const a = selected ? 0.55 : 0.32;
    for (const s of SIDES) {
      const ang = poly.facing + s * half;
      const x2 = poly.x + Math.cos(ang) * L;
      const y2 = poly.y + Math.sin(ang) * L;
      t.line(poly.x + Math.cos(ang) * 0.5, poly.y + Math.sin(ang) * 0.5, x2, y2, 0.035, withAlpha(c, a), withAlpha(c, 0));
    }
  }

  route(t, u, pos, mpp, time, selected) {
    const c = this.rgb(u);
    const pts = this.routePts;
    pts.length = 0;
    pts.push(pos.x, pos.y);
    for (const p of u.route) pts.push(p.x, p.y);
    const w = (selected ? OVERLAY.routeWidthPx : OVERLAY.routeWidthIdlePx) * mpp;
    if (pts.length >= 4) {
      t.polyline(pts, w + OVERLAY.routeOutlinePx * mpp, BLACK(selected ? 0.6 : 0.4));
      if (selected) {
        t.polyline(pts, w, withAlpha(c, 0.95));
        const size = OVERLAY.chevronSizePx * mpp;
        t.chevrons(pts, OVERLAY.chevronSpacing, -time * OVERLAY.dashSpeed, size, w * 0.6, BLACK(0.75));
      } else {
        t.polyline(pts, w, withAlpha(c, u.follow ? 0.45 : 0.7)); // a follower's route is the leader's: quieter
      }
      // Quiet legs (pace 'sneak'): dark stripes across the line, like footprints.
      const seg = this.linkPts;
      for (let i = 0; i < u.route.length; i++) {
        if (u.route[i].pace !== 'sneak') continue;
        seg[0] = pts[i * 2];
        seg[1] = pts[i * 2 + 1];
        seg[2] = pts[i * 2 + 2];
        seg[3] = pts[i * 2 + 3];
        t.dashed(seg, w * 1.5, 0.08, 0.16, 0, BLACK(0.6));
      }
    }
    const r = OVERLAY.waypointRadiusPx * mpp * (selected ? 1 : 0.78);
    let lastUser = -1;
    for (let i = 0; i < u.route.length; i++) if (u.route[i].user) lastUser = i;
    for (let i = 0; i < u.route.length; i++) {
      const p = u.route[i];
      if (!p.user) continue;
      if (p.entry) this.entryMarker(t, p.x, p.y, p.entry, p.entryDoor, selected, mpp);
      if (p.toss) this.tossMarker(t, p.x, p.y, p.toss.x, p.toss.y, p.toss.item, selected ? 1 : 0.55, mpp, tossDoorway(this.sim.world, p, p.toss.x, p.toss.y));
      if (p.look !== null) this.lookMarker(t, p.x, p.y, p.look, c, selected ? 1 : 0.6, mpp, u.vision.fov);
      if (p.hold) {
        this.holdMarker(t, p.x, p.y, r * 1.6, c, mpp, this.goRgb(p.code));
      } else {
        const end = i === lastUser;
        const rr = end ? r * 1.25 : r;
        t.circle(p.x, p.y, rr + 2 * mpp, BLACK(0.75), 16);
        t.circle(p.x, p.y, rr, withAlpha(c, 1), 16);
        if (selected) t.circle(p.x, p.y, rr * (end ? 0.5 : 0.38), end ? BLACK(0.7) : WHITE(0.95), 12);
      }
    }
    if (this.planning && pts.length >= 4) this.turnReach(t, u, pts, c, mpp, selected);
    if (u.route.length === 0 && u.idleLook !== null && !u.waitingGo) {
      this.lookMarker(t, pos.x, pos.y, u.idleLook, c, selected ? 0.9 : 0.5, mpp, u.vision.fov);
    }
    const e = u.entry;
    if (e && e.phase !== 'act' && e.mode === 'toss') this.tossMarker(t, pos.x, pos.y, e.tx, e.ty, e.item, selected ? 1 : 0.55, mpp, e.doorway);
    else if (e && e.phase !== 'act') this.entryMarker(t, pos.x, pos.y, e.mode, e.doorway, selected, mpp);
    if (e && e.phase === 'prep') {
      // Progress of the crack / the plant around the operator.
      const total = e.mode === 'breach' ? ENTRY.breach.prepTime * u.mods.breachPrep : ENTRY.slow.prepTime;
      const k = 1 - Math.max(0, e.t) / total;
      const ec = OVERLAY.entryColors[e.mode];
      t.arc(pos.x, pos.y, OVERLAY.unitRing.prep, 3 * mpp, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2, rgba(ec[0], ec[1], ec[2], 0.95), 28);
    }
    if (u.waitingGo) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 5);
      t.ring(pos.x, pos.y, OVERLAY.unitRing.waitGo + pulse * OVERLAY.unitRing.waitGoPulse, 2.4 * mpp, WHITE(0.5 + 0.4 * pulse), 36);
    }
  }

  /**
   * Where the operator gets to in one turn (ROUND.turnSeconds at his walking
   * speed along the drawn route): a bar across the route. At a GO hold he
   * stops (the GO is the player's call during the turn: the hold marker says
   * it). An estimate — doors, queues, entries and fights slow him down.
   */
  turnReach(t, u, pts, c, mpp, selected) {
    const speed = MOVE.speed * u.mods.speed;
    let left = ROUND.turnSeconds; // s of the turn still to spend
    for (let i = 0; i < pts.length / 2 - 1; i++) {
      const ax = pts[i * 2];
      const ay = pts[i * 2 + 1];
      const bx = pts[i * 2 + 2];
      const by = pts[i * 2 + 3];
      const len = Math.hypot(bx - ax, by - ay);
      const time = len / speed;
      if (time < left) {
        left -= time;
        if (u.route[i].hold || (u.route[i].ask && ENTRY.undecided === 'stop')) return; // he will wait there
        continue;
      }
      const k = len > 1e-6 ? (left * speed) / len : 0;
      const x = ax + (bx - ax) * k;
      const y = ay + (by - ay) * k;
      const nx = len > 1e-6 ? -(by - ay) / len : 0;
      const ny = len > 1e-6 ? (bx - ax) / len : 1;
      const h = (selected ? 9 : 6) * mpp;
      t.line(x - nx * h, y - ny * h, x + nx * h, y + ny * h, 5 * mpp, BLACK(0.8));
      t.line(x - nx * h, y - ny * h, x + nx * h, y + ny * h, 2.6 * mpp, selected ? WHITE(0.95) : withAlpha(c, 0.85));
      return;
    }
  }

  /**
   * Noise the viewer's side heard of the enemy in the last turns (sim/noise.js,
   * read through the side's view): soft rings at a rough position, fading
   * with each turn. Loud kinds (shots, blasts) are red, the rest amber.
   */
  noise(g, view, turn, mpp, time) {
    for (const p of view.pulses) {
      const age = Math.max(0, turn - 1 - p.turn); // 0 = the turn that just ran
      const fade = 1 - age / NOISE.keepTurns;
      if (fade <= 0) continue;
      const loud = NOISE.rank.indexOf(p.kind) >= NOISE.rank.indexOf('shot');
      const col = loud ? [1, 0.32, 0.25] : [1, 0.72, 0.2];
      const r = NOISE.cell * 0.42;
      const beat = age === 0 ? 0.5 + 0.5 * Math.sin(time * 4) : 0;
      g.circle(p.x, p.y, r, rgba(col[0], col[1], col[2], 0.1 * fade), 28, rgba(col[0], col[1], col[2], 0));
      g.ring(p.x, p.y, r * (0.75 + 0.25 * beat), 2.4 * mpp, rgba(col[0], col[1], col[2], (0.35 + 0.35 * beat) * fade), 32);
      g.ring(p.x, p.y, r * 0.35, 1.6 * mpp, rgba(col[0], col[1], col[2], 0.45 * fade), 20);
    }
  }

  /** Dashed link from a stack point to the doorway it enters, and a mode-colored diamond on the doorway. */
  entryMarker(t, x, y, mode, doorway, selected, mpp) {
    const d = this.sim.world.doorways[doorway];
    if (!d) return;
    const c = OVERLAY.entryColors[mode] || LOOK_PREVIEW_RGB;
    const a = selected ? 0.95 : 0.6;
    const pts = this.linkPts;
    pts[0] = x;
    pts[1] = y;
    pts[2] = d.cx;
    pts[3] = d.cy;
    t.dashed(pts, 2 * mpp, 0.14, 0.1, 0, rgba(c[0], c[1], c[2], a * 0.8));
    const r = OVERLAY.entryMarker;
    const o = r + 2 * mpp;
    t.quad(d.cx, d.cy - o, d.cx + o, d.cy, d.cx, d.cy + o, d.cx - o, d.cy, BLACK(0.7 * a));
    t.quad(d.cx, d.cy - r, d.cx + r, d.cy, d.cx, d.cy + r, d.cx - r, d.cy, rgba(c[0], c[1], c[2], a));
  }

  /**
   * A planned throw: a dashed line from the point to where it lands
   * (sim/queries.js tossLanding; through doorway k, a bend at its center)
   * and a ring there. A grenade that would reach the thrower himself
   * (straight throw, too close) is drawn red.
   */
  tossMarker(t, x, y, tx, ty, item, alpha, mpp, k = -1) {
    const land = tossLanding(this.sim.world, x, y, tx, ty, this.land, k);
    const ex = land.x;
    const ey = land.y;
    const self = item === 'frag' && k < 0 && ENTRY.frag.damage * (1 - Math.hypot(ex - x, ey - y) / ENTRY.frag.radius) >= ENTRY.frag.minDamage;
    const c = self ? TOSS_DANGER_RGB : OVERLAY.entryColors[item] || LOOK_PREVIEW_RGB;
    const pts = this.tossPts;
    pts.length = 0;
    pts.push(x, y);
    if (k >= 0) pts.push(land.viaX, land.viaY);
    pts.push(ex, ey);
    t.dashed(pts, 3.6 * mpp, 0.12, 0.12, 0, BLACK(0.55 * alpha));
    t.dashed(pts, 2 * mpp, 0.12, 0.12, 0, rgba(c[0], c[1], c[2], 0.95 * alpha));
    const r = item === 'smoke' ? ENTRY.smoke.radius : item === 'frag' ? ENTRY.frag.radius : item === 'molotov' ? ENTRY.molotov.radius : 0.45;
    t.ring(ex, ey, r, 3.4 * mpp, BLACK(0.35 * alpha), 32);
    t.ring(ex, ey, r, 2 * mpp, rgba(c[0], c[1], c[2], 0.8 * alpha), 32);
    t.circle(ex, ey, 0.12, rgba(c[0], c[1], c[2], alpha), 12);
  }

  /**
   * Defender cameras (sim/cameras.js): the defenders see theirs, the attackers
   * the ones they know of. Each is drawn as a wall camera seen from above (a
   * plate on the wall, an arm, the body and its lens toward where it looks)
   * with its field of view on the floor — filled and outlined, cut by walls,
   * doors and smoke — pulsing while it reports someone. A broken one is a
   * dark body with a cross. While the defender picks mounts (preparation,
   * drone) every free mount shows the view a camera there would have, dashed.
   */
  cameras(t, g, sim, own, mpp, time, picking) {
    const C = OVERLAY.camera;
    const c = C.color;
    if (picking) this.mountGhosts(t, sim, mpp, time);
    let k = 0;
    for (const cam of sim.cameras) {
      if (own === 'attackers' && !cam.known) continue;
      if (cam.alive) {
        const hot = sim.time - cam.lastAlert < C.spotPulse;
        const pulse = hot ? 0.5 + 0.5 * Math.sin(time * 14) : 0;
        const poly = this.camPoly[k] = visibilityPolygon(sim.world, cam.x, cam.y, cam.facing, cam.fov, cam.range, this.camPoly[k]);
        k++;
        const fill = rgba(c[0], c[1], c[2], C.coneAlpha + 0.12 * pulse);
        for (let i = 0; i + 3 < poly.length; i += 2) g.tri(cam.x, cam.y, poly[i], poly[i + 1], poly[i + 2], poly[i + 3], fill);
        const pts = this.coneOutline(cam, poly);
        t.polyline(pts, 3.4 * mpp, BLACK(0.3), false);
        t.polyline(pts, 1.6 * mpp, rgba(c[0], c[1], c[2], C.edgeAlpha + 0.4 * pulse), false);
      }
      this.cameraBody(t, cam.x, cam.y, cam.facing, mpp, cam.alive ? 1 : 0, time, cam.alive && sim.time - cam.lastAlert < C.spotPulse);
    }
  }

  /** [lens, ...edge of the view, lens]: the outline of a camera's field of view. */
  coneOutline(cam, poly) {
    const pts = this.conePts;
    pts.length = 0;
    pts.push(cam.x, cam.y);
    for (let i = 0; i < poly.length; i++) pts.push(poly[i]);
    pts.push(cam.x, cam.y);
    return pts;
  }

  /** The free mounts' views, dashed (their polygons only change with the doors: cached per barricade set-up). */
  mountGhosts(t, sim, mpp, time) {
    const C = OVERLAY.camera;
    const c = C.color;
    let key = sim.site.id;
    for (const d of sim.doors) key += d.barricaded ? 'b' : d.destroyed || d.open ? 'o' : d.cracked ? 'c' : '-';
    if (this.ghostKey !== key || this.ghostSim !== sim) {
      this.ghostKey = key;
      this.ghostSim = sim;
      this.ghosts = sim.compiled.cameraMounts.map((m) => visibilityPolygon(sim.world, m.at[0], m.at[1], m.facing, m.fov ?? CAMERA.fov, m.range ?? CAMERA.range));
    }
    const full = sim.cameras.length >= CAMERA.max;
    sim.compiled.cameraMounts.forEach((m, i) => {
      if (sim.cameras.some((cam) => cam.mount === m.id)) return;
      const a = full ? C.ghostAlpha * 0.45 : C.ghostAlpha;
      const pts = this.coneOutline({ x: m.at[0], y: m.at[1] }, this.ghosts[i]);
      t.dashed(pts, 1.6 * mpp, 0.25, 0.2, -time * 0.4, rgba(c[0], c[1], c[2], a));
    });
  }

  /**
   * A wall camera from above at (x, y) looking `facing`: the plate on the
   * wall behind, an arm, the body and a hood over the lens. `alive` 0: broken
   * (dark, crossed). `hot`: it is reporting someone (the lens flashes).
   */
  cameraBody(t, x, y, facing, mpp, alive, time, hot) {
    const C = OVERLAY.camera;
    const c = C.color;
    const L = C.length;
    const W = C.width * 0.5;
    const ux = Math.cos(facing);
    const uy = Math.sin(facing);
    const vx = -uy;
    const vy = ux;
    // A box along the facing from a0 to a1 (m from the plate), half width h.
    const box = (a0, a1, h, col) =>
      t.quad(x + ux * a0 + vx * h, y + uy * a0 + vy * h, x + ux * a1 + vx * h, y + uy * a1 + vy * h, x + ux * a1 - vx * h, y + uy * a1 - vy * h, x + ux * a0 - vx * h, y + uy * a0 - vy * h, col);
    const ol = Math.min(mpp, 0.03); // outline
    const body = alive ? rgba(0.88, 0.9, 0.92, 1) : rgba(0.3, 0.3, 0.32, 1); // a white housing, like a real one
    // Wall plate and arm.
    box(-0.04 * L, 0.1 * L, W * 1.15, BLACK(0.9));
    t.line(x + ux * 0.06 * L, y + uy * 0.06 * L, x + ux * 0.3 * L, y + uy * 0.3 * L, W * 0.55, BLACK(0.9));
    // Body (outlined), then the hood over the lens, a bit wider.
    box(0.26 * L - ol, 0.86 * L + ol, W + ol, BLACK(0.9));
    box(0.26 * L, 0.86 * L, W, body);
    box(0.8 * L, 1.0 * L, W * 1.2, alive ? rgba(0.1, 0.11, 0.12, 1) : body);
    if (!alive) {
      const k = W * 1.6;
      const mx = x + ux * 0.6 * L;
      const my = y + uy * 0.6 * L;
      t.line(mx - k, my - k, mx + k, my + k, 1.6 * mpp, rgba(c[0], c[1], c[2], 0.9));
      t.line(mx - k, my + k, mx + k, my - k, 1.6 * mpp, rgba(c[0], c[1], c[2], 0.9));
      return;
    }
    t.circle(x + ux * 0.9 * L, y + uy * 0.9 * L, W * 0.62, hot ? WHITE(1) : rgba(0.55, 0.85, 1, 0.95), 12);
    // The recording light: blinks on the body, with a halo that grows while it is on (it is what you spot).
    const lx = x + ux * 0.55 * L;
    const ly = y + uy * 0.55 * L;
    const phase = (time / C.blink) % 2; // 0..1 on, 1..2 off
    const on = hot || phase < 1;
    if (on) {
      const k = hot ? (time * 3) % 1 : phase;
      t.ring(lx, ly, (3 + (C.haloPx - 3) * k) * mpp, 1.4 * mpp, rgba(1, 0.2, 0.15, 0.75 * (1 - k)), 16);
      t.circle(lx, ly, Math.max(W * 0.35, C.ledPx * mpp) * 1.8, rgba(1, 0.2, 0.15, 0.3), 12, rgba(1, 0.2, 0.15, 0));
    }
    t.circle(lx, ly, Math.max(W * 0.35, C.ledPx * mpp), on ? rgba(1, 0.22, 0.16, 1) : rgba(0.45, 0.08, 0.06, 1), 10);
  }

  /**
   * Trampero's traps (sim/traps.js): the defenders see theirs, the attackers
   * the ones they found — a toothed orange ring on the floor; a sprung or
   * broken one is a dark ring with a cross.
   */
  traps(t, sim, own, mpp) {
    const C = OVERLAY.trap;
    const c = C.color;
    const s = C.size;
    for (const trap of sim.traps) {
      if (own === 'attackers' && !trap.known) continue;
      const col = trap.alive ? rgba(c[0], c[1], c[2], 1) : rgba(0.3, 0.3, 0.32, 0.9);
      t.ring(trap.x, trap.y, s, 3.4 * mpp, BLACK(0.6), 18);
      t.ring(trap.x, trap.y, s, 2 * mpp, col, 18);
      if (trap.alive) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          t.line(trap.x + Math.cos(a) * s * 0.45, trap.y + Math.sin(a) * s * 0.45, trap.x + Math.cos(a) * s, trap.y + Math.sin(a) * s, 1.6 * mpp, col);
        }
        t.circle(trap.x, trap.y, s * 0.22, col, 8);
      } else {
        t.line(trap.x - s * 0.7, trap.y - s * 0.7, trap.x + s * 0.7, trap.y + s * 0.7, 2 * mpp, col);
        t.line(trap.x - s * 0.7, trap.y + s * 0.7, trap.x + s * 0.7, trap.y - s * 0.7, 2 * mpp, col);
      }
    }
  }

  /** Smoke clouds (sim/smoke.js): a soft gray disc, denser in the middle; it fills the sight cone's gap. */
  /** Incendiaria pools (sim/fire.js): flickering orange discs that shrink as they burn down. */
  fires(t, sim, frame) {
    const M = ENTRY.molotov;
    for (const f of sim.fires) {
      if (f.age >= M.seconds) continue;
      const left = 1 - f.age / M.seconds;
      const r = M.radius * (0.75 + 0.25 * Math.min(1, left * 4));
      const flick = 0.06 * Math.sin(frame.time * 9 + f.x * 3) + 0.04 * Math.sin(frame.time * 13 + f.y * 5);
      t.circle(f.x, f.y, r * (1 + flick), rgba(1, 0.42, 0.1, 0.55), 28, rgba(1, 0.3, 0.05, 0.25));
      t.circle(f.x, f.y, r * 0.55 * (1 - flick), rgba(1, 0.8, 0.3, 0.6), 20, rgba(1, 0.55, 0.15, 0));
    }
  }

  smokes(t, sim, frame) {
    const c = OVERLAY.smokeColor;
    for (const s of sim.smokes) {
      if (s.r <= 0) continue;
      const wob = 0.04 * Math.sin(frame.time * 1.3 + s.x);
      t.circle(s.x, s.y, s.r * (1.05 + wob), rgba(c[0], c[1], c[2], 0.7), 28, rgba(c[0], c[1], c[2], 0.42));
      t.circle(s.x + 0.3, s.y - 0.2, s.r * 0.6, rgba(c[0] + 0.08, c[1] + 0.08, c[2] + 0.08, 0.35), 20, rgba(c[0], c[1], c[2], 0));
    }
  }

  /** Grenades in flight (an arc through the doorway) and rolling to a stop. */
  grenades(t, sim, frame, mpp) {
    for (const g of sim.grenades) {
      const age = g.age + frame.alpha * sim.dt;
      const p = grenadeAt(g, age, this.gpos);
      const lift = p.k < 1 ? Math.sin(p.k * Math.PI) * 0.25 : 0; // reads as a lob: a bigger dot mid-flight
      const r = OVERLAY.grenadeRadius * (1 + lift) + 1.5 * mpp;
      const c = OVERLAY.entryColors[g.kind];
      t.circle(p.x, p.y, r + 1.5 * mpp, BLACK(0.8), 12);
      t.circle(p.x, p.y, r, rgba(c[0], c[1], c[2], 1), 12);
      // Fuse: a ring shrinking to the bang.
      const left = Math.max(0, 1 - age / g.fuse);
      t.ring(p.x, p.y, 0.25 + left * 0.35, 1.6 * mpp, rgba(c[0], c[1], c[2], 0.35 + 0.5 * (1 - left)), 20);
    }
  }

  lookMarker(t, x, y, angle, c, alpha, mpp, fov) {
    const half = fov / 2;
    t.wedge(x, y, 1.7, angle - half, angle + half, withAlpha(c, 0.16 * alpha), withAlpha(c, 0), 20);
    const L = OVERLAY.lookArrowLength;
    const x2 = x + Math.cos(angle) * L;
    const y2 = y + Math.sin(angle) * L;
    t.arrow(x, y, x2, y2, 5 * mpp, 0.3, BLACK(0.5 * alpha));
    t.arrow(x, y, x2, y2, 2.6 * mpp, 0.26, withAlpha(c, alpha));
  }

  /** RGB of a GO group's color (config/ui.js GO_GROUPS; old plans without a code: the first group). */
  goRgb(code) {
    const id = code || ENTRY.goCodes[0];
    let c = this.goColors.get(id);
    if (!c) this.goColors.set(id, (c = hexToRgb((GO_GROUPS[id] || GO_GROUPS.A).color)));
    return c;
  }

  /** A GO hold: a diamond in its group's color, with the operator's color as the two bars. */
  holdMarker(t, x, y, r, c, mpp, g) {
    const o = r + 1.6 * mpp;
    t.quad(x, y - o, x + o, y, x, y + o, x - o, y, BLACK(0.75));
    t.quad(x, y - r, x + r, y, x, y + r, x - r, y, withAlpha(g, 1));
    const bw = r * 0.22;
    const bh = r * 0.5;
    for (const s of SIDES) {
      const bx = x + s * r * 0.2;
      t.quad(bx - bw / 2, y - bh, bx + bw / 2, y - bh, bx + bw / 2, y + bh, bx - bw / 2, y + bh, withAlpha(c, 1));
    }
  }

  planningPreview(t, sim, session, mpp) {
    const ui = session.ui;
    const u = session.selectedId >= 0 ? sim.units[session.selectedId] : null;
    if (!u || !u.alive) return;
    const c = this.rgb(u);
    if (ui.hoverPath && ui.hoverPath.length >= 4 && !ui.drawing && !ui.lookPreview) {
      t.dashed(ui.hoverPath, 2 * mpp, 0.22, 0.18, 0, withAlpha(c, OVERLAY.hoverPathAlpha));
      const n = ui.hoverPath.length;
      t.ring(ui.hoverPath[n - 2], ui.hoverPath[n - 1], OVERLAY.waypointRadiusPx * mpp, 1.6 * mpp, withAlpha(c, 0.7), 16);
    }
    if (ui.lookPreview) {
      const lp = ui.lookPreview;
      this.lookMarker(t, lp.x, lp.y, lp.angle, LOOK_PREVIEW_RGB, 0.95, mpp, u.vision.fov);
    }
    // A waypoint being dragged (or a new one pulled out of a stretch of route): a ghost and its legs.
    const mp = ui.movePreview;
    if (mp && mp.unitId === u.id) {
      const r = u.route;
      const at = Math.min(mp.index, r.length - 1);
      let prev = u;
      for (let j = at - 1; j >= 0; j--) if (r[j].user && !r[j].ask) { prev = r[j]; break; }
      let next = null;
      for (let j = mp.insert ? at : at + 1; j < r.length; j++) if (r[j].user && !r[j].ask) { next = r[j]; break; }
      const pts = this.linkPts;
      pts[0] = prev.x;
      pts[1] = prev.y;
      pts[2] = mp.x;
      pts[3] = mp.y;
      t.dashed(pts, 2.4 * mpp, 0.2, 0.14, 0, withAlpha(c, 0.8));
      if (next) {
        pts[0] = mp.x;
        pts[1] = mp.y;
        pts[2] = next.x;
        pts[3] = next.y;
        t.dashed(pts, 2.4 * mpp, 0.2, 0.14, 0, withAlpha(c, 0.8));
      }
      const rr = OVERLAY.waypointRadiusPx * mpp * 1.3;
      t.circle(mp.x, mp.y, rr + 2 * mpp, BLACK(0.7), 16);
      t.circle(mp.x, mp.y, rr, WHITE(0.95), 16);
    }
    // Aiming a throw (menu "Lanzar", then a tap): from the point to the cursor.
    const tp = ui.tossPick;
    if (tp && tp.unitId === u.id && (tp.index === HERE || tp.index < u.route.length) && ui.cursorWorld) {
      const p = tp.index === HERE ? u : u.route[tp.index]; // HERE: from where he stands
      const { x: cx, y: cy } = ui.cursorWorld;
      const k = tossDoorway(this.sim.world, p, cx, cy);
      // How far it can go: from the point, or from the doorway it is thrown through.
      const d = k >= 0 ? this.sim.world.doorways[k] : null;
      const reach = d ? ENTRY.tossRange - Math.hypot(d.cx - p.x, d.cy - p.y) : ENTRY.tossRange;
      t.ring(d ? d.cx : p.x, d ? d.cy : p.y, reach, 1.6 * mpp, WHITE(0.28), 64);
      this.tossMarker(t, p.x, p.y, cx, cy, tp.item, 0.8, mpp, k);
    }
    // The waypoint the player tapped (door picker, ESPERAR, sigilo act on it): a white ring.
    const tg = session.pointTarget;
    if (tg && tg.unitId === u.id && (tg.index === HERE || tg.index < u.route.length)) {
      const p = tg.index === HERE ? u : u.route[tg.index];
      t.ring(p.x, p.y, OVERLAY.waypointRadiusPx * mpp * 2.1, 2.2 * mpp, WHITE(0.9), 24);
    }
  }

  drawGround(frame) {
    this.draw(frame, this.ground, HEIGHTS.overlay, true);
  }

  drawTop(frame) {
    this.draw(frame, this.top, HEIGHTS.overlay, false);
  }

  draw(frame, batch, z, depthTest) {
    const gl = this.gl;
    if (depthTest) gl.enable(gl.DEPTH_TEST);
    else gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    this.prog.use().mat4('uViewProj', frame.viewProj).f1('uZ', z);
    batch.draw();
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
  }
}
