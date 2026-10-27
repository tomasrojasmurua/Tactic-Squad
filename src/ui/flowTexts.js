// Session flow texts (owner: gameplay): main menu, confirmations, smart pause,
// retry, guided tutorial. Merged into ui/texts.js as T.flow.
import { ROUND, BUY, BARRICADE, DRONE } from '../config/balance.js';

const TURN = ROUND.turnSeconds;

export const FLOW_TEXTS = Object.freeze({
  // GO buttons during a turn: how many of the group are in position.
  goReady: (ready, total) => `${ready}/${total}`,
  confirmRestart: '¿Borrar plan?', // restart button armed (second press wipes the plan)
  confirmReady: '¿Listo igual?', // LISTO armed: some door is still on "?" (strict mode, ENTRY.undecided 'stop')
  overview: 'Ver todo',
  tutorialStart: 'Tutorial guiado',
  tutorialSkip: 'Saltar tutorial',
  /** Main menu (ui/Screens.js). */
  menu: {
    play: 'Jugar contra la IA',
    playNote: 'Asalto por turnos; compra, entrada y dron se suman a medida que juegas',
    tutorial: 'Tutorial guiado',
    tutorialNote: 'Paso a paso, en una ronda más fácil',
    tutorialNew: 'Recomendado para empezar',
    tutorialDone: 'Completado',
    button: 'Menú',
    confirm: '¿Salir?',
    pitch: 'Asalto táctico por turnos. Planificas sin ver al rival y todo se ejecuta a la vez. Encuentra la bomba y desactívala.',
  },
  rerollButton: 'Nueva tirada',
  /** Help option (ui/Screens.js): the phases before the assault. */
  stopOnContact: (on) => `Cortar el turno al ver un enemigo: ${on ? 'SÍ' : 'NO'}`,
  fullRound: (on) => `Ronda completa (compra, entrada, dron): ${on ? 'SÍ' : 'SEGÚN EXPERIENCIA'}`,
  /** EV.NOTICE codes -> toast text. */
  notice: {
    confirm_restart: { touch: 'Toca REINICIAR otra vez para borrar todo el plan', desk: 'Pulsa R otra vez para borrar todo el plan' },
    confirm_ready: (n) => `${n === 1 ? 'Hay una puerta' : `Hay ${n} puertas`} sin decidir (?): ${n === 1 ? 'ese soldado se detendrá' : 'esos soldados se detendrán'} ahí. Pulsa LISTO otra vez para confirmar`,
    confirm_menu: { touch: 'Toca MENÚ otra vez para salir (se pierde esta ronda)', desk: 'Pulsa MENÚ otra vez para salir (se pierde esta ronda)' },
    confirm_newPlan: { touch: 'Repite para empezar un plan nuevo (se borra el actual)', desk: 'Pulsa N otra vez para empezar un plan nuevo' },
    replayDiverged: (n) => `Plan cambiado: ${n === 1 ? 'esta fase ya no se repite' : `estas ${n} fases ya no se repiten`}; sigues tú`,
    noPause: `Un turno no se pausa: dura ${TURN} s y luego vuelves a planificar`,
    droneReplay: 'Reintento: el dron repite su recorrido grabado',
    goInTurn: 'Los GO se dan durante el turno: pulsa LISTO y luego el GO de color cuando quieras',
    goReplay: 'Este turno es la repetición de tu plan: tomas el control en la próxima planificación',
    planFirst: 'Las órdenes se dan al planificar: espera al fin del turno',
    rerolled: 'Nueva tirada: mismo plan, otra suerte',
    tutorialDone: '¡Tutorial completado! Termina la ronda: encuentra la bomba y desactívala',
    tutorialSkipped: 'Tutorial omitido (puedes repetirlo desde el menú)',
    tutorialFirst: 'Primero haz el paso del tutorial (recuadro de la izquierda)',
    contactCut: '¡Contacto! El turno se cortó para que puedas reaccionar',
    contactOn: 'El turno se cortará al ver un enemigo (desde el próximo plan)',
    contactOff: 'Los turnos duran siempre 5 s (desde el próximo plan)',
    fullRoundOn: 'Ronda completa: compra, entrada y dron desde el próximo plan',
    fullRoundOff: 'Compra, entrada y dron se suman a medida que juegas',
  },
  /** Banner hint while a turn is paused, by session.pauseReason. */
  pause: {
    background: { touch: 'Pausa automática al salir del juego · SEGUIR para continuar', desk: 'Pausa automática al salir del juego · ESPACIO para continuar' },
    graphics: { touch: 'Pausa: se restauraron los gráficos · SEGUIR para continuar', desk: 'Pausa: se restauraron los gráficos · ESPACIO para continuar' },
    orientation: { touch: 'Pausa: gira el teléfono en horizontal y pulsa SEGUIR', desk: 'Pausa' },
  },
  replaying: (n) => `Repitiendo tu plan: quedan ${n} fases grabadas · cambia algo para tomar el control`,
  /**
   * Guided tutorial (session/Tutorial.js): one card per step. `title` and
   * `text` ({touch, desk} or a string); info steps carry an ENTENDIDO button.
   */
  tutorial: {
    step: (k, n) => `Tutorial ${k}/${n}`,
    ok: 'Entendido',
    okKey: 'Intro',
    tip: 'Consejo',
    welcome: {
      title: 'Bienvenido',
      text: `Los Defensores escondieron una bomba en el sitio A o en el B. Tu escuadrón de 3 debe encontrarla y desactivarla antes de que explote, o eliminar a todos los Defensores. Aquí aprendes el asalto, con solo 2 defensores. La compra, la elección de entrada y el dron se suman en las rondas siguientes, de a uno.`,
    },
    plan: {
      title: 'Asalto por turnos',
      text: `Ahora planificas con el tiempo detenido. Cuando pulsas LISTO, tu plan y el del rival se ejecutan a la vez durante ${TURN} s, sin pausa; luego vuelves a planificar. La bomba explota tras ${ROUND.timeLimit} s de ejecución (${Math.round(ROUND.timeLimit / TURN)} turnos): planificar no gasta tiempo.`,
    },
    select: { title: 'Elige un operador', text: { touch: 'Toca a ÁGUILA (o su tarjeta arriba a la izquierda).', desk: 'Haz clic en ÁGUILA, o pulsa 1.' } },
    route: {
      title: 'Traza su ruta',
      text: {
        touch: 'Arrastra el dedo desde ÁGUILA hasta dentro del edificio, pasando por la puerta. Tocar el suelo también añade un punto.',
        desk: 'Haz clic dentro del edificio, pasando por la puerta (o arrastra para dibujar la ruta a mano).',
      },
    },
    door: {
      title: 'Decide la puerta',
      text: {
        touch: 'La ruta cruza una puerta cerrada: verás un ? sobre ella. Sin hacer nada, ÁGUILA la abre y pasa. Toca el ? para elegir cómo entra; prueba FLASH: abre y lanza un flash adentro.',
        desk: 'La ruta cruza una puerta cerrada: verás un ? sobre ella. Sin hacer nada, ÁGUILA la abre y pasa. Haz clic en el ? para elegir cómo entra; prueba FLASH: abre y lanza un flash adentro.',
      },
    },
    hold: {
      title: 'Elige cuándo',
      text: 'En CUÁNDO elige VIOLETA: ÁGUILA esperará en la puerta hasta que des el GO violeta. Cada color es un grupo: los que esperan el mismo color entran juntos.',
    },
    look: {
      title: 'Hacia dónde mira',
      text: {
        touch: 'Mantén pulsado el último punto de la ruta y arrastra: es hacia dónde mirará al llegar. Quien ya apunta al ángulo dispara primero.',
        desk: 'Clic derecho en el último punto de la ruta y arrastra: es hacia dónde mirará al llegar. Quien ya apunta al ángulo dispara primero.',
      },
    },
    execute: {
      title: 'Ejecuta el turno',
      text: {
        touch: `Pulsa LISTO. Si quieres, antes dale ruta a LOBO y ZORRO. El turno dura ${TURN} s y no se pausa.`,
        desk: `Pulsa LISTO (Espacio). Si quieres, antes dale ruta a LOBO (2) y ZORRO (3). El turno dura ${TURN} s y no se pausa.`,
      },
    },
    go: {
      title: 'Da el GO',
      text: {
        touch: 'Cuando ÁGUILA llegue a la puerta, toca GO VIOLETA a la derecha: ¡ahora! Si el turno se acaba antes, pulsa LISTO y sigue en el próximo.',
        desk: 'Cuando ÁGUILA llegue a la puerta, pulsa GO VIOLETA (o Z): ¡ahora! Si el turno se acaba antes, pulsa Espacio y sigue en el próximo.',
      },
    },
    turnEnd: {
      title: 'Fin del turno',
      text: `Vuelves a planificar con lo que pasó: las rutas sin terminar siguen, y los ruidos que oyó tu equipo aparecen como pulsos en el mapa. Repite hasta el final: encuentra la bomba en B y desactívala (${ROUND.defuseTime} s quieto junto a ella), o elimina a los Defensores.`,
    },
    tips: {
      introBuy: {
        title: 'Nuevo: compra',
        text: {
          touch: `Antes del asalto cada operador tiene $${BUY.startMoney} y ya lleva el equipo de su rol. Toca un objeto en su fila para comprar otro (− lo devuelve). LISTO para seguir.`,
          desk: `Antes del asalto cada operador tiene $${BUY.startMoney} y ya lleva el equipo de su rol. Haz clic en un objeto de su fila para comprar otro (− lo devuelve). LISTO (Espacio) para seguir.`,
        },
      },
      introPrep: {
        title: 'Nuevo: elige la entrada',
        text: 'Los dos bandos se preparan a la vez y a ciegas. El defensor elige el sitio de la bomba, coloca a los suyos y atranca 2 puertas. Tú eliges por qué puerta exterior entra tu escuadrón (Norte, Principal o Sur): él no lo sabe.',
      },
      introDrone: {
        title: 'Nuevo: dron de reconocimiento',
        text: {
          touch: `Tienes ${DRONE.seconds} s de dron, en tiempo real. Muévelo con el mando de la izquierda. Pasa por debajo de las puertas, pero no por las barricadas. Lo que ve queda marcado: defensores, barricadas (barra naranja) y la bomba. Si un defensor lo ve, lo derriba. RETIRAR lo termina antes.`,
          desk: `Tienes ${DRONE.seconds} s de dron, en tiempo real. Muévelo con WASD o las flechas. Pasa por debajo de las puertas, pero no por las barricadas. Lo que ve queda marcado: defensores, barricadas (barra naranja) y la bomba. Si un defensor lo ve, lo derriba. Espacio lo retira antes.`,
        },
      },
      barricade: {
        title: 'Barricada',
        text: `La barra naranja es una barricada: no se abre. Si tu ruta la cruza, el operador la rompe a golpes (${BARRICADE.breakTime} s quieto y se oye lejos). Una CARGA la vuela al instante. También puedes rodearla por otra puerta.`,
      },
      defuse: {
        title: 'Desactivar',
        text: { touch: `Hay un operador junto a la bomba: toca DESACTIVAR y luego LISTO. Debe quedarse ${ROUND.defuseTime} s quieto sin disparar.`, desk: `Hay un operador junto a la bomba: pulsa P y luego Espacio. Debe quedarse ${ROUND.defuseTime} s quieto sin disparar.` },
      },
    },
  },
});
