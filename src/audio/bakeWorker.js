// Module worker: bakes sound groups off the main thread, one group per task,
// and transfers each one back as soon as it is ready (audio/SoundBank.js).
// Messages in:
//   {type:'bake', rate, names}  queue groups; the queue stays in registry (= priority) order,
//                               so a round's lazy weapons slot in right after the interface and beds
//   {type:'rate', rate}                 native rate for the groups still to bake (device rate known)
// Messages out: {type:'group', name, sr, variations, ms}, {type:'idle'} when the queue empties.
// Owner: audio.
import { SoundBank } from './SoundBank.js';
import { SOUND_GROUPS } from './recipes/index.js';

const byName = new Map(SOUND_GROUPS.map((g) => [g.name, g]));
const priority = new Map(SOUND_GROUPS.map((g, i) => [g.name, i]));
const queue = [];
const baked = new Set();
let rate = 48000;
let scheduled = false;

function step() {
  scheduled = false;
  while (queue.length && baked.has(queue[0])) queue.shift();
  if (!queue.length) {
    self.postMessage({ type: 'idle' });
    return;
  }
  const name = queue.shift();
  baked.add(name);
  const t0 = performance.now();
  const { sr, variations } = SoundBank.renderGroup(byName.get(name), rate);
  self.postMessage({ type: 'group', name, sr, variations, ms: performance.now() - t0 }, variations.map((v) => v.buffer));
  schedule();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(step, 0); // yield between groups so priority requests are seen
}

self.onmessage = (e) => {
  const m = e.data;
  if (m.rate) rate = m.rate;
  if (m.type !== 'bake') return;
  for (const n of m.names) if (byName.has(n) && !baked.has(n) && !queue.includes(n)) queue.push(n);
  queue.sort((a, b) => priority.get(a) - priority.get(b));
  schedule();
};
