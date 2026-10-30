// Deterministic math for the simulation. Math.sin / cos / atan2 / hypot are
// not required to give the same bits on every engine (V8 on Android, JavaScriptCore
// on iOS round them differently), and a lockstep match needs every device
// to compute exactly the same round. These use only +, -, *, / and sqrt,
// which IEEE 754 rounds exactly (JS never fuses a multiply-add), so the result
// is the same everywhere. Ported from fdlibm (the kernels of sin, cos, atan):
// accurate to about 1 ulp, enough for a game.
//
// Every system in sim/ (and anything that feeds it) uses these, never Math.sin & co.

const PIO2_1 = 1.57079632673412561417e0; // first 33 bits of pi/2
const PIO2_1T = 6.07710050650619224932e-11; // pi/2 - PIO2_1
const PIO2_2 = 6.07710050630396597660e-11;
const PIO2_2T = 2.02226624879595063154e-21;
const INV_PIO2 = 6.36619772367581382433e-1; // 2/pi

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.08757232129817482790e-9;
const C6 = -1.13596475577881948265e-11;

/** sin on [-pi/4, pi/4], x = hi + lo. */
function kSin(x, y) {
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return x - (z * (0.5 * y - v * r) - y - v * S1);
}

/** cos on [-pi/4, pi/4], x = hi + lo. */
function kCos(x, y) {
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  const hz = 0.5 * z;
  const w = 1 - hz;
  return w + (1 - w - hz + (z * r - x * y));
}

// Range reduction: x = n * pi/2 + (hi + lo), |hi + lo| <= pi/4. Exact enough
// for the angles a game sees (|x| below ~1e5; beyond that the result is still
// deterministic, just less accurate).
let redHi = 0;
let redLo = 0;
function reduce(x) {
  const n = Math.round(x * INV_PIO2);
  const fn = n;
  let r = x - fn * PIO2_1;
  let w = fn * PIO2_1T;
  let hi = r - w;
  // A second step when the first cancelled many bits (x close to a multiple of pi/2).
  const t = r;
  w = fn * PIO2_2;
  r = t - w;
  w = fn * PIO2_2T - (t - r - w);
  hi = r - w;
  redHi = hi;
  redLo = r - hi - w;
  return n;
}

export function dsin(x) {
  if (!(x === x) || x === Infinity || x === -Infinity) return NaN;
  if (x > -0.7853981633974483 && x < 0.7853981633974483) return kSin(x, 0);
  const n = reduce(x) & 3;
  if (n === 0) return kSin(redHi, redLo);
  if (n === 1) return kCos(redHi, redLo);
  if (n === 2) return -kSin(redHi, redLo);
  return -kCos(redHi, redLo);
}

export function dcos(x) {
  if (!(x === x) || x === Infinity || x === -Infinity) return NaN;
  if (x > -0.7853981633974483 && x < 0.7853981633974483) return kCos(x, 0);
  const n = reduce(x) & 3;
  if (n === 0) return kCos(redHi, redLo);
  if (n === 1) return -kSin(redHi, redLo);
  if (n === 2) return -kCos(redHi, redLo);
  return kSin(redHi, redLo);
}

export const dtan = (x) => dsin(x) / dcos(x);

// atan (fdlibm s_atan.c)
const ATAN_HI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.57079632679489655800e0];
const ATAN_LO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.11111104054623557880e-1, 9.09088713343650656196e-2, -7.69187620504482999495e-2,
  6.66107313738753120669e-2, -5.83357013379057348645e-2, 4.97687799461593236017e-2, -3.65315727442169155270e-2, 1.62858201153657823623e-2,
];

export function datan(x) {
  if (!(x === x)) return NaN;
  const neg = x < 0;
  let ax = neg ? -x : x;
  if (ax >= 7.378697629483821e19) return neg ? -ATAN_HI[3] - ATAN_LO[3] : ATAN_HI[3] + ATAN_LO[3];
  let id;
  if (ax < 0.4375) {
    if (ax < 1e-29) return x;
    id = -1;
  } else if (ax < 1.1875) {
    if (ax < 0.6875) {
      id = 0;
      ax = (2 * ax - 1) / (2 + ax);
    } else {
      id = 1;
      ax = (ax - 1) / (ax + 1);
    }
  } else if (ax < 2.4375) {
    id = 2;
    ax = (ax - 1.5) / (1 + 1.5 * ax);
  } else {
    id = 3;
    ax = -1 / ax;
  }
  const z = ax * ax;
  const w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) {
    const r = ax - ax * (s1 + s2);
    return neg ? -r : r;
  }
  const r = ATAN_HI[id] - (ax * (s1 + s2) - ATAN_LO[id] - ax);
  return neg ? -r : r;
}

const PI = 3.141592653589793;
const PI_LO = 1.2246467991473532e-16;

/** atan2(y, x) with Math.atan2's quadrants and signed zeros. */
export function datan2(y, x) {
  if (!(x === x) || !(y === y)) return NaN;
  if (y === 0) {
    const negX = x < 0 || (x === 0 && 1 / x < 0);
    if (!negX) return y; // +-0
    return 1 / y < 0 ? -PI : PI;
  }
  if (x === 0) return y > 0 ? PI / 2 : -PI / 2;
  if (x === Infinity || x === -Infinity || y === Infinity || y === -Infinity) {
    if (y === Infinity || y === -Infinity) {
      const q = x === Infinity ? PI / 4 : x === -Infinity ? (3 * PI) / 4 : PI / 2;
      return y > 0 ? q : -q;
    }
    if (x === Infinity) return y > 0 ? 0 : -0;
    return y > 0 ? PI : -PI;
  }
  const z = datan(Math.abs(y / x));
  if (x > 0) return y > 0 ? z : -z;
  const r = PI - (z - PI_LO);
  return y > 0 ? r : -r;
}

/** sqrt(x² + y²) (sqrt is exact in IEEE; no care for overflow: game distances). */
export function dhypot(x, y) {
  return Math.sqrt(x * x + y * y);
}
export const sq = (x) => x * x;
