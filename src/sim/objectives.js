// Bomb carry/drop/pickup, planting on site A and round outcome.
import { ROUND, NAV } from '../config/balance.js';
import { EV } from '../core/events.js';
import { pointInBox } from '../core/geom.js';
import { buildNotes } from './debrief.js';

export function createBomb(units) {
  const carrier = units.find((u) => u.carriesBomb);
  return {
    carrierId: carrier ? carrier.id : -1,
    x: carrier ? carrier.x : 0,
    y: carrier ? carrier.y : 0,
    progress: 0, // 0..1 while planting
    planterId: -1,
    planted: false,
  };
}

export function updateObjectives(sim, dt) {
  if (sim.outcome) return;
  updateBomb(sim, dt);
  sim.timeLeft = Math.max(0, sim.timeLeft - dt);

  const attackersAlive = sim.units.some((u) => u.team === 'attackers' && u.alive);
  const defendersAlive = sim.units.some((u) => u.team === 'defenders' && u.alive);
  if (sim.bomb.planted) return endRound(sim, 'attackers', 'planted');
  if (!defendersAlive) return endRound(sim, 'attackers', 'elimination');
  if (!attackersAlive) return endRound(sim, 'defenders', 'wiped');
  if (sim.timeLeft <= 0) return endRound(sim, 'defenders', 'time');
}

function updateBomb(sim, dt) {
  const bomb = sim.bomb;
  if (bomb.planted) return;
  let carrier = bomb.carrierId >= 0 ? sim.units[bomb.carrierId] : null;

  if (carrier && !carrier.alive) {
    carrier.carriesBomb = false;
    bomb.carrierId = -1;
    // Dropped where a route can always reach it (never inside a prop or wall).
    const spot = sim.world.nav.nearestWalkable(carrier.x, carrier.y, NAV.snapRadius);
    bomb.x = spot ? spot.x : carrier.x;
    bomb.y = spot ? spot.y : carrier.y;
    abortPlant(sim, carrier);
    sim.emit(EV.BOMB_DROPPED, { x: bomb.x, y: bomb.y });
    carrier = null;
  }

  if (!carrier) {
    const r2 = ROUND.bombPickupRadius * ROUND.bombPickupRadius;
    for (const u of sim.units) {
      if (!u.alive || u.team !== 'attackers') continue;
      if ((u.x - bomb.x) ** 2 + (u.y - bomb.y) ** 2 <= r2) {
        u.carriesBomb = true;
        bomb.carrierId = u.id;
        sim.emit(EV.BOMB_PICKED, { unitId: u.id });
        carrier = u;
        break;
      }
    }
    if (!carrier) return;
  }

  bomb.x = carrier.x;
  bomb.y = carrier.y;
  const site = sim.world.zones.siteA;
  const canPlant =
    site && pointInBox(carrier.x, carrier.y, site.box) && !carrier.route.length && !carrier.moving && carrier.target < 0 && carrier.reloadTimer <= 0;

  if (!canPlant) {
    if (carrier.planting) abortPlant(sim, carrier);
    return;
  }
  if (!carrier.planting) {
    carrier.planting = true;
    bomb.planterId = carrier.id;
    sim.emit(EV.PLANT_START, { unitId: carrier.id });
  }
  bomb.progress = Math.min(1, bomb.progress + dt / ROUND.plantTime);
  if (bomb.progress >= 1) {
    bomb.planted = true;
    carrier.planting = false;
    carrier.carriesBomb = false;
    bomb.carrierId = -1;
    sim.emit(EV.BOMB_PLANTED, { unitId: carrier.id, x: bomb.x, y: bomb.y });
  }
}

function abortPlant(sim, u) {
  if (!u.planting) return;
  u.planting = false;
  sim.bomb.progress = 0;
  sim.bomb.planterId = -1;
  sim.emit(EV.PLANT_ABORT, { unitId: u.id });
}

function endRound(sim, winner, reason) {
  sim.outcome = { winner, reason, time: sim.time, notes: buildNotes(sim, winner, reason) };
  sim.emit(EV.ROUND_END, { winner, reason });
}
