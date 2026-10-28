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
      doors: { title: '2. Puertas y granadas', note: 'Granada desde el costado del marco, esperar el estallido y lanzar sin moverte' },
      squad: { title: '3. Coordinar con GO', note: 'Escuadra en fila, dos grupos con su GO, dos puertas a la vez y sigilo' },
      defend: { title: '4. Defender', note: 'Barricadas, cámaras, posiciones, vigilancia y el turno del defensor' },
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
        : `Gana el primero en llegar a ${Math.floor(n / 2) + 1}. A la mitad se cambia de bando. Cada ronda empiezas con el equipo de tu clase y ${BUY.points} puntos de utilidad; el que pierde suma uno más en la siguiente`,
    toPick: 'Elegir clases',
    side: 'Empiezas',
    sides: { attackers: 'Atacando', defenders: 'Defendiendo', attackersTeam: 'Cuando atacas', defendersTeam: 'Cuando defiendes' },
    map: 'Mapa',
    randomMap: 'Al azar',
    players: 'Jugadores',
    you: 'Tú',
    youWaiting: 'Eligiendo',
    youReady: 'Listo',
    ai: 'IA',
    aiReady: 'Lista',
    readyKey: 'Intro',
  },
  /** The roster after the lobby (ui/Roster.js): a pool per side, 3 make the squad. */
  pick: {
    title: 'Elige tu escuadra',
    note: (both) =>
      both
        ? 'Elige 3 del grupo para cada bando: los juegas toda la partida. Toca uno para ver su equipo. La IA elige los suyos a ciegas'
        : 'Elige 3 del grupo: los juegas toda la ronda. Toca uno para ver su equipo. La IA elige los suyos a ciegas',
    count: (n) => `${n}/3`,
    map: (name, drawn) => (drawn ? `Mapa al azar: ${name}` : `Mapa: ${name}`),
    aiPicks: 'Elige a ciegas',
    ready: 'Confirmar',
    missing: (n, side) => `${n === 1 ? 'Falta 1' : `Faltan ${n}`}${side ? ` · ${side}` : ''}`,
    missingSide: { attackers: 'ataque', defenders: 'defensa' },
    squad: 'Tu escuadra',
    empty: 'Libre',
    remove: 'Toca para quitar',
    add: 'Añadir',
    removeOne: 'Quitar',
    full: 'Escuadra completa: quita uno',
    limitReached: (max) => (max === 1 ? 'Solo uno por escuadra' : `Máximo ${max} por escuadra`),
    inSquad: (n) => (n > 1 ? `×${n}` : '✓'),
    soon: 'Próximamente',
    soonNote: 'Esta clase llega en una próxima versión.',
    limit: (max) => (max === 1 ? 'Uno por escuadra' : max >= 3 ? 'Sin límite' : `Hasta ${max} por escuadra`),
    weapon: 'Arma',
    gear: 'Equipo (cada ronda)',
    traits: 'Características',
    stats: { damage: 'Daño', rate: 'Cadencia', accuracy: 'Precisión', moving: 'En movimiento' },
    mag: (n) => `Cargador ${n}`,
    hp: (n) => `Vida ${n}`,
    gearName: { flash: 'Flash', frag: 'Granada', smoke: 'Humo', breach: 'Carga de brecha', molotov: 'Incendiaria' },
    noGear: 'Sin utilidad: la compra con sus puntos',
    mods: {
      speed: (p) => `Velocidad ${p}`,
      reaction: (p) => `Tiempo de reacción ${p}`,
      visionRange: (p) => `Alcance de visión ${p}`,
      breachPrep: (p) => `Tiempo en plantar una carga ${p}`,
      bash: (p) => `Tiempo en romper una barricada ${p}`,
      stepNoise: (p) => `Ruido de sus pasos ${p}`,
    },
    abilities: {
      scoutPulse: (r) => `Pulso: al final de cada turno detecta a los defensores a ${r} m, aun tras las paredes`,
    },
    traps: (n) => `Pone ${n} trampas en la preparación: atrapan al que las pisa y lo delatan`,
    baseline: 'Sin modificadores: el soldado estándar',
    soonNames: { shield: 'Escudo', marksman: 'Tirador', grenadier: 'Granadero', lookout: 'Vigía' },
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
    noRetry: 'Las rondas no se repiten: mejor suerte en la próxima',
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
    // Lesson 2: doors and throws (config/lessons.js 'doors').
    doorsWelcome: {
      title: 'Puertas y granadas',
      text: 'Tu escuadrón está frente a la puerta principal. Una puerta cerrada es el lugar más peligroso: el que espera adentro ya te está apuntando. Aquí aprendes a abrirla con ventaja.',
    },
    doorAsk: {
      title: 'Hasta la puerta',
      text: {
        touch: 'Toca a ÁGUILA y traza su ruta hasta el pasillo, cruzando la puerta principal. Sobre la puerta aparece un ?.',
        desk: 'Elige a ÁGUILA (1) y haz clic en el pasillo, cruzando la puerta principal. Sobre la puerta aparece un ?.',
      },
    },
    doorBeside: {
      title: 'Granada desde el costado',
      text: {
        touch: 'Toca el ? y elige GRANADA. ÁGUILA se pega al costado del marco, fuera de la línea de fuego, abre y lanza adentro. FLASH y CARGA también se hacen desde el costado.',
        desk: 'Haz clic en el ? y elige GRANADA. ÁGUILA se pega al costado del marco, fuera de la línea de fuego, abre y lanza adentro. FLASH y CARGA también se hacen desde el costado.',
      },
    },
    doorWait: {
      title: 'Espera el estallido',
      text: {
        touch: 'Ahora traza a LOBO por la misma puerta. Como ÁGUILA ya la decidió, LOBO se coloca del otro lado del marco con la etiqueta ESPERA: entra cuando estalle la granada.',
        desk: 'Ahora elige a LOBO (2) y trázalo por la misma puerta. Como ÁGUILA ya la decidió, LOBO se coloca del otro lado del marco con la etiqueta ESPERA: entra cuando estalle la granada.',
      },
    },
    doorHere: {
      title: 'Lanzar sin moverte',
      text: {
        touch: 'Toca a ZORRO y vuelve a tocarlo: el menú «Desde donde está». En LANZAR elige HUMO o FLASH y toca dónde cae. Lanza desde su sitio y después sigue su ruta, si le das una.',
        desk: 'Elige a ZORRO (3) y haz clic sobre él: el menú «Desde donde está». En LANZAR elige HUMO o FLASH y haz clic dónde cae. Lanza desde su sitio y después sigue su ruta, si le das una.',
      },
    },
    doorsExecute: {
      title: 'Ejecuta',
      text: { touch: 'Pulsa LISTO y mira el orden: la granada, el estallido y LOBO entrando detrás.', desk: 'Pulsa LISTO (Espacio) y mira el orden: la granada, el estallido y LOBO entrando detrás.' },
    },
    doorsEnd: {
      title: 'Otras entradas',
      text: 'En el ? también tienes PATADA (de golpe: aturde al que está detrás, pero se oye lejos) y ENTREABRIR (mira por la rendija y pasa con el GO). Regla de oro: el que cruza la puerta mirando al frente pierde contra el que ya apunta al marco. Ciégalo, atúrdelo o espera a que se mueva.',
    },
    // Lesson 3: two groups with their GOs (config/lessons.js 'squad').
    squadWelcome: {
      title: 'Coordinar con GO',
      text: 'Un buen asalto entra por dos lados a la vez: el defensor solo puede mirar uno. Vas a armar dos grupos, cada uno con su GO, y darlos tú en el momento justo.',
    },
    squadFile: {
      title: 'Escuadra en fila',
      text: {
        touch: 'Elige a ÁGUILA y toca ESCUADRA: LOBO y ZORRO la siguen en fila por su ruta. Una ruta para todos.',
        desk: 'Elige a ÁGUILA (1) y pulsa Q (o ESCUADRA): LOBO y ZORRO la siguen en fila por su ruta. Una ruta para todos.',
      },
    },
    squadGroups: {
      title: 'Dos grupos, dos GO',
      text: {
        touch: 'Traza a ÁGUILA hasta la puerta principal y en CUÁNDO elige VIOLETA. Luego da a ZORRO su propia ruta (sale de la fila) hasta la puerta de la oficina, al norte, con CUÁNDO ROSA.',
        desk: 'Traza a ÁGUILA hasta la puerta principal y en CUÁNDO elige VIOLETA (Z). Luego da a ZORRO (3) su propia ruta (sale de la fila) hasta la puerta de la oficina, al norte, con CUÁNDO ROSA (X).',
      },
    },
    squadSneak: {
      title: 'Sigilo',
      text: {
        touch: 'Toca un punto de una ruta y en PASO elige SIGILO: ese tramo se camina despacio y casi sin ruido. Los defensores que reaccionan al ruido no te oyen llegar.',
        desk: 'Haz clic en un punto de una ruta y pulsa T (o PASO: SIGILO): ese tramo se camina despacio y casi sin ruido. Los defensores que reaccionan al ruido no te oyen llegar.',
      },
    },
    squadExecute: {
      title: 'Ejecuta',
      text: { touch: 'Pulsa LISTO. Cada grupo camina hasta su puerta y espera su GO.', desk: 'Pulsa LISTO (Espacio). Cada grupo camina hasta su puerta y espera su GO.' },
    },
    squadGo: {
      title: 'Tú das la orden',
      text: {
        touch: 'Cuando un grupo llega, su botón GO se enciende. Dalos juntos para entrar a la vez, o uno detrás del otro para distraer. Si el turno se acaba antes, sigue en el próximo.',
        desk: 'Cuando un grupo llega, su GO se enciende: Z violeta, X rosa (G, el primero listo). Dalos juntos para entrar a la vez, o uno detrás del otro para distraer. Si el turno se acaba antes, sigue en el próximo.',
      },
    },
    squadEnd: {
      title: 'Pinza',
      text: 'Así se gana un sitio: el defensor que gira hacia un ruido le da la espalda a la otra puerta. Sigue la ronda y prueba: encuentra la bomba en B.',
    },
    // Lesson 4: the defender's side (config/lessons.js 'defend').
    defWelcome: {
      title: 'Defender',
      text: 'Ahora la bomba es tuya: está en B y tus defensores deben aguantar hasta que explote. Te preparas a ciegas, igual que el atacante elige su entrada sin saber nada de ti.',
    },
    defBarricade: {
      title: 'Barricadas',
      text: 'En el panel, en BARRICADAS, atranca una puerta que lleve a B. No se abre: el atacante tiene que romperla a golpes (se oye) o volarla con una carga. Tienes 2.',
    },
    defRecon: {
      title: 'Cámaras',
      text: {
        touch: 'Tus cámaras (punto rojo con su cono) avisan cuando ven a un atacante. Toca un + en la pared para poner una y × para quitarla. Luego pulsa CONFIRMAR: sitio, barricadas y cámaras quedan fijos.',
        desk: 'Tus cámaras (punto rojo con su cono) avisan cuando ven a un atacante. Haz clic en un + de la pared para poner una y en × para quitarla. Luego pulsa CONFIRMAR (Espacio): sitio, barricadas y cámaras quedan fijos.',
      },
    },
    defSelect: { title: 'Elige un defensor', text: { touch: 'Toca a uno de tus defensores.', desk: 'Haz clic en uno de tus defensores, o pulsa 1.' } },
    defPlace: {
      title: 'Colócalo',
      text: {
        touch: 'Toca el suelo para moverlo (solo en tu mitad). Lejos de la puerta y en ángulo: el atacante que entra mirando al frente tiene que girar para encontrarlo.',
        desk: 'Haz clic en el suelo para moverlo (solo en tu mitad). Lejos de la puerta y en ángulo: el atacante que entra mirando al frente tiene que girar para encontrarlo.',
      },
    },
    defWatch: {
      title: 'Su vigilancia',
      text: {
        touch: 'Mantén pulsado y arrastra para orientarlo, o elige en el panel: ÁNGULO FIJO (no se distrae), BARRER (mueve la mirada) o ATENTO (gira hacia los ruidos).',
        desk: 'Clic derecho y arrastra para orientarlo, o elige en el panel: ÁNGULO FIJO (no se distrae), BARRER (mueve la mirada) o ATENTO (gira hacia los ruidos).',
      },
    },
    defReady: {
      title: 'Listo',
      text: { touch: 'Acomoda a los demás si quieres y pulsa LISTO. Empieza el asalto.', desk: 'Acomoda a los demás si quieres (1·2·3) y pulsa LISTO (Espacio). Empieza el asalto.' },
    },
    defPlan: {
      title: 'El turno del defensor',
      text: `También planificas cada turno de ${TURN} s: rutas cortas, asomarse y volver, o un cambio de posición. Sin órdenes, cada uno cumple su vigilancia. Lo que ven tus defensores y tus cámaras queda marcado.`,
    },
    defExecute: {
      title: 'Ejecuta',
      text: { touch: 'Pulsa LISTO y mira cómo llegan.', desk: 'Pulsa LISTO (Espacio) y mira cómo llegan.' },
    },
    defEnd: {
      title: 'Aguanta',
      text: 'Ganas si la bomba explota o si eliminas a los atacantes. No hace falta salir a buscarlos: el tiempo juega a tu favor y el que se mueve hace ruido.',
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
        title: 'Nuevo: compra',
        text: {
          touch: `Cada operador juega con su clase: Asaltante (duelos), Brecha (cargas rápidas) o Explorador (detecta defensores cerca al final de cada turno). Cada clase trae su equipo gratis, y cada operador tiene ${BUY.points} puntos (●) para sumar utilidad: toca un objeto para sumar uno (− lo devuelve). Lo que no gastes se pierde. LISTO para seguir.`,
          desk: `Cada operador juega con su clase: Asaltante (duelos), Brecha (cargas rápidas) o Explorador (detecta defensores cerca al final de cada turno). Cada clase trae su equipo gratis, y cada operador tiene ${BUY.points} puntos (●) para sumar utilidad: haz clic en un objeto para sumar uno (− lo devuelve). Lo que no gastes se pierde. LISTO (Espacio) para seguir.`,
        },
      },
      introPrep: {
        title: 'Nuevo: elige la entrada',
        text: 'Los dos bandos se preparan a la vez y a ciegas. El defensor elige el sitio de la bomba, coloca a los suyos y atranca 2 puertas. Tú eliges por qué puerta exterior entra tu escuadrón (Norte, Principal o Sur): él no lo sabe.',
      },
      introDrone: {
        title: 'Nuevo: dron de reconocimiento',
        text: {
          touch: `Tienes ${DRONE.seconds} s de dron, en tiempo real. Muévelo con el mando de la izquierda. Pasa por debajo de las puertas, pero no por las barricadas. Lo que ve queda marcado: defensores, barricadas (barra naranja), cámaras (punto rojo con su cono) y la bomba. Una cámara que ya conoces la rompen más rápido, aunque alcanza a verte un momento. Si un defensor ve el dron, lo derriba. RETIRAR lo termina antes.`,
          desk: `Tienes ${DRONE.seconds} s de dron, en tiempo real. Muévelo con WASD o las flechas. Pasa por debajo de las puertas, pero no por las barricadas. Lo que ve queda marcado: defensores, barricadas (barra naranja), cámaras (punto rojo con su cono) y la bomba. Una cámara que ya conoces la rompen más rápido, aunque alcanza a verte un momento. Si un defensor ve el dron, lo derriba. Espacio lo retira antes.`,
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
