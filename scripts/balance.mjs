// Equilibrio IA contra IA: juega N rondas completas con semillas fijas (las
// dos IA deciden solas, nadie aprieta nada) y cuenta quién gana, por sitio y
// por motivo. Uso: node scripts/balance.mjs [N] [defensores, p. ej. 0,1,2 o -] [mapa, p. ej. hotel]
// La meta de diseño es 45-55 % por bando (RESUMEN-DEL-JUEGO.md).
import { Simulation } from '../src/sim/Simulation.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';

export function playRound(seed, opts = {}, map = DEFAULT_MAP) {
  const sim = new Simulation(MAPS[map], { seed, controllers: { attackers: 'ai', defenders: 'ai' }, ...opts });
  for (let guard = 0; sim.phase !== 'end' && guard < 40000; guard++) {
    if (sim.phase === 'buy' || sim.phase === 'prep' || sim.phase === 'plan') sim.advancePhase();
    else sim.step();
    sim.drainEvents();
  }
  return sim;
}

/** {rounds, attackers, bySite: {A: [wins, n]}, reasons: {winner/reason: n}} */
export function measure(n, opts = {}, map = DEFAULT_MAP) {
  const r = { rounds: n, attackers: 0, bySite: {}, reasons: {} };
  for (let seed = 1; seed <= n; seed++) {
    const sim = playRound(seed, opts, map);
    const o = sim.outcome || { winner: 'none', reason: 'stuck' };
    if (o.winner === 'attackers') r.attackers++;
    const s = (r.bySite[sim.site.id] ||= [0, 0]);
    if (o.winner === 'attackers') s[0]++;
    s[1]++;
    const k = `${o.winner}/${o.reason}`;
    r.reasons[k] = (r.reasons[k] || 0) + 1;
  }
  return r;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] || 200);
  const opts = process.argv[3] && process.argv[3] !== '-' ? { defenders: process.argv[3].split(',').map(Number) } : {};
  const map = process.argv[4] || DEFAULT_MAP;
  if (!MAPS[map]) throw new Error(`Mapa desconocido: ${map} (hay: ${Object.keys(MAPS).join(', ')})`);
  const r = measure(n, opts, map);
  console.log(MAPS[map].name);
  const pct = (a, b) => `${((100 * a) / b).toFixed(0)} %`;
  console.log(`Atacantes ganan ${r.attackers}/${n} (${pct(r.attackers, n)})`);
  for (const [site, [w, t]] of Object.entries(r.bySite)) console.log(`  sitio ${site}: ${w}/${t} (${pct(w, t)})`);
  for (const [k, v] of Object.entries(r.reasons).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
}
