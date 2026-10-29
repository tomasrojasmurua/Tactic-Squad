# Decisiones de diseño de Tactic Squad

Al 29 de octubre de 2026. Este documento junta el diseño original de la ronda y todas las
decisiones que Tomás tomó después, en orden, con lo que cambió respecto del diseño original.
Cuando una decisión posterior contradice el diseño original, manda la posterior.

---

## 1. Principios que guían todo

Estos salieron de las conversaciones y se aplican a cualquier trabajo nuevo:

1. **Realismo.** El juego busca transportar al jugador a la sensación de un asalto real en
   espacios cerrados. Nada futurista ni imaginario sin sentido (27-28 oct). Por eso se
   quitó la pausa táctica al contacto y el pulso del Explorador que veía a través de paredes.
2. **Paridad entre bandos.** "La partida es pareja entre atacante y defensor. Las decisiones
   que tomas dentro de la partida definen quién gana, no un beneficio natural de algún
   bando" (27 oct). Los dos bandos usan los mismos números de reacción y puntería; decide
   la postura (quien sostiene un ángulo gana el primer cruce salvo que el otro use
   utilidad o flanquee).
3. **Equilibrio medido.** Meta 45-55 % de victorias por bando, medida con
   `node scripts/balance.mjs` (IA contra IA) antes de entregar un cambio de reglas.
4. **Sin frustración por errores no forzados.** Controles pulcros, pensados primero para
   el celular horizontal (27 oct).
5. **Las rondas son rondas.** Terminan sin vuelta atrás: no hay reintento (28 oct).
6. **Clases distintivas.** Cada soldado se juega distinto aprovechando su equipo, al estilo
   de Apex u Overwatch pero con equipo o técnica real (28 oct).
7. **Leer el mapa es parte del juego.** Los mapas premian clases distintas, pero la ficha
   del mapa no sugiere clases (28 oct).
8. **Estándar visual.** Un mapa nuevo tiene que verse igual o mejor que los existentes (28 oct).

---

## 2. Diseño original de la ronda (documento del 25 oct 2026, Tomás Rojas)

Resumen tal como quedó en las instrucciones del proyecto. Lo marcado con → cambió después
(sección 3).

- **Objetivo** tipo Rainbow Six: la bomba ya está en el mapa; los defensores la protegen y
  los atacantes la desactivan. Ambientación Counter-Strike con sitios A y B, armas y
  utilidad (flash, humo, molotov, HE) con nombres genéricos.
- **Preparación** simultánea y oculta. **Asalto We-Go**: planificar 15 s a ciegas y ejecutar
  5 s a la vez. → La planificación no tiene límite contra la IA.
- Primero contra una IA que también se prepara; online después.
- **Partida** al mejor de 7 (gana quien llega a 4), cambio de bando tras la ronda 3, rondas
  de unos 4 min. Fases: compra 20 s, preparación 45-60 s, asalto por turnos (máx. 18 turnos
  o 90 s de juego), fin de ronda 10 s. → También al mejor de 3 y 5; plazos sin límite contra
  la IA.
- **Defensor:** elige sitio A/B oculto (la bomba no se mueve), posiciona operadores en su
  mitad, órdenes de vigilancia (ángulo fijo, barrer, reaccionar a ruido, replegarse),
  refuerzos (barricada, puerta trabada, sensor, cámara; primer paso solo 2 barricadas).
  → Hoy: barricadas, alambre, cámaras e incendiaria; sin puerta trabada ni sensor.
- **Atacante:** dron gratis de 15 s manejado en tiempo real (pasa bajo puertas, no por
  barricadas, marca la última posición conocida, se puede destruir); elige entrada entre
  2-3 (oculta al defensor); compra equipo; pre-planifica. Sin dron en el asalto.
- **Asalto:** desactivar 7 s inmóvil y vulnerable; el ruido (pasos, patadas, disparos) llega
  como pulso aproximado al mapa rival. El atacante gana si desactiva o elimina a todos; el
  defensor si se acaba el tiempo o elimina a todos.
- **Economía** (cifras a ajustar): inicial $800; ganar +$3.250; perder +$1.400 (+$500 por
  derrota seguida, tope $3.400); baja +$300; desactivar +$300; barricada o puerta trabada
  $200; carga $300; sensor $250; cámara $400. → **Eliminada** (28 oct).
- **Clases** (ficha de datos + módulo de habilidad, elección a ciegas, sin repetir).
  Atacante: Asaltante, Brecha, Explorador, Escudo, Tirador, Granadero. Defensor: Ancla,
  Merodeador, Trampero, Vigía, Tirador. Contras: Brecha > Ancla, Explorador > Merodeador,
  Escudo > Tirador, Granadero > Vigía. Versiones 3v3 y 5v5 (en 5v5 máx. 2 repeticiones de
  clase). → Hoy 6 por bando (se sumó el Escopetero), solo 3v3.
- **Alcance del primer paso:** una ronda completa contra la IA, jugable en celular, el
  jugador elige bando, mapa con A/B y 2-3 entradas, IA que se prepara, defiende y ataca.
  Después: más mapas, puertas trabadas, sensores, cámaras, partida completa con economía,
  niveles de IA, online. → Cumplido y superado, salvo lo marcado como pendiente.
- **Técnico:** fases de ronda en la simulación, visión por jugador (el servidor online no
  envía lo que el jugador no ve), mapas como datos (sitios, entradas, línea de despliegue,
  huecos de puerta), determinismo por semilla.

---

## 3. Decisiones tomadas después, en orden

### 26 de octubre

- **Sin pausa táctica al ver un enemigo.** "Si entras tontamente y el oponente está mejor
  posicionado te mata, eso pasaría en la vida real." Después (cuenta paralela, 27 oct) se
  sumó el **corte del turno al contacto**: el turno de 5 s termina antes si tu escuadra ve
  un enemigo nuevo, para que puedas replanificar. Es una opción, activa por defecto contra
  la IA. El juego nunca se congela a mitad del turno.
- **Cambiar el plan durante la ronda** se mantiene: a Tomás le gusta poder ajustar la ruta
  después de asegurar una zona.
- **Entradas coordinadas por puerta** al estilo Door Kickers: abrir, patada, entreabrir,
  flash, granada o carga, sincronizadas con un GO.
- **Hitos:** 1) objetivo invertido y mapa con A/B y entradas; 2) fases en la simulación y
  asalto We-Go; 3) preparación de ambos bandos; 4) IA y elección de bando; 5) clases y
  partida; 6) equilibrio y visión por jugador antes del online.
- **Turnos de 5 s** (hubo una etapa de 8 s) y la **bomba de 90 s solo corre durante la
  ejecución**: pensar es gratis, pero cada turno la acerca.

### 27 de octubre

- **Menú con tutorial guiado** y opción de jugar contra la IA. IA atacante. Jugar de defensor.
- **Revisión de UX hecha desde otra cuenta de Claude** (rama `claude/revision-ux-fases`,
  PR #12): GO por **colores** (violeta, rosa, blanco; teclas Z/X/C) en vez de letras;
  puertas que **se abren solas** si nadie decide; menú del punto junto a la puerta; ruta de
  escuadra en fila; editar rutas; paso sigiloso; corte del turno al contacto; lanzar
  flash, granada o humo a cualquier punto; humo; cámaras del defensor; primeras clases;
  partida al mejor de 3, 5 o 7.
- **Paredes destructibles (paredes blandas): descartadas.** No se implementan y no se
  proponen.
- **Cambio de bando a la mitad** de la partida.
- **Rueda de comandos** al tocar una puerta (Abrir, Patada, Carga, Granada, Flash,
  Entreabrir).
- **La granada espera la explosión:** el que lanza se queda quieto hasta que explota y
  después sigue su ruta.
- **Entreabrir se mantiene** (no espejo bajo la puerta), pero solo deja ver la franja de la
  rendija, no la sala entera.
- **Defensor más fuerte por diseño, no por bono:** mismos números para los dos bandos,
  ventaja al que sostiene un ángulo quieto, **3 contra 3** (antes 3 contra 4), cámaras que
  avisan al defensor humano y botón CÁMARAS, y la orden **asomarse y volver**.
- **Menú nuevo:** JUGAR → CONTRA LA IA / MULTIJUGADOR (próximamente) → lobby con formato,
  mapa y composición. Toda partida arranca completa, con compra y dron.
- **Tutorial en lecciones** (Básico, Puertas, Escuadra y GO, Defender, Ronda completa),
  ninguna obligatoria.
- **Todo optimizado para celular** horizontal; nada debe quedar cortado.

### 28 de octubre

- **Lanzar sin moverse:** se puede tirar una granada desde donde está el operador, sin
  cruzar una puerta.
- **Lanzar de forma táctica:** granada, flash y carga se hacen desde el costado del marco,
  sin exponerse frente al vano.
- **Puerta compartida:** si dos rutas cruzan la misma puerta y uno ya decidió cómo entrar,
  el otro espera al costado y cruza después de la detonación.
- **Repetición de la última baja** al final de la ronda, encuadrando a todos los soldados
  involucrados. **Las rondas no se reintentan.**
- **Economía eliminada; se usa la mezcla:** kit fijo por clase que se repone cada ronda + 2
  puntos de utilidad por operador en **los dos bandos**, +1 punto por operador al bando que
  perdió la ronda anterior; lo que no se gasta se pierde. "Ambos tienen puntos y acceso a
  utilidad"; puede ser específica por bando, pero cada uno tiene que tener utilidad que lo
  ayude en su misión.
- **Utilidad propia del defensor:** alambre de púas (uno por ronda, frena a la mitad y
  suena) e incendiaria (2 puntos, fuego de 7 s, el humo la apaga). El "molotov" que estaba
  pendiente quedó cubierto por la incendiaria.
- **Cámaras:** dibujo que se reconoce como cámara (luz roja que parpadea), cono de visión
  visible, el defensor elige en qué soportes del mapa montar 2. Se eligen en la preparación
  y **quedan fijas toda la ronda**. Más difíciles de ver y de romper desde lejos, para que
  alcancen a avisar.
- **Lobby separado de la selección de clases**, como el pick phase de un MOBA. La selección
  es un **roster**: personajes con símbolo propio, ficha con arma, equipo y características;
  se eligen 3. Las clases no se cambian dentro de la partida.
- **Preparación del defensor en pasos:** Compra, Reconocimiento (sitio, barricadas, alambre,
  cámaras) y Preparación (colocar y vigilancia). Los paneles se pueden ocultar para mirar el
  mapa.
- **Ventanas:** se ve, se dispara y se lanza utilidad a través; nadie pasa.
- **Vigilancia decidible en cada turno** (ángulo fijo, barrer, atento) y **"Cubrir zona"**
  (barrido) también para los atacantes, por ejemplo para cubrir al que desactiva.
- **Alambre de púas** con aspecto de rollo de concertina; **cepo** con mandíbulas para las
  trampas del Trampero.
- **Los defensores del jugador no se mueven solos.** Las patrullas y repliegues del mapa son
  solo de la IA. La IA defensora rota hacia la bomba cuando la atacan.
- **Clases nuevas, distintivas y realistas:** el Explorador cambia el pulso a través de
  paredes por una **cámara de fibra óptica** bajo la puerta y oído fino. Asaltante: corta el
  ángulo al cruzar una puerta. **6 clases por bando**: el Defensor genérico sale del roster
  (solo tutorial) y entra el **Escopetero**.
- **Mapas que premian clases:** Hotel, Puerto y Embajada aprobados. El jugador (o los
  jugadores en multijugador) **elige el mapa**, con opción **Al azar** (se sortea al pasar a
  las clases). La ficha muestra el plano y tres rasgos, sin sugerir clases.

### 29 de octubre

- **Lista de mapas a la izquierda** del lobby, con scroll; el plano del elegido a la derecha.
- **La ficha del mapa es fiel al juego:** se dibuja con el mismo motor gráfico, con todos los
  colores, pisos y muebles.

---

## 4. Preguntas abiertas que quedaron sin decidir

- Si se agrega dificultad de la IA y cómo (no se discutió en detalle).
- Plazos de las fases para el online (el diseño original pide 15 s de planificación; contra
  la IA no hay límite).
- 5 contra 5: en el diseño original, pero sin fecha.
- Cómo será el multijugador (solo se decidió que los jugadores eligen mapa).
