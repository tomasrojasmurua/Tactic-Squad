// Key bindings (KeyboardEvent.code), pointer/touch tuning and camera controls.
// Owner: gameplay (input feel).

export const KEYS = Object.freeze({
  pause: ['Space'],
  execute: ['Enter', 'NumpadEnter'],
  go: ['KeyG'], // during a turn: the first GO group ready
  goGroups: ['KeyZ', 'KeyX', 'KeyC'], // during a turn: GO violeta / rosa / blanco (Z / X edit routes only while planning)
  hold: ['KeyH'],
  squad: ['KeyQ'], // the others follow the selected operator in file (again: each on his own)
  pace: ['KeyT'], // the targeted leg is walked quietly (again: normally)
  entry: ['KeyE'], // cycles how he goes through the door next to the last waypoint
  undo: ['Backspace', 'KeyZ'],
  clear: ['KeyX', 'Delete'],
  restart: ['KeyR'], // retry: same plan, fresh round
  newPlan: ['KeyN'], // fresh round with no routes
  focus: ['KeyF'],
  reload: ['KeyY'], // the selected operator reloads now
  light: ['KeyL'], // the selected operator's flashlight on / off (night)
  unitInfo: ['KeyJ'], // the selected operator's sheet (class, weapon, utility)
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
  cameras: ['KeyO'], // defending, while deciding: the view jumps to each of your cameras in turn
});

/** Keys whose browser default is always suppressed (scroll, focus change, help). */
export const PREVENT_DEFAULT_KEYS = Object.freeze(['Space', 'Tab', 'Backspace', 'F1', 'Slash']);

/**
 * A tap / click this close to a door (m from the wall plane; half of it past
 * the jambs) is a tap ON the door: the operator stacks by it and the door
 * wheel opens (input/PlanningController.js stackAt). Fingers get more room.
 */
export const DOOR_TAP = Object.freeze({ pointer: 0.35, touch: 0.5 });

export const POINTER = Object.freeze({
  unitPickRadius: 0.6, // m
  unitPickPx: 16, // px: the pick radius never shrinks below this on screen (zoomed out)
  unitPickHeight: 0.9, // m, units are picked around chest height (perspective)
  dragThresholdPx: 6,
  lookMinDistance: 0.3, // m
  drawEndMinDistance: 0.25, // m, releasing a drag farther than this adds a final point
  tailPickPx: 22, // px: a drag starting this close to the route's last point continues it
  waypointPickRadius: 0.35, // m: a press this close to a waypoint grabs it (drag: move; click: door picker)...
  waypointPickPx: 12, // ...never less than this on screen
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
