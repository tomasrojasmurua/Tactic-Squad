# Arquitectura de Tactic Squad

Estado del código: rama `claude/revision-ux-fases` (sobre `main` tras el PR #9), 27 de octubre de 2026 (~21.300 líneas en `src/`).
La sección 11 resume qué agregó esta rama y dónde.
Este documento describe **cómo está construido el código**. El diseño del juego y las
reglas están en `README.md`; acá va la estructura, el flujo de datos, las reglas que
sostiene cada capa y los puntos por donde se extiende.

JavaScript puro: módulos ES nativos, sin framework, sin dependencias en tiempo de
ejecución. La única dependencia de desarrollo es `esbuild`, y solo para empaquetar el
juego en un HTML único. El navegador carga `index.html` y de ahí `src/main.js`; no hay
paso de compilación obligatorio.

---

## 1. Capas y dependencias

```
                          ┌──────────────────────────┐
   data/ (mapas, props) ─▶│  sim/  SIMULACIÓN         │◀── config/ (todos los números)
                          │  autoritativa, determinista│
                          └────────────┬─────────────┘
                              órdenes  │  eventos + estado de solo lectura
                                   ▲   ▼
                          ┌──────────────────────────┐
                          │  Game.js  (raíz)          │
                          │  EventBus + FixedLoop     │
                          └──┬────────┬────────┬─────┘
                             │        │        │
                   session/ ─┘   input/ ┘   render/ ui/ audio/
                   (fases de     (gestos)   (presentación: solo leen)
                    pantalla)
```

La regla de dependencias es unidireccional: **nada de `sim/` importa de `render/`,
`ui/`, `input/`, `audio/` o `session/`.** Al revés sí, pero con un contrato estrecho:
las capas de presentación solo pueden importar de `sim/` los lectores puros
(`sim/queries.js`, `sim/vision.js`, `sim/view.js`) y los datos compilados del mapa.

| Carpeta | Líneas | Qué es | Regla que cumple |
| --- | --- | --- | --- |
| `src/core/` | 424 | Matemática, geometría 2D, RNG sembrado, bus de eventos, bucle fijo, `mat4` | Sin dependencias, funciones puras o estructuras mínimas |
| `src/config/` | 1.380 | Todos los números y fichas: `balance.js`, `weapons.js`, `operators.js`, `squad.js`, `render.js`, `audio.js`, `ui.js`, `input.js`, `materials.js` | Ningún número de juego vive en el código de la sim |
| `src/data/` | 333 | Mapas (`maps/warehouse.js`) y catálogo de muebles, como datos puros | Un mapa nuevo = un archivo + una línea en `maps/index.js` |
| `src/sim/` | 5.271 | Estado autoritativo y determinista de la ronda | Sin DOM, WebGL, audio ni reloj real. Solo avanza con `step(dt)` |
| `src/session/` | 1.219 | Lo que no es de la sim: fases en pantalla, plazos de reloj de pared, tutorial, grabación de planes, partida al mejor de 7 | En el online, el servidor hará de `PhaseClock` |
| `src/input/` | 1.330 | Mouse, teclado, táctil, dron; trazado de rutas | Nunca muta la sim: emite órdenes al bus |
| `src/render/` | 5.116 | Renderer WebGL2 propio por capas, shaders GLSL ES 3.0, geometría, efectos | Solo lee la sim |
| `src/ui/` | 2.400 | HUD en DOM, pantallas, textos en español | Todos los strings en `ui/texts.js` y `ui/flowTexts.js` |
| `src/audio/` | 3.633 | Motor de audio procedural, sonidos horneados en un worker, música generativa | Solo escucha eventos |

---

## 2. El núcleo: `Game.js`, el bus y el bucle fijo

`src/Game.js` es la **raíz de composición**: construye cada subsistema, es dueño de la
`Simulation` actual y del bucle, y los cablea. Los subsistemas no se conocen entre sí:
hablan por el bus (`core/EventBus.js`, publicación/suscripción síncrona).

```
input  ──EV.COMMAND──▶ sim.enqueue
sim    ──drainEvents──▶ bus.emit  (flushEvents, después de cada paso)
input/ui ──EV.REQUEST / EV.SELECT──▶ SessionController
render / audio / ui ◀── eventos del bus + estado de solo lectura (sim, session)
```

La simulación **nunca llama al bus**: encola eventos y `Game.flushEvents()` los publica
después del paso, así ningún oyente puede reentrar en la simulación a mitad de un paso.

`core/events.js` es el catálogo canónico de eventos (`EV`), con el payload de cada uno
documentado en el mismo archivo. Son dos familias: eventos de la simulación (hechos del
mundo: `SHOT`, `HIT`, `DOOR_OPEN`, `BOMB_DEFUSED`, `ROUND_PHASE`…) y eventos de
sesión/UI (peticiones y cambios de pantalla: `REQUEST`, `SELECT`, `PHASE`, `NOTICE`…).

`core/FixedLoop.js` da el paso fijo: la simulación avanza en incrementos exactos de
1/60 s (`SIM.tickRate`), el render corre una vez por `requestAnimationFrame` con un
factor de interpolación `alpha` entre los dos últimos estados. Cuando `simulating` es
`false` (planificación, pausa) el tiempo no avanza la sim, pero se sigue dibujando y las
órdenes se aplican al instante para que las rutas se actualicen en vivo.

### Determinismo

Es el requisito transversal del proyecto, y lo que hace posibles los turnos We-Go, el
reintento y el online por lockstep más adelante:

- `core/rng.js` (mulberry32 sembrado) es la **única** fuente de azar de la sim. Nunca
  `Math.random()`.
- Paso fijo, nunca `dt` variable dentro de la sim.
- Ninguna lectura de reloj real: los plazos de las fases viven fuera (`PhaseClock`), y
  la sim no los ve. Tardar 3 s o 15 s en decidir no puede cambiar el resultado.
- Las órdenes son objetos planos serializables (`sim/orders.js`), y las que se dan
  durante un turno en vivo (un GO, el mando del dron) van **selladas con el paso**
  (`atTick`), así se reaplican en el mismo instante.
- Las decisiones de la IA que no afectan al estado usan un hash de la semilla, no
  `sim.rng`, para no desplazar el flujo de azar del resto de la ronda.
- `tests/determinism.test.mjs` juega rondas completas dos veces con la misma semilla y
  compara el resultado.

---

## 3. `src/sim/`: la simulación

`sim/Simulation.js` es el estado autoritativo. Se construye con los datos del mapa y
opciones (`seed`, `controllers`, `site`, `entry`, `defenders`, `phases`, `stopOnContact`,
`loadout`) y expone una
superficie pequeña: `step(dt)`, `enqueue(cmd)`, `flushCommands()`, `advancePhase()`,
`drainEvents()`, más `phase` y `turn` de solo lectura.

### Orden de un paso

`Simulation.step()` es el único lugar que fija el orden de los sistemas, y ese orden es
parte del contrato determinista:

```
canStep?  (en fases de decisión el tiempo no corre)
  ├─ fase 'drone' → stepDrone: solo el dron se mueve; los defensores solo giran
  └─ fase 'exec'  → flushCommands
                    attackAiTick
                    guardar pos/ángulo previos (para interpolar al dibujar)
                    updateDoors → updateBash → updateEntries → updateSmokes
                    updatePerception → updateCameras → (contacto: corte del turno)
                    updateMemory → spotBarricades
                    por unidad: updateAiUnit → updateFacing → updateMovement
                    resolveCollisions
                    updateCombat → updateAbilities → updateObjectives
                    collectNoise → afterTick (fin de turno: turnEndAbilities; fin de ronda)
```

### Módulos

| Módulo | Responsabilidad |
| --- | --- |
| `round.js` | Fases dentro de la sim: `buy → prep → drone → plan ⇄ exec → end`. Decide qué órdenes son válidas, así que es estado autoritativo, no pantalla. Turnos de 5 s (`TURN_TICKS`), cortados al contacto si `stopOnContact` (nunca antes de `ROUND.minContactSeconds`); al cerrar un turno llama a las habilidades `turnEnd` |
| `mapCompiler.js` | Convierte los datos del mapa en geometría de runtime: cajas de pared con los huecos de puerta recortados, bisagras, huellas de muebles, zonas, sitios, entradas, mitades de despliegue y huecos para barricada. Puro |
| `World.js` | Geometría estática + los segmentos dinámicos de las puertas y del humo: cajas de colisión, lista plana de segmentos y la grilla de navegación. Los primeros `solidCount` segmentos son sólidos (paredes, puertas); detrás van los polígonos de humo, que solo cortan la vista. **Balas, explosiones y lanzamientos usan `solidCount`; la vista usa `segmentCount`** |
| `NavGrid.js` | A* de 8 vecinos sobre una grilla de ocupación inflada por holgura, y "string pulling" a unos pocos tramos rectos. Las puertas cerradas no son obstáculo |
| `orders.js` | Comandos del jugador → estado de ruta de la unidad. Objetos planos serializables (la unidad de intercambio para We-Go y red). Códigos de rechazo en `REJECT`. Nuevas en esta rama: `moveWaypoint`, `insertWaypoint`, `setPace`, `setToss`, `follow` / `unfollow`, `setRole` |
| `routePoint.js` | La forma única de un punto de ruta (`{x, y, user, look, hold, code, entry, entryDoor, ask, door, pace, toss}`) |
| `follow.js` | Ruta de escuadra: el seguidor recorre la ruta del líder `MOVE.fileGap × rango` detrás y se apila en sus esperas con el mismo código GO. Se reconstruye por órdenes (determinista); una orden propia lo desvincula |
| `units.js` | Fábrica de unidades. Todo lo que varía por operador sale de su ROL (`config/operators.js`): los sistemas leen `u.maxHp`, `u.mods.*`, `u.vision`, `u.ability`, nunca un valor fijo por unidad |
| `movement.js` | Orientación y seguimiento de ruta. "Cortar la torta": sin orden de mirada explícita, el operador apunta a un punto adelante de su ruta, así gira hacia la esquina o la puerta antes de llegar |
| `collisions.js` | Separación blanda entre aliados (una fila junto a la puerta), separación dura y empuje fuera de paredes, muebles y puertas cerradas |
| `vision.js` | Línea de vista y polígonos de visibilidad. Geometría pura sobre la lista de segmentos, **compartida** por la percepción y la niebla de guerra: lo que ves en pantalla es exactamente lo que la sim considera visible |
| `perception.js` | Quién ve a quién en este paso, adquisición de blanco y tiempos de reacción |
| `combat.js` | Disparo: retardo de reacción, ráfagas, dispersión y retroceso, balas hitscan, cobertura baja, daño por parte del cuerpo |
| `doors.js` | Puertas con bisagra: abrir, entreabrir, patear, volar. La geometría de la hoja alimenta LOS y balas |
| `entries.js` | Entradas a puerta estilo Door Kickers: `kick`, `slow` (entreabrir), `flash`, `frag`, `breach`, armadas en un punto de ruta y liberadas con un GO. Una puerta sin decidir se abre al pasar (`ENTRY.undecided = 'open'`). También el **lanzamiento libre** (`armToss`, modo `toss`): flash, granada o humo a un punto, cortado por `queries.tossLanding` |
| `smoke.js` | Nubes de humo: crecen, duran y se disipan; `World.updateSmokeSegments` las convierte en polígonos que tapan la vista |
| `cameras.js` | Cámaras del defensor (`aiCameras` del mapa, por sitio): ven atacantes y alertan a la IA, se descubren (operadores, dron) y se rompen de un tiro |
| `traps.js` | Trampas del Trampero (`aiTraps` del mapa, orden `placeTrap`): atrapan al atacante que las pisa y lo delatan; se descubren con sigilo, dron o pulso del Explorador y se rompen de un tiro |
| `barricades.js` | Barricadas: bloquean cuerpo, vista, balas y dron; romperlas a golpes o volarlas con carga. `sim.intel` = qué barricadas conocen los atacantes |
| `drone.js` | Dron de reconocimiento del atacante (fase `drone`): se maneja en tiempo real con órdenes selladas por paso; pasa bajo las puertas, no por barricadas |
| `prep.js` | Compra (dinero por operador), **clase** (`setRole`: reembolsa el equipo, aplica la clase, cobra su equipo) y preparación del defensor: elegir sitio, colocar, vigilancia, barricadas, cámaras del sitio. `applyLayout` aplica el rol de cada puesto (`role: 'anchor'`) |
| `objectives.js` | La bomba, encontrarla, desactivarla (7 s quieto) y el resultado de la ronda |
| `noise.js` | Qué oye cada bando del otro. Se lee de los eventos que el paso emitió, así que ningún sistema necesita saber del ruido. Al final del turno los ruidos oídos se vuelven pulsos aproximados en el mapa del que escucha |
| `view.js` | `teamView(sim, bando)`: **lo que un bando puede saber**. Es el filtro que aplicará el servidor online antes de mandar un frame |
| `ai.js` | Comportamientos del defensor: mantener ángulo, barrer, patrullar, replegarse. Las alertas (tiros, dolor, pasos) lo hacen pre-apuntar la esquina o puerta por donde tiene que venir la amenaza |
| `aiAttack.js` | La IA atacante como **comandante**, no como reflejos: da a su escuadra las mismas órdenes que un jugador, en los mismos momentos, y sabe solo lo que sabe su bando |
| `abilities/` | Registro de habilidades por rol: un módulo `{id, init?, update?, turnEnd?}` por gadget. Hoy: `scoutPulse` (Explorador: al cerrar el turno, los defensores a `SCOUT.radius` entran en la memoria del bando) |
| `debrief.js` | El "por qué" del final, como hechos y códigos, nunca como texto: la causa de cada muerte y notas de la ronda. La UI los convierte en frases |
| `queries.js` | Preguntas de solo lectura sobre el estado, el **único** helper de la sim (con `vision.js` y `view.js`) que input/ui/render pueden importar |

### Vista por jugador

`sim/view.js teamView(sim, team)` devuelve lo que ese bando puede saber: sus unidades,
los enemigos que ve ahora, la última posición conocida de los demás, los pulsos de ruido
que oyó y la bomba si sabe dónde está. Ya es la única fuente de los pulsos de ruido y de
las barricadas conocidas; **el resto del render todavía lee la sim entera**, y migrarlo
es el trabajo pendiente para que el servidor online no mande lo que el jugador no ve.

---

## 4. `src/session/`: lo que no es simulación

| Módulo | Responsabilidad |
| --- | --- |
| `Session.js` | Estado de "esta sesión de juego": fase de pantalla, selección, estado transitorio de UI. Las fases espejan las de la ronda y agregan `title`, `paused` y `ended` |
| `SessionController.js` | El **único** lugar que decide qué significa cada petición del jugador en cada fase: cierra fases de decisión, corre el bucle solo mientras un turno se ejecuta, sella los GO y el mando del dron. Decide qué fases previas están **bloqueadas** para este jugador (`FLOW.unlockAfterRounds`, fijo por intento para que el reintento no se desincronice) y las salta con valores por defecto. Lleva el modo (`play` / `tutorial` / `match`) |
| `PhaseClock.js` | Plazos de reloj de pared de las fases de decisión. La sim nunca ve este reloj; online, lo tendrá el servidor. Se detiene mientras el jugador no puede planificar (ayuda abierta, página oculta, celular en vertical, tutorial) |
| `Match.js` | Partida al mejor de 7 contra la IA: reglas puras (`createMatch`, `matchLoadout`, `endMatchRound`). Marcador del jugador contra la IA, cambio de bando tras `MATCH.switchAfter` rondas (`match.team`, que el flujo copia a `session.team`), ingresos (`MATCH`), y qué pasa a la ronda siguiente (clase, dinero, equipo de los vivos) como `opts.loadout` de la próxima `Simulation` |
| `PlanRecorder.js` | Todas las órdenes de un intento, agrupadas por fase. Es exactamente la lista de paquetes de turno We-Go: lo que mandaría una partida online y lo que necesita un replay. Sostiene el "reintentar" |
| `Tutorial.js` | Tutorial guiado: una ronda real paso a paso (solo el asalto), y las tarjetas de presentación de compra, entrada y dron la primera vez que aparecen (`PHASE_INTROS`) |
| `AutoPause.js` | Pausa de sistema cuando el jugador no puede seguir el turno (página oculta, foco perdido, contexto WebGL perdido). Nunca por contacto |
| `confirm.js` | Confirmación en dos pasos para lo que borra el plan |
| `storage.js` | Preferencias por dispositivo en `localStorage`, con cada acceso envuelto: sin almacenamiento el juego se comporta igual |

---

## 5. `src/input/`: gestos → órdenes

`InputManager` recibe el DOM crudo y lo rutea a controladores; nunca toca el estado del
juego. `PlanningController` expone acciones **independientes del dispositivo** (`tap`,
`beginDraw/drawTo/endDraw`, `beginMove/moveTo/endMove`, `beginLook/lookTo/endLook`,
`toggleSquad`, `setPace`, `pickToss/placeToss`) y es el único que emite órdenes de
planificación. `grab(x, y)` dice qué hay bajo el puntero (`unit`, `tail`, `waypoint`,
`segment`, `other`, `ground`), y de eso depende el arrastre: dibujar (desde el operador o
el final de la ruta), mover un punto, insertar uno en un tramo, o mover la cámara (el
suelo, con un dedo). Un toque en un punto o en el final de la ruta abre su menú.
Encima, `MouseKeyController` (mouse + teclado) y `TouchController` (tap, arrastre,
pulsación larga, dos dedos, pinza) hacen el mapeo.

Un arrastre a mano alzada es un "trazo": las órdenes `beginStroke` / `endStroke` lo
encierran, así la sim lo endereza al soltar y un gesto que resulta ser una pinza se
puede quitar completo (`cancelStroke`). `picking.js` responde qué hay bajo un punto de
la pantalla (con radios que nunca bajan del tamaño de un dedo) y `RoutePreview` dibuja
el tramo que agregaría un clic, con el A* cacheado por celda.

---

## 6. `src/render/`: WebGL2 propio

`Renderer.js` orquesta el frame: lee el estado de la simulación (nunca lo muta) y
escucha eventos a través de `FxDirector`. Orden de pasadas:

```
máscara de visión → suelo → calcomanías → overlay de piso → paredes y muebles
→ puertas → unidades → partículas → overlay superior (rutas)
```

- `gl/` envuelve WebGL2 con lo mínimo: contexto con error tipado para la pantalla de
  "no soportado", programas GLSL ES 3.0 con ubicaciones cacheadas, mallas en VAO,
  render targets y `ShapeBatch` (triángulos 2D con color por vértice, en modo
  inmediato, escrito para no generar basura porque el overlay se reconstruye cada
  frame).
- `layers/` es una capa por cosa dibujada: suelo (shader procedural horneado una vez a
  una textura en espacio de mapa), estática (paredes y muebles fundidos en una sola
  malla y un solo draw call), puertas, unidades, calcomanías, visión, overlay táctico,
  marcadores de contacto y pings.
- `VisionLayer` dibuja los abanicos de visibilidad de cada atacante vivo en una
  textura, los difumina y los acumula en la memoria de "explorado"; la pasada se salta
  cuando su resultado no pudo cambiar.
- `PlanView` maneja el estado "plano táctico" (cuánto del mapa no visto se dibuja como
  plano al decidir) contra la niebla negra durante la ejecución, con un barrido
  circular en la transición.
- Rendimiento: `FramePacer` solo dibuja cuando algo cambió; `AdaptiveResolution` sube y
  baja la resolución con histéresis; el tamaño del canvas viene de un `ResizeObserver`
  (ninguna lectura de layout por frame); un contexto WebGL perdido se sobrevive y todos
  los recursos GL se reconstruyen al recuperarlo.

---

## 7. `src/ui/` y `src/audio/`

La UI es DOM, no canvas. `UI.js` es la raíz; cada componente lee el estado de
sim/session cada frame y responde solo con peticiones al bus. `dom.js` da setters que
escriben al DOM **solo cuando el valor cambió**, así un HUD sin cambios cuesta cero
recálculo de estilo. Todo el texto visible está en `ui/texts.js` (y el del flujo en
`ui/flowTexts.js`): los componentes no llevan strings. `HudOcclusion` baja la opacidad
de las placas que tapan la acción, y `config/ui.js HUD_SAFE` declara los márgenes que
el HUD ocupa para que la cámara encuadre en lo que queda libre.

El audio es completamente procedural: no hay archivos de sonido. `SoundBank` hornea
cada receta (`audio/recipes/`) a arrays de muestras en un Worker, en dos tandas
(primero lo que el título y la planificación necesitan, después lo de combate), y las
envuelve en `AudioBuffer`. `AudioDirector` traduce eventos de la sim a sonidos: elige la
variación, la superficie del piso, el espacio acústico y el material del impacto, y los
posiciona en estéreo respecto de la cámara. `Music.js` es una partitura generativa
conducida por la situación táctica. El `AudioEngine` se crea perezosamente en el primer
gesto del usuario (política de autoplay / iOS).

---

## 8. Datos: `src/config/` y `src/data/`

Cambiar el balance nunca debería tocar código de la sim. `config/balance.js` tiene
bloques congelados (`SIM`, `UNIT`, `MOVE`, `VISION`, `COMBAT`, `COVER`, `AI`,
`AI_ATTACK`, `DOORS`, `ENTRY`, `ROUND`, `NOISE`, `BUY`, `PREP`, `BARRICADE`, `DRONE`,
`NAV`, `MAP_FORMAT`) y cualquier cambio ahí cambia el replay determinista, lo que se
espera.

`config/operators.js` define los ROLES como datos: etiqueta, arma, modificadores
multiplicativos (`speed`, `turnRate`, `reaction`, `spread`, `visionRange`, `visionFov`,
`breachPrep`, `bash`, `stepNoise`), vida, equipo de clase, el id de su habilidad, para
los atacantes `pick` / `unique` / `blurb` (lo que muestra la compra) y para los
defensores `defPick` / `max` (panel de preparación, tope por bando). Un rol nuevo es una
entrada ahí más, si tiene habilidad, un módulo en `sim/abilities/`. Hoy: `assault`
(Asaltante), `entry` (Brecha), `scout` (Explorador, `scoutPulse`), `defender`, `anchor`
(Ancla), `roamer` (Merodeador) y `trapper` (Trampero, sus trampas en `sim/traps.js`).
`sim/units.js applyRole` cambia la clase de una unidad viva (compra, `setDefenderRole`).

Bloques nuevos en `balance.js`: `CAMERA`, `SCOUT`, `MATCH`, `ENTRY.smoke`,
`ENTRY.tossItems` / `tossRange`, `MOVE.sneakFactor` / `sneakHearing` / `fileGap`,
`ROUND.minContactSeconds`. En `config/ui.js`: `GO_GROUPS` (nombre, glifo, color y tecla
de cada grupo GO; los códigos internos siguen siendo `'A'`, `'B'`, `'C'`) y
`FLOW.unlockAfterRounds`.

Un mapa (`src/data/maps/warehouse.js`, "Operación Almacén", 40×28 m) es datos puros en
metros: paredes como líneas centrales (los huecos de puerta se recortan solos),
puertas con bisagra y marca `barricade`, aperturas sin puerta, muebles, zonas, pintura
de piso, y los datos de la ronda: `sites` (A y B, con el punto de la bomba), `entries`
(norte, principal, sur: la puerta y las posiciones de inicio), `deployment` (línea y
mitad de cada bando), `defense` (la disposición de la IA defensora para cada sitio, con
el comportamiento de cada puesto y su `role`), `aiBarricades`, `aiEntries` (con pesos),
`aiCameras` (las cámaras del defensor por sitio: `{at, facing, fov?, range?}`) y `camera`
(el encuadre inicial de la vista).

---

## 9. Pruebas y empaquetado

`npm test` corre `node --test tests/*.test.mjs`: 14 archivos y 96 pruebas que juegan
rondas sin pantalla (determinismo, fases y turnos, entradas a puerta, preparación y
compra, dron y barricadas, jugabilidad, tutorial, IA contra IA, y los nuevos
`control` — fila, editar rutas, sigilo, corte al contacto, clases —, `toss` — lanzar y
humo —, `cameras`, `match`, `defend` y `defenderClasses`). La
simulación se puede instanciar sin DOM ni WebGL, que es justo lo que hace posible
probarla así; una `Simulation` con `{phases: false}` corre sin fases y acepta órdenes en
cualquier momento, para probar mecánicas sueltas.

`npm run build` (`scripts/build-single-html.mjs`) empaqueta todo en
`dist/tactic-squad.html`: esbuild junta los módulos en un `<script type="module">`
minificado, el CSS se inyecta en línea y el worker de audio se incrusta como texto y se
carga desde un blob (si el navegador lo bloquea, `SoundBank` hornea en el hilo
principal). El resultado son ~515 KB en un archivo que funciona con `file://`, a
diferencia de `index.html`, que necesita un servidor porque los navegadores no cargan
módulos ES desde disco. `.github/workflows/pages.yml` publica `main` en GitHub Pages
cuando pasan las pruebas.

---

## 10. Hacia el online

El código ya está ordenado para la versión en red, aunque no haya nada de red todavía:

- **Determinismo por semilla** y paso fijo: la base del lockstep.
- **Órdenes serializables** (`sim/orders.js`), con las de tiempo real selladas con su
  paso (`atTick`).
- **`PlanRecorder`** ya produce la lista de paquetes de turno que mandaría una partida
  online.
- **`PhaseClock` fuera de la sim**: online, el servidor pone los plazos y la sim no
  cambia.
- **`teamView`** es el filtro de información por jugador que el servidor aplicará; está
  escrito y usado en parte, y falta migrar el render para que no lea la sim entera.
- **`CONTROLLERS`** por bando (`'human'` / `'ai'`): la sim nunca asume cuál bando es el
  jugador, así que 1v1 es poner los dos en `'human'`.

### Deuda conocida

- El render lee la sim completa en vez de `teamView` (ver arriba). Es la pieza que
  bloquea el online y la que más cuesta. Las cámaras y el humo se dibujan leyendo
  `sim.cameras` / `sim.smokes` (filtrando por `known` para el atacante).
- Un solo mapa, y la cantidad de operadores por bando la fija el mapa (hoy 3 atacantes
  contra 4 defensores), no una configuración de partida.
- Faltan las clases Escudo, Tirador, Granadero y Vigía.
- Varios comentarios del código mencionan `docs/BRIEF.md` y `tests/sim-plans.mjs`, que
  no venían en el zip original y no existen en el repo.

---

## 11. Qué agregó la rama `claude/revision-ux-fases`

Una revisión de jugabilidad en tres fases, cada una en sus commits.

**Fase 1 — claridad**
- GO por **colores** (`config/ui.js GO_GROUPS`): violeta, rosa, blanco; teclas Z / X / C. Internamente siguen siendo `'A' / 'B' / 'C'`.
- Puertas **abiertas por defecto** (`ENTRY.undecided = 'open'`; `'stop'` restaura el freno anterior).
- Menú del punto (`ui/EntryPicker.js`): en una puerta, rueda con las seis entradas alrededor del punto y un panel al lado (cuándo, paso, lanzar); lejos de puertas, popover anclado. Tocar una puerta apila al operador junto a ella y abre la rueda (`PlanningController.stackAt`, `config/input.js` `DOOR_TAP`).
- ESPERAR (táctil) abre los colores (`session.ui.holdMenu`).
- Primera partida directo a planificar; compra, entrada y dron se desbloquean (`FLOW.unlockAfterRounds`), con tarjeta la primera vez.
- Un solo canal de "qué hago ahora" (el banner): se quitaron la línea de GO del feed y la barra de pistas duplicada.
- Ayuda de escritorio reescrita para los controles nuevos.

**Fase 2 — control**
- Ruta de escuadra en fila (`sim/follow.js`, botón ESCUADRA / Q, Mayús + clic).
- Editar rutas: mover un punto, insertar en un tramo (`moveWaypoint`, `insertWaypoint`).
- Arrastrar el suelo mueve la cámara (un dedo en táctil).
- Paso sigiloso por tramo (`setPace`, rayas oscuras en la ruta).
- Corte del turno al contacto (`stopOnContact`, opción en la ayuda, activa por defecto).

**Fase 3 — profundidad**
- Lanzar flash / granada / humo a cualquier punto (`setToss`) y humo que tapa la vista (`sim/smoke.js`).
- Cámaras del defensor (`sim/cameras.js`, `aiCameras`).
- Clases Asaltante / Brecha / Explorador / Ancla (`config/operators.js`, `setRole`, `abilities/scoutPulse.js`).
- Partida al mejor de 7 con economía (`session/Match.js`, `MATCH`).

**Paredes blandas destructibles: descartadas.** Tomás decidió no implementarlas (27 oct 2026). No proponerlas como trabajo pendiente.
