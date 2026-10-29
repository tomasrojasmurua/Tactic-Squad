// The map's card before a game (lobby and class pick): a floor plan drawn
// from the map's data (floors, tall furniture, walls with their doorways, windows, the two
// sites and the attackers' entries) and its reading in words: the map's
// `traits`, or a site's `siteTraits` while that site is tapped on the plan.
// It names no class: reading the map is the player's job.
// "Al azar" shows a card that says the map is drawn on the way to the classes.
import { compileMap } from '../sim/mapCompiler.js';
import { FLOORS } from '../config/materials.js';
import { MAPS } from '../data/maps/index.js';
import { el, setText, toggle } from './dom.js';
import { T } from './texts.js';

const C = Object.freeze({
  ground: '#0b0d10',
  wall: '#d9dee2',
  fence: '#6d7378',
  window: '#7fc6e6',
  door: '#c98a3a',
  site: '#f2c230',
  siteFill: 'rgba(242, 194, 48, 0.16)',
  siteOn: 'rgba(242, 194, 48, 0.38)',
  entry: '#2fd7ff',
  cover: '#7b838a', // furniture that blocks sight (containers, shelves, wardrobes)
});

const compiled = new Map(); // map id -> compiled map (the plan is drawn from it)
const compiledOf = (id) => compiled.get(id) || compiled.set(id, compileMap(MAPS[id])).get(id);

export class MapPreview {
  constructor() {
    const P = T.flow.mapCard;
    this.root = el('div', 'map-card', `<canvas class="mc-plan"></canvas><div class="mc-text"><div class="mc-name"></div><div class="mc-sub"></div><ul class="mc-traits"></ul><div class="mc-hint">${P.hint}</div></div>`);
    this.canvas = this.root.querySelector('canvas');
    this.name = this.root.querySelector('.mc-name');
    this.sub = this.root.querySelector('.mc-sub');
    this.list = this.root.querySelector('.mc-traits');
    this.hint = this.root.querySelector('.mc-hint');
    this.mapId = null;
    this.random = false;
    this.site = null; // the site tapped on the plan, or null
    this.drawn = ''; // what the canvas shows now (redrawn only when it changes)
    this.canvas.addEventListener('click', (e) => this.tap(e));
  }

  /** Shows `mapId` ('random' = the map is still to be drawn). */
  show(mapId) {
    const random = mapId === 'random' || !MAPS[mapId];
    if (mapId !== this.mapId) this.site = null;
    this.mapId = mapId;
    this.random = random;
    const P = T.flow.mapCard;
    toggle(this.root, 'random', random);
    if (random) {
      setText(this.name, P.randomName);
      setText(this.sub, P.randomSub);
      this.setTraits(Object.values(MAPS).map((m) => m.name));
    } else {
      const def = MAPS[mapId];
      const site = this.site && def.siteTraits?.[this.site];
      setText(this.name, def.name);
      setText(this.sub, site ? P.site(this.site, def.siteNames?.[this.site]) : P.reading);
      this.setTraits(site || def.traits || []);
    }
    this.hint.hidden = random;
    this.draw();
  }

  setTraits(lines) {
    const key = lines.join('|');
    if (this.list.dataset.key === key) return;
    this.list.dataset.key = key;
    this.list.innerHTML = '';
    for (const t of lines) {
      const li = el('li');
      setText(li, t);
      this.list.appendChild(li);
    }
  }

  /** Tapping a site on the plan shows its reading; tapping elsewhere goes back to the map's. */
  tap(e) {
    if (this.random || !this.view) return;
    const r = this.canvas.getBoundingClientRect();
    const v = this.view;
    const x = ((e.clientX - r.left) * v.dpr - v.ox) / v.k;
    const y = ((e.clientY - r.top) * v.dpr - v.oy) / v.k;
    const hit = compiledOf(this.mapId).sites.find((s) => x >= s.rect[0] - 1 && x <= s.rect[0] + s.rect[2] + 1 && y >= s.rect[1] - 1 && y <= s.rect[1] + s.rect[3] + 1);
    this.site = hit && hit.id !== this.site ? hit.id : null;
    this.show(this.mapId);
  }

  draw() {
    const cv = this.canvas;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (!w || !h) return; // hidden: drawn when shown again
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const key = `${this.mapId}|${this.site}|${w}x${h}@${dpr}`;
    if (key === this.drawn) return;
    this.drawn = key;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d');
    g.fillStyle = C.ground;
    g.fillRect(0, 0, cv.width, cv.height);
    if (this.random) return this.drawRandom(g, cv);
    const m = compiledOf(this.mapId);
    const pad = 6 * dpr;
    const k = Math.min((cv.width - 2 * pad) / m.width, (cv.height - 2 * pad) / m.height);
    const ox = (cv.width - m.width * k) / 2;
    const oy = (cv.height - m.height * k) / 2;
    this.view = { k, ox, oy, dpr };
    const R = (x, y, rw, rh) => [ox + x * k, oy + y * k, rw * k, rh * k];

    for (const f of m.floors) {
      g.fillStyle = shade(FLOORS[f.material]?.a || '#555', 0.42);
      g.fillRect(...R(...f.rect));
    }
    for (const s of m.sites) {
      g.fillStyle = s.id === this.site ? C.siteOn : C.siteFill;
      g.fillRect(...R(...s.rect));
      g.setLineDash([3 * dpr, 2 * dpr]);
      g.strokeStyle = C.site;
      g.lineWidth = 1 * dpr;
      g.strokeRect(...R(...s.rect));
      g.setLineDash([]);
      g.fillStyle = C.site;
      g.font = `800 ${Math.round(Math.min(s.rect[2], s.rect[3]) * k * 0.55)}px 'Barlow Condensed', sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(s.id, ox + (s.rect[0] + s.rect[2] / 2) * k, oy + (s.rect[1] + s.rect[3] / 2) * k);
    }
    g.fillStyle = C.cover;
    for (const p of m.props) {
      if (!p.blocksVision) continue;
      const b = p.box;
      g.fillRect(...R(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY));
    }
    for (const wl of m.walls) {
      const b = wl.box;
      g.fillStyle = wl.kind === 'fence' ? C.fence : C.wall;
      g.fillRect(...R(b.minX, b.minY, Math.max(b.maxX - b.minX, 0.25), Math.max(b.maxY - b.minY, 0.25)));
    }
    for (const wn of m.windows) {
      const b = wn.box;
      g.fillStyle = C.window;
      g.fillRect(...R(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY));
    }
    for (const d of m.doors) {
      const b = d.closedBox;
      g.fillStyle = C.door;
      g.fillRect(...R(b.minX - 0.06, b.minY - 0.06, b.maxX - b.minX + 0.12, b.maxY - b.minY + 0.12));
    }
    // Entries: an arrow from where the squad starts to its door.
    g.strokeStyle = C.entry;
    g.fillStyle = C.entry;
    g.lineWidth = 1.6 * dpr;
    for (const e of m.entries) {
      const door = m.doors.find((d) => d.id === e.door);
      const [sx, sy] = e.spawns[0].at;
      const ax = ox + (sx - 1.6) * k;
      const ay = oy + sy * k;
      const bx = ox + (door.cx - 0.5) * k;
      const by = oy + door.cy * k;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.stroke();
      const a = Math.atan2(by - ay, bx - ax);
      const s = 5 * dpr;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx - s * Math.cos(a - 0.5), by - s * Math.sin(a - 0.5));
      g.lineTo(bx - s * Math.cos(a + 0.5), by - s * Math.sin(a + 0.5));
      g.closePath();
      g.fill();
    }
  }

  drawRandom(g, cv) {
    this.view = null;
    g.fillStyle = 'rgba(242, 194, 48, 0.85)';
    g.font = `800 ${Math.round(cv.height * 0.55)}px 'Barlow Condensed', sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', cv.width / 2, cv.height / 2);
  }
}

/** A floor color dimmed toward black (the plan reads as a plan, not as the game). */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.round(v * f);
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}
