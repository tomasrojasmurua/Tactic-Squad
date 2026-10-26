# Tactic Squad

Juego web táctico de escuadra en vista cenital. JavaScript puro (módulos ES, sin framework) y WebGL2 propio. Interfaz en español; se juega en escritorio y en celular.

## Cómo correrlo

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

## Objetivo de la ronda

Los Defensores dejan la bomba en el sitio A o en el B (por ahora lo decide la semilla de la ronda; un reintento conserva el sitio). Los Atacantes no saben en cuál está hasta verla. Para ganar la desactivan, 7 s quietos junto a ella sin disparar (moverse o morir pierde el progreso), o eliminan a todos los Defensores. Los Defensores ganan si se acaba el tiempo o eliminan a todos los Atacantes.

Cada mapa declara como datos (`src/data/maps/warehouse.js`): `sites` (rectángulo y punto de la bomba), `entries` (puerta y posiciones de inicio de cada entrada atacante), `deployment` (línea de despliegue y mitad de cada bando), puertas con `barricade: true` (huecos aptos para barricadas) y `defense` (la disposición de los Defensores para cada sitio, hasta que llegue la fase de preparación).

## Fases de la ronda y turnos We-Go

La ronda vive en la simulación (`sim/round.js`): **compra → preparación → planificación ⇄ ejecución → fin**.

| Fase | Plazo | Qué se hace |
| --- | --- | --- |
| Compra | sin límite | Por ahora solo muestra el equipo de cada rol (la compra llega en el hito 3). |
| Preparación | sin límite | El atacante elige entrada (el defensor no la ve) y puede adelantar rutas. El defensor sigue saliendo de los datos del mapa. |
| Planificación | sin límite | El tiempo no corre. Se trazan o cambian rutas, miradas, esperas en grupos GO (A, B, C) y entradas por puerta. No se ve lo que planea el rival. |
| Ejecución | 8 s | Todo se ejecuta a la vez, sin pausa. La única orden son los GO: el jugador dice "¡ahora!" y ese grupo actúa junto. Luego se vuelve a planificar (las rutas sin terminar siguen). |

**Temporizador de la bomba.** La bomba explota tras 3 minutos de ejecución (`ROUND.timeLimit`); solo corre durante los turnos, así que planificar es gratis pero cada turno la acerca. En 0 explota aunque alguien esté a mitad de la desactivación, y ganan los Defensores. En los últimos 30 s pita cada vez más rápido.

**LISTO** (Espacio o Intro) termina una fase. Contra la IA no hay plazo (`ROUND.phaseSeconds` en `null`); para el juego online se pondrá un límite, por ejemplo 60 s para planificar. Los plazos son reloj de pared (`session/PhaseClock.js`) y la sim nunca los ve: tardar 3 s o 15 s en decidir no cambia el resultado.

**Grupos GO en vivo.** Al planificar, cada espera (H o el botón ESPERAR) se asigna a un grupo A, B o C. Durante el turno aparecen los botones GO A/B/C con cuántos del grupo están en posición (por ejemplo 2/3); G llama al primero que tiene a alguien esperando. Al apretarlo, los que esperan salen juntos (si uno lanza flash o granada, los demás esperan el estallido) y los que aún no llegan a su espera ya no se detienen: siguen de largo y hacen su entrada al llegar. Si nadie aprieta, siguen esperando en el turno siguiente. Cada GO se graba con el paso del turno en que se dio (`atTick`), así que el reintento y el futuro servidor lo aplican en el mismo instante.

**Ruido.** Pasos, puertas, patadas, disparos, cargas, granadas y la desactivación se oyen dentro de un radio (`NOISE` en `config/balance.js`, a través de paredes). Al final de cada turno lo que oyó cada bando aparece en su mapa como un pulso aproximado (celda de 3 m, corrida hasta 0,9 m con un hash de la semilla) que se apaga en 3 turnos (`sim/noise.js`). Nadie oye su propio ruido. La IA sigue oyendo como antes.

**Vista por bando.** `sim/view.js` `teamView(sim, bando)` devuelve lo que ese bando puede saber: sus unidades, los enemigos que ve ahora, dónde vio por última vez a los demás, los pulsos que oyó y la bomba si sabe dónde está. Es el filtro que usará el servidor online; los pulsos ya se dibujan desde ahí, el resto del render todavía lee la sim entera.

**Reintentar** (R al final de la ronda) repite la ronda con la misma semilla: cada fase de decisión vuelve a dar sus órdenes grabadas y se cierra sola. Cambiar algo en una fase repetida toma el control desde ahí. Durante la ronda, R la empieza de nuevo sin plan (con confirmación).

Una `Simulation` creada con `{ phases: false }` no tiene fases: corre siempre y acepta órdenes en cualquier momento (pruebas de mecánicas sueltas).

## Entradas a salas

**Puertas sin decidir.** Si una ruta cruza una puerta cerrada, el juego no decide por ti: pone un punto **?** justo antes de la puerta (`ENTRY.askDistance`, `markDoors` en `sim/orders.js`) y el soldado se detiene ahí. Al tocar el **?** el selector pregunta *cómo* (abrir, patada, entreabrir, flash, granada, carga) y *cuándo* (de inmediato o con el GO A, B o C); "Abrir, de inmediato" es pasar de corrido como antes, pero elegido. Si aprietas LISTO con alguna puerta en **?**, avisa y pide un segundo LISTO para confirmar; esos soldados esperan en la puerta y decides en la siguiente planificación.

Cada espera lleva un grupo GO (A, B o C): el botón o la tecla H rota entre ellos, y el GO de ese grupo se da durante el turno (ver arriba). Un punto de ruta junto a una puerta puede llevar además cómo se entra (`sim/entries.js`, selector en pantalla o tecla E):

| Entrada | Qué hace |
| --- | --- |
| Abrir | Empuja la puerta y pasa (lo de siempre). |
| Patada | Con el GO la puerta se abre de golpe, sin pausa; aturde al que esté justo detrás y se oye lejos. |
| Entreabrir | Al llegar entorna la puerta en silencio y mira por la rendija (revela, no dispara); con el GO pasa. |
| Flash | Con el GO abre y lanza un flash ~3 m adentro; el resto de ese código espera el estallido. Ciega a quien lo mire, también a los propios. |
| Granada | Igual, pero hace daño según la distancia y sin atravesar paredes. |
| Carga | Al llegar coloca la carga (1,8 s); el GO revienta la puerta y hiere o aturde a quien esté cerca del otro lado. |

El equipo de cada operador está en `config/operators.js` (`gear`) y todos los números en `config/balance.js` (`ENTRY`). Son órdenes como datos, sin azar.

## Pruebas

`tests/determinism.test.mjs` juega rondas completas por turnos sin pantalla dos veces con la misma semilla (una por sitio) y comprueba que el resultado es idéntico. `tests/turns.test.mjs` cubre las fases, los turnos de 8 s, la explosión de la bomba, la desactivación entre turnos, los GO en vivo (incluido el que llega tarde), la elección de entrada, el ruido y la vista de cada bando. `tests/round.test.mjs` cubre la desactivación, las condiciones de victoria y la coherencia de los datos del mapa. `tests/entries.test.mjs` cubre los códigos GO y cada tipo de entrada, y repite una ronda con entradas coordinadas para comprobar el determinismo. Algunos comentarios del código mencionan `docs/ARCHITECTURE.md`, `docs/BRIEF.md` y `tests/sim-plans.mjs`, que no venían en el zip original.
