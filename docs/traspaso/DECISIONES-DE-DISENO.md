# Decisiones de diseño de Tactic Squad

Al 30 de octubre de 2026. Junta el diseño original de la ronda y todas las decisiones que
Tomás tomó después, en orden. Cuando una decisión posterior contradice el diseño original,
manda la posterior.

---

## 1. Principios que guían todo

1. **Realismo.** Transportar al jugador a la sensación de un asalto real en espacios cerrados.
   Nada futurista ni imaginario sin sentido (27-28 oct). Por eso se quitó la pausa táctica al
   contacto y el pulso del Explorador que veía a través de paredes.
2. **Paridad entre bandos.** "La partida es pareja entre atacante y defensor. Las decisiones
   que tomas dentro de la partida definen quién gana, no un beneficio natural de algún bando"
   (27 oct). Los dos bandos usan los mismos números de reacción y puntería; decide la postura.
3. **Equilibrio medido.** Meta 45-55 % de victorias por bando (y por sitio), medida con
   `node scripts/balance.mjs` (IA contra IA) antes de entregar un cambio de reglas.
4. **Sin frustración por errores no forzados.** Controles pulcros, pensados primero para el
   celular horizontal (27 oct).
5. **Las rondas son rondas.** Terminan sin vuelta atrás: no hay reintento (28 oct).
6. **Clases distintivas.** Cada soldado se juega distinto aprovechando su equipo, con equipo o
   técnica real (28 oct). Distintas composiciones de equipo tienen planes de juego distintos
   (29 oct).
7. **Leer el mapa es parte del juego.** Los mapas premian clases distintas, pero la ficha del
   mapa no sugiere clases (28 oct).
8. **Estándar visual.** Un mapa nuevo tiene que verse igual o mejor que los existentes (28 oct).
   Mapas con personalidad, no ordenados ni simétricos (29 oct).

---

## 2. Diseño original de la ronda (documento del 25 oct 2026, Tomás Rojas)

Lo marcado con → cambió después (sección 3).

- **Objetivo** tipo Rainbow Six: la bomba ya está en el mapa; los defensores la protegen y
  los atacantes la desactivan. Ambientación Counter-Strike con sitios A y B, armas y utilidad
  (flash, humo, molotov, HE) con nombres genéricos.
- **Preparación** simultánea y oculta. **Asalto We-Go**: planificar 15 s a ciegas y ejecutar
  5 s a la vez. → Contra la IA la planificación no tiene límite; online la pone el servidor.
- Primero contra una IA que también se prepara; online después.
- **Partida** al mejor de 7 (gana quien llega a 4), cambio de bando tras la ronda 3. Fases:
  compra 20 s, preparación 45-60 s, asalto por turnos (máx. 18 turnos o 90 s de juego), fin de
  ronda 10 s. → También al mejor de 3 y 5, y a una ronda.
- **Defensor:** elige sitio A/B oculto, posiciona operadores en su mitad, vigilancia, refuerzos
  (barricada, puerta trabada, sensor, cámara). → Hoy: barricadas, alambre, cámaras e
  incendiaria; sin puerta trabada ni sensor.
- **Atacante:** dron gratis de 15 s en tiempo real (pasa bajo puertas, no por barricadas, se
  puede destruir); elige entrada entre 2-3 (oculta al defensor); compra equipo. Sin dron en el
  asalto.
- **Asalto:** desactivar 7 s inmóvil; el ruido llega como pulso aproximado al rival. El
  atacante gana si desactiva o elimina a todos; el defensor si se acaba el tiempo o elimina a
  todos.
- **Economía** con dinero. → **Eliminada** (28 oct).
- **Clases** con elección a ciegas. Contras: Brecha > Ancla, Explorador > Merodeador,
  Escudo > Tirador, Granadero > Vigía. Versiones 3v3 y 5v5. → 6 clases por bando; contras
  cerradas el 29 oct; solo 3v3 por ahora; online, 1v1 y 2v2 (29 oct).
- **Técnico:** fases en la simulación, visión por jugador (el servidor online no envía lo que
  el jugador no ve), mapas como datos, determinismo por semilla.

---

## 3. Decisiones tomadas después, en orden

### 26 de octubre

- **Sin pausa táctica al ver un enemigo.** "Si entras tontamente y el oponente está mejor
  posicionado te mata, eso pasaría en la vida real." Se sumó después el **corte del turno al
  contacto** (opción, activa por defecto contra la IA). El juego nunca se congela a mitad del
  turno.
- **Cambiar el plan durante la ronda** se mantiene.
- **Entradas coordinadas por puerta** al estilo Door Kickers, sincronizadas con un GO.
- **Turnos de 5 s** y **bomba de 90 s que solo corre durante la ejecución**.

### 27 de octubre

- Menú con tutorial guiado, IA atacante, jugar de defensor.
- GO por **colores** (violeta, rosa, blanco); puertas que se abren solas si nadie decide; ruta
  de escuadra en fila; editar rutas; paso sigiloso; lanzar a cualquier punto; humo; cámaras;
  partida al mejor de 3, 5 o 7.
- **Paredes destructibles (paredes blandas): descartadas.** No se proponen.
- Cambio de bando a la mitad; rueda de comandos en la puerta; la granada espera la explosión.
- **Entreabrir** se quitó: lo reemplaza el **espejo** (bajo, corto, delata con el destello y se puede romper). La cámara del Explorador sigue siendo mejor (decisión de Tomás, 31 oct).
- **Defensor fuerte por diseño, no por bono:** mismos números, ventaja al que sostiene un ángulo,
  **3 contra 3**, cámaras que avisan, orden "asomarse y volver".
- Tutorial en lecciones; todo optimizado para celular horizontal.

### 28 de octubre

- Lanzar sin moverse y desde el costado del marco; puerta compartida.
- **Repetición de la última baja**; **las rondas no se reintentan**.
- **Economía eliminada:** kit fijo por clase + 2 puntos de utilidad por operador, +1 al bando
  que perdió.
- Utilidad del defensor: alambre de púas e incendiaria.
- Cámaras en soportes del mapa, fijas toda la ronda.
- **Lobby separado de la selección de clases** (roster, pick phase a ciegas).
- Preparación del defensor en pasos (Compra, Reconocimiento, Preparación).
- Ventanas; vigilancia decidible en cada turno; "Cubrir zona" para atacantes.
- **Los defensores del jugador no se mueven solos.**
- Clases realistas: Explorador con cámara de fibra (no ve a través de paredes); 6 por bando
  (entra el Escopetero).
- **Mapas que premian clases**; el jugador elige el mapa o "Al azar".

### 29 de octubre

- Lista de mapas a la izquierda del lobby; la ficha del mapa se dibuja con el motor del juego.
- **Revisión de clases por un especialista** (PR #43, fusionado): equilibrio y **5 composiciones
  arquetípicas por bando**, cada una con un plan de juego distinto que la IA ejecuta
  (`docs/diseno/composiciones.md`). Contras del diseño original cerradas con mecánicas reales
  (conmoción de la carga, oído del Explorador, sacudida del Escudo, gas contra el monitor).
- **Mapas con personalidad y más grandes** (PR #44, fusionado): Tomás pidió mapas menos
  "ordenados" y simétricos (los contenedores del Puerto estaban en fila) y más grandes (Hotel y
  Almacén se sentían chicos). Resultado: Almacén y Hotel de 56 × 34 m, Puerto de 60 × 38 m,
  con historia, callouts y composición irregular (`docs/diseno/mapas-v2.md`). El tutorial
  sigue en el almacén de 40 × 28 m.
- **Gráficos: seguir con el render WebGL2 propio, no migrar a Three.js.** Tomás: "preferiría
  no tener que migrar y mejor trabajar con lo que ya tenemos". El especialista llegó a la misma
  recomendación (más luces con sombra en el iPhone, el HTML sigue liviano, sin dependencias).
  Plan en 8 etapas y prototipo en la rama `claude/graficos-realismo`. Pendiente: el ambiente
  (nocturno o de día) y la prueba del prototipo v2 en el iPhone.
- **Multijugador:** 1v1 (3 soldados por jugador) y 2v2 (4 por equipo, 2 por jugador); sala con
  invitación por WhatsApp; lobby para equipos, mapa y duración; cómodo en iPhone y Android;
  buena conexión en Wifi y red móvil. **Servidor en Cloudflare** (elegido por Tomás frente a
  Firebase y P2P); secretos ya cargados en GitHub. Netcode por lockstep de órdenes.
- **"Hagámoslo funcional ya"** (29 oct, noche): prioridad al multijugador jugable sobre el
  pulido. Los mapas v2 se fusionaron sin re-equilibrar contra la IA de clases nueva (Hotel y
  Puerto quedaron con el atacante en ~40 %); queda pendiente.

### 30 de octubre

- El trabajo sigue desde otra cuenta de Claude con créditos de trabajo en la nube. Traspaso en
  `docs/traspaso/`.

---

### 31 de octubre

- **Turnos de ejecución de 10 s** (antes 5); el corte al ver un enemigo sigue igual. Reloj de la bomba
  destacado junto al cartel de fase. Flash con más alcance (12 m) y granada con menos radio (3 m).
- **Ficha del soldado** dentro de la partida: clase, arma, equipo que lleva y características.
- **Controles táctiles para una pantalla limpia** (la partida se mira como una película):
  - Mantener pulsada la ficha de un soldado muestra su información; al soltar se esconde.
  - Mantener pulsado un "?", un punto de ruta o el soldado abre una **rueda radial**: se desliza hacia
    una opción y se suelta (soltar en el centro no elige nada). **Solo mantener y deslizar** (sin
    tocar para dejarla abierta). Cada opción tiene un lugar fijo (flash a la derecha, granada abajo a
    la derecha, humo abajo…) para que la mano lo aprenda.
  - ESPERAR, DESHACER y BORRAR **se mantienen**, pero como íconos discretos. Las utilidades (ver todo,
    cámaras, pantalla, música, ayuda) van en un **botón ⋯** discreto.
  - Durante el turno, en el celular, la interfaz se desvanece (modo película); un toque la devuelve.
    Quedan los GO y el reloj de la bomba.

## 4. Preguntas abiertas

- Ambiente visual: operación nocturna (penumbra y luz local) o luz de día.
- Plazos exactos de las fases online (punto de partida: compra 20 s, preparación ~60 s,
  planificación ~30 s con LISTO, fin de ronda 10 s); ajustar probando en el celular.
- Qué pasa si un jugador abandona en 2v2 (el compañero toma sus soldados o se declara la
  derrota).
- Niveles de dificultad de la IA; 5 contra 5.
