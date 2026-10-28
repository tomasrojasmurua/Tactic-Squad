// Mobile device helpers: fullscreen + landscape lock (where supported).
// Every API here is optional; failures are silent by design (iOS Safari has
// no orientation lock and only partial fullscreen support).

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export async function requestFullscreenLandscape() {
  const root = document.documentElement;
  try {
    if (!isFullscreen()) {
      if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
      else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
    }
  } catch {
    /* not allowed / not supported */
  }
  try {
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch {
    /* lock unsupported (iOS) or not in fullscreen */
  }
}

export async function toggleFullscreen() {
  if (isFullscreen()) {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch {
      /* ignore */
    }
    return;
  }
  await requestFullscreenLandscape();
}

export const fullscreenSupported = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);

/**
 * Keeps the page at zoom 1 on phones. iOS Safari ignores user-scalable=no in
 * the browser tab, so a pinch that lands on the HUD (or a double tap) zoomed
 * the whole page and cut off the screen until the phone was rotated. The game
 * reads its own pinch through pointer events on the canvas, which these
 * listeners leave alone: they only cancel the browser's page zoom.
 */
export function installZoomGuard() {
  const stop = (e) => e.preventDefault();
  // WebKit's page-zoom gesture events (iOS only).
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, stop, { passive: false });
  // Two-finger moves never scroll anything here, so they can only be a page zoom.
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  // Double-tap zoom is already off: every element has touch-action none.
  document.addEventListener('dblclick', stop, { passive: false });

  // If a zoom slips through anyway (accessibility zoom, an older iOS), snap it
  // back: rewriting the viewport meta makes Safari re-apply scale 1, the same
  // thing rotating the phone did.
  const vv = window.visualViewport;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!vv || !meta) return;
  const base = meta.getAttribute('content');
  let resetting = false;
  vv.addEventListener('resize', () => {
    if (resetting || vv.scale <= 1.01) return;
    resetting = true;
    meta.setAttribute('content', base + ', minimum-scale=1');
    requestAnimationFrame(() => {
      meta.setAttribute('content', base);
      window.scrollTo(0, 0);
      resetting = false;
    });
  });
}
