// Equilibrio IA contra IA: juega N rondas completas con semillas fijas (las
// dos IA deciden solas, nadie aprieta nada) y cuenta quién gana, por sitio y
// por motivo. Uso: node scripts/balance.mjs [N] [defensores, p. ej. 0,1,2 | ciegas | -] [mapa, p. ej. hotel]
// "ciegas": cada IA elige su escuadra como en una partida (session/Lobby.js aiRoles)
// y se cuenta también por clase.
// La meta de diseño es 45-55 % por bando (RESUMEN-DEL-JUEGO.md).
import { Simulation } from '../src/sim/Simulation.js';
import { MAPS, DEFAULT_MAP } from '../src/data/maps/index.js';
import { aiRoles } from '../src/session/Lobby.js';

export function playRound(seed, opts = {}, map = DEFAULT_MAP) {
  // squads: 'blind' = each AI picks its squad as in a game (session/Lobby.js aiRoles); else the defaults.
  const roles = opts.squads === 'blind' ? { roles: { attackers: aiRoles(seed, 'attackers'), defenders: aiRoles(seed, 'defenders') } } : {};
  const sim = new Simulation(MAPS[map], { seed, controllers: { attackers: 'ai', defenders: 'ai' }, ...roles, ...opts });
  for (let guard = 0; sim.phase !== 'end' && guard < 40000; guard++) {
    if (sim.phase === 'buy' || sim.phase === 'prep' || sim.phase === 'plan') sim.advancePhase();
    else sim.step();
    sim.drainEvents();
  }
  return sim;
}

/** {rounds, attackers, bySite: {A: [wins, n]}, reasons: {winner/reason: n}, byRole: {side:role: [attacker wins, n]}} */
export function measure(n, opts = {}, map = DEFAULT_MAP) {
  const r = { rounds: n, attackers: 0, bySite: {}, reasons: {}, byRole: {} };
  for (let seed = 1; seed <= n; seed++) {
    const sim = playRound(seed, opts, map);
    const o = sim.outcome || { winner: 'none', reason: 'stuck' };
    if (o.winner === 'attackers') r.attackers++;
    const s = (r.bySite[sim.site.id] ||= [0, 0]);
    if (o.winner === 'attackers') s[0]++;
    s[1]++;
    const k = `${o.winner}/${o.reason}`;
    r.reasons[k] = (r.reasons[k] || 0) + 1;
    for (const u of sim.units) {
      const b = (r.byRole[`${u.team === 'attackers' ? 'A' : 'D'}:${u.role}`] ||= [0, 0]);
      if (o.winner === 'attackers') b[0]++;
      b[1]++;
    }
  }
  return r;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] || 200);
  const arg = process.argv[3];
  const opts = arg === 'ciegas' ? { squads: 'blind' } : arg && arg !== '-' ? { defenders: arg.split(',').map(Number) } : {};
  const map = process.argv[4] || DEFAULT_MAP;
  if (!MAPS[map]) throw new Error(`Mapa desconocido: ${map} (hay: ${Object.keys(MAPS).join(', ')})`);
  const r = measure(n, opts, map);
  console.log(MAPS[map].name);
  const pct = (a, b) => `${((100 * a) / b).toFixed(0)} %`;
  console.log(`Atacantes ganan ${r.attackers}/${n} (${pct(r.attackers, n)})`);
  for (const [site, [w, t]] of Object.entries(r.bySite)) console.log(`  sitio ${site}: ${w}/${t} (${pct(w, t)})`);
  for (const [k, v] of Object.entries(r.reasons).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
  if (opts.squads) for (const [k, [w, t]] of Object.entries(r.byRole).sort()) console.log(`  ${k}: atacantes ganan ${pct(w, t)} (${t} operadores)`);
}
