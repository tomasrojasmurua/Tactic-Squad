// Session flow texts (owner: gameplay): confirmations, smart pause, retry,
// guided tutorial. Merged into ui/texts.js as T.flow.

export const FLOW_TEXTS = Object.freeze({
  goLater: 'GO al ejecutar', // the GO button while planning (disabled: GO only works while time runs)
  confirmRestart: '¿Borrar plan?', // restart button armed (second press wipes the plan)
  overview: 'Ver todo',
  tutorialStart: 'Tutorial guiado',
  tutorialSkip: 'Saltar tutorial',
  rerollButton: 'Nueva tirada',
  autoPauseContact: (on) => `Autopausa al contacto: ${on ? 'SÍ' : 'NO'}`,
  autoPauseIdle: (on) => `Autopausa sin órdenes: ${on ? 'SÍ' : 'NO'}`,
  /** EV.NOTICE codes -> toast text. */
  notice: {
    confirm_restart: { touch: 'Toca REINICIAR otra vez para borrar todo el plan', desk: 'Pulsa R otra vez para borrar todo el plan' },
    confirm_newPlan: { touch: 'Repite para empezar un plan nuevo (se borra el actual)', desk: 'Pulsa N otra vez para empezar un plan nuevo' },
    replayDiverged: (n) => `Plan cambiado: ${n} órdenes grabadas ya no se repetirán`,
    rerolled: 'Nueva tirada: mismo plan, otra suerte',
    tutorialDone: '¡Tutorial completado! Termina la misión con el resto del escuadrón',
    tutorialSkipped: 'Tutorial omitido (puedes repetirlo desde el título)',
    tutorialFirst: 'Primero completa el paso del tutorial',
    contactOn: 'Autopausa al contacto: activada',
    contactOff: 'Autopausa al contacto: desactivada',
    idleOn: 'Autopausa sin órdenes: activada',
    idleOff: 'Autopausa sin órdenes: desactivada',
  },
  /** Banner hint while paused, by session.pauseReason. */
  pause: {
    contact: { touch: '¡Contacto! Revisa la amenaza, ajusta y pulsa SEGUIR', desk: '¡Contacto! Revisa la amenaza, ajusta y pulsa ESPACIO' },
    idle: { touch: 'Todos en posición y sin órdenes: dales nuevas rutas y pulsa SEGUIR', desk: 'Todos en posición y sin órdenes: traza nuevas rutas y pulsa ESPACIO' },
    background: { touch: 'Pausa automática al salir del juego · SEGUIR para continuar', desk: 'Pausa automática al salir del juego · ESPACIO para continuar' },
    graphics: { touch: 'Pausa: se restauraron los gráficos · SEGUIR para continuar', desk: 'Pausa: se restauraron los gráficos · ESPACIO para continuar' },
    orientation: { touch: 'Pausa: gira el teléfono en horizontal y pulsa SEGUIR', desk: 'Pausa' },
  },
  replaying: (n) => `Repitiendo tu plan: ${n} órdenes grabadas en pausa por llegar`,
  /** Guided first round: one instruction per session/Tutorial.js step. */
  tutorial: {
    prefix: (k, n) => `TUTORIAL ${k}/${n} · `,
    select: { touch: 'Toca a ÁGUILA (lleva la bomba)', desk: 'Haz clic en ÁGUILA (o pulsa 1) para seleccionarlo' },
    route: { touch: 'Arrastra desde ÁGUILA hasta la puerta', desk: 'Arrastra (o haz clic) desde ÁGUILA hasta la puerta del edificio' },
    look: { touch: 'Mantén pulsado el último punto y arrastra: su mirada', desk: 'Clic derecho en el último punto y arrastra: hacia dónde mirará' },
    hold: { touch: 'Pulsa ESPERAR: allí aguardará tu GO', desk: 'Pulsa H: en ese punto aguardará tu código GO' },
    execute: { touch: 'Pulsa EJECUTAR para que el tiempo corra', desk: 'Pulsa ESPACIO para que el tiempo corra' },
    go: { touch: 'Cuando llegue y espere, pulsa GO', desk: 'Cuando llegue y espere, pulsa G' },
  },
});
