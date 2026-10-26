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
import { ENTRY, MOVE, ROUND, NOISE } from '../../config/balance.js';
import { teamView } from '../../sim/view.js';
import { hexToRgb } from '../../core/math.js';
import { grenadeAt } from '../../sim/queries.js';
import { ShaderProgram } from '../gl/ShaderProgram.js';
import { ShapeBatch } from '../gl/ShapeBatch.js';
import { FLAT_VS, FLAT_FS } from '../shaders/flat.js';
import { OverlayPings } from './OverlayPings.js';
import { ContactMarkers } from './ContactMarkers.js';
import { rgba, BLACK, WHITE, withAlpha } from './overlayColors.js';

const LOOK_PREVIEW_RGB = [1, 1, 1];
const SIDES = [-1, 1];

export class OverlayLayer {
  constructor(gl) {
    this.gl = gl;
    this.prog = new ShaderProgram(gl, FLAT_VS, FLAT_FS, 'overlay');
    this.ground = new ShapeBatch(gl);
    this.top = new ShapeBatch(gl);
    this.colors = new Map();
    this.markers = new ContactMarkers();
    this.pose = { x: 0, y: 0, facing: 0 }; // scratch interpolated pose
    this.gpos = { x: 0, y: 0, k: 0 }; // scratch grenade position
    this.routePts = []; // scratch flat polyline
    this.linkPts = [0, 0, 0, 0]; // scratch entry link
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

    this.grenades(t, sim, frame, mpp);
    if (session.phase !== 'title') this.noise(g, teamView(sim, own), sim.turn, mpp, time);
    if (editable) this.planningPreview(t, sim, session, mpp);
    this.markers.contacts(t, sim, unitLayer, frame, mpp, own);
    this.markers.bomb(t, sim, unitLayer, frame, mpp);
    this.pings.draw(t, time, mpp, this.colorOf, this.posOf, rgba);

    g.upload();
    t.upload();
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
        t.polyline(pts, w, withAlpha(c, 0.7));
      }
    }
    const r = OVERLAY.waypointRadiusPx * mpp * (selected ? 1 : 0.78);
    let lastUser = -1;
    for (let i = 0; i < u.route.length; i++) if (u.route[i].user) lastUser = i;
    for (let i = 0; i < u.route.length; i++) {
      const p = u.route[i];
      if (!p.user) continue;
      if (p.entry) this.entryMarker(t, p.x, p.y, p.entry, p.entryDoor, selected, mpp);
      if (p.look !== null) this.lookMarker(t, p.x, p.y, p.look, c, selected ? 1 : 0.6, mpp, u.vision.fov);
      if (p.hold) {
        this.holdMarker(t, p.x, p.y, r * 1.6, c, mpp);
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
    if (e && e.phase !== 'act') this.entryMarker(t, pos.x, pos.y, e.mode, e.doorway, selected, mpp);
    if (e && e.phase === 'prep') {
      // Progress of the crack / the plant around the operator.
      const total = e.mode === 'breach' ? ENTRY.breach.prepTime : ENTRY.slow.prepTime;
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
        if (u.route[i].hold || u.route[i].ask) return; // he will wait there
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

  holdMarker(t, x, y, r, c, mpp) {
    const o = r + 1.6 * mpp;
    t.quad(x, y - o, x + o, y, x, y + o, x - o, y, BLACK(0.75));
    t.quad(x, y - r, x + r, y, x, y + r, x - r, y, WHITE(1));
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
