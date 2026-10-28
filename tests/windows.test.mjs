// Ventanas (mapa `windows`): se ve, se dispara y se lanza a través; nadie pasa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { EV } from '../src/core/events.js';
import { lineOfSight, solidLineOfSight } from '../src/sim/vision.js';
import { tossLanding } from '../src/sim/queries.js';

const MAP = MAPS[DEFAULT_MAP];
const WIN = MAP.windows.find((w) => w.id === 'ventana-oficina');
const [WX, WY] = WIN.at;

function round() {
  const sim = new Simulation(MAP, { seed: 3, site: 'B' });
  sim.skipToAssault();
  const cmd = (c) => {
    sim.enqueue({ team: 'attackers', ...c });
    sim.flushCommands();
  };
  return { sim, cmd };
}

test('la ventana deja ver y disparar de afuera hacia la sala; la pared de al lado no', () => {
  const { sim } = round();
  const w = sim.world;
  assert.ok(lineOfSight(w, WX - 3, WY, WX + 3, WY), 'se ve por la ventana');
  assert.ok(solidLineOfSight(w, WX - 3, WY, WX + 3, WY), 'y pasan las balas');
  assert.ok(!lineOfSight(w, WX - 3, WY + 2, WX + 3, WY + 2), 'la pared sigue tapando');
  assert.ok(sim.compiled.windows.length >= 2);
  assert.ok(!sim.compiled.doorways.some((d) => d.id === WIN.id), 'no es una puerta');
});

test('nadie pasa por la ventana: la ruta a la oficina da la vuelta por una puerta', () => {
  const { sim, cmd } = round();
  assert.ok(!sim.world.nav.walkable(WX, WY));
  const [a] = sim.teams.attackers;
  // Place him in front of the window, outside, and send him just inside.
  a.x = a.prevX = WX - 1.2;
  a.y = a.prevY = WY + 0.3;
  cmd({ type: 'addWaypoint', unitId: a.id, x: WX + 1.2, y: WY, user: true });
  sim.advancePhase();
  let crossedWindow = false;
  for (let i = 0; i < 1200 && sim.phase !== 'end'; i++) {
    if (sim.phase !== 'exec') sim.advancePhase();
    sim.step();
    if (Math.abs(a.x - WX) < 0.3 && Math.abs(a.y - WY) < WIN.width / 2) crossedWindow = true;
    if (a.x > WX + 1 && Math.abs(a.y - WY) < 0.6) break;
  }
  assert.ok(!crossedWindow, 'no atraviesa el alféizar');
});

test('una granada lanzada desde afuera cae adentro, por la ventana', () => {
  const { sim, cmd } = round();
  const [a] = sim.teams.attackers;
  a.x = a.prevX = WX - 2;
  a.y = a.prevY = WY + 0.4;
  a.gear.frag = 1;
  const land = tossLanding(sim.world, a.x, a.y, WX + 2.5, WY);
  assert.ok(land.x > WX + 1, 'el tiro no choca con la ventana');
  cmd({ type: 'setToss', unitId: a.id, index: 'here', item: 'frag', x: WX + 2.5, y: WY });
  sim.advancePhase();
  let thrown = null;
  for (let i = 0; i < 300 && !thrown; i++) {
    sim.step();
    thrown = sim.drainEvents().find((e) => e.type === EV.GRENADE_THROWN) || null;
  }
  assert.ok(thrown, 'la lanza');
  assert.ok(thrown.toX > WX + 1, `cae dentro de la oficina (${thrown.toX.toFixed(2)})`);
});
