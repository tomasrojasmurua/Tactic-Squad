// Entry point: boots the Game, or shows a clear message if WebGL2 (or
// anything else) fails at startup.
import { Game } from './Game.js';
import { WebGL2UnavailableError } from './render/gl/context.js';
import { showFatal } from './ui/Screens.js';

const canvas = document.getElementById('view');
const uiRoot = document.getElementById('ui');

try {
  performance.mark('boot:start'); // load-time budget (docs/ARCHITECTURE.md): modules loaded -> game built
  const game = new Game(canvas, uiRoot);
  game.start();
  performance.mark('boot:end');
  // Debug / automated-test handle (read-only use).
  window.__game = game;
} catch (err) {
  const isWebGL = err instanceof WebGL2UnavailableError;
  showFatal(uiRoot, err, isWebGL);
  if (!isWebGL) console.warn(err);
}
