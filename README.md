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

Al abrir el juego aparece el menú principal con tres opciones: **Atacar** y **Defender** (una ronda completa contra la IA, que juega el otro bando) y **Tutorial guiado** (siempre de atacante). Intro ataca. Desde la partida se vuelve al menú con el botón MENÚ (en escritorio, en la barra de abajo; en el celular, dentro de Ayuda; también al final de la ronda). Si ya hay un plan, pide una segunda pulsación para confirmar.

El tutorial (`session/Tutorial.js`, tarjeta en `ui/TutorialCard.js`, textos en `ui/flowTexts.js`) recorre una ronda real paso a paso: compra, preparación y entrada, dron, planificación (elegir operador, trazar ruta, decidir la puerta con su entrada y su GO, la mirada), ejecutar el turno, dar el GO y el fin del turno. Hay dos tipos de paso. Las tarjetas de explicación se cierran con ENTENDIDO, LISTO o Intro, y la del dron detiene el dron hasta cerrarla. Los pasos de acción avanzan solos cuando se hace el gesto. LISTO solo funciona en los pasos que lo piden. Después siguen saliendo, una sola vez, consejos de barricada y de desactivar. La ronda del tutorial es más fácil (`TUTORIAL` en `config/ui.js`): semilla fija, bomba en B y solo 2 defensores (opción `defenders` de `Simulation`, que elige qué puestos de `defense` se ocupan). Se puede saltar en cualquier momento, y queda recordado en el dispositivo cuando se termina.

## Objetivo de la ronda

Los Defensores dejan la bomba en el sitio A o en el B (la IA lo decide con la semilla de la ronda, así que un reintento conserva el sitio; un defensor humano lo elige en la preparación). Los Atacantes no saben en cuál está hasta verla. Para ganar la desactivan, 7 s quietos junto a ella sin disparar (moverse o morir pierde el progreso), o eliminan a todos los Defensores. Los Defensores ganan si se acaba el tiempo o eliminan a todos los Atacantes.

Cada mapa declara como datos (`src/data/maps/warehouse.js`): `sites` (rectángulo y punto de la bomba), `entries` (puerta y posiciones de inicio de cada entrada atacante), `deployment` (línea de despliegue y mitad de cada bando), puertas con `barricade: true` (huecos aptos para barricadas; cuentan solo los que tocan la mitad defensora), `defense` (la disposición de la IA defensora en cada sitio, y el punto de partida de un defensor humano) `aiBarricades` (entre qué puertas elige la IA sus 2 barricadas en cada sitio) y `aiEntries` (por qué entradas ataca la IA cada sitio, con pesos).

## Fases de la ronda y turnos We-Go

La ronda vive en la simulación (`sim/round.js`): **compra → preparación → dron → planificación ⇄ ejecución → fin**.

| Fase | Plazo | Qué se hace |
| --- | --- | --- |
| Compra | sin límite | Cada atacante compra su utilidad con su propio dinero (ver abajo). |
| Preparación | sin límite | A ciegas y a la vez. El atacante elige entrada (el defensor no la ve) y puede adelantar rutas. El defensor elige sitio, coloca a los suyos, les da órdenes de vigilancia y pone 2 barricadas (la IA lo hace al empezar la fase). |
| Dron | 15 s | El atacante maneja el dron en tiempo real (ver abajo). El tiempo de la bomba no corre. LISTO lo retira antes. |
| Planificación | sin límite | El tiempo no corre. Se trazan o cambian rutas, miradas, esperas en grupos GO (A, B, C) y entradas por puerta. No se ve lo que planea el rival. En la primera, antes de ejecutar, todavía se puede cambiar la entrada (borra las rutas). |
| Ejecución | 5 s | Todo se ejecuta a la vez, sin pausa. La única orden son los GO: el jugador dice "¡ahora!" y ese grupo actúa junto. Luego se vuelve a planificar (las rutas sin terminar siguen). |

**Temporizador de la bomba.** La bomba explota tras 90 s de ejecución, 18 turnos (`ROUND.timeLimit`); solo corre durante los turnos, así que planificar es gratis pero cada turno la acerca. En 0 explota aunque alguien esté a mitad de la desactivación, y ganan los Defensores. En los últimos 20 s pita cada vez más rápido.

**LISTO** (Espacio o Intro) termina una fase. Contra la IA no hay plazo (`ROUND.phaseSeconds` en `null`); para el juego online se pondrá un límite, por ejemplo 60 s para planificar. Los plazos son reloj de pared (`session/PhaseClock.js`) y la sim nunca los ve: tardar 3 s o 15 s en decidir no cambia el resultado.

**Grupos GO en vivo.** Al planificar, cada espera (H o el botón ESPERAR) se asigna a un grupo A, B o C. Durante el turno aparecen los botones GO A/B/C con cuántos del grupo están en posición (por ejemplo 2/3); G llama al primero que tiene a alguien esperando. Al apretarlo, los que esperan salen juntos (si uno lanza flash o granada, los demás esperan el estallido) y los que aún no llegan a su espera ya no se detienen: siguen de largo y hacen su entrada al llegar. Si nadie aprieta, siguen esperando en el turno siguiente. Cada GO se graba con el paso del turno en que se dio (`atTick`), así que el reintento y el futuro servidor lo aplican en el mismo instante.

**Ruido.** Pasos, puertas, patadas, disparos, cargas, granadas y la desactivación se oyen dentro de un radio (`NOISE` en `config/balance.js`, a través de paredes). Al final de cada turno lo que oyó cada bando aparece en su mapa como un pulso aproximado (celda de 3 m, corrida hasta 0,9 m con un hash de la semilla) que se apaga en 3 turnos (`sim/noise.js`). Nadie oye su propio ruido. La IA sigue oyendo como antes.

**Vista por bando.** `sim/view.js` `teamView(sim, bando)` devuelve lo que ese bando puede saber: sus unidades, los enemigos que ve ahora, dónde vio por última vez a los demás, los pulsos que oyó y la bomba si sabe dónde está. Es el filtro que usará el servidor online; los pulsos ya se dibujan desde ahí, el resto del render todavía lee la sim entera.

**Reintentar** (R al final de la ronda) repite la ronda con la misma semilla: cada fase de decisión vuelve a dar sus órdenes grabadas y se cierra sola. Cambiar algo en una fase repetida toma el control desde ahí. Durante la ronda, R la empieza de nuevo sin plan (con confirmación).

## Preparación de ambos bandos (hito 3)

**Compra** (`sim/prep.js`, `BUY` en `config/balance.js`). Cada atacante tiene $800 por ronda y empieza con el equipo de su rol ya pagado (el Asaltante lleva flash y granada y le quedan $300; el de Entrada lleva además la carga y le queda $0). En el panel, tocar un objeto compra otro y − lo devuelve. Precios: flash $200, granada $300, carga $300; como máximo 2 flash, 1 granada y 2 cargas. La economía entre rondas llega con la partida al mejor de 7.

**Defensor.** Órdenes de la preparación (`sim/orders.js`): `chooseSite` (la bomba va a ese sitio y el despliegue vuelve al del mapa para él), `placeUnit` (solo en la mitad defensora, en suelo transitable y a 0,7 m o más de un compañero), `setWatch` y `barricade` (hasta 2, solo en las puertas de `barricadeSlots`). Las órdenes de vigilancia se vuelven los comportamientos de la IA (`sim/ai.js`), así que funcionan solas en el asalto:

| Orden | Datos | Comportamiento |
| --- | --- | --- |
| Ángulo fijo | `{facing}` | Mantiene el ángulo y no se gira por ruidos. |
| Barrer | `{facing, sweep: [desde, hasta]}` | Barre entre dos ángulos (`PREP.sweepPeriod`). |
| Reaccionar a ruido | `{facing, react: true}` | Mantiene el ángulo y se gira hacia lo que oye. |
| Replegarse | `{facing, react: true, fallback: {to, look}}` | Con el primer tiroteo que oye va a ese punto (de su mitad) y mira hacia `look`. |

La IA defensora se prepara al empezar la preparación: el sitio que sale de la semilla, la disposición del mapa para ese sitio y 2 barricadas elegidas entre las `aiBarricades` del sitio con un hash de la semilla (no usa el azar de la ronda). 
**Jugar de defensor** (menú → Defender; `session.team = 'defenders'`, la IA atacante de `sim/aiAttack.js` juega el otro bando):

- La compra la hace la IA y se salta sola. La preparación empieza con la disposición del mapa para el sitio que salió de la semilla.
- En la preparación, el panel **Tu defensa** (`ui/PhasePanel.js`, a la derecha; en el celular a la izquierda, sobre el patio) tiene tres partes:
  - el sitio de la bomba (cambiarlo vuelve a la disposición del mapa para ese sitio);
  - las 2 barricadas, una por botón de puerta;
  - la vigilancia del defensor elegido (`session/watch.js`): **Ángulo fijo** (no reacciona al ruido), **Barrer** (barre 70° alrededor de su mirada y reacciona) y **Atento** (mirada fija, reacciona).
- Se coloca con los mismos gestos de las rutas (`input/PlanningController.js`): con un defensor elegido, tocar o hacer clic en el suelo lo pone ahí (solo en la mitad defensora; si cae sobre un mueble, se corre al hueco libre más cercano). Clic derecho y arrastrar (en el celular, mantener pulsado y arrastrar) lo orienta. Un repliegue del mapa se conserva al cambiar de modo.
- El dron es del atacante: el defensor solo lo ve venir y no puede retirarlo.
- En cada planificación puede mover defensores con rutas, igual que el atacante. Un defensor movido deja su patrulla, barrido o repliegue y se queda mirando hacia donde se le indique al llegar.
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

**Puertas sin decidir.** Si una ruta cruza una puerta cerrada, el juego no decide por ti: pone un punto **?** justo antes de la puerta (`ENTRY.askDistance`, `markDoors` en `sim/orders.js`) y el soldado se detiene ahí. Mientras quede un **?**, el selector de entrada del operador muestra esa puerta y se queda en ella hasta decidir también el cuándo (`targetIndex` en `session/Session.js`). Al tocar el **?** el selector pregunta *cómo* (abrir, patada, entreabrir, flash, granada, carga) y *cuándo* (de inmediato o con el GO A, B o C); "Abrir, de inmediato" es pasar de corrido como antes, pero elegido. Si aprietas LISTO con alguna puerta en **?**, avisa y pide un segundo LISTO para confirmar; esos soldados esperan en la puerta y decides en la siguiente planificación.

Cada espera lleva un grupo GO (A, B o C): el botón o la tecla H rota entre ellos, y el GO de ese grupo se da durante el turno (ver arriba). Un punto de ruta junto a una puerta puede llevar además cómo se entra (`sim/entries.js`, selector en pantalla o tecla E):

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

`tests/determinism.test.mjs` juega rondas completas por turnos sin pantalla dos veces con la misma semilla (una por sitio) y comprueba que el resultado es idéntico. `tests/turns.test.mjs` cubre las fases, los turnos de 5 s, la explosión de la bomba, la desactivación entre turnos, los GO en vivo (incluido el que llega tarde), la elección de entrada, el ruido y la vista de cada bando. `tests/round.test.mjs` cubre la desactivación, las condiciones de victoria y la coherencia de los datos del mapa. `tests/entries.test.mjs` cubre los códigos GO y cada tipo de entrada, y repite una ronda con entradas coordinadas para comprobar el determinismo. `tests/prep.test.mjs` cubre la compra, la preparación del defensor (sitio, posiciones, vigilancia, barricadas), la de la IA, romper y volar barricadas, el dron (puertas, barricadas, lo que marca, derribo, tiempo, determinismo) y el cambio de entrada en la primera planificación. `tests/playability.test.mjs` cubre que tres operadores con ruta al mismo punto llegan (antes se empujaban entre ellos sin avanzar), que el que lanza un flash no se ciega y la ronda del tutorial. `tests/tutorial.test.mjs` recorre el tutorial guiado paso a paso, sus consejos y la salida al menú. `tests/aiAttack.test.mjs` juega rondas IA contra IA: que terminan y se repiten igual, que la IA atacante usa el dron, da GO y entra con utilidad sin órdenes rechazadas, que gana a veces y no siempre, que un jugador no puede mover a un bando de la IA, y que un operador empujado contra una pared vuelve a buscar el camino. `tests/defend.test.mjs` cubre jugar de defensor: los controladores, la preparación con órdenes (sitio, colocación con ajuste a suelo libre, vigilancia, barricadas), los modos de vigilancia del panel, el barrido de un defensor humano durante el asalto, mover un defensor entre turnos y una ronda completa. Algunos comentarios del código mencionan `docs/ARCHITECTURE.md`, `docs/BRIEF.md` y `tests/sim-plans.mjs`, que no venían en el zip original.
