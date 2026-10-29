# Tactic Squad

Juego web táctico de escuadra en vista cenital. JavaScript puro (módulos ES, sin framework) y WebGL2 propio. Interfaz en español; se juega en escritorio y en celular.

## Cómo correrlo

Se juega en línea en **https://tomasrojasmurua.github.io/Tactic-Squad/**. Cada push a `main` lo vuelve a publicar si pasan las pruebas (`.github/workflows/pages.yml`).

El juego no necesita build: basta servir la carpeta.

```sh
npm start          # http://localhost:8080 (cualquier servidor estático sirve)
npm test           # pruebas de la simulación (Node 20+)
npm install && npm run build   # dist/tactic-squad.html, un solo HTML autocontenido
```

Abrir `index.html` directamente con `file://` no funciona, porque los navegadores no cargan módulos ES desde disco. El HTML de `npm run build` sí funciona así.

## Estructura

| Carpeta | Qué contiene | Reglas |
| --- | --- | --- |
| `src/sim/` | Simulación autoritativa y determinista: fases de la ronda y turnos, unidades, movimiento, visión, combate, IA, puertas, objetivos, ruido, vista por bando | Sin DOM, WebGL, audio ni reloj real. Solo avanza con `step(dt)` y la semilla (`core/rng.js`). Recibe órdenes como datos (`sim/orders.js`) y reporta con eventos. |
| `src/config/` | Todos los números y fichas: equilibrio (`balance.js`), armas, roles de operador, escuadra, render, audio, UI | Los números de juego van aquí, no en el código de la sim. |
| `src/data/` | Mapas (`maps/`) y props como datos puros | Un mapa nuevo = un archivo y una línea en `maps/index.js`. |
| `src/core/` | Utilidades sin dependencias: matemáticas, geometría, RNG, bus de eventos, bucle fijo | |
| `src/session/` | Lo que no es de la sim: plazos de las fases de decisión (`PhaseClock.js`), pausa de sistema, tutorial, grabación de planes por fase | En el online, el servidor hará de `PhaseClock`. |
| `src/input/` | Mouse, teclado y táctil; planificación de rutas | |
| `src/render/` | Renderer WebGL2 por capas, shaders, geometría y efectos | Solo lee la sim. |
| `src/audio/` | Motor de audio procedural, sonidos horneados en un worker, música | Solo escucha eventos. |
| `src/ui/` | HUD, pantallas y textos (`texts.js`) | |

Para agregar una clase de operador: una entrada en `config/operators.js` (`ROLES`) y, si tiene habilidad, un módulo en `sim/abilities/` registrado en `sim/abilities/index.js`.

## Menú y tutorial guiado

Al abrir el juego aparece el menú principal con cuatro opciones: **Atacar** y **Defender** (una ronda contra la IA, que juega el otro bando), **Alambre de púas** (`sim/wires.js`, `WIRE`). El defensor pone `PREP.wires` (1) por ronda en una puerta de `barricadeSlots` sin barricada. El atacante que lo cruza va a `WIRE.slow` (50 %) y hace ruido; el defensor pasa libre; una granada o una carga cerca lo corta. El atacante lo conoce al verlo o pisarlo (`sim.intel.wires`).

**Incendiaria** (`sim/fire.js`, `ENTRY.molotov`). Solo del defensor, 2 puntos. Se lanza como cualquier utilidad y deja fuego (`radius` 1,8 m, `seconds` 7, `dps` 22) que quema a quien esté adentro; una nube de humo que la alcanza la apaga. La IA atacante no entra al fuego (`movement.js` `fireAhead`).

**Partida al mejor de 7** (`session/Match.js`: rondas seguidas, el primero en ganar 4; el jugador ataca las 3 primeras y después defiende; el bando que pierde una ronda tiene un punto de utilidad más en la siguiente) y **Tutorial guiado** (siempre de atacante).

**Fases que se suman.** La primera partida va directo a planificar; la entrada se suma en la 2.ª ronda y la compra y el dron en la 3.ª (`FLOW.unlockAfterRounds` en `config/ui.js`), cada una con una tarjeta la primera vez. La opción "Ronda completa" de la Ayuda las muestra siempre; la partida al mejor de 7 se juega siempre completa. Intro ataca. Desde la partida se vuelve al menú con el botón MENÚ (en escritorio, en la barra de abajo; en el celular, dentro de Ayuda; también al final de la ronda). Si ya hay un plan, pide una segunda pulsación para confirmar.

El tutorial (`session/Tutorial.js`, tarjeta en `ui/TutorialCard.js`, textos en `ui/flowTexts.js`) recorre una ronda real paso a paso: compra, preparación y entrada, dron, planificación (elegir operador, trazar ruta, decidir la puerta con su entrada y su GO, la mirada), ejecutar el turno, dar el GO y el fin del turno. Hay dos tipos de paso. Las tarjetas de explicación se cierran con ENTENDIDO, LISTO o Intro, y la del dron detiene el dron hasta cerrarla. Los pasos de acción avanzan solos cuando se hace el gesto. LISTO solo funciona en los pasos que lo piden. Después siguen saliendo, una sola vez, consejos de barricada y de desactivar. La ronda del tutorial es más fácil (`TUTORIAL` en `config/ui.js`): semilla fija, bomba en B y solo 2 defensores (opción `defenders` de `Simulation`, que elige qué puestos de `defense` se ocupan). Se puede saltar en cualquier momento, y queda recordado en el dispositivo cuando se termina.

## Objetivo de la ronda

Los Defensores dejan la bomba en el sitio A o en el B (la IA lo decide con la semilla de la ronda, así que un reintento conserva el sitio; un defensor humano lo elige en la preparación). Los Atacantes no saben en cuál está hasta verla. Para ganar la desactivan, 7 s quietos junto a ella sin disparar (moverse o morir pierde el progreso), o eliminan a todos los Defensores. Los Defensores ganan si se acaba el tiempo o eliminan a todos los Atacantes.

Cada mapa declara como datos (`src/data/maps/warehouse.js`, `hotel.js`): `sites` (rectángulo y punto de la bomba), `entries` (puerta y posiciones de inicio de cada entrada atacante), `deployment` (línea de despliegue y mitad de cada bando), puertas con `barricade: true` (huecos aptos para barricadas; cuentan solo los que tocan la mitad defensora), `defense` (la disposición de la IA defensora en cada sitio, y el punto de partida de un defensor humano) `aiBarricades` (entre qué puertas elige la IA sus 2 barricadas en cada sitio), `aiEntries` (por qué entradas ataca la IA cada sitio, con pesos) y, opcionales, `palette` (color de las paredes) y `traits`, `siteNames` y `siteTraits` (la ficha del mapa en el lobby y en la elección de clases, `ui/MapPreview.js`: plano dibujado desde los datos y su lectura, general o del sitio que se toca; no nombra clases). El lobby elige el mapa (o al azar); las lecciones del tutorial van siempre en el Almacén. `node scripts/balance.mjs 200 - hotel` mide el equilibrio IA contra IA de un mapa y `tests/maps.test.mjs` revisa cada mapa (caminos, nombres, rondas).

## Fases de la ronda y turnos We-Go

La ronda vive en la simulación (`sim/round.js`): **compra → preparación → dron → planificación ⇄ ejecución → fin**.

| Fase | Plazo | Qué se hace |
| --- | --- | --- |
| Compra | sin límite | Los dos bandos a la vez: cada operador suma utilidad con sus puntos (ver abajo). Las clases se eligieron antes de la partida. |
| Preparación | sin límite | A ciegas y a la vez. El atacante elige entrada (el defensor no la ve) y puede adelantar rutas. El defensor primero hace su **reconocimiento** (sitio, 2 barricadas y cámaras; al confirmar quedan fijos toda la ronda, orden `endRecon`) y después coloca a los suyos y les da órdenes de vigilancia (la IA lo hace al empezar la fase). |
| Dron | 15 s | El atacante maneja el dron en tiempo real (ver abajo). El tiempo de la bomba no corre. LISTO lo retira antes. |
| Planificación | sin límite | El tiempo no corre. Se trazan o cambian rutas (también en fila de escuadra), miradas, esperas en grupos GO de color, entradas por puerta, paso y lanzamientos. No se ve lo que planea el rival. En la primera, antes de ejecutar, todavía se puede cambiar la entrada (borra las rutas). |
| Ejecución | 5 s | Todo se ejecuta a la vez. Contra la IA el turno se corta si la escuadra ve a un enemigo nuevo (`stopOnContact`, opción de la Ayuda; nunca antes de 0,5 s). La única orden son los GO: el jugador dice "¡ahora!" y ese grupo actúa junto. Luego se vuelve a planificar (las rutas sin terminar siguen). |

**Temporizador de la bomba.** La bomba explota tras 90 s de ejecución, 18 turnos (`ROUND.timeLimit`); solo corre durante los turnos, así que planificar es gratis pero cada turno la acerca. En 0 explota aunque alguien esté a mitad de la desactivación, y ganan los Defensores. En los últimos 20 s pita cada vez más rápido.

**LISTO** (Espacio o Intro) termina una fase. Contra la IA no hay plazo (`ROUND.phaseSeconds` en `null`); para el juego online se pondrá un límite, por ejemplo 60 s para planificar. Los plazos son reloj de pared (`session/PhaseClock.js`) y la sim nunca los ve: tardar 3 s o 15 s en decidir no cambia el resultado.

**Grupos GO en vivo.** Al planificar, cada espera (H, o el botón ESPERAR que abre los colores) se asigna a un grupo de color: violeta, rosa o blanco (`GO_GROUPS` en `config/ui.js`; internamente `'A'`, `'B'`, `'C'`). Durante el turno aparecen los botones GO de cada color con cuántos del grupo están en posición (por ejemplo 2/3); Z / X / C los dan, G llama al primero que tiene a alguien esperando. Al apretarlo, los que esperan salen juntos (si uno lanza flash o granada, los demás esperan el estallido) y los que aún no llegan a su espera ya no se detienen: siguen de largo y hacen su entrada al llegar. Si nadie aprieta, siguen esperando en el turno siguiente. Cada GO se graba con el paso del turno en que se dio (`atTick`), así que el reintento y el futuro servidor lo aplican en el mismo instante.

**Ruido.** Pasos, puertas, patadas, disparos, cargas, granadas y la desactivación se oyen dentro de un radio (`NOISE` en `config/balance.js`, a través de paredes). Al final de cada turno lo que oyó cada bando aparece en su mapa como un pulso aproximado (celda de 3 m, corrida hasta 0,9 m con un hash de la semilla) que se apaga en 3 turnos (`sim/noise.js`). Nadie oye su propio ruido. La IA sigue oyendo como antes.

**Vista por bando.** `sim/view.js` `teamView(sim, bando)` devuelve lo que ese bando puede saber: sus unidades, los enemigos que ve ahora, dónde vio por última vez a los demás, los pulsos que oyó y la bomba si sabe dónde está. Es el filtro que usará el servidor online; los pulsos ya se dibujan desde ahí, el resto del render todavía lee la sim entera.

**Repetición de la última baja** (`session/KillCam.js`, `KILLCAM`). Al terminar la ronda, antes del resultado, la ronda se juega otra vez fuera de pantalla con la misma semilla y las órdenes grabadas por fase (`PlanRecorder`) hasta 3,5 s antes de la última baja, y esa copia se muestra (render, sonido, efectos; sus eventos llevan `replay` y ni el HUD ni la sesión los cuentan) con el disparo en cámara lenta. Las rondas no se reintentan: R / N (reintentar, plan nuevo) quedan solo para las lecciones del tutorial.

## Preparación de ambos bandos (hito 3)

**Clases** (`config/operators.js`). Se eligen antes de la partida, en el **roster** del menú (después del lobby: 3 personajes de un grupo, cada uno con su símbolo y su ficha; `ui/Roster.js`), y duran toda la partida: dentro de ella ninguna orden las cambia (`setRole` / `setDefenderRole` en `sim/prep.js` quedan como las reglas de esa selección). Cada atacante elige Asaltante (rifle, flash y granada), Brecha (subfusil, flash y 2 cargas; planta en la mitad de tiempo y rompe barricadas antes) Explorador (cámara de fibra bajo la puerta), Escudo (escudo balístico, `combat.js shieldFacing`), Tirador (fusil de tirador) o Granadero (gas lacrimógeno, `sim/gas.js`). Ver `RESUMEN-DEL-JUEGO.md` §3. Del lado defensor, con tope por bando: Escopetero (hasta 2; escopeta con `cone` y `falloff` en `config/weapons.js`, reacción más rápida de cerca), Ancla (hasta 2; 120 de vida, reacción más rápida), Merodeador (1; subfusil, 12 % más rápido y sus pasos se oyen a un tercio de distancia) Trampero (1; pone 2 trampas, `sim/traps.js`, `TRAP`, y un alambre más), Vigía (1; una cámara más y el monitor) y Tirador (1; francotirador). El Ancla arma un parapeto (`sim/parapets.js`). La IA las toma de los puestos del mapa (`role`). Cada bando elige a ciegas. Una **trampa** atrapa al atacante que la pisa (2 s quieto, 15 de daño, ruido fuerte) y los defensores saben dónde está; el atacante solo la ve yendo con sigilo (a 3,5 m), con el dron o con la cámara del Explorador, y una trampa que conoce la rompe de un tiro. El Trampero las pone con "Poner trampas" y tocando el suelo (tocar una suya la levanta); el mapa trae las de la IA (`aiTraps`).

**Compra** (`sim/prep.js`, `BUY` en `config/balance.js`). Cada operador, en los dos bandos, lleva gratis el equipo de su clase y tiene 2 puntos de utilidad por ronda: los dos bandos los gastan a la vez en la compra: el atacante en flash, granada, humo o carga y el defensor en flash, granada o humo. Cada objeto cuesta 1 punto; como máximo 2 flash, 1 granada, 1 humo y 2 cargas, contando el equipo de la clase. En el panel, tocar un objeto suma uno y − lo devuelve (el equipo de la clase no se devuelve). Lo que no se gasta se pierde.

**Partida al mejor de 7** (`session/Match.js`, `MATCH`). No hay dinero: cada ronda empieza con el equipo de cada clase completo y los puntos de utilidad, y el bando que perdió la ronda anterior tiene `BUY.lossBonus` (1) punto más por operador (`opts.lossBonus` de `Simulation`). Pasa a la ronda siguiente la clase de cada atacante (`opts.loadout`). No hay reintentos dentro de una partida. El jugador ataca las primeras `MATCH.switchAfter` (3) rondas y después defiende; en el cambio los nuevos atacantes empiezan de cero, como en un medio tiempo. El marcador es del jugador contra la IA.

**Cámaras** (`sim/cameras.js`, `CAMERA`, `aiCameras` del mapa). Una por sitio. Si tiene a un atacante a la vista 0,5 s, todos los defensores de la IA reciben su posición como una alerta. Los atacantes la descubren con la vista o con el dron y la rompen de un tiro si no tienen otro blanco (casi al instante si ya la conocían). El humo la ciega.

**Defensor.** Órdenes de la preparación (`sim/orders.js`): `chooseSite` (la bomba va a ese sitio y el despliegue vuelve al del mapa para él), `placeUnit` (solo en la mitad defensora, en suelo transitable y a 0,7 m o más de un compañero), `setWatch` y `barricade` (hasta 2, solo en las puertas de `barricadeSlots`). Las órdenes de vigilancia se vuelven los comportamientos de la IA (`sim/ai.js`), así que funcionan solas en el asalto:

| Orden | Datos | Comportamiento |
| --- | --- | --- |
| Ángulo fijo | `{facing}` | Mantiene el ángulo y no se gira por ruidos. |
| Barrer | `{facing, sweep: [desde, hasta]}` | Barre entre dos ángulos (`PREP.sweepPeriod`). |
| Reaccionar a ruido | `{facing, react: true}` | Mantiene el ángulo y se gira hacia lo que oye. |
| Replegarse | `{facing, react: true, fallback: {to, look}}` | Con el primer tiroteo que oye va a ese punto (de su mitad) y mira hacia `look`. |

La IA defensora se prepara al empezar la preparación: el sitio que sale de la semilla, la disposición del mapa para ese sitio y 2 barricadas elegidas entre las `aiBarricades` del sitio con un hash de la semilla (no usa el azar de la ronda). 
**Jugar de defensor** (menú → Defender; `session.team = 'defenders'`, la IA atacante de `sim/aiAttack.js` juega el otro bando):

- En la compra, a la vez que la IA atacante, el panel muestra a los tres defensores con su clase, sus puntos y la utilidad que pueden sumar. La preparación empieza con la disposición del mapa para el sitio que salió de la semilla.
- La preparación tiene dos pasos (`inRecon` en `session/Session.js`). Primero el **Reconocimiento** (`ui/PhasePanel.js`, a la derecha; en el celular a la izquierda): el sitio de la bomba (cambiarlo vuelve a la disposición del mapa para ese sitio), las 2 barricadas y las cámaras, que se ponen tocando los soportes del mapa (`ui/CameraMounts.js`). CONFIRMAR (orden `endRecon`) los deja fijos toda la ronda, dron incluido. Después, **Tus defensores**:
  - la vigilancia del defensor elegido (`session/watch.js`): **Ángulo fijo** (no reacciona al ruido), **Barrer** (barre 70° alrededor de su mirada y reacciona) y **Atento** (mirada fija, reacciona).
- Se coloca con los mismos gestos de las rutas (`input/PlanningController.js`): con un defensor elegido, tocar o hacer clic en el suelo lo pone ahí (solo en la mitad defensora; si cae sobre un mueble, se corre al hueco libre más cercano). Clic derecho y arrastrar (en el celular, mantener pulsado y arrastrar) lo orienta. Un repliegue del mapa se conserva al cambiar de modo.
- El dron es del atacante: el defensor solo lo ve venir y no puede retirarlo.
- En cada planificación puede mover defensores con rutas, igual que el atacante. Un defensor movido deja su patrulla o repliegue pero conserva su modo de vigilancia, que aplica donde llega, alrededor de la mirada que se le indique ahí.
- La vigilancia no queda fija: en cada planificación, con un defensor elegido, el panel **Vigilancia** (`'watch'` en `ui/PhasePanel.js`, `setWatch` también en la fase `plan`) la cambia entre Ángulo fijo, Barrer y Atento. Gira hacia ella durante el turno, no al instante.
- **Cubrir zona** (atacantes, orden `setCover`): en el menú del punto, al final de su ruta o desde donde está, el atacante barre `PREP.sweepArc` alrededor de la mirada que se le dio, como el Barrer del defensor (p. ej. cubrir al que desactiva). En el mapa: abanico ancho y etiqueta CUBRE.
- La vigilancia de todos los defensores funciona sola durante el asalto, sea quien sea quien los preparó (`isAiControlled` en `sim/queries.js`).

**Barricadas** (`sim/barricades.js`, `BARRICADE`). Una puerta atrancada no se abre, no se entreabre ni se patea: bloquea el paso, la vista, las balas y el dron. El atacante que intenta abrirla (de cualquier forma) se pone a romperla: 3 s quieto dando golpes que se oyen a 14 m (la IA cercana se gira y rota como con un tiroteo); si aparece un enemigo, pelea y luego sigue. Después el hueco queda libre. Una carga la vuela al instante. Los atacantes solo la ven cuando uno de ellos o el dron la tiene a la vista (`sim.intel.barricades`, en `teamView`); entonces se dibuja una barra naranja sobre la puerta.

**Dron** (`sim/drone.js`, `DRONE`). Sale frente a la puerta de la entrada elegida. Se maneja con WASD o las flechas en escritorio y con el mando en pantalla en el celular; la dirección va en 16 rumbos y se manda solo cuando cambia, como orden `{type:'drone', dir, atTick}` sellada con el paso de la fase (igual que un GO), así que el reintento repite el mismo recorrido. Rueda bajo las puertas cerradas pero no atraviesa barricadas, paredes ni muebles. Lo que ve su cono (100°, 14 m) lo aprenden los atacantes: los defensores quedan marcados donde estaban (última posición conocida), las barricadas quedan a la vista y, si ve la bomba, revela el sitio. Los defensores no se mueven durante el dron: solo giran (sus órdenes de vigilancia, y la IA lo oye a 3 m), y el que lo tiene a la vista 0,6 s lo derriba. Termina a los 15 s, al ser derribado o con LISTO (`droneRecall`).

## IA atacante

Cuando los atacantes los juega la IA (`controllers: { attackers: 'ai' }`), `sim/aiAttack.js` hace de comandante: da a su escuadra las mismas órdenes que un jugador, en los mismos momentos, y solo sabe lo que sabe el bando atacante (lo que vio el dron o la escuadra, las barricadas descubiertas, la bomba cuando la encuentra). Sus operadores caminan, abren, entran y disparan igual que los del jugador; no tienen los reflejos de la IA defensora (`sim/ai.js`).

| Fase | Qué hace la IA |
| --- | --- |
| Compra | Cada operador compra un flash si le alcanza la plata. |
| Preparación | Se queda en la entrada principal para que el dron entre por el medio. |
| Dron | Lo lleva por el camino de navegación hacia cada sitio (el más cercano primero) hasta ver la bomba o ver vacío el punto de un sitio; entonces lo recoge. |
| Primera planificación | Elige el sitio (el de la bomba si la vio, si no el que no descartó), la entrada que el mapa recomienda para ese sitio (`aiEntries`, con pesos y la semilla) y traza las rutas hasta la bomba. En cada puerta cerrada de la ruta arma la entrada: uno lanza un flash (o vuela con carga una barricada conocida) y los demás lo siguen tras el estallido, todos con el mismo GO (A, B y C por orden de puerta). |
| Planificaciones siguientes | Cambia de objetivo si encontró la bomba en el otro sitio o vio vacío el suyo, y da ruta nueva al que se quedó sin ella. |
| Ejecución | Da el GO de un grupo cuando todos están en posición (tras 0,25 s), o a los 4 s de espera aunque falte alguien. |

Decide cuando termina cada fase de decisión (`Simulation.advancePhase`, como si apretara LISTO) y en cada paso de las fases en vivo. No usa el azar de la ronda (las elecciones con varias opciones usan un hash de la semilla), así que una ronda contra la IA se repite igual. Los números están en `AI_ATTACK` de `config/balance.js`. Contra la defensa del mapa gana cerca de 2 de cada 3 rondas (IA contra IA, 120 semillas). Se juega contra ella desde el menú con **Defender**.

Una `Simulation` creada con `{ phases: false }` no tiene fases: corre siempre y acepta órdenes en cualquier momento (pruebas de mecánicas sueltas).

## Entradas a salas

**Puertas sin decidir.** Si una ruta cruza una puerta cerrada, pone un **?** justo antes (`ENTRY.askDistance`, `markDoors` en `sim/orders.js`), pero si nadie decide el operador **la abre y pasa** (`ENTRY.undecided = 'open'`; con `'stop'` vuelve el comportamiento anterior: se detiene y LISTO pide confirmación).

**Menú del punto** (`ui/EntryPicker.js`). Tocar un punto de ruta, su etiqueta, un **?** o el final de la ruta abre un menú junto a él: *puerta* (Abrir, Patada, Flash y "Más": Entreabrir, Granada, Carga), *cuándo* (Ya o un color GO), *paso* (Normal o Sigilo: `setPace`, mitad de velocidad, se oye a 2 m) y *lanzar* (flash, granada o humo: el siguiente toque elige dónde cae, máximo 9 m y cortado por la primera pared; orden `setToss`, `sim/entries.js armToss`). Un punto lleva una puerta o un lanzamiento, no los dos.

**Editar y mover a la escuadra.** Arrastrar un punto lo mueve (`moveWaypoint`), arrastrar un tramo inserta uno (`insertWaypoint`), arrastrar el suelo mueve la cámara. ESCUADRA (Q, o Mayús + clic en un operador) pone a los demás en fila detrás del seleccionado (`sim/follow.js`): una sola ruta mueve a todos y en cada espera se apilan con el mismo color.

**Humo** (`sim/smoke.js`, `ENTRY.smoke`). Nube de 2,6 m de radio que tapa la vista de todos (operadores, IA, niebla, dron, cámaras) unos 14 s, pero no balas ni explosiones: sus polígonos van en `world.segments` después de los `solidCount` sólidos.

Cada espera lleva un grupo GO de color: el menú, el botón ESPERAR o la tecla H lo eligen, y el GO de ese grupo se da durante el turno (ver arriba). Un punto de ruta junto a una puerta puede llevar además cómo se entra (`sim/entries.js`, selector en pantalla o tecla E):

| Entrada | Qué hace |
| --- | --- |
| Abrir | Empuja la puerta y pasa (lo de siempre). |
| Patada | Con el GO la puerta se abre de golpe, sin pausa; aturde al que esté justo detrás y se oye lejos. |
| Entreabrir | Al llegar entorna la puerta en silencio y mira por la rendija (revela, no dispara); con el GO pasa. |
| Flash | Con el GO abre y lanza un flash ~3 m adentro; el resto de ese código espera el estallido. Ciega a quien lo mire, también a los propios, salvo al que lo lanza y a los que esperan su estallido (se cubren tras el marco). |
| Granada | Igual, pero hace daño según la distancia y sin atravesar paredes. |
| Carga | Al llegar coloca la carga (1,8 s); el GO revienta la puerta y hiere o aturde a quien esté cerca del otro lado. |

El equipo de cada operador está en `config/operators.js` (`gear`) y todos los números en `config/balance.js` (`ENTRY`). Son órdenes como datos, sin azar.

## Pruebas

`tests/determinism.test.mjs` juega rondas completas por turnos sin pantalla dos veces con la misma semilla (una por sitio) y comprueba que el resultado es idéntico. `tests/turns.test.mjs` cubre las fases, los turnos de 5 s, la explosión de la bomba, la desactivación entre turnos, los GO en vivo (incluido el que llega tarde), la elección de entrada, el ruido y la vista de cada bando. `tests/round.test.mjs` cubre la desactivación, las condiciones de victoria y la coherencia de los datos del mapa. `tests/entries.test.mjs` cubre los códigos GO y cada tipo de entrada, y repite una ronda con entradas coordinadas para comprobar el determinismo. `tests/prep.test.mjs` cubre la compra, la preparación del defensor (sitio, posiciones, vigilancia, barricadas), la de la IA, romper y volar barricadas, el dron (puertas, barricadas, lo que marca, derribo, tiempo, determinismo) y el cambio de entrada en la primera planificación. `tests/playability.test.mjs` cubre que tres operadores con ruta al mismo punto llegan (antes se empujaban entre ellos sin avanzar), que el que lanza un flash no se ciega y la ronda del tutorial. `tests/tutorial.test.mjs` recorre el tutorial guiado paso a paso, sus consejos y la salida al menú. `tests/control.test.mjs` cubre la fila de escuadra, mover e insertar puntos, el sigilo, el corte del turno al contacto y las clases. `tests/toss.test.mjs`, lanzar y el humo. `tests/cameras.test.mjs`, las cámaras. `tests/match.test.mjs`, el punto extra del que pierde, el marcador y el cambio de bando de la partida. `tests/aiAttack.test.mjs` juega rondas IA contra IA: que terminan y se repiten igual, que la IA atacante usa el dron, da GO y entra con utilidad sin órdenes rechazadas, que gana a veces y no siempre, que un jugador no puede mover a un bando de la IA, y que un operador empujado contra una pared vuelve a buscar el camino. `tests/defend.test.mjs` cubre jugar de defensor: los controladores, la preparación con órdenes (sitio, colocación con ajuste a suelo libre, vigilancia, barricadas), los modos de vigilancia del panel, el barrido de un defensor humano durante el asalto, mover un defensor entre turnos y una ronda completa. `tests/defenderClasses.test.mjs` cubre el Merodeador y el Trampero: la disposición del mapa, el tope por clase, poner y levantar trampas, que atrapan, que solo se ven con sigilo, dron o Explorador, y que los pasos del Merodeador se oyen menos. Algunos comentarios del código mencionan `docs/ARCHITECTURE.md`, `docs/BRIEF.md` y `tests/sim-plans.mjs`, que no venían en el zip original.
