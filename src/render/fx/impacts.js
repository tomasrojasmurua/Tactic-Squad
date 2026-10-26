// Bullet impacts on walls, doors and furniture (render/fx). Cosmetic
// randomness only (Math.random), never read by the simulation.
import { FX } from '../../config/render.js';
import { SURFACE_FX } from '../../config/materials.js';
import { SHAPE } from './Particles.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/**
 * Surface-aware impact burst at height z (EV.SHOT.material / impactZ):
 * sparks (+ a flicker of light), dust puffs and chips that stay on the floor.
 * @param {{particles, addLight: Function}} fx the FxDirector
 */
export function spawnImpact(fx, x, y, ang, surface, z) {
  const P = fx.particles;
  const S = SURFACE_FX[surface] || SURFACE_FX.plaster;
  const back = ang + Math.PI;
  for (let i = 0; i < S.sparks; i++) {
    const a = back + rand(-1.2, 1.2);
    const v = rand(3, 8);
    P.spawn({
      x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 6, size: [rand(0.07, 0.13), 0.013], rot: a,
      color: [1, 0.85, 0.45, 1], life: rand(0.08, 0.18), shape: SHAPE.streak, additive: true,
    });
  }
  if (S.sparks > 3) fx.addLight(x, y, 1.6, 0.6, FX.muzzleLight.color, 0.05);
  for (let i = 0; i < S.puffs; i++) {
    const a = back + rand(-0.7, 0.7);
    P.spawn({
      x: x + Math.cos(back) * 0.08, y: y + Math.sin(back) * 0.08, z, vx: Math.cos(a) * rand(0.4, 1.1),
      vy: Math.sin(a) * rand(0.4, 1.1), drag: 2.4, size: [0.08, 0.08], grow: rand(0.4, 0.8), rot: rand(0, 6),
      color: [...S.dust, 0.5], life: rand(0.5, 0.9), shape: SHAPE.puff,
    });
  }
  for (let i = 0; i < S.chips; i++) {
    const a = back + rand(-1, 1);
    const sz = rand(0.02, 0.04);
    P.spawn({
      x, y, z, vx: Math.cos(a) * rand(0.8, 2.4), vy: Math.sin(a) * rand(0.8, 2.4), vz: rand(0, 1.6), gravity: 1, bounce: 0.25,
      size: [sz * S.chipStretch, sz], rot: rand(0, 6), spin: rand(-12, 12), color: [...pick(S.chipColors), 1],
      life: FX.debrisLife, fade: false, fadeOutLast: 1.5, shape: SHAPE.rect,
    });
  }
}
