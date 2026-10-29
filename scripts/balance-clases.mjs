// Equilibrio de clases con muestras grandes: juega N rondas IA contra IA por
// mapa (escuadras a ciegas como en una partida, session/Lobby.js aiRoles, o
// todas las composiciones de AI_SQUADS contra todas) repartidas en hilos, y
// cuenta victorias por bando, por clase (del bando de la clase), por par de
// clases del mismo bando y por composición.
// Uso: node scripts/balance-clases.mjs [N por mapa] [mapas, p. ej. warehouse,hotel,port] [ciegas | todas] [--json archivo]
// "todas": cada semilla juega una de las 5 × 5 parejas de composiciones (la semilla elige cuál, en orden),
// así cada pareja tiene N/25 rondas.
// "azar": cada semilla juega un trío al azar (válido, sin repetir clase) por bando: mide el efecto de
// cada clase y de cada par sin depender de las composiciones de la IA.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { writeFileSync } from 'node:fs';

if (isMainThread) {
  const args = process.argv.slice(2);
  const jsonAt = args.indexOf('--json');
  const jsonFile = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : null;
  const n = +(args[0] || 600);
  const { MAPS } = await import('../src/data/maps/index.js');
  const maps = (args[1] || Object.keys(MAPS).join(',')).split(',');
  const mode = args[2] || 'ciegas';
  const threads = Math.max(1, availableParallelism());
  const all = {};
  for (const map of maps) {
    if (!MAPS[map]) throw new Error(`Mapa desconocido: ${map}`);
    const chunks = [];
    const per = Math.ceil(n / threads);
    for (let t = 0; t < threads; t++) {
      const from = 1 + t * per;
      const to = Math.min(n, (t + 1) * per);
      if (from > to) continue;
      chunks.push(new Promise((ok, ko) => {
        const w = new Worker(new URL(import.meta.url), { workerData: { map, from, to, mode } });
        w.on('message', ok);
        w.on('error', ko);
      }));
    }
    const rows = (await Promise.all(chunks)).flat();
    all[map] = rows;
    report(MAPS[map].name, rows);
  }
  if (jsonFile) writeFileSync(jsonFile, JSON.stringify(all));
} else {
  const { playRound } = await import('./balance.mjs');
  const { AI_SQUADS } = await import('../src/config/operators.js');
  const { aiRoles } = await import('../src/session/Lobby.js');
  const { map, from, to, mode } = workerData;
  const { ROLES } = await import('../src/config/operators.js');
  const pool = { attackers: Object.keys(ROLES).filter((id) => ROLES[id].pick), defenders: Object.keys(ROLES).filter((id) => ROLES[id].defPick && !ROLES[id].hidden) };
  const trio = (seed, team) => {
    let h = (seed * 2654435761 + (team === 'attackers' ? 97 : 31)) >>> 0;
    const ids = [...pool[team]];
    const out = [];
    for (let i = 0; i < 3; i++) {
      h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
      h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
      out.push(ids.splice((h ^ (h >>> 15)) % ids.length, 1)[0]);
    }
    return out;
  };
  const rows = [];
  const na = AI_SQUADS.attackers.length;
  const nd = AI_SQUADS.defenders.length;
  for (let seed = from; seed <= to; seed++) {
    const k = (seed - 1) % (na * nd);
    const roles = mode === 'azar' ? { attackers: trio(seed, 'attackers'), defenders: trio(seed, 'defenders') } : mode === 'todas'
      ? { attackers: [...AI_SQUADS.attackers[k % na]], defenders: [...AI_SQUADS.defenders[Math.floor(k / na)]] }
      : { attackers: aiRoles(seed, 'attackers'), defenders: aiRoles(seed, 'defenders') };
    const sim = playRound(seed, { roles }, map);
    const o = sim.outcome || { winner: 'none', reason: 'stuck' };
    rows.push({ seed, a: roles.attackers, d: roles.defenders, w: o.winner === 'attackers' ? 1 : 0, r: o.reason, site: sim.site.id });
  }
  parentPort.postMessage(rows);
}

function report(name, rows) {
  const pct = (w, t) => (t ? `${((100 * w) / t).toFixed(1)} %` : '-');
  const aw = rows.reduce((s, r) => s + r.w, 0);
  console.log(`\n${name}: atacantes ${pct(aw, rows.length)} (${rows.length} rondas)`);
  const by = (key) => {
    const m = {};
    for (const r of rows) for (const k of key(r)) (m[k] ||= [0, 0]), (m[k][0] += r.w), m[k][1]++;
    return m;
  };
  const uniq = (xs) => [...new Set(xs)];
  // Per class: the win rate of HIS side (an attacker class: attackers' wins; a defender class: defenders').
  const cls = by((r) => [...uniq(r.a).map((c) => `A:${c}`), ...uniq(r.d).map((c) => `D:${c}`)]);
  for (const [k, [w, t]] of Object.entries(cls).sort()) console.log(`  ${k.padEnd(14)} su bando gana ${pct(k[0] === 'A' ? w : t - w, t).padStart(7)} (${t})`);
  const comp = by((r) => [`A:${r.a.join('+')}`, `D:${r.d.join('+')}`]);
  console.log('  composiciones:');
  for (const [k, [w, t]] of Object.entries(comp).sort()) console.log(`    ${k.padEnd(36)} su bando gana ${pct(k[0] === 'A' ? w : t - w, t).padStart(7)} (${t})`);
  const pairs = by((r) => {
    const out = [];
    for (const a of uniq(r.a)) for (const d of uniq(r.d)) out.push(`${a}>${d}`);
    return out;
  });
  const ext = Object.entries(pairs).filter(([, [, t]]) => t >= 40).map(([k, [w, t]]) => [k, w / t, t]).sort((x, y) => y[1] - x[1]);
  console.log('  pares atacante-defensor (atacantes ganan), extremos:');
  for (const [k, p, t] of [...ext.slice(0, 4), ...ext.slice(-4)]) console.log(`    ${k.padEnd(24)} ${(100 * p).toFixed(1)} % (${t})`);
}
