// Inline SVG icons (original artwork): weapon silhouettes for the HUD and
// small glyphs. All white fills; color via CSS `color` where noted.

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = (viewBox, body, cls = '') => `<svg class="${cls}" viewBox="${viewBox}" xmlns="${SVG_NS}" aria-hidden="true">${body}</svg>`;

/** HUD weapon silhouettes keyed by weapon id (config/weapons.js). */
export const WEAPON_ICONS = {
  rifle: svg(
    '0 0 220 64',
    `<path fill="currentColor" d="M4 24 L44 19 L48 16 L132 16 L134 12 L160 12 L162 16 L206 16 L206 19 L214 19 L214 23 L206 23 L206 25
     L160 25 L156 29 L134 29 L128 31 L120 33 L112 58 L98 55 L106 31 L90 30 L84 38 L74 38 L76 30 L52 30 L16 44 L6 42 Z"/>
     <rect x="58" y="19" width="66" height="3" fill="#000" opacity=".35"/>`,
  ),
  smg: svg(
    '0 0 220 64',
    `<path fill="currentColor" d="M16 22 L40 20 L44 15 L140 15 L140 19 L176 19 L176 24 L140 24 L136 29 L118 29 L112 58 L100 58 L104 29
     L86 29 L80 40 L70 40 L72 29 L52 29 L28 36 L16 34 Z"/>`,
  ),
  pistol: svg(
    '0 0 220 64',
    `<path fill="currentColor" d="M50 14 L150 14 L152 18 L150 28 L96 28 L92 34 L84 58 L62 58 L70 32 L56 28 Z"/>
     <rect x="62" y="18" width="80" height="3" fill="#000" opacity=".3"/>`,
  ),
  dmr: svg(
    '0 0 220 64',
    `<path fill="currentColor" d="M4 25 L42 19 L48 16 L136 16 L138 13 L150 13 L152 16 L210 16 L210 22 L152 22 L148 28 L132 28 L126 31 L118 31
     L112 50 L100 48 L106 30 L88 29 L82 36 L74 36 L76 29 L52 29 L16 43 L6 41 Z"/>
     <rect x="70" y="5" width="46" height="8" rx="3" fill="currentColor"/><rect x="88" y="12" width="6" height="5" fill="currentColor"/>`,
  ),
  shotgun: svg(
    '0 0 220 64',
    `<path fill="currentColor" d="M6 26 L44 19 L50 16 L120 16 L120 14 L208 14 L208 20 L120 20 L120 22 L108 22 L102 28 L88 28 L82 34 L74 34
     L76 28 L54 28 L18 44 L8 42 Z"/><rect x="124" y="22" width="56" height="9" rx="2" fill="currentColor"/>`,
  ),
  sniper: svg(
    '0 0 220 64',
    `<path fill="currentColor" d="M2 26 L40 20 L46 18 L140 18 L140 21 L216 21 L216 25 L140 25 L136 30 L104 30 L98 44 L88 44 L92 30 L52
     32 L14 44 L4 42 Z"/>
     <rect x="70" y="6" width="54" height="9" rx="3" fill="currentColor"/><rect x="88" y="14" width="6" height="5" fill="currentColor"/>`,
  ),
};

export const ICON = {
  squad: svg(
    '0 0 24 24',
    `<circle cx="6" cy="8" r="2.6" fill="currentColor"/><circle cx="12" cy="8" r="2.6" fill="currentColor" opacity=".75"/><circle cx="18" cy="8" r="2.6" fill="currentColor" opacity=".5"/>
     <path d="M3 16 H19 M15 12.5 L19.5 16 L15 19.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  bullets: svg(
    '0 0 40 40',
    `<g fill="currentColor" transform="rotate(-25 20 20)"><rect x="8" y="10" width="6" height="22" rx="1"/>
     <path d="M8 10 L11 3 L14 10Z"/><rect x="17" y="10" width="6" height="22" rx="1"/><path d="M17 10 L20 3 L23 10Z"/>
     <rect x="26" y="10" width="6" height="22" rx="1"/><path d="M26 10 L29 3 L32 10Z"/></g>`,
  ),
  grenade: svg(
    '0 0 40 40',
    `<g fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="19" cy="23" r="12"/>
     <path d="M9 19h20M8 26h22M15 12c-2 6-2 16 0 22M23 12c2 6 2 16 0 22"/><path d="M22 10 l4-5 l8 3" stroke-linecap="round"/></g>
     <rect x="15" y="8" width="9" height="5" fill="currentColor"/>`,
  ),
  bomb: svg(
    '0 0 24 24',
    `<rect x="3" y="7" width="18" height="11" rx="2" fill="currentColor"/><rect x="7" y="7" width="3" height="11" fill="#c9a227"/>
     <rect x="14" y="7" width="3" height="11" fill="#c9a227"/><circle cx="18" cy="5" r="2" fill="#ff3020"/>`,
  ),
  pause: svg(
    '0 0 40 40',
    `<rect x="9" y="6" width="8" height="28" rx="1.5" fill="currentColor"/>
     <rect x="23" y="6" width="8" height="28" rx="1.5" fill="currentColor"/>`,
  ),
  play: svg('0 0 40 40', `<path d="M11 6 L33 20 L11 34 Z" fill="currentColor"/>`),
  skull: svg(
    '0 0 24 24',
    `<path fill="currentColor" d="M12 2C6.5 2 3 5.8 3 10.5c0 2.8 1.3 4.7 3 5.9V20h3v-2h2v2h2v-2h2v2h3v-3.6c1.7-1.2 3-3.1 3-5.9C21 5.8
     17.5 2 12 2zm-3.5 11a2 2 0 110-4 2 2 0 010 4zm7 0a2 2 0 110-4 2 2 0 010 4z"/>`,
  ),
  helmet: svg(
    '0 0 40 40',
    `<circle cx="20" cy="20" r="13" fill="currentColor"/><path d="M8 20 h24" stroke="rgba(0,0,0,.35)" stroke-width="3"/>
     <circle cx="20" cy="20" r="5" fill="rgba(0,0,0,.25)"/>`,
  ),
  undo: svg(
    '0 0 24 24',
    `<path d="M9 7 L4 12 L9 17" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
     <path d="M4.5 12 H14 a5 5 0 0 1 0 10 H11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`,
  ),
  trash: svg(
    '0 0 24 24',
    `<path d="M5 7 H19 M10 7 V4 H14 V7 M7 7 L8 20 H16 L17 7" fill="none" stroke="currentColor" stroke-width="2.4"
     stroke-linejoin="round"/>`,
  ),
  hold: svg(
    '0 0 24 24',
    `<path d="M12 2 L22 12 L12 22 L2 12 Z" fill="currentColor"/><rect x="9" y="8" width="2.2" height="8" fill="#111"/>
     <rect x="12.8" y="8" width="2.2" height="8" fill="#111"/>`,
  ),
  restart: svg(
    '0 0 24 24',
    `<path d="M20 12 a8 8 0 1 1 -2.4 -5.7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
     <path d="M18.5 2.5 V7.2 H13.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"
     stroke-linejoin="round"/>`,
  ),
  fullscreen: svg(
    '0 0 24 24',
    `<path d="M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15" fill="none" stroke="currentColor" stroke-width="2.6"
     stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  // "See all": a folded map (the whole plan), clearly not the fullscreen corners.
  overview: svg(
    '0 0 24 24',
    `<path d="M3 6.5 L9 4 L15 6.5 L21 4 V17.5 L15 20 L9 17.5 L3 20 Z" fill="none" stroke="currentColor" stroke-width="2.2"
     stroke-linejoin="round"/><path d="M9 4 V17.5 M15 6.5 V20" stroke="currentColor" stroke-width="2"/>`,
  ),
  // Defender cameras: a security camera on its wall arm (body tilted down, lens on the left, hood over it).
  camera: svg(
    '0 0 24 24',
    `<path d="M21.5 4 V14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
     <path d="M21.5 9 H17.5 L15.6 11.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
     <path d="M4.6 7.4 L16.2 4.3 a1.3 1.3 0 0 1 1.6 .9 L19 9.6 a1.3 1.3 0 0 1 -.9 1.6 L7.3 14 Z" fill="currentColor"/>
     <path d="M2.2 7.2 L8.6 5.5 L9.1 7.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
     <circle cx="6" cy="10.8" r="2.6" fill="currentColor"/><circle cx="6" cy="10.8" r="1.25" fill="#000" opacity=".55"/>
     <path d="M3 17 L5.5 14.6 M5.6 19 L7.4 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>`,
  ),
  music: svg(
    '0 0 24 24',
    `<path d="M9 18 V5 L20 3 V16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
     <circle cx="6.5" cy="18" r="2.7" fill="currentColor"/><circle cx="17.5" cy="16" r="2.7" fill="currentColor"/>`,
  ),
  help: svg(
    '0 0 24 24',
    `<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.2"/>
     <path d="M9.2 9.3 a2.9 2.9 0 1 1 4.1 2.6 c-.9.4-1.3 1-1.3 2" fill="none" stroke="currentColor" stroke-width="2.2"
     stroke-linecap="round"/>
     <circle cx="12" cy="17.4" r="1.3" fill="currentColor"/>`,
  ),
  phone: svg(
    '0 0 64 64',
    `<rect x="20" y="6" width="24" height="52" rx="5" fill="none" stroke="currentColor" stroke-width="3.5"/>
     <circle cx="32" cy="51" r="2.5" fill="currentColor"/>`,
  ),
  headshot: svg(
    '0 0 24 24',
    `<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.4"/>
     <circle cx="12" cy="12" r="2.4" fill="currentColor"/>`,
  ),
};

/** Door entry modes (ui/EntryPicker.js), 'none' = just open the door. currentColor fills. */
export const ENTRY_ICON = {
  none: svg(
    '0 0 24 24',
    `<path d="M5 21 V3 H15 V21" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
     <path d="M15 3 L19 5 V21 L15 21" fill="currentColor" opacity=".55"/><circle cx="12.5" cy="12" r="1.3" fill="currentColor"/>`,
  ),
  kick: svg(
    '0 0 24 24',
    `<path fill="currentColor" d="M6 2 H11 V11 L19 13.5 C21 14 22 15.5 22 17 V19 H5 Z"/><rect x="5" y="20" width="17" height="2" fill="currentColor"/>
     <path d="M1.5 9 L4 10 M1 13 L3.8 13.3 M1.5 17 L4 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  ),
  slow: svg(
    '0 0 24 24',
    `<path d="M4 21 V3 H12" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 3 L16 6 V20 L12 21 Z" fill="currentColor"/>
     <path d="M17 12 C18.5 9.6 20.5 9.6 22 12 C20.5 14.4 18.5 14.4 17 12 Z" fill="none" stroke="currentColor" stroke-width="1.6"/>
     <circle cx="19.5" cy="12" r="1" fill="currentColor"/>`,
  ),
  flash: svg(
    '0 0 24 24',
    `<path fill="currentColor" d="M12 1 L13.8 8.2 L20.5 4.5 L16.6 10.9 L23 12 L16.6 13.1 L20.5 19.5 L13.8 15.8 L12 23 L10.2 15.8
     L3.5 19.5 L7.4 13.1 L1 12 L7.4 10.9 L3.5 4.5 L10.2 8.2 Z"/><circle cx="12" cy="12" r="3" fill="#111"/>`,
  ),
  frag: svg(
    '0 0 24 24',
    `<circle cx="11" cy="14" r="7.5" fill="currentColor"/><path d="M5 12h12M5 16h12M9 7c-1 4-1 10 0 14M13 7c1 4 1 10 0 14" stroke="#111"
     stroke-width="1.2" fill="none"/><rect x="8.5" y="4" width="5" height="3.2" fill="currentColor"/><path d="M13 5 L17 2.5 L21 4" fill="none"
     stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  ),
  breach: svg(
    '0 0 24 24',
    `<rect x="3" y="8" width="18" height="10" rx="1.5" fill="currentColor"/><rect x="6" y="11" width="5" height="4" fill="#111"/>
     <circle cx="16.5" cy="13" r="1.6" fill="#ff3020"/><path d="M12 8 C12 5 14 4 16 3.5" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  ),
  // Cámara de fibra óptica: a door, and the cable snaking under it to a lens
  cam: svg(
    '0 0 24 24',
    `<path d="M3 20 V3 H11 V20" fill="none" stroke="currentColor" stroke-width="2"/><path d="M1 22 H23" stroke="currentColor" stroke-width="1.6"/>
     <path d="M6 15 C6 19 9 20.5 13 20.5 H18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
     <circle cx="20" cy="19" r="2.6" fill="currentColor"/><circle cx="20" cy="19" r="1" fill="#111"/>`,
  ),
};

export const CURSOR_SVG = svg(
  '0 0 48 48',
  `<circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" stroke-width="3.2" stroke-dasharray="17 3.4" />
   <circle cx="24" cy="24" r="3.2" fill="currentColor"/>
   <circle cx="24" cy="24" r="17.5" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1.2"/>`,
);

// Roster emblems (ui/Roster.js): one symbol per character, so each reads apart at a glance.
const ring = (n, r0, r1, w) =>
  Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    const p = (r, d) => `${(24 + Math.cos(a + d) * r).toFixed(1)} ${(24 + Math.sin(a + d) * r).toFixed(1)}`;
    return `M${p(r0, -w)} L${p(r1, 0)} L${p(r0, w)}Z`;
  }).join(' ');
const burst = Array.from({ length: 16 }, (_, k) => {
  const a = (k / 16) * Math.PI * 2 - Math.PI / 2;
  const r = k % 2 ? 9 : 21;
  return `${(24 + Math.cos(a) * r).toFixed(1)} ${(24 + Math.sin(a) * r).toFixed(1)}`;
}).join(' L');

export const ROLE_EMBLEM = {
  // Asaltante: a spearhead of two chevrons
  assault: svg('0 0 48 48', `<g fill="currentColor"><path d="M24 4 L42 22 L33 22 L24 13 L15 22 L6 22 Z"/><path d="M24 21 L42 39 L33 39 L24 30 L15 39 L6 39 Z" opacity=".65"/></g>`),
  // Brecha: a blast
  entry: svg('0 0 48 48', `<path fill="currentColor" d="M${burst}Z"/><circle cx="24" cy="24" r="5" fill="#0a0c0e"/>`),
  // Explorador: a radar sweep
  scout: svg(
    '0 0 48 48',
    `<g fill="none" stroke="currentColor" stroke-width="3"><circle cx="24" cy="24" r="19" opacity=".45"/><circle cx="24" cy="24" r="11"/></g>
     <path d="M24 24 L24 5 A19 19 0 0 1 41 15.5 Z" fill="currentColor" opacity=".5"/><circle cx="24" cy="24" r="3.5" fill="currentColor"/><circle cx="33" cy="12" r="2.6" fill="currentColor"/>`,
  ),
  // Defensor: a battlemented shield
  defender: svg('0 0 48 48', `<path fill="currentColor" d="M8 6 H15 V12 H20.5 V6 H27.5 V12 H33 V6 H40 V22 C40 32 33 39 24 44 C15 39 8 32 8 22 Z"/><path d="M24 17 V36 M16 24 H32" stroke="#0a0c0e" stroke-width="3"/>`),
  // Ancla: an anchor
  anchor: svg(
    '0 0 48 48',
    `<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><circle cx="24" cy="9" r="4.5"/><path d="M24 14 V42 M15 20 H33"/>
     <path d="M8 29 C9 37 16 42 24 42 C32 42 39 37 40 29"/></g><path fill="currentColor" d="M3 31 L8 22 L13 31 Z M35 31 L40 22 L45 31 Z"/>`,
  ),
  // Merodeador: a paw print
  roamer: svg(
    '0 0 48 48',
    `<g fill="currentColor"><path d="M24 24 C31 24 37 31 37 36 C37 41 32 42 28 41 C26 40.5 22 40.5 20 41 C16 42 11 41 11 36 C11 31 17 24 24 24 Z"/>
     <ellipse cx="9.5" cy="20" rx="4.2" ry="5.5" transform="rotate(-25 9.5 20)"/><ellipse cx="18" cy="10.5" rx="4.4" ry="6"/>
     <ellipse cx="30" cy="10.5" rx="4.4" ry="6"/><ellipse cx="38.5" cy="20" rx="4.2" ry="5.5" transform="rotate(25 38.5 20)"/></g>`,
  ),
  // Trampero: the jaws of a trap
  trapper: svg('0 0 48 48', `<circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" stroke-width="4"/><path fill="currentColor" d="${ring(12, 18, 9, 0.2)}"/><circle cx="24" cy="24" r="3" fill="currentColor"/>`),
  // Escudo, Tirador, Granadero, Vigía
  shield: svg('0 0 48 48', `<path fill="currentColor" d="M10 5 H38 V30 C38 37 31 42 24 44 C17 42 10 37 10 30 Z"/><rect x="15" y="12" width="18" height="4.5" rx="1.5" fill="#0a0c0e"/>`),
  marksman: svg(
    '0 0 48 48',
    `<g fill="none" stroke="currentColor" stroke-width="3.2"><circle cx="24" cy="24" r="16"/><path d="M24 2 V15 M24 33 V46 M2 24 H15 M33 24 H46"/></g><circle cx="24" cy="24" r="3" fill="currentColor"/>`,
  ),
  grenadier: svg(
    '0 0 48 48',
    `<circle cx="22" cy="29" r="14" fill="currentColor"/><path d="M10 25h24M10 33h24M18 16c-2 8-2 18 0 26M26 16c2 8 2 18 0 26" stroke="#0a0c0e" stroke-width="2" fill="none"/>
     <rect x="17" y="9" width="10" height="6" fill="currentColor"/><path d="M26 11 L34 5 L42 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  ),
  lookout: svg(
    '0 0 48 48',
    `<path d="M3 24 C10 12 17 9 24 9 C31 9 38 12 45 24 C38 36 31 39 24 39 C17 39 10 36 3 24 Z" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="24" cy="24" r="8" fill="currentColor"/><circle cx="24" cy="24" r="3" fill="#0a0c0e"/>`,
  ),
};
// Escopetero: three buckshot pellets spreading from a muzzle
ROLE_EMBLEM.shotgunner = svg('0 0 48 48', `<rect x="3" y="20" width="16" height="8" rx="2" fill="currentColor"/><g fill="currentColor"><circle cx="30" cy="24" r="4.5"/><circle cx="38" cy="13" r="4.5" opacity=".75"/><circle cx="38" cy="35" r="4.5" opacity=".75"/><circle cx="44" cy="24" r="3" opacity=".5"/></g>`);
ROLE_EMBLEM.sniper = ROLE_EMBLEM.marksman; // the defending Tirador: the same crosshair

/** Utility in a class's kit (the roster's detail). */
export const GEAR_ICON = {
  flash: ENTRY_ICON.flash,
  frag: ENTRY_ICON.frag,
  breach: ENTRY_ICON.breach,
  smoke: svg('0 0 24 24', `<g fill="currentColor"><circle cx="8" cy="15" r="5"/><circle cx="15" cy="13" r="6"/><circle cx="11" cy="8" r="4.5" opacity=".7"/><rect x="4" y="18" width="16" height="3" rx="1.5"/></g>`),
  // Gas lacrimógeno: a 40 mm round trailing its cloud
  gas: svg('0 0 24 24', `<rect x="3" y="13" width="9" height="7" rx="1.5" fill="currentColor"/><rect x="12" y="14" width="3" height="5" fill="currentColor" opacity=".7"/>
     <g fill="currentColor" opacity=".55"><circle cx="16" cy="8" r="3.4"/><circle cx="20.5" cy="6" r="2.6"/><circle cx="12" cy="6" r="2.2"/></g>`),
  molotov: svg('0 0 24 24', `<path fill="currentColor" d="M10 2 H14 V7 C17 8.5 18 11 18 13 V21 C18 22 17 23 16 23 H8 C7 23 6 22 6 21 V13 C6 11 7 8.5 10 7 Z"/><path d="M12 0.5 C13.5 2 13 3 12 4 C11 3 10.5 2 12 0.5Z" fill="#ff7a1a"/>`),
};
