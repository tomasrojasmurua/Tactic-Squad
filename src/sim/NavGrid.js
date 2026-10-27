// Grid navigation for planned routes: A* (8-connected, no corner cutting)
// over a clearance-inflated occupancy grid, then string-pulled into a few
// straight segments. Closed doors are NOT obstacles (units open them).
import { pointAabbDistance } from '../core/geom.js';
import { NAV } from '../config/balance.js';

const SQRT2 = Math.SQRT2;

export class NavGrid {
  constructor(width, height, cellSize, blockers, clearance) {
    this.cell = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.width = width;
    this.height = height;
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.rasterize(blockers, clearance);

    const n = this.cols * this.rows;
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.state = new Uint8Array(n); // 0 = new, 1 = open, 2 = closed
    this.heap = new MinHeap(n);
  }

  rasterize(blockers, clearance) {
    const { cell, cols, rows } = this;
    // Map border
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const x = (ix + 0.5) * cell;
        const y = (iy + 0.5) * cell;
        if (x < clearance || y < clearance || x > this.width - clearance || y > this.height - clearance) {
          this.blocked[iy * cols + ix] = 1;
        }
      }
    }
    for (const b of blockers) {
      const x0 = Math.max(0, Math.floor((b.minX - clearance) / cell));
      const x1 = Math.min(cols - 1, Math.floor((b.maxX + clearance) / cell));
      const y0 = Math.max(0, Math.floor((b.minY - clearance) / cell));
      const y1 = Math.min(rows - 1, Math.floor((b.maxY + clearance) / cell));
      for (let iy = y0; iy <= y1; iy++) {
        for (let ix = x0; ix <= x1; ix++) {
          const d = pointAabbDistance((ix + 0.5) * cell, (iy + 0.5) * cell, b);
          if (d < clearance) this.blocked[iy * cols + ix] = 1;
        }
      }
    }
  }

  cellIndex(x, y) {
    const ix = Math.floor(x / this.cell);
    const iy = Math.floor(y / this.cell);
    if (ix < 0 || iy < 0 || ix >= this.cols || iy >= this.rows) return -1;
    return iy * this.cols + ix;
  }

  walkable(x, y) {
    const i = this.cellIndex(x, y);
    return i >= 0 && this.blocked[i] === 0;
  }

  /** Nearest walkable point within maxRadius (m), or null. */
  nearestWalkable(x, y, maxRadius) {
    if (this.walkable(x, y)) return { x, y };
    const { cell, cols, rows } = this;
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const maxR = Math.ceil(maxRadius / cell);
    let best = null;
    let bestD = Infinity;
    for (let r = 1; r <= maxR && !best; r++) {
      for (let iy = cy - r; iy <= cy + r; iy++) {
        for (let ix = cx - r; ix <= cx + r; ix++) {
          if (ix < 0 || iy < 0 || ix >= cols || iy >= rows) continue;
          if (Math.max(Math.abs(ix - cx), Math.abs(iy - cy)) !== r) continue;
          if (this.blocked[iy * cols + ix]) continue;
          const px = (ix + 0.5) * cell;
          const py = (iy + 0.5) * cell;
          const d = (px - x) ** 2 + (py - y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = { x: px, y: py };
          }
        }
      }
    }
    return best;
  }

  /** True if a straight walk a->b stays on walkable cells. */
  lineWalkable(ax, ay, bx, by) {
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(len / (this.cell * NAV.lineSampleFactor)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!this.walkable(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  }

  /**
   * Path from a to b as [{x, y}, ...] excluding the start, or null.
   * The final point is snapped onto walkable ground if needed.
   */
  findPath(ax, ay, bx, by, snapRadius) {
    const goal = this.nearestWalkable(bx, by, snapRadius);
    if (!goal) return null;
    const start = this.walkable(ax, ay) ? { x: ax, y: ay } : this.nearestWalkable(ax, ay, snapRadius * 2);
    if (!start) return null;
    if (this.lineWalkable(start.x, start.y, goal.x, goal.y)) {
      return start.x === ax && start.y === ay ? [goal] : [start, goal];
    }
    const cells = this.astar(this.cellIndex(start.x, start.y), this.cellIndex(goal.x, goal.y));
    if (!cells) return null;
    const pts = cells.map((i) => ({ x: ((i % this.cols) + 0.5) * this.cell, y: (Math.floor(i / this.cols) + 0.5) * this.cell }));
    pts[0] = { x: start.x, y: start.y };
    pts[pts.length - 1] = goal;
    const smooth = this.stringPull(pts);
    // Drop the start point unless we had to snap off an obstacle.
    if (start.x === ax && start.y === ay) smooth.shift();
    return smooth;
  }

  /** findPath with the cells under `boxes` ({minX, maxX, minY, maxY}, e.g. barricaded doors) blocked for this search only. */
  findPathAvoiding(ax, ay, bx, by, snapRadius, boxes) {
    if (!boxes.length) return this.findPath(ax, ay, bx, by, snapRadius);
    const { cell, cols, rows, blocked } = this;
    const saved = [];
    for (const b of boxes) {
      const x0 = Math.max(0, Math.floor(b.minX / cell) - 1);
      const x1 = Math.min(cols - 1, Math.floor(b.maxX / cell) + 1);
      const y0 = Math.max(0, Math.floor(b.minY / cell) - 1);
      const y1 = Math.min(rows - 1, Math.floor(b.maxY / cell) + 1);
      for (let iy = y0; iy <= y1; iy++) {
        for (let ix = x0; ix <= x1; ix++) {
          const i = iy * cols + ix;
          if (!blocked[i]) {
            blocked[i] = 1;
            saved.push(i);
          }
        }
      }
    }
    try {
      return this.findPath(ax, ay, bx, by, snapRadius);
    } finally {
      for (const i of saved) blocked[i] = 0;
    }
  }

  astar(startIdx, goalIdx) {
    if (startIdx < 0 || goalIdx < 0) return null;
    const { cols, blocked, g, came, state, heap } = this;
    state.fill(0);
    heap.clear();
    const gx = goalIdx % cols;
    const gy = Math.floor(goalIdx / cols);
    const h = (i) => {
      const dx = Math.abs((i % cols) - gx);
      const dy = Math.abs(Math.floor(i / cols) - gy);
      return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
    };
    g[startIdx] = 0;
    came[startIdx] = -1;
    state[startIdx] = 1;
    heap.push(startIdx, h(startIdx));
    while (heap.size) {
      const cur = heap.pop();
      if (state[cur] === 2) continue;
      if (cur === goalIdx) return this.reconstruct(cur);
      state[cur] = 2;
      const cx = cur % cols;
      const cy = Math.floor(cur / cols);
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= this.rows) continue;
          const ni = ny * cols + nx;
          if (blocked[ni] || state[ni] === 2) continue;
          if (ox && oy && (blocked[cy * cols + nx] || blocked[ny * cols + cx])) continue;
          const ng = g[cur] + (ox && oy ? SQRT2 : 1);
          if (state[ni] === 1 && ng >= g[ni]) continue;
          g[ni] = ng;
          came[ni] = cur;
          state[ni] = 1;
          heap.push(ni, ng + h(ni));
        }
      }
    }
    return null;
  }

  reconstruct(i) {
    const out = [];
    while (i !== -1) {
      out.push(i);
      i = this.came[i];
    }
    return out.reverse();
  }

  stringPull(pts) {
    const out = [pts[0]];
    let anchor = 0;
    while (anchor < pts.length - 1) {
      let next = anchor + 1;
      for (let j = pts.length - 1; j > anchor + 1; j--) {
        if (this.lineWalkable(pts[anchor].x, pts[anchor].y, pts[j].x, pts[j].y)) {
          next = j;
          break;
        }
      }
      out.push(pts[next]);
      anchor = next;
    }
    return out;
  }
}

/** Binary min-heap of (index, priority) with typed storage. */
class MinHeap {
  constructor(capacity) {
    this.items = new Int32Array(capacity * 4);
    this.prio = new Float32Array(capacity * 4);
    this.size = 0;
  }

  clear() {
    this.size = 0;
  }

  push(item, p) {
    if (this.size >= this.items.length) return;
    let i = this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent] <= p) break;
      this.items[i] = this.items[parent];
      this.prio[i] = this.prio[parent];
      i = parent;
    }
    this.items[i] = item;
    this.prio[i] = p;
  }

  pop() {
    const top = this.items[0];
    const lastItem = this.items[--this.size];
    const lastP = this.prio[this.size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.prio[c + 1] < this.prio[c]) c++;
      if (this.prio[c] >= lastP) break;
      this.items[i] = this.items[c];
      this.prio[i] = this.prio[c];
      i = c;
    }
    this.items[i] = lastItem;
    this.prio[i] = lastP;
    return top;
  }
}
