// Squad routes (Door Kickers' "follow the leader"): an operator told to
// follow another walks the leader's route in file, MOVE.fileGap behind the
// one in front of him (rank 1, 2 ...), and stacks behind the leader at each
// GO hold of the leader's route, waiting for the same GO group. When the
// leader's route changes, every follower's route is rebuilt from it, so the
// player draws ONE route for the whole squad.
//
//   unit.follow = {leader: unitId, rank} | null
//
// The leader does the door entries; followers only walk and wait: on a GO,
// sim/orders.js issueGo holds them until a leader's flash / charge goes off
// (unit.goDelay), so they enter right after the bang. Doors on the way are
// opened by whoever gets there first (sim/doors.js). Rebuilt only by orders
// (deterministic, data only); a follower given his own order is unlinked.
import { MOVE, NAV } from '../config/balance.js';
import { EV } from '../core/events.js';
import { routePoint } from './routePoint.js';

/** The followers of a unit, by rank. */
export function followersOf(sim, leader) {
  const out = [];
  for (const u of sim.teams[leader.team]) if (u.alive && u.follow && u.follow.leader === leader.id) out.push(u);
  return out.sort((a, b) => a.follow.rank - b.follow.rank);
}

/** Links `u` behind `leader` (rank: 1 right behind him) and builds his route. False: not allowed. */
export function startFollow(sim, u, leader, rank) {
  if (!leader || !leader.alive || leader === u || leader.team !== u.team) return false;
  if (leader.follow) return false; // one level only: the leader leads
  for (const f of followersOf(sim, u)) f.follow = null; // he was leading: his file breaks up
  u.follow = { leader: leader.id, rank: Math.max(1, rank | 0) };
  rebuildFollower(sim, u, leader);
  return true;
}

/** Rebuilds every follower of `leader` (his route changed). Returns the followers rebuilt. */
export function rebuildFollowers(sim, leader) {
  const list = followersOf(sim, leader);
  for (const f of list) rebuildFollower(sim, f, leader);
  return list;
}

/**
 * The follower's route: from where he stands to the leader, then along the
 * leader's route. Each stop of the leader (a GO hold he will wait at, or
 * where he is waiting now) becomes a hold of the same group fileGap × rank
 * back along the way; the route ends that far behind the leader's last point.
 */
function rebuildFollower(sim, f, leader) {
  const back = MOVE.fileGap * f.follow.rank;
  const nav = sim.world.nav;
  // The leader's plan as a polyline, starting where he stands (waiting there, maybe).
  const lead = [{ x: leader.x, y: leader.y, stop: leader.waitingGo && leader.waitCode && leader.waitCode !== '?' ? leader.waitCode : null, look: leader.lookOverride, pace: null }];
  for (const p of leader.route) lead.push({ x: p.x, y: p.y, stop: p.user && p.hold ? p.code : null, look: p.user ? p.look : null, pace: p.pace || null });
  const path = nav.findPath(f.x, f.y, lead[0].x, lead[0].y, NAV.snapRadius);
  if (!path) return;
  // pts[0] is the follower himself (not part of the route).
  const pts = [{ x: f.x, y: f.y, stop: null, look: null, pace: null }];
  for (const q of path) pts.push({ x: q.x, y: q.y, stop: null, look: null, pace: lead[1] ? lead[1].pace : null });
  const leadStart = pts.length - 1; // index of the leader's position in pts
  pts[leadStart].stop = lead[0].stop;
  pts[leadStart].look = lead[0].look;
  for (let i = 1; i < lead.length; i++) pts.push({ ...lead[i] });

  // Every pts[1..] becomes a pass point; the leader's stops (and the end) are placed `back` m
  // before his points, along the way, as holds of the same GO group.
  const route = [];
  for (let j = 1; j < pts.length; j++) route.push(routePoint(pts[j].x, pts[j].y, { pace: pts[j].pace }));
  const last = pts.length - 1;
  const inserts = [];
  for (let j = leadStart; j < last; j++) if (pts[j].stop) inserts.push({ ...pointBack(pts, j, back), code: pts[j].stop, look: pts[j].look, end: false });
  inserts.push({ ...pointBack(pts, last, back), code: pts[last].stop, look: pts[last].look, end: true });
  // Later along the way first, so the indices of the earlier ones stay valid.
  inserts.sort((a, b) => b.seg - a.seg || a.dist - b.dist);
  for (const ins of inserts) {
    // The stop lies on the leg pts[seg - 1] -> pts[seg]: before route[seg - 1].
    const at = Math.max(0, ins.seg - 1);
    const p = routePoint(ins.x, ins.y, { user: true, look: ins.look, pace: route[Math.min(at, route.length - 1)] ? route[Math.min(at, route.length - 1)].pace : null });
    if (ins.code) {
      p.hold = true;
      p.code = ins.code;
    }
    if (ins.end) {
      route.length = at; // the file ends behind the leader: nothing of his route past this point
      route.push(p);
    } else route.splice(at, 0, p);
  }
  f.route.length = 0;
  for (const p of route) f.route.push(p);
  f.waitingGo = false;
  f.waitCode = null;
  f.idleLook = null;
  sim.emit(EV.ROUTE_CHANGED, { unitId: f.id, kind: 'follow' });
}

/**
 * The point `back` m before pts[j] walking back along the polyline pts:
 * {x, y, seg} where seg is the index of the end of the leg it lies on
 * (seg - 1 -> seg); clamped at pts[1]'s leg start (the follower himself).
 */
function pointBack(pts, j, back) {
  let left = back;
  for (let k = j; k >= 1; k--) {
    const a = pts[k - 1];
    const b = pts[k];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len >= left && len > 1e-6) {
      const t = (len - left) / len;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, seg: k, dist: left };
    }
    left -= len;
  }
  return { x: pts[0].x, y: pts[0].y, seg: 1, dist: back };
}
