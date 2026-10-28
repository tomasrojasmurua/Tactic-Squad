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
    play: 'Jugar',
    playNote: 'Una ronda o una partida al mejor de 3, 5 o 7',
    vsAi: 'Contra la IA',
    vsAiNote: 'Tú y tu escuadra contra la IA, en el bando que elijas',
    multi: 'Multijugador',
    soon: 'Próximamente',
    back: 'Volver',
    tutorial: 'Tutorial',
    tutorialNote: 'Lecciones cortas, de lo básico a la ronda completa',
    tutorialNew: 'Recomendado para empezar',
    lessonsDone: (n, total) => `${n}/${total} lecciones`,
    button: 'Menú',
    confirm: '¿Salir?',
    pitch: 'Asalto táctico por turnos. Planificas sin ver al rival y todo se ejecuta a la vez. Ataca para desactivar la bomba, o defiéndela.',
  },
  /** The tutorial's lessons (config/lessons.js) in the menu. */
  lessons: {
    title: 'Tutorial',
    minutes: (n) => `~${n} min`,
    done: 'Hecha',
    next: 'Siguiente',
    soon: 'Próximamente',
    items: {
      basic: { title: '1. Básico', note: 'Elegir operador, ruta, mirada, puertas, GO y el turno de 5 s' },
      doors: { title: '2. Puertas y granadas', note: 'Patada, entreabrir, flash por la puerta y por qué gana el que espera' },
      squad: { title: '3. Coordinar con GO', note: 'Escuadra en fila, colores de GO, dos puertas a la vez y sigilo' },
      defend: { title: '4. Defender', note: 'Sitio, posiciones, vigilancia, barricadas, cámaras y asomarse' },
      round: { title: '5. Ronda completa', note: 'Compra, entrada, dron, cámaras y bomba contra la IA' },
    },
  },
  /** The lobby (ui/Menu.js, session/Lobby.js). */
  lobby: {
    title: 'Partida contra la IA',
    format: 'Formato',
    bestOf: (n) => (n === 1 ? 'Una ronda' : `Mejor de ${n}`),
    formatNote: (n) =>
      n === 1
        ? 'Una ronda suelta: puedes repetir tu plan o probar otra suerte'
        : `Gana el primero en llegar a ${Math.floor(n / 2) + 1}. A la mitad se cambia de bando; el dinero y el equipo de los vivos pasan a la siguiente`,
    side: 'Empiezas',
    sides: { attackers: 'Atacando', defenders: 'Defendiendo', attackersTeam: 'Cuando atacas', defendersTeam: 'Cuando defiendes' },
    map: 'Mapa',
    moreMaps: 'Más mapas · próximamente',
    players: 'Jugadores',
    you: 'Tú',
    youWaiting: 'Eligiendo',
    youReady: 'Listo',
    ai: 'IA',
    aiReady: 'Lista',
    team: 'Tu equipo',
    teamNote: 'La clase de cada uno al empezar. En la compra (o la preparación) la puedes cambiar ronda a ronda',
    ready: 'Listo',
    readyKey: 'Intro',
  },
  rerollButton: 'Nueva tirada',
  /** Help option (ui/Screens.js): the phases before the assault. */
  stopOnContact: (on) => `Cortar el turno al ver un enemigo: ${on ? 'SÍ' : 'NO'}`,
  /** EV.NOTICE codes -> toast text. */
  notice: {
    confirm_restart: { touch: 'Toca REINICIAR otra vez para borrar todo el plan', desk: 'Pulsa R otra vez para borrar todo el plan' },
    confirm_ready: (n) => `${n === 1 ? 'Hay una puerta' : `Hay ${n} puertas`} sin decidir (?): ${n === 1 ? 'ese soldado se detendrá' : 'esos soldados se detendrán'} ahí. Pulsa LISTO otra vez para confirmar`,
    confirm_menu: { touch: 'Toca MENÚ otra vez para salir (se pierde esta ronda)', desk: 'Pulsa MENÚ otra vez para salir (se pierde esta ronda)' },
    confirm_newPlan: { touch: 'Repite para empezar un plan nuevo (se borra el actual)', desk: 'Pulsa N otra vez para empezar un plan nuevo' },
    replayDiverged: (n) => `Plan cambiado: ${n === 1 ? 'esta fase ya no se repite' : `estas ${n} fases ya no se repiten`}; sigues tú`,
    noPause: `Un turno no se pausa: dura ${TURN} s y luego vuelves a planificar`,
    droneReplay: 'Reintento: el dron repite su recorrido grabado',
    enemyDrone: 'El dron es del atacante: termina solo (o cuando un defensor lo derriba)',
    pickDefender: 'Primero toca a un defensor',
    goInTurn: 'Los GO se dan durante el turno: pulsa LISTO y luego el GO de color cuando quieras',
    goReplay: 'Este turno es la repetición de tu plan: tomas el control en la próxima planificación',
    planFirst: 'Las órdenes se dan al planificar: espera al fin del turno',
    rerolled: 'Nueva tirada: mismo plan, otra suerte',
    tutorialDone: '¡Tutorial completado! Termina la ronda: encuentra la bomba y desactívala',
    tutorialSkipped: 'Tutorial omitido (puedes repetirlo desde el menú)',
    tutorialFirst: 'Primero haz el paso del tutorial (recuadro de la izquierda)',
    noCameras: { touch: 'No te queda ninguna cámara', desk: 'No te queda ninguna cámara' },
    tossAim: { touch: 'Toca donde quieres que caiga. Junto a una puerta, la abre y lanza adentro. × cancela', desk: 'Haz clic donde quieres que caiga. Junto a una puerta, la abre y lanza adentro. Esc cancela' },
    matchNoRetry: 'En una partida no se repiten rondas: SIGUIENTE RONDA',
    contactCut: '¡Contacto! El turno se cortó para que puedas reaccionar',
    contactOn: 'El turno se cortará al ver un enemigo (desde el próximo plan)',
    contactOff: 'Los turnos duran siempre 5 s (desde el próximo plan)',
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
      text: `Los Defensores escondieron una bomba en el sitio A o en el B. Tu escuadrón de 3 debe encontrarla y desactivarla antes de que explote, o eliminar a todos los Defensores. Aquí aprendes el asalto, con solo 2 defensores. La compra, la entrada y el dron están en la lección 5 y en cualquier partida.`,
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
    roundWelcome: {
      title: 'Una ronda completa',
      text: 'Ahora sí, todo: compras, eliges por dónde entrar, reconoces con el dron y asaltas. Contra 3 defensores de la IA que también se prepararon a ciegas. Cada fase se explica al llegar.',
    },
    roundPlan: {
      title: 'Al asalto',
      text: 'Lo que vio el dron sigue marcado. Las cámaras (punto rojo con su cono) avisan a los defensores: rómpelas de un tiro o ciégalas con humo. Gana encontrando la bomba y desactivándola, o eliminando a los defensores.',
    },
    turnEnd: {
      title: 'Fin del turno',
      text: `Vuelves a planificar con lo que pasó: las rutas sin terminar siguen, y los ruidos que oyó tu equipo aparecen como pulsos en el mapa. Repite hasta el final: encuentra la bomba en B y desactívala (${ROUND.defuseTime} s quieto junto a ella), o elimina a los Defensores.`,
    },
    tips: {
      introBuy: {
        title: 'Nuevo: clases y compra',
        text: {
          touch: `Elige la clase de cada operador: Asaltante (duelos), Brecha (cargas rápidas) o Explorador (detecta defensores cerca al final de cada turno). Cada uno tiene $${BUY.startMoney} y ya lleva el equipo de su clase: toca un objeto para comprar otro (− lo devuelve). LISTO para seguir.`,
          desk: `Elige la clase de cada operador: Asaltante (duelos), Brecha (cargas rápidas) o Explorador (detecta defensores cerca al final de cada turno). Cada uno tiene $${BUY.startMoney} y ya lleva el equipo de su clase: haz clic en un objeto para comprar otro (− lo devuelve). LISTO (Espacio) para seguir.`,
        },
      },
      introPrep: {
        title: 'Nuevo: elige la entrada',
        text: 'Los dos bandos se preparan a la vez y a ciegas. El defensor elige el sitio de la bomba, coloca a los suyos y atranca 2 puertas. Tú eliges por qué puerta exterior entra tu escuadrón (Norte, Principal o Sur): él no lo sabe.',
      },
      introDrone: {
        title: 'Nuevo: dron de reconocimiento',
        text: {
          touch: `Tienes ${DRONE.seconds} s de dron, en tiempo real. Muévelo con el mando de la izquierda. Pasa por debajo de las puertas, pero no por las barricadas. Lo que ve queda marcado: defensores, barricadas (barra naranja), cámaras (punto rojo con su cono) y la bomba. Una cámara que ya conoces la rompen de un tiro antes de que te vea. Si un defensor ve el dron, lo derriba. RETIRAR lo termina antes.`,
          desk: `Tienes ${DRONE.seconds} s de dron, en tiempo real. Muévelo con WASD o las flechas. Pasa por debajo de las puertas, pero no por las barricadas. Lo que ve queda marcado: defensores, barricadas (barra naranja), cámaras (punto rojo con su cono) y la bomba. Una cámara que ya conoces la rompen de un tiro antes de que te vea. Si un defensor ve el dron, lo derriba. Espacio lo retira antes.`,
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
