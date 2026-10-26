// Per-device preferences in localStorage. Every access is wrapped: private
// windows, blocked storage or previews throw or return nothing, and the game
// must behave exactly the same (defaults) without it.

/** Parsed JSON value under `key`, or `fallback`. */
export function loadPref(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Stores a JSON value; silently does nothing when storage is unavailable. */
export function savePref(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: the preference lasts for this session only
  }
}
