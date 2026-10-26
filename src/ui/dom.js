// Minimal DOM helpers for the HUD components. Components update every
// frame, so every setter writes to the DOM only when the value changed:
// an unchanged HUD costs zero style recalculation / layout.

export function el(tag, className = '', html = '') {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html) e.innerHTML = html;
  return e;
}

/** Sets textContent only when it changed (avoids layout churn every frame). */
export function setText(node, text) {
  const s = String(text);
  if (node.textContent !== s) node.textContent = s;
}

export function toggle(node, cls, on) {
  if (node.classList.contains(cls) !== !!on) node.classList.toggle(cls, !!on);
}

/** Last value written per node and style property (avoids reading styles back). */
const styleCache = new WeakMap();

/** Sets node.style[prop] only when it changed since the last setStyle call. */
export function setStyle(node, prop, value) {
  let cache = styleCache.get(node);
  if (!cache) styleCache.set(node, (cache = {}));
  if (cache[prop] === value) return;
  cache[prop] = value;
  node.style[prop] = value;
}

export function setClassName(node, className) {
  if (node.className !== className) node.className = className;
}

export function setHidden(node, hidden) {
  if (node.hidden !== hidden) node.hidden = hidden;
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
