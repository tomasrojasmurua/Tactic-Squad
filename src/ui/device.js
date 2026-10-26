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
