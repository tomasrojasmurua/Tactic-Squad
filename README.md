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
| `src/sim/` | Simulación autoritativa y determinista: unidades, movimiento, visión, combate, IA, puertas, objetivos | Sin DOM, WebGL, audio ni reloj real. Solo avanza con `step(dt)` y la semilla (`core/rng.js`). Recibe órdenes como datos (`sim/orders.js`) y reporta con eventos. |
| `src/config/` | Todos los números y fichas: equilibrio (`balance.js`), armas, roles de operador, escuadra, render, audio, UI | Los números de juego van aquí, no en el código de la sim. |
| `src/data/` | Mapas (`maps/`) y props como datos puros | Un mapa nuevo = un archivo y una línea en `maps/index.js`. |
| `src/core/` | Utilidades sin dependencias: matemáticas, geometría, RNG, bus de eventos, bucle fijo | |
| `src/session/` | Estado de la partida fuera de la sim: fases de pantalla, pausa, tutorial, grabación de planes | |
| `src/input/` | Mouse, teclado y táctil; planificación de rutas | |
| `src/render/` | Renderer WebGL2 por capas, shaders, geometría y efectos | Solo lee la sim. |
| `src/audio/` | Motor de audio procedural, sonidos horneados en un worker, música | Solo escucha eventos. |
| `src/ui/` | HUD, pantallas y textos (`texts.js`) | |

Para agregar una clase de operador: una entrada en `config/operators.js` (`ROLES`) y, si tiene habilidad, un módulo en `sim/abilities/` registrado en `sim/abilities/index.js`.

## Objetivo de la ronda

Los Defensores dejan la bomba en el sitio A o en el B (por ahora lo decide la semilla de la ronda; un reintento conserva el sitio). Los Atacantes no saben en cuál está hasta verla. Para ganar la desactivan, 7 s quietos junto a ella sin disparar (moverse o morir pierde el progreso), o eliminan a todos los Defensores. Los Defensores ganan si se acaba el tiempo o eliminan a todos los Atacantes.

Cada mapa declara como datos (`src/data/maps/warehouse.js`): `sites` (rectángulo y punto de la bomba), `entries` (puerta y posiciones de inicio de cada entrada atacante), `deployment` (línea de despliegue y mitad de cada bando), puertas con `barricade: true` (huecos aptos para barricadas) y `defense` (la disposición de los Defensores para cada sitio, hasta que llegue la fase de preparación).

## Entradas a salas

Cada espera lleva un código GO (A, B o C): el botón o la tecla H rota entre ellos, y GO (tecla G o botón) suelta a los que esperan el siguiente código. Un punto de ruta junto a una puerta puede llevar además cómo se entra (`sim/entries.js`, selector en pantalla o tecla E):

| Entrada | Qué hace |
| --- | --- |
| Abrir | Empuja la puerta y pasa (lo de siempre). |
| Patada | Con el GO la puerta se abre de golpe, sin pausa; aturde al que esté justo detrás y se oye lejos. |
| Entreabrir | Al llegar entorna la puerta en silencio y mira por la rendija (revela, no dispara); con el GO pasa. |
| Flash | Con el GO abre y lanza un flash ~3 m adentro; el resto de ese código espera el estallido. Ciega a quien lo mire, también a los propios. |
| Granada | Igual, pero hace daño según la distancia y sin atravesar paredes. |
| Carga | Al llegar coloca la carga (1,8 s); el GO revienta la puerta y hiere o aturde a quien esté cerca del otro lado. |

El equipo de cada operador está en `config/operators.js` (`gear`) y todos los números en `config/balance.js` (`ENTRY`). Son órdenes como datos, sin azar: funcionan igual en tiempo real y en turnos We-Go.

## Pruebas

`tests/determinism.test.mjs` juega rondas completas sin pantalla dos veces con la misma semilla (una por sitio) y comprueba que el resultado es idéntico. `tests/round.test.mjs` cubre la desactivación, las condiciones de victoria y la coherencia de los datos del mapa. `tests/entries.test.mjs` cubre los códigos GO y cada tipo de entrada, y repite una ronda con entradas coordinadas para comprobar el determinismo. Algunos comentarios del código mencionan `docs/ARCHITECTURE.md`, `docs/BRIEF.md` y `tests/sim-plans.mjs`, que no venían en el zip original.
