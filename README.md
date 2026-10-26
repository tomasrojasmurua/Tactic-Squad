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
| Compra | 20 s | Por ahora solo muestra el equipo de cada rol (la compra llega en el hito 3). |
| Preparación | 45 s | El atacante elige entrada (el defensor no la ve) y puede adelantar rutas. El defensor sigue saliendo de los datos del mapa. |
| Planificación | 15 s | El tiempo no corre. Se trazan o cambian rutas, miradas, esperas, entradas por puerta y se programan los GO. No se ve lo que planea el rival. |
| Ejecución | 5 s | Todo se ejecuta a la vez. No hay pausa ni órdenes: lo que pase al contacto, pasa. Luego se vuelve a planificar (las rutas sin terminar siguen). |

Hasta 18 turnos (90 s de juego); al acabarse el último ganan los Defensores. **LISTO** (Espacio o Intro) termina una fase antes del plazo. Los plazos son reloj de pared (`ROUND.phaseSeconds`, en `session/PhaseClock.js`) y la sim nunca los ve: tardar 3 s o 15 s en decidir no cambia el resultado. El reloj se detiene con la ayuda abierta, la app en segundo plano o el teléfono en vertical, y no corre en el tutorial.

**GO programado.** Un GO ya no se aprieta en vivo: se programa al planificar. Cada pulsación del botón GO (o G) lo mueve: *al estar listos* → a los 1, 2, 3, 4 s del turno → sin programar. Sale en el primer instante a partir de ese segundo en que todos los que esperan ese código están en posición; si no alcanzan en este turno, queda programado para el siguiente.

**Ruido.** Pasos, puertas, patadas, disparos, cargas, granadas y la desactivación se oyen dentro de un radio (`NOISE` en `config/balance.js`, a través de paredes). Al final de cada turno lo que oyó cada bando aparece en su mapa como un pulso aproximado (celda de 3 m, corrida hasta 0,9 m con un hash de la semilla) que se apaga en 3 turnos (`sim/noise.js`). Nadie oye su propio ruido. La IA sigue oyendo como antes.

**Vista por bando.** `sim/view.js` `teamView(sim, bando)` devuelve lo que ese bando puede saber: sus unidades, los enemigos que ve ahora, dónde vio por última vez a los demás, los pulsos que oyó y la bomba si sabe dónde está. Es el filtro que usará el servidor online; los pulsos ya se dibujan desde ahí, el resto del render todavía lee la sim entera.

**Reintentar** (R al final de la ronda) repite la ronda con la misma semilla: cada fase de decisión vuelve a dar sus órdenes grabadas y se cierra sola. Cambiar algo en una fase repetida toma el control desde ahí. Durante la ronda, R la empieza de nuevo sin plan (con confirmación).

Una `Simulation` creada con `{ phases: false }` no tiene fases: corre siempre y acepta órdenes en cualquier momento (pruebas de mecánicas sueltas).

## Entradas a salas

Cada espera lleva un código GO (A, B o C): el botón o la tecla H rota entre ellos, y el GO de ese código se programa al planificar (ver arriba). Un punto de ruta junto a una puerta puede llevar además cómo se entra (`sim/entries.js`, selector en pantalla o tecla E):

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

`tests/determinism.test.mjs` juega rondas completas por turnos sin pantalla dos veces con la misma semilla (una por sitio) y comprueba que el resultado es idéntico. `tests/turns.test.mjs` cubre las fases, los turnos de 5 s, el límite de 18 turnos, la desactivación entre turnos, los GO programados, la elección de entrada, el ruido y la vista de cada bando. `tests/round.test.mjs` cubre la desactivación, las condiciones de victoria y la coherencia de los datos del mapa. `tests/entries.test.mjs` cubre los códigos GO y cada tipo de entrada, y repite una ronda con entradas coordinadas para comprobar el determinismo. Algunos comentarios del código mencionan `docs/ARCHITECTURE.md`, `docs/BRIEF.md` y `tests/sim-plans.mjs`, que no venían en el zip original.
