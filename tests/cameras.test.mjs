// Cámaras de los defensores: avisan dónde vieron a un atacante, los
// atacantes las descubren y las rompen de un tiro, y el humo las ciega.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim/Simulation.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { spawnSmoke } from '../src/sim/smoke.js';
import { visibilityPolygon } from '../src/sim/vision.js';
import { CAMERA } from '../src/config/balance.js';

const MAP = MAPS[DEFAULT_MAP];
const T = 'attackers';

function round(site = 'A') {
  const sim = new Simulation(MAP, { seed: 3, site });
  sim.skipToAssault();
  const cmd = (c) => {
    sim.enqueue({ team: T, ...c });
    sim.flushCommands();
  };
  return { sim, cmd, squad: sim.teams.attackers };
}

function run(sim, ticks, each = () => {}) {
  const events = [];
  for (let i = 0; i < ticks && !sim.outcome; i++) {
    if (sim.phase !== 'exec') sim.advancePhase();
    sim.step();
    for (const e of sim.drainEvents()) events.push(e);
    each();
  }
  return events;
}

test('cada sitio trae sus cámaras en los soportes de la IA', () => {
  for (const site of ['A', 'B']) {
    const { sim } = round(site);
    assert.equal(sim.cameras.length, CAMERA.max);
    assert.deepEqual(sim.cameras.map((c) => c.mount), MAP.aiCameras[site]);
  }
});

/** A round in the preparation, playing the defenders against the AI. */
function prepRound(seed = 3) {
  const sim = new Simulation(MAP, { seed, site: 'A', controllers: { attackers: 'ai', defenders: 'human' } });
  while (sim.phase !== 'prep') sim.advancePhase();
  const cmd = (c) => {
    sim.enqueue({ team: 'defenders', ...c });
    sim.flushCommands();
    return sim.drainEvents();
  };
  return { sim, cmd };
}

test('el defensor mueve sus cámaras a otros soportes en la preparación', () => {
  const { sim, cmd } = prepRound();
  const [first] = MAP.aiCameras.A;
  cmd({ type: 'camera', mount: first, on: false });
  assert.equal(sim.cameras.length, CAMERA.max - 1);
  cmd({ type: 'camera', mount: 'cocina', on: true });
  assert.ok(sim.cameras.some((c) => c.mount === 'cocina'));
  const m = MAP.cameraMounts.find((x) => x.id === 'cocina');
  const cam = sim.cameras.find((c) => c.mount === 'cocina');
  assert.deepEqual([cam.x, cam.y, cam.facing], [m.at[0], m.at[1], m.facing]);
  // Lleno: una tercera se rechaza.
  const ev = cmd({ type: 'camera', mount: 'pasillo-oeste', on: true });
  assert.equal(sim.cameras.length, CAMERA.max);
  assert.ok(ev.some((e) => e.type === 'orderRejected' && e.reason === 'tooManyCameras'));
  // Un soporte que el mapa no tiene.
  assert.ok(cmd({ type: 'camera', mount: 'techo', on: true }).some((e) => e.reason === 'badMount'));
  sim.cameras.forEach((c, i) => assert.equal(c.id, i));
});

test('el atacante no puede tocar las cámaras, y en el asalto ya no se mueven', () => {
  const { sim } = prepRound();
  sim.enqueue({ team: 'attackers', type: 'camera', mount: MAP.aiCameras.A[0], on: false });
  sim.flushCommands();
  assert.equal(sim.cameras.length, CAMERA.max);
  sim.skipToAssault();
  sim.enqueue({ team: 'defenders', type: 'camera', mount: MAP.aiCameras.A[0], on: false });
  sim.flushCommands();
  assert.equal(sim.cameras.length, CAMERA.max);
});

test('al terminar el reconocimiento las cámaras, las barricadas y el sitio quedan fijos, también durante el dron', () => {
  const { sim, cmd } = prepRound(11);
  const mounts = sim.cameras.map((c) => c.mount);
  const reasons = (ev) => ev.filter((e) => e.type === 'orderRejected').map((e) => e.reason);
  assert.deepEqual(reasons(cmd({ type: 'endRecon' })), []);
  assert.equal(sim.reconDone, true);
  assert.deepEqual(reasons(cmd({ type: 'camera', mount: mounts[0], on: false })), ['reconOver']);
  assert.deepEqual(reasons(cmd({ type: 'chooseSite', site: 'B' })), ['reconOver']);
  assert.deepEqual(reasons(cmd({ type: 'barricade', door: sim.compiled.barricadeSlots[0], on: true })), ['reconOver']);
  assert.equal(sim.site.id, 'A');
  sim.advancePhase(); // al dron
  assert.equal(sim.phase, 'drone');
  assert.deepEqual(reasons(cmd({ type: 'camera', mount: mounts[0], on: false, atTick: 0 })), ['notNow']);
  assert.deepEqual(sim.cameras.map((c) => c.mount), mounts);
});

test('un soporte que el atacante ya descubrió sigue descubierto aunque la cámara se quite y se vuelva a poner', () => {
  const { sim, cmd } = prepRound();
  const id = MAP.aiCameras.A[0];
  sim.knownMounts.add(id);
  cmd({ type: 'camera', mount: id, on: false });
  cmd({ type: 'camera', mount: id, on: true });
  assert.equal(sim.cameras.find((c) => c.mount === id).known, true);
});

test('cada soporte del mapa ve algo: su cono no choca con la pared de al lado', () => {
  for (const m of MAP.cameraMounts) {
    const poly = visibilityPolygon(new Simulation(MAP, { seed: 1 }).world, m.at[0], m.at[1], m.facing, CAMERA.fov, CAMERA.range);
    let far = 0;
    for (let i = 0; i < poly.length; i += 2) far = Math.max(far, Math.hypot(poly[i] - m.at[0], poly[i + 1] - m.at[1]));
    assert.ok(far > 5, `${m.id} ve hasta ${far.toFixed(1)} m`);
  }
});

test('la cámara del pasillo ve entrar al atacante y avisa; él la descubre y la rompe', () => {
  const { sim, cmd, squad } = round('A');
  const [a] = squad;
  cmd({ type: 'addWaypoint', unitId: a.id, x: 18, y: 12.7, user: true });
  const ev = run(sim, 60 * 14);
  const types = ev.map((e) => e.type);
  assert.ok(types.includes('cameraFound'), 'la vio');
  assert.ok(types.includes('cameraDestroyed'), 'la rompió');
  assert.equal(sim.cameras[0].alive, false);
  const destroyed = ev.find((e) => e.type === 'cameraDestroyed');
  assert.equal(destroyed.unitId, a.id);
});

test('una cámara conocida de antes (dron) se rompe antes de que alcance a avisar', () => {
  const play = (known) => {
    const { sim, cmd, squad } = round('A');
    const [a] = squad;
    sim.cameras[0].known = known;
    cmd({ type: 'addWaypoint', unitId: a.id, x: 18, y: 12.7, user: true });
    const ev = run(sim, 60 * 14);
    return ev.filter((e) => e.type === 'cameraSpot').length;
  };
  assert.equal(play(true), 0, 'pre-apuntada: no avisa');
});

test('con humo delante la cámara no ve nada', () => {
  const { sim, cmd, squad } = round('A');
  const [a] = squad;
  const cam = sim.cameras[0];
  // Un atacante parado en el pasillo, en el cono de la cámara.
  a.x = 18;
  a.y = 12.7;
  a.facing = Math.PI / 2; // mirando a la pared: no la rompe
  let spots = run(sim, 60).filter((e) => e.type === 'cameraSpot').length;
  assert.ok(spots >= 1, 'sin humo lo ve');
  cam.lastAlert = -Infinity;
  cam.watch = 0;
  spawnSmoke(sim, 22.5, 12.7);
  sim.smokes[0].age = 2; // ya formada
  spots = run(sim, 60).filter((e) => e.type === 'cameraSpot').length;
  assert.equal(spots, 0, 'el humo la ciega');
});

test('lo que ve la cámara lo ve el defensor: se muestra, se recuerda, es un contacto y corta el turno', () => {
  // El humano defiende; un atacante (IA) queda parado en el pasillo, en el cono de la cámara.
  const sim = new Simulation(MAP, { seed: 3, site: 'A', controllers: { attackers: 'ai', defenders: 'human' }, stopOnContact: true });
  sim.skipToAssault();
  sim.advancePhase();
  const [a] = sim.teams.attackers;
  a.x = a.prevX = 18;
  a.y = a.prevY = 12.7;
  a.facing = Math.PI / 2; // mirando a la pared: no la rompe
  a.route.length = 0;
  assert.equal(a.seenByEnemy, false);
  let spot = null;
  for (let i = 0; i < 60 && !spot && sim.phase === 'exec'; i++) {
    sim.step();
    spot = sim.drainEvents().find((e) => e.type === 'spotted' && e.byCamera);
  }
  assert.ok(spot, 'la cámara avisa al bando defensor');
  assert.equal(spot.unitId, a.id);
  assert.ok(a.seenByEnemy, 'el atacante se muestra en el mapa del defensor');
  assert.ok(sim.memory.defenders.has(a.id), 'y queda en su memoria');
  for (let i = 0; i < 60 && sim.phase === 'exec'; i++) sim.step();
  assert.ok(sim.round.cut, 'el turno se corta como con un contacto propio');
});
