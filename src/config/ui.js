// HUD / DOM interface tuning. Owner: shared — visual (look, timings of
// effects) and gameplay (flow). Colors of the HUD itself live in ui/styles.css.

export const HUD = Object.freeze({
  feedSeconds: 6, // kill-feed entry lifetime
  feedFadeMs: 450, // CSS fade-out before removal
  feedMaxItems: 6,
  toastSeconds: 1.8,
  lowAmmoFraction: 0.25, // magazine fraction that turns the ammo counter red
  lowTimeSeconds: 30, // the bomb's timer turns red (and beeps: config/audio.js BOMB_BEEP)
  clockWarnSeconds: 5, // the decision clock turns amber this close to its deadline
  deadGunColor: '#666',
  labelOffsetPx: 14, // operator tags float this far above the head
  labelFarPxPerMeter: 30, // below this zoom tags shrink and sit behind the operator (never on a body)
  labelHudMarginPx: 22, // a tag this close to a HUD plate is hidden (tags are ~60 px wide with a status)
  labelBehindMeters: 0.95, // distance of a far tag from the operator, opposite to where it looks
  pointTagOffsetPx: 11, // waypoint tags (GO code, door entry) sit this far below the waypoint
  coachInterval: 0.12, // s between re-evaluations of the onboarding hint (gameplay flow)
});

/** Red damage vignette (Hud). Levels are opacities 0..1. */
export const VIGNETTE = Object.freeze({
  hitKick: 0.55, // added when an operator is hit
  deathFloorStep: 0.08, // permanent tint added per fallen operator...
  deathFloorMax: 0.35, // ...up to this
  defeatFloor: 0.7,
  decayPerSecond: 1.6,
});

/**
 * Screen margins the HUD occupies (CSS px, safe-area excluded), per layout.
 * Camera framing ("see all", initial shot, contact) keeps the action inside the
 * rest. Same numbers as the `--safe-phone-*` / `--safe-desk-*` variables in
 * ui/styles.css (compact phone HUD: body.touch, height <= 520 px; desktop):
 * check-architecture fails if they differ, tests/capture-tour.cjs measures the
 * real plates against them. Owner: visual.
 */
export const HUD_SAFE = Object.freeze({
  phone: Object.freeze({ top: 58, right: 88, bottom: 32, left: 8 }),
  desktop: Object.freeze({ top: 84, right: 16, bottom: 136, left: 256 }),
});

/** HUD plates fade when an operator or a seen enemy is under them (ui/HudOcclusion.js). */
export const HUD_OCCLUSION = Object.freeze({
  marginPx: 26, // a unit this close to a plate counts as under it
  measureSeconds: 0.5, // plate rectangles are re-measured this often (never per frame)
});

/**
 * Session flow tuning (owner: gameplay — what happens and when, not how it looks).
 *   confirmSeconds   a destructive request (wipe the plan) must be repeated within this time
 *   replayPhaseSeconds  on a retry, each recorded decision phase replays and ends by itself
 *   storageKeys      localStorage keys (read/written through session/storage.js, try/catch)
 */
export const FLOW = Object.freeze({
  confirmSeconds: 3,
  replayPhaseSeconds: 0.8, // a replayed decision phase (retry) ends by itself after this long
  framePaddingM: 1.0, // m of map kept around a framed rectangle ("see all", first shot)
  overviewTapMs: 320, // a two-finger tap (both fingers up within this, barely moving)...
  overviewTapPx: 14, // ...toggles the whole-map view
  storageKeys: Object.freeze({ tutorialDone: 'ts.tutorialDone' }),
});
