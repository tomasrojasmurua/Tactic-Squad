// Key bindings (KeyboardEvent.code), pointer/touch tuning and camera controls.
// Owner: gameplay (input feel).

export const KEYS = Object.freeze({
  pause: ['Space'],
  execute: ['Enter', 'NumpadEnter'],
  go: ['KeyG'],
  hold: ['KeyH'],
  undo: ['Backspace', 'KeyZ'],
  clear: ['KeyX', 'Delete'],
  restart: ['KeyR'], // retry: same plan, fresh round
  newPlan: ['KeyN'], // fresh round with no routes
  focus: ['KeyF'],
  help: ['F1', 'Slash', 'KeyI'],
  mute: ['KeyM'],
  music: ['KeyB'], // N is newPlan
  cycle: ['Tab'],
  deselect: ['Escape'],
  select: ['Digit1', 'Digit2', 'Digit3', 'Digit4'],
  panUp: ['KeyW', 'ArrowUp'],
  panDown: ['KeyS', 'ArrowDown'],
  panLeft: ['KeyA', 'ArrowLeft'],
  panRight: ['KeyD', 'ArrowRight'],
  zoomIn: ['Equal', 'NumpadAdd'],
  zoomOut: ['Minus', 'NumpadSubtract'],
  defuse: ['KeyP'],
  overview: ['KeyV'], // see the whole map (again = back)
});

/** Keys whose browser default is always suppressed (scroll, focus change, help). */
export const PREVENT_DEFAULT_KEYS = Object.freeze(['Space', 'Tab', 'Backspace', 'F1', 'Slash']);

export const POINTER = Object.freeze({
  unitPickRadius: 0.6, // m
  unitPickPx: 16, // px: the pick radius never shrinks below this on screen (zoomed out)
  unitPickHeight: 0.9, // m, units are picked around chest height (perspective)
  dragThresholdPx: 6,
  lookMinDistance: 0.3, // m
  drawEndMinDistance: 0.25, // m, releasing a drag farther than this adds a final point
  tailPickPx: 22, // px: a drag starting this close to the route's last point continues it
  duplicatePointPx: 10, // px: a tap this close to the route's last point adds nothing
  edgePanPx: 28, // px: while drawing, the camera follows the pointer near the screen edge...
  edgePanSpeed: 0.8, // ...at this fraction of the visible height per second
});

/** Camera navigation from mouse / keyboard (the camera's look is in config/render.js). */
export const CAMERA_CONTROLS = Object.freeze({
  zoomStep: 1.13, // per wheel notch / key press
  panSpeed: 0.95, // fraction of visible height per second (keyboard / edge)
  edgeScrollPx: 14,
  edgeScrollEnabled: true,
});

/** Touch gestures (phones / tablets). */
export const TOUCH = Object.freeze({
  longPressMs: 380,
  dragThresholdPx: 12,
  unitPickRadius: 0.95, // m, fingers are less precise than a mouse
  unitPickPx: 34, // px: minimum on-screen pick radius for an operator (fingertip ~ 9 mm)
  waypointPickPx: 34,
  waypointPickMinRadius: 0.6, // m, long-press pick radius never shrinks below this
  tailPickPx: 40, // px: a drag starting this close to the route's last point continues it
  duplicatePointPx: 26, // px: a tap this close to the route's last point adds nothing
  // A second finger landing this soon after a stroke began means "pan/zoom",
  // not "draw": the half-drawn stroke is removed instead of kept.
  strokeCancelMs: 320,
  edgePanPx: 32, // px from the screen edge where a drawing finger pans the camera...
  edgePanDelayMs: 250, // ...after resting there this long (grazing the edge does nothing)
  edgePanSpeed: 0.9, // fraction of the visible height per second
  hapticMs: 18,
});
