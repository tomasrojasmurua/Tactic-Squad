// Session flow texts (owner: gameplay): confirmations, smart pause, retry,
// guided tutorial. Merged into ui/texts.js as T.flow.

export const FLOW_TEXTS = Object.freeze({
  // GO buttons during a turn: how many of the group are in position.
  goReady: (ready, total) => `${ready}/${total}`,
  confirmRestart: '¿Borrar plan?', // restart button armed (second press wipes the plan)
  overview: 'Ver todo',
  tutorialStart: 'Tutorial guiado',
  tutorialSkip: 'Saltar tutorial',
  rerollButton: 'Nueva tirada',
  /** EV.NOTICE codes -> toast text. */
  notice: {
    confirm_restart: { touch: 'Toca REINICIAR otra vez para borrar todo el plan', desk: 'Pulsa R otra vez para borrar todo el plan' },
    confirm_newPlan: { touch: 'Repite para empezar un plan nuevo (se borra el actual)', desk: 'Pulsa N otra vez para empezar un plan nuevo' },
    replayDiverged: (n) => `Plan cambiado: ${n === 1 ? 'esta fase ya no se repite' : `estas ${n} fases ya no se repiten`}; sigues tú`,
    noPause: 'Un turno no se pausa: dura 8 s y luego vuelves a planificar',
    goInTurn: 'Los GO se dan durante el turno: pulsa LISTO y luego A, B o C cuando quieras',
    goReplay: 'Este turno es la repetición de tu plan: tomas el control en la próxima planificación',
    planFirst: 'Las órdenes se dan al planificar: espera al fin del turno',
    rerolled: 'Nueva tirada: mismo plan, otra suerte',
    tutorialDone: '¡Tutorial completado! Termina la misión con el resto del escuadrón',
    tutorialSkipped: 'Tutorial omitido (puedes repetirlo desde el título)',
    tutorialFirst: 'Primero completa el paso del tutorial',
  },
  /** Banner hint while a turn is paused, by session.pauseReason. */
  pause: {
    background: { touch: 'Pausa automática al salir del juego · SEGUIR para continuar', desk: 'Pausa automática al salir del juego · ESPACIO para continuar' },
    graphics: { touch: 'Pausa: se restauraron los gráficos · SEGUIR para continuar', desk: 'Pausa: se restauraron los gráficos · ESPACIO para continuar' },
    orientation: { touch: 'Pausa: gira el teléfono en horizontal y pulsa SEGUIR', desk: 'Pausa' },
  },
  replaying: (n) => `Repitiendo tu plan: quedan ${n} fases grabadas · cambia algo para tomar el control`,
  /** Guided first round: one instruction per session/Tutorial.js step. */
  tutorial: {
    prefix: (k, n) => `TUTORIAL ${k}/${n} · `,
    select: { touch: 'Toca a ÁGUILA', desk: 'Haz clic en ÁGUILA (o pulsa 1) para seleccionarlo' },
    route: { touch: 'Arrastra desde ÁGUILA hasta la puerta', desk: 'Arrastra (o haz clic) desde ÁGUILA hasta la puerta del edificio' },
    look: { touch: 'Mantén pulsado el último punto y arrastra: su mirada', desk: 'Clic derecho en el último punto y arrastra: hacia dónde mirará' },
    hold: { touch: 'Pulsa ESPERAR: allí aguardará tu GO', desk: 'Pulsa H: en ese punto aguardará tu código GO' },
    execute: { touch: 'Pulsa LISTO: el turno corre 8 s, sin pausa', desk: 'Pulsa ESPACIO: el turno corre 8 s, sin pausa' },
    go: { touch: 'Cuando esté en posición, toca GO A: ¡ahora!', desk: 'Cuando esté en posición, pulsa GO A (o G): ¡ahora!' },
  },
});
