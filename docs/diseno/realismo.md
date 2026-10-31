# Realismo estilo Ready or Not: propuesta priorizada

31 oct 2026. Para Tactic Squad (We-Go cenital, celular horizontal, WebGL2 propio).

## La idea

Ready or Not no se siente real por los gráficos. Se siente real porque **no sabes qué hay
detrás de cada puerta, mueres rápido y entrar a una sala da miedo**. Cada etapa de abajo
busca una de esas tres cosas, con reglas simples que se lean en la pantalla del celular.

## Reglas que no se tocan

- **Paridad:** toda mecánica vale igual para atacante y defensor, y la IA de los dos bandos la usa.
- **Determinismo:** todo vive en `src/sim/` con el RNG por semilla (y `src/core/dmath.js` si ya
  está en `main`). Los efectos de pantalla y sonido se derivan del estado de la sim, nunca al revés.
- **Equilibrio:** `node scripts/balance.mjs 800 ciegas <mapa>` en los tres mapas, dos tandas de
  semillas, antes y después de cada etapa. Hoy Hotel y Puerto ya están en ~40 % atacante: la
  meta por etapa es **no alejar ningún mapa de 45-55 %** (y acercarlos si se puede).
- **No proponer ni hacer:** paredes destructibles, pausa al contacto, economía con dinero,
  reintentar rondas, Three.js, ver a través de paredes.
- **Celular primero:** ningún botón nuevo si una orden existente (rueda de la puerta, vigilancia)
  puede cargarlo. Indicadores chicos y legibles en un iPhone SE horizontal.

## Etapas, en orden

| # | Etapa | Qué siente el jugador | Costo |
| --- | --- | --- | --- |
| 0 | Auditoría | (nada; inventario de lo que ya existe) | bajo |
| 1 | Supresión | "Me están tirando y no puedo apuntar" | bajo |
| 2 | Heridas | "Me dieron en la pierna y ahora soy lento" | medio |
| 3 | Munición y recarga | "Recargar en mitad de la sala fue un error" | medio |
| 4 | Sonido y callouts | "Oigo vidrio detrás de esa puerta" | medio |
| 5 | Espejo y despejar por cortes | "Miré bajo la puerta y entré cubriendo cada esquina" | medio |
| 6 | Penumbra y linternas | "La sala está a oscuras y mi linterna me delata" | alto |

### 0. Auditoría (sin cambios de juego)
Listar qué hay ya de cada tema (daño por zona, munición, recarga, ruido, pulso de ruido, paso
sigiloso, entreabrir, fibra, flash, gas, visión) y ajustar las etapas siguientes para no
duplicar. Medir la línea base de equilibrio de los tres mapas. Copiar este archivo a
`docs/diseno/realismo.md`.

### 1. Supresión y estrés
- Cada soldado tiene `estres` 0-1. Sube con balas que pasan a menos de ~1,5 m, impactos
  cercanos, explosiones y bajas aliadas a la vista; baja sola con el tiempo sin fuego.
- Efecto en sim: dispersión ×(1 + estrés) y reacción más lenta (hasta ×1,4 aprox.). Un soldado
  suprimido no avanza por su ruta si la orden lo permite (se agacha/detiene medio segundo).
- Efecto en pantalla (solo para tus soldados): viñeta que se cierra, desaturado leve y sonido
  apagado mientras dura. Un ícono chico en la ficha del soldado.
- Da sentido táctico al fuego de cobertura sin pausa ni magia.

### 2. Heridas
- Zonas simples: torso, piernas, brazos (la cabeza ya está si hay tiros letales).
- Pierna: velocidad ×0,6 y pasos más ruidosos. Brazo: dispersión ×1,5 y recarga más lenta.
- Nada de curarse solo. Herido grave deja **rastro de sangre** en el piso (dato de la sim,
  visible solo para quien lo vea con su visión normal): es información real para el rival.
- Revisar que el tiempo para morir siga siendo corto: dos o tres tiros, no más.

### 3. Munición y recarga
- Cargadores contados por arma (p. ej. rifle 30 + 3, escopeta 7 + 16 cartuchos). Kit fijo por
  clase, sin compra.
- Recarga con duración por arma (2-3 s); mientras recarga no dispara. Recarga automática con el
  cargador vacío y orden "Recargar" en la vigilancia/rueda para hacerlo a cubierto.
- La recarga hace ruido corto (se oye cerca). Indicador de munición discreto en la ficha.

### 4. Sonido que informa y callouts
- Superficies en los datos del mapa: vidrio roto, metal, grava (pocas manchas por mapa). Pisar
  vidrio o metal hace ruido aunque se vaya sigiloso. Correr hace más ruido que caminar.
- Puertas que crujen al abrirse lento (menos que una patada, más que nada).
- Callouts de tus soldados como texto corto sobre el soldado y voz o tono: "¡Contacto!",
  "¡Despejado!", "¡Recargando!", "¡Herido!", "¡Granada!". Solo los oye tu equipo.
- Todo entra por el sistema de ruido y pulso que ya existe; el oído del Explorador conserva su
  ventaja.

### 5. Espejo y despejar por cortes
- **El espejo reemplaza a entreabrir** (decisión de Tomás, 31 oct). Lo lleva todo soldado de
  los dos bandos. Orden en la rueda de la puerta: el soldado se agacha en el marco ~2 s sin
  abrir y ve un cono bajo y corto de la sala (unos 6 m, ~90°). No ve lo que está detrás de
  cobertura alta ni pegado a la pared de la puerta.
- Riesgo: quien esté mirando esa puerta ve el espejo (destello) y sabe que hay alguien. Un
  defensor puede romperlo de un tiro; el soldado queda sin espejo el resto de la ronda.
- La **cámara de fibra del Explorador** sigue siendo mejor: más alcance, ve toda la sala, no
  delata y se usa más rápido. Así el Explorador conserva su papel.
- Quitar entreabrir del juego, del tutorial y de la IA (la IA usa el espejo donde usaba entreabrir).
- Opción en la rueda de la puerta: "Despejar por cortes". El soldado se queda en el marco y
  gira por los ángulos de la sala uno por uno antes de entrar (más lento, más seguro).
- En sim: los ángulos ya cubiertos dan ventaja de reacción a quien los cubrió; entrar sin
  cortar es más rápido pero expone. Debe convivir con la ventaja del Asaltante en el umbral.
- La IA lo usa según su plan (composiciones lentas sí, asalto rápido no).

### 6. Penumbra y linternas (solo si Tomás elige ambiente nocturno)
- Pendiente de decisión: nocturno o de día. Si es nocturno:
- Salas marcadas como oscuras en los datos del mapa. Ahí la visión sin luz se acorta mucho.
- Linterna por soldado: encendida, cono de visión largo pero **se ve desde lejos** y delata la
  posición; apagada, sigilo pero vista corta. Orden en la vigilancia.
- Se coordina con el plan gráfico de la rama `claude/graficos-realismo` (etapa 1: HDR,
  fogonazos que deslumbran, viñeta). Medir fps en el iPhone antes de fusionar.

## Cómo entregar cada etapa
Un PR chico por etapa: pruebas nuevas en `tests/` (incluida una de determinismo: misma semilla,
mismo resultado), las 213+ pruebas en verde, tabla de equilibrio antes/después en el PR,
capturas en celular horizontal, y `RESUMEN-DEL-JUEGO.md` y `DECISIONES-DE-DISENO.md` al día.
Si una etapa saca un mapa de la meta, ajustar sus números (o los datos del mapa) antes de pedir
el merge, nunca empeorar en silencio.

---

## Auditoría (etapa 0, 31 oct 2026)

Qué existe hoy de cada tema y qué cambia para las etapas siguientes. Referencias a `main`
(`98ef1cd` más los turnos de 10 s, PR #51).

| Tema | Ya existe | Falta / ajuste para la etapa |
| --- | --- | --- |
| Daño por zona | `sim/combat.js` `rollBodyPart`: cabeza, torso o extremidad (`COMBAT.limbChance` 0,25; multiplicadores por zona; menos cabeza al disparar caminando). Tiro letal con un impacto de francotirador al torso | **Etapa 2** parte de ahí: guardar la zona herida en la unidad y aplicar sus efectos. No hay efectos persistentes |
| Impacto que desarma | "Aim punch": `flinchRecoil` y `flinchDelay` al recibir un tiro (desvía la puntería y retrasa el primer disparo) | **Etapa 1** no debe duplicarlo: el estrés suma a otra cosa (balas que pasan cerca, explosiones, bajas a la vista) |
| Supresión / estrés | No existe en la sim. Solo hay sonido de bala que pasa cerca (`config/audio.js` `NEAR_MISS`: 1,7 m), que es presentación | **Etapa 1** completa. Puede reutilizar la geometría del `NEAR_MISS`, pero calculada dentro de la sim |
| Munición | Cargador y reserva por arma (rifle 30 + 90, subfusil 30 + 120, pistola 12 + 36…). Recarga automática al vaciar el cargador, con `reloadTime` de 2,0 a 2,3 s según el arma. Evento `RELOAD` con su sonido | **Etapa 3** se reduce: el conteo ya existe. Faltan la orden "Recargar" para recargar a cubierto, el ruido de recarga en `NOISE` (hoy solo suena, no lo oye el rival) y revisar las duraciones por arma |
| Ruido | `NOISE.radius` por tipo (sigilo 2 m, paso 6, puerta 7, patada 12, disparo 34, granada 22…). Pulsos al rival al final del turno, en celdas de 3 m. Oído del Explorador (`EARS`: se gira hacia pasos a menos de 5 m). Paso sigiloso (`sneakFactor` 0,5) | **Etapa 4**: superficies (vidrio, metal, grava) en los datos del mapa. No hay "correr": la regla de correr más fuerte pasa a "paso normal frente a sigilo" |
| Callouts | El registro de eventos ya tiene textos (por ejemplo "¡Contacto!"), sin voz y sin globo sobre el soldado | **Etapa 4**: globo corto sobre el soldado y un tono, solo para su equipo |
| Entreabrir | Modo `slow`: abre una rendija (`prepTime` 0,7 s, franja de visión de 90°) y pasa con el GO. **La IA no lo usa** (ni el atacante ni el defensor) | **Etapa 5**: el espejo lo reemplaza. Como la IA nunca usó entreabrir, hay que enseñarle a usar el espejo desde cero |
| Cámara de fibra | Explorador: `cam` (`prepTime` 1,0 s, 150°, 11 m, pasa bajo la puerta) | Sigue siendo mejor que el espejo (etapa 5) |
| Asomarse y volver | Orden `setPeek`: se queda `peekTime` 1,5 s mirando y vuelve | Convive con "despejar por cortes" (etapa 5) |
| Flash, humo, gas | Existen. Flash con 12 m de alcance desde el 31 oct; gas del Granadero | Las explosiones y las flash suben el estrés (etapa 1) |
| Visión | 112° atacantes, 100° defensores, 30 m. Sin luz ni penumbra | **Etapa 6**: salas oscuras y linternas, solo si se elige ambiente nocturno |
| Sangre | Manchas en el piso, solo como efecto visual (`render/fx`) | **Etapa 2**: un rastro de sangre como dato de la sim, visible para quien lo vea |

### Línea base de equilibrio

`node scripts/balance.mjs 800 ciegas <mapa> [primera semilla]`, % de victorias del atacante.
(El script acepta ahora una primera semilla para medir una segunda tanda.)

| Mapa | Tanda | Total | Sitio A | Sitio B |
| --- | --- | --- | --- | --- |
| Almacén | 1-800 | **56** | 47 | **64** |
| Almacén | 10001-10800 | **56** | 50 | **61** |
| Hotel | 1-800 | 45 | 45 | 45 |
| Hotel | 10001-10800 | 45 | **42** | 47 |
| Puerto | 1-800 | **41** | **34** | 49 |
| Puerto | 10001-10800 | **44** | **37** | 51 |

En negrita, lo que está fuera de 45-55 %. Las dos tandas coinciden, así que no es ruido. Antes de
empezar las etapas conviene corregir **el sitio B del Almacén** (sube al atacante) y **el sitio A
del Puerto** (lo baja) con los datos de cada mapa. Si no, cualquier etapa mide sobre una base
desequilibrada.

**Corregido el 31 oct** (solo datos de los mapas, sin tocar clases). En el Almacén B, el Trampero y el
Merodeador pasan a puestos dentro del taller. En el Puerto A, el Ancla y el Trampero se retiran hacia
la cerca y la IA pone una sola barricada. Resultado con 800 rondas y dos tandas:

| Mapa | Tanda | Total | Sitio A | Sitio B |
| --- | --- | --- | --- | --- |
| Almacén | 1-800 | 51 | 47 | 55 |
| Almacén | 10001-10800 | 51 | 50 | 51 |
| Hotel (sin cambios) | 1-800 | 45 | 45 | 45 |
| Hotel (sin cambios) | 10001-10800 | 45 | 42 | 47 |
| Puerto | 1-800 | 50 | 50 | 49 |
| Puerto | 10001-10800 | 49 | 46 | 51 |

Esta es la línea base para las etapas. El sitio A del Hotel queda justo en el borde (45/42).

---

## Etapa 1 hecha: supresión (31 oct)

- `src/sim/stress.js`, números en `config/balance.js` `STRESS`. Estrés 0-1 por soldado: sube con las
  balas enemigas que pasan a menos de 1,5 m (más cuanto más cerca), las heridas, las explosiones a la
  vista (hasta 2 × su radio) y un compañero que cae a la vista (14 m). Baja 0,35 por segundo tras 1,2 s
  de calma.
- Efectos: error de puntería × (1 + estrés); tiempo de reacción × (1 + 0,4 · estrés); al llegar a
  0,75 se tira al piso 0,6 s (no avanza por su ruta), y no otra vez antes de 3 s. Igual para los dos
  bandos y la IA.
- En pantalla (solo los propios): viñeta oscura, mundo apagado (paso bajo del audio), estado
  "Suprimido" en la ficha y "Bajo fuego: estrés N %" en su información.
- Equilibrio (800 rondas, dos tandas, % atacante): Almacén 50/51, Puerto 47/48. El Hotel bajó a 45/42
  (sitio A 41/38): la supresión favorece un poco a quien defiende quieto. Se corrigió con el mapa (el
  Merodeador espera en la suite y la IA pone una sola barricada en A): **Hotel 50/48 (A 52/50, B 48/46)**.

## Etapa 2 hecha: heridas (31 oct)

- `src/sim/wounds.js`, números en `config/balance.js` `WOUNDS`. Un impacto en una extremidad es pierna
  o brazo (mitad y mitad). Pierna: velocidad × 0,6 y pasos que se oyen 1,5 × más lejos. Brazo:
  puntería × 1,5 peor y recarga × 1,3 más lenta. Nadie se cura en la ronda; el tiempo para morir no
  cambia (mismo daño).
- Rastro de sangre: por debajo de la mitad de la vida, una gota cada 0,9 m caminados (`sim.blood`). Su
  bando siempre la ve; el rival solo las gotas que un soldado suyo vio con su visión normal.
- En pantalla: "Herido" en la ficha (quieto) y la herida con su efecto en la información del soldado.
- Equilibrio (800 rondas, dos tandas, % atacante): **Almacén 49/50** (A 43/48, B 55/51), **Hotel
  50/47** (A 52/49, B 47/45), **Puerto 47/45** (A 44/42, B 49/48). Los totales siguen en la meta. El
  sitio A del Puerto bajó ~2 puntos (dentro del ruido de ~400 rondas por sitio). Se probaron variantes
  de mapa y de números (pierna 0,75, brazo 1,25, puestos, trampas, cámaras) y ninguna lo movió fuera del
  ruido: queda anotado para la próxima pasada de mapas.

## Etapa 3 hecha: munición y recarga (31 oct)

- Ya existían el conteo de cargador y reserva por arma, la recarga automática con el cargador vacío y
  la **recarga táctica** (sin blanco y con un tercio o menos, recarga sola; los dos bandos y la IA).
- Nuevo: la orden **RECARGAR** (rueda del soldado, abajo a la izquierda; tecla Y), en la planificación
  o durante el turno: un cargador nuevo en el paso siguiente, para hacerlo a cubierto antes de entrar.
- Nuevo: la recarga **se oye** (`NOISE.radius.reload` 5 m, entre el paso sigiloso y el normal).
- Nuevo: el número del cargador en la ficha se pone ámbar con un tercio o menos.
- Equilibrio: idéntico al de la etapa 2, ronda por ronda. La IA ya recargaba sola y no lee los pulsos
  de ruido (son información para el jugador), así que IA contra IA no cambia. Lo nuevo sirve a los
  jugadores.

## Etapa 4 hecha: sonido y callouts (31 oct)

- **Suelo ruidoso**: parches de vidrio roto, chapa y grava en cada mapa (`debris` en los datos del
  mapa; se dibujan en el piso, los dos bandos los ven). Pisarlos hace más ruido: grava 7 m, chapa 8 m,
  vidrio 9 m (`NOISE.radius`), aunque se vaya en sigilo. Almacén: vidrio, chapa y grava; Hotel: dos
  de vidrio y uno de chapa; Puerto: dos de grava y dos de chapa, en pasos que conviene cruzar callado.
  Un test comprueba que cada mapa tiene al menos tres parches, todos sobre piso transitable.
- **Callouts** (`ui/Callouts.js`, textos en `T.callouts`): una burbuja breve sobre el soldado propio
  que recarga, recibe un impacto, queda clavado por la supresión, lanza una granada, ve a un enemigo
  ("¡Contacto!", el más cercano) o abate a uno. Una por soldado cada 0,9 s; no se repiten en la
  repetición.
- No se hizo el **chirrido de puerta entreabierta**: entreabrir desaparece en la etapa 5 (lo reemplaza
  el espejo).
- Equilibrio: idéntico al de las etapas 2 y 3 (Almacén 49/50, Hotel 50/47, Puerto 47/45; mismos
  sitios). La IA no lee los pulsos de ruido, así que IA contra IA no cambia; lo nuevo es información
  para el jugador. Sigue pendiente el sitio A del Puerto (44/42) para la próxima pasada de mapas.
