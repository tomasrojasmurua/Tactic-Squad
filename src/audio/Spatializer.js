// World point -> {pan, gain, distance, far} relative to the listener (the game
// camera: anything with x, y, height, width and worldToScreen()). Sounds pan
// with their screen position and fade with distance and zoom. The returned
// object is reused (copy what you need). `spatialize.listener` exposes the
// listener's ground position (ambience crossfades by it). Owner: audio.
import { clamp } from '../core/math.js';
import { MIX, SPATIAL } from '../config/audio.js';

export function createSpatializer(camera) {
  const out = { pan: 0, gain: 0, distance: 0, far: 0 };
  const spatialize = (x, y) => {
    const s = camera.worldToScreen(x, y, 0);
    out.pan = clamp((s.x / camera.width) * 2 - 1, -1, 1);
    out.distance = Math.hypot(x - camera.x, y - camera.y);
    out.far = clamp(out.distance / MIX.hearingDistance, 0, 1);
    const k = 1 - out.far;
    out.gain = k * k * (SPATIAL.zoomGainBase - camera.height / SPATIAL.zoomGainHeightDivisor);
    return out;
  };
  const listener = { x: 0, y: 0 };
  spatialize.listener = () => {
    listener.x = camera.x;
    listener.y = camera.y;
    return listener;
  };
  return spatialize;
}
