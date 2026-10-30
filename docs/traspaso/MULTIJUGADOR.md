# Multijugador online: especificación y plan

Al 30 de octubre de 2026. Es la prioridad del proyecto. Tomás pidió, textual: *"hagámoslo
funcional ya"*: primero algo jugable de punta a punta y desplegado, después el pulido y los
casos raros.

---

## 1. Lo que pidió Tomás

- Se puede jugar **1v1 o 2v2**.
- Un jugador **crea una sala** y comparte la **invitación por WhatsApp**.
- Todos entran a un **lobby** donde deciden **los equipos, el mapa y la duración** de la
  partida (una ronda, o al mejor de 3, 5 o 7).
- **1v1:** cada jugador maneja 3 soldados (como hoy contra la IA).
- **2v2:** 4 soldados por equipo; **cada jugador maneja 2**.
- Que todos jueguen **cómodamente desde el celular**, sea iPhone o Android (siempre en
  horizontal).
- **Buena conectividad** en Wifi o red móvil.

## 2. Decisiones ya tomadas

| Tema | Decisión |
| --- | --- |
| Servidor | **Cloudflare Workers + Durable Objects** (elegido por Tomás el 29 oct). Un Durable Object por sala, WebSockets, plan gratuito. Usar la **API de hibernación de WebSockets** y Durable Objects con **almacenamiento SQLite** (los dos están en el plan gratuito) |
| Credenciales | Secretos de GitHub ya cargados: `CLOUDFLARE_API_TOKEN` (plantilla "Edit Cloudflare Workers") y `CLOUDFLARE_ACCOUNT_ID`. El despliegue lo hace GitHub Actions; la sesión de Claude no tiene acceso directo a Cloudflare |
| Netcode | **Lockstep de órdenes** sobre la simulación determinista: viajan las órdenes, no el estado. En We-Go son pocos KB por turno, ideal para red móvil |
| Determinismo entre teléfonos | `Math.sin/cos/atan2/hypot/exp/pow` no dan lo mismo bit a bit en V8 (Android/Chrome) y JavaScriptCore (iOS/Safari). **Hecho:** `src/core/dmath.js` en la rama `claude/multijugador` (solo + − × ÷ y raíz, que son exactos en IEEE 754), usado en toda `src/sim/`. **Falta:** hash del estado por turno y resincronización por snapshot |
| Anti-trampa | Partidas entre amigos: se acepta que en lockstep cada cliente tiene el estado completo. Pero la UI, el render, el audio y el feed **no deben mostrar** nada que el equipo no vea (`teamView`) |
| Prioridad | Primero 1v1 funcional y desplegado; después 2v2; el pulido al final |
| Fusionar | Tomás autoriza fusionar cada PR del multijugador en `main` en cuanto pasen las pruebas, para probar en el teléfono |
| Lo que no cambia | El modo contra la IA, el tutorial y el equilibrio de 1 contra IA quedan iguales |

## 3. Lo que ya existe en el código

- **Simulación determinista** por semilla y paso fijo de 60 Hz (`src/sim/Simulation.js`).
- **Órdenes serializables** (`src/sim/orders.js`): JSON chico con `type`, `unitId`, etc. Las de
  tiempo real llevan `atTick` (dron: `phaseTick`; GO durante la ejecución: `round.execTick`).
  Ver `SessionController.command(...)`.
- **`PlanRecorder`** (`src/session/PlanRecorder.js`): todas las órdenes de una ronda agrupadas
  por fase = los paquetes de turno de una partida online.
- **`PhaseClock`** (`src/session/PhaseClock.js`): plazos de reloj de pared fuera de la sim
  (contra la IA no tienen límite). Online los pone el servidor.
- **`CONTROLLERS` por bando** (`src/config/squad.js`): `'human'` o `'ai'`. 1v1 = los dos
  `'human'`.
- **`teamView(sim, team)`** (`src/sim/view.js`): lo que un bando puede saber. Hoy solo lo usa en
  parte el render (`OverlayLayer`); el resto del render, el HUD y el audio leen la sim entera.
- **Menú:** `src/ui/Menu.js` ya tiene el botón MULTIJUGADOR "próximamente"; lobby
  (`src/session/Lobby.js`) y roster de clases (`src/ui/Roster.js`) sirven de base.
- **Mapas:** 3 puntos de aparición (spawns) por entrada y 4 puestos de defensa por sitio en los
  tres mapas v2. **Para 2v2 falta un 4.º spawn por entrada** en cada mapa (y revisar el mapa `training`).
- **Squad:** `SQUAD` (3 callsigns) y `DEFENDERS = 3` en `src/config/squad.js`.

## 4. Arquitectura propuesta

```
Celular A ─┐                          ┌─ Durable Object "sala ABC12"
Celular B ─┼── WebSocket (wss) ──── Worker ──┤   jugadores, lobby, registro de órdenes,
Celular C ─┤                          │   plazos de fase, hashes por turno
Celular D ─┘                          └─ (uno por sala; hiberna si no hay mensajes)
```

- **`server/`** (nuevo): `worker.js` (enruta `/sala/:codigo` al Durable Object y crea salas),
  `Room.js` (el Durable Object), `wrangler.toml` (con la migración `new_sqlite_classes` del
  Durable Object). Sin dependencias.
- **Lógica de sala pura** (`server/roomLogic.js` o `src/net/roomLogic.js`): funciones sin
  Cloudflare ni red (lobby, fases, plazos, juntar órdenes, comparar hashes), para probarla con
  `node --test` y para un servidor local con `ws`.
- **Cliente** (`src/net/`): `Connection.js` (WebSocket, latido, reconexión, cola de envío),
  `OnlineSession.js` (une la red con `SessionController`: aplica las órdenes recibidas a la sim
  en el orden y paso que dicta el servidor).
- **El servidor no simula.** Ordena, guarda, reparte y pone los plazos. Así es barato y cabe de
  sobra en el plan gratuito.

### Flujo de una ronda en lockstep

| Fase | Tipo | Qué hace el servidor |
| --- | --- | --- |
| Compra (20 s) | Decisión | Junta las órdenes de cada jugador. Al vencer el plazo o cuando **todos marcan LISTO**, reparte el paquete completo con un número de secuencia. Todos lo aplican y avanzan de fase |
| Preparación (~60 s) | Decisión | Igual. Las órdenes del rival **no se reparten antes del cierre**: la preparación es a ciegas |
| Dron (15 s) | Tiempo real | Marca el ritmo: cada ~100 ms manda "avanzar hasta el paso N" con las órdenes que lleven `atTick ≤ N`. El cliente envía su orden sellada con `atTick = paso actual + retraso` (~6-9 pasos, 100-150 ms) para que llegue a tiempo. Los defensores pueden dispararle al dron |
| Planificación (~30 s, ajustar) | Decisión | Igual que compra. En 2v2 las órdenes **del compañero** se reenvían al instante como vista previa (para ver sus rutas en vivo); las del rival solo al cierre |
| Ejecución (5 s) | Tiempo real | Igual que el dron (por el GO por colores durante el turno). Al terminar, cada cliente manda el **hash** de su estado |
| Fin de ronda (10 s) | — | Marcador, repetición, siguiente ronda o fin de partida |

- La **semilla**, el mapa, las clases, los bandos y quién maneja cada unidad los fija el servidor
  al empezar (mensaje `start`), así todos crean la misma `Simulation`.
- **Hash por turno:** algo barato y estable (posición, vida, munición, puertas, granadas,
  bomba, RNG, etc., redondeado a bits exactos). Si un hash difiere, el servidor pide un
  **snapshot** al anfitrión (o al cliente con el hash de la mayoría) y se lo manda a los
  demás, sin cortar la partida. Para eso hace falta **serializar el estado de la sim**: ojo con
  referencias compartidas, objetos congelados y referencias al mapa compilado (se reconstruyen,
  no se copian).
- **Plazos:** los pone el servidor (`PhaseClock` online). Los textos y el banner de fase ya
  muestran un reloj; hay que alimentarlo con el plazo del servidor.

### Mensajes (borrador, JSON compacto)

Cliente → servidor: `hola {sala, token, nombre}`, `lobby {equipo|mapa|duracion|bando|listo}`,
`clases {roles}`, `ordenes {fase, seq, lista}`, `listo {fase}`, `hash {turno, h}`, `ping {t}`.

Servidor → cliente: `sala {jugadores, ajustes, anfitrion}`, `start {semilla, mapa, roles,
bandos, dueños}`, `fase {fase, seq, plazo}`, `paquete {seq, ordenes}`, `pasos {hasta, ordenes}`,
`previa {jugador, ordenes}` (compañero, 2v2), `resync {snapshot}`, `pong {t}`, `error {motivo}`.

## 5. Conectividad en el celular

- **Reconexión automática y transparente.** iOS corta el WebSocket al pasar a segundo plano o
  al cambiar de antena. El cliente guarda un **token de jugador** en `localStorage` (por sala);
  al volver se reengancha y se pone al día reproduciendo el registro de órdenes desde el inicio
  de la ronda (o con snapshot si es largo).
- **Latido** cada ~5 s con indicador de calidad (verde/ámbar/rojo) en el HUD y en el lobby.
- **Mensajes chicos** y sin datos que se puedan recalcular.
- **Caída de un jugador:** la partida espera (los plazos de decisión se pausan para ese equipo,
  un aviso lo muestra a todos). Si no vuelve en ~60-90 s, el resto puede declarar abandono
  (o, en 2v2, el compañero toma sus soldados).
- **Pantalla:** que el celular no se apague durante la partida (`navigator.wakeLock` donde
  exista).

## 6. Experiencia

- **Menú:** MULTIJUGADOR → **Crear sala** (elige 1v1 o 2v2) o **Unirse** con código.
- **Código de sala** de 5-6 caracteres sin letras que se confundan (sin 0/O, 1/I/L).
- **Invitar por WhatsApp:** botón que abre `https://wa.me/?text=` con un texto y el enlace
  `https://tomasrojasmurua.github.io/Tactic-Squad/?sala=CODIGO`; en el celular, usar antes
  `navigator.share` si existe. Abrir ese enlace lleva directo al lobby de esa sala.
- **Lobby:** jugadores con nombre (lo escribe cada uno y se recuerda), listo/no listo, indicador
  de conexión. El anfitrión elige mapa (o al azar, con la ficha como hoy), duración y bando
  inicial. Los jugadores se pasan de equipo con un toque. En 2v2 se reparten 2 soldados por
  jugador.
- **Selección de clases:** por equipo y a ciegas respecto del rival (como hoy). En 2v2 cada
  jugador elige sus 2 y ve las de su compañero.
- **Durante la partida (2v2):** cada jugador solo da órdenes a sus 2 soldados, pero ve los 4 de
  su equipo; ve en vivo las rutas que planea su compañero; los GO por colores son del equipo;
  un indicador muestra quién ya marcó LISTO.
- **Fin:** como hoy, sin reintentos. Revancha y volver al lobby.
- Todo en **horizontal**, objetivos de toque de 44 px o más, textos en `src/ui/texts.js`.

## 7. 2v2 en la simulación

- 4 unidades por bando: un 4.º spawn por entrada en cada mapa; usar los 4 puestos de defensa
  que ya existen; `SQUAD` con un 4.º callsign y color; límites de clase para escuadras de 4
  (hoy: atacantes únicas salvo el Asaltante; defensores Escopetero y Ancla hasta 2).
- **Dueño por unidad** (`owner`/jugador) además del bando. Validar en el cliente y en el
  servidor que cada jugador solo ordene a sus unidades (el servidor lo puede comprobar sin
  simular: mira `unitId`).
- Puntos de utilidad, IA y pruebas para 4. El 3 contra 3 contra la IA no cambia.
- Medir el equilibrio de 4 contra 4 (IA contra IA) antes de darlo por bueno.

## 8. Despliegue

`.github/workflows/pages.yml` hoy: en cada push a `main` corre las pruebas y publica
`index.html` + `src/` tal cual en GitHub Pages (sin empaquetar). Para el multijugador:

1. Un paso (o job previo) que, si existen los secretos, despliega el Worker:
   `npx wrangler deploy` en `server/` con `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
2. Captura la URL `https://<nombre>.<subdominio>.workers.dev` de la salida de wrangler y la
   escribe en un archivo de configuración del cliente (por ejemplo `src/config/server.js`,
   generado antes de armar `_site`). Así nadie copia URLs a mano. El build de un solo archivo
   (`scripts/build-single-html.mjs`) debe leer la misma configuración.
3. **Si faltan los secretos o el despliegue falla**, Pages se publica igual y el menú muestra
   el multijugador como no disponible.
4. La primera vez, Tomás tiene que mirar en github.com → Tactic-Squad → **Actions** que el
   paso del Worker salió bien (la sesión de Claude no puede leer Actions), y si falla, copiar el
   error.

## 9. Cómo probar

- **Pruebas automáticas** (`node --test`):
  - lógica de sala pura (lobby, fases, plazos, LISTO, juntar órdenes, hashes);
  - **prueba de red local**: un servidor local con `ws` que imita el Durable Object (usando
    la misma lógica de sala), 2 y 4 clientes sin pantalla que juegan rondas completas por
    lockstep con planes de la IA y verifican que todos los hashes coinciden;
  - **reconexión** a mitad de un turno y de una fase de decisión;
  - snapshot: guardar y restaurar el estado da el mismo hash y la misma continuación.
- **Equilibrio** de 1 contra IA sin cambios fuera del ruido (`scripts/balance.mjs 400 ciegas`).
- **Capturas** en celular horizontal (844 × 390, DPR 3): menú, crear sala, lobby 1v1 y 2v2,
  partida. Mirarlas antes de entregar.
- **Prueba real:** dos teléfonos (uno iPhone y uno Android, si se puede), uno con Wifi y otro
  con datos móviles; incluir pasar la app a segundo plano a mitad de un turno.

## 10. Etapas

1. **Jugable 1v1 (lo primero, un PR aunque sea grande):** `server/` + despliegue por Actions +
   capa de red del cliente + crear/unirse + invitación por WhatsApp + lobby + partida 1v1 en
   lockstep con plazos y LISTO + dron y ejecución en tiempo real + hash y resincronización +
   reconexión básica. Fusionar en cuanto pasen las pruebas para que Tomás pruebe.
2. **2v2:** 4 soldados por equipo, 2 por jugador, rutas del compañero en vivo.
3. **Pulido:** UI que lea solo `teamView`, indicadores de conexión, abandono y revancha,
   casos raros.

## 11. Riesgos

- **Determinismo entre motores:** `dmath.js` cubre la trigonometría; revisar también
  `Math.round`/`floor` con negativos, orden de iteración de `Map`/`Set` (es estable), `sort`
  con comparadores que empaten (usar desempate por id), y cualquier `toFixed` o `parseFloat` que
  entre a la sim.
- **iOS en segundo plano:** Safari suspende la página; la reconexión tiene que ser rápida y la
  partida tolerar unos segundos de ausencia sin romperse.
- **Plan gratuito de Cloudflare:** de sobra para partidas entre amigos (las órdenes son pocas);
  la hibernación de WebSockets evita cobrar tiempo de Durable Object mientras se espera.
  Revisar los límites vigentes en la documentación de Cloudflare antes de dimensionar.
- **El render lee la sim entera:** en lockstep no es un riesgo de red, pero sí de filtrar
  información en pantalla. Revisar al menos HUD, feed, audio y efectos (sonidos y fogonazos del
  rival fuera de la vista).
