// Enemy contact markers (red "spotted" pulse, dashed last-known position)
// and bomb markers (dropped, planting progress, planted pulse) on the
// tactical overlay. Owns the contact-tracking state. Allocation-free per frame.
import { OVERLAY, FX } from '../../config/render.js';
import { clamp } from '../../core/math.js';
import { BLACK, RED, ORANGE } from './overlayColors.js';

const LAST_KNOWN_SEGMENTS = 24;

export class ContactMarkers {
  constructor() {
    this.spotted = new Map(); // unitId -> world time of last "spotted"
    this.lastKnown = new Map(); // unitId -> {x, y, time}
    this.wasVisible = new Map();
    this.pose = { x: 0, y: 0, facing: 0 };
    this.circlePts = [];
  }

  reset() {
    this.spotted.clear();
    this.lastKnown.clear();
    this.wasVisible.clear();
  }

  onSpotted(unitId, time) {
    this.spotted.set(unitId, time);
  }

  /** Contacts = units not of the side this screen plays (`frame.viewer`). */
  trackContacts(sim, unitLayer, frame) {
    for (const u of sim.units) {
      if (u.team === frame.viewer) continue;
      const vis = u.alive && u.seenByEnemy;
      const was = this.wasVisible.get(u.id) || false;
      if (was && !vis && u.alive) this.lastKnown.set(u.id, { x: u.x, y: u.y, time: frame.worldTime });
      if (vis || !u.alive) this.lastKnown.delete(u.id);
      this.wasVisible.set(u.id, vis);
    }
  }

  contacts(t, sim, unitLayer, frame, mpp, own) {
    for (const id of this.spotted.keys()) {
      const age = frame.worldTime - this.spotted.get(id);
      const u = sim.units[id];
      if (age > FX.spotPulseSeconds || !u) {
        this.spotted.delete(id);
        continue;
      }
      if (u.team === own) continue;
      const k = age / FX.spotPulseSeconds;
      const p = unitLayer.poseInto(u, frame.alpha, this.pose);
      t.ring(p.x, p.y, 0.5 + k * 1.3, (4 - 3 * k) * mpp, RED(1 - k), 40);
    }
    for (const id of this.lastKnown.keys()) {
      const lk = this.lastKnown.get(id);
      const age = frame.worldTime - lk.time;
      if (age > OVERLAY.lastKnownSeconds) {
        this.lastKnown.delete(id);
        continue;
      }
      const a = clamp(1 - age / OVERLAY.lastKnownSeconds, 0, 1) * 0.85;
      const pts = this.circlePts;
      pts.length = 0;
      const n = LAST_KNOWN_SEGMENTS;
      for (let i = 0; i <= n; i++) pts.push(lk.x + Math.cos((i / n) * Math.PI * 2) * 0.42, lk.y + Math.sin((i / n) * Math.PI * 2) * 0.42);
      t.dashed(pts, 2.2 * mpp, 0.16, 0.12, frame.worldTime * 0.3, RED(a));
      t.line(lk.x - 0.12, lk.y - 0.12, lk.x + 0.12, lk.y + 0.12, 2.2 * mpp, RED(a));
      t.line(lk.x - 0.12, lk.y + 0.12, lk.x + 0.12, lk.y - 0.12, 2.2 * mpp, RED(a));
    }
  }

  bomb(t, sim, unitLayer, frame, mpp) {
    const b = sim.bomb;
    const time = frame.time;
    if (b.planted) {
      const k = (time * 1.4) % 1;
      t.ring(b.x, b.y, 0.4 + k * 1.6, 3 * mpp, RED(1 - k), 40);
      return;
    }
    if (b.carrierId < 0) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 6);
      t.ring(b.x, b.y, 0.45 + pulse * 0.1, 2.5 * mpp, ORANGE(0.6 + 0.4 * pulse), 32);
      return;
    }
    const carrier = sim.units[b.carrierId];
    if (carrier && carrier.planting) {
      const p = unitLayer.poseInto(carrier, frame.alpha, this.pose);
      t.ring(p.x, p.y, 0.72, 6 * mpp, BLACK(0.55), 48);
      t.arc(p.x, p.y, 0.72, 4.5 * mpp, -Math.PI / 2, -Math.PI / 2 + b.progress * Math.PI * 2, ORANGE(1), 48);
    }
  }

}
