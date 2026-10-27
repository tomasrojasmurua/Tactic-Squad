# Tactic Squad — resumen del juego

Estado al 27 de octubre de 2026, rama `claude/revision-ux-fases` (sale de `main` después del PR #9).
Este documento es para que alguien de fuera entienda qué es el juego, qué está hecho y
qué falta, sin leer el código. La arquitectura del código está en `ARCHITECTURE.md`; el
juego se puede probar en el HTML único que acompaña a este resumen.

> **Qué cambió en esta revisión** (detalle en la sección 5): GO por colores en vez de
> letras, puertas que se abren solas si no decidís, menú del punto junto a la puerta,
> fases que se van sumando con la experiencia, ruta de escuadra en fila, editar rutas,
> paso sigiloso, turno que se corta al ver un enemigo, lanzar flash/granada/humo a
> cualquier punto, humo, cámaras de los defensores, clases (Asaltante, Brecha,
> Explorador / Ancla), y partida al mejor de 7 con economía.

---

## 1. Qué es

Un juego web táctico de escuadra en vista cenital (casi de arriba, con una perspectiva
leve que deja ver las caras de las paredes). JavaScript puro con WebGL2 propio, interfaz
en español, se juega en escritorio y en celular horizontal. No hay framework ni
dependencias en tiempo de ejecución.

La referencia de controles y de lectura es **Door Kickers 2**: se eligen operadores, se
les dibujan rutas, se decide cómo entran por cada puerta, se mueven en fila. La
referencia del objetivo y de la preparación es **Rainbow Six Siege**: la bomba ya está
en el mapa, los defensores la protegen con barricadas y cámaras, los atacantes
reconocen con un dron y la desactivan. La ambientación y la estructura de partida vienen
de **Counter-Strike**: sitios A y B, entradas, utilidad (flash, granada, humo, carga),
economía entre rondas y partida al mejor de 7.

La decisión de diseño que define el juego es el ritmo **We-Go**: nadie juega en tiempo
real contra el reloj. Se planifica a ciegas, sin límite contra la IA, y al apretar
LISTO los dos bandos resuelven 5 segundos a la vez. Después se vuelve a planificar. El
temporizador de la bomba (90 s) **solo corre durante esos turnos**, así que pensar es
gratis pero cada turno la acerca: 18 turnos y explota. Contra la IA, el turno **se corta
antes si tu escuadra ve a un enemigo nuevo** (opción, activa por defecto), para que
puedas reaccionar en vez de mirar cómo te matan.

---

## 2. Cómo se juega una ronda

Un mapa: **Operación Almacén** (40 × 28 m: patio de salida, oficina y cocina al norte,
pasillo al centro, baño y sala con el sitio B al sur, nave con el sitio A al este).
Hoy la ronda es 3 atacantes contra 4 defensores, lo que fija el mapa.

| Fase | Plazo | Qué pasa |
| --- | --- | --- |
| **Compra** | sin límite | Cada atacante elige su **clase** (Asaltante, Brecha, Explorador; Brecha y Explorador, uno solo) y compra utilidad con su dinero: flash $200, granada $300, humo $300, carga $300. |
| **Preparación** | sin límite | A ciegas y a la vez. El atacante elige una de **3 entradas** (norte, principal, sur); el defensor elige **sitio A o B**, coloca a los suyos, les da vigilancia y pone **2 barricadas**. Cada sitio trae **una cámara**. |
| **Dron** | 15 s | El atacante maneja un dron en tiempo real. Pasa por debajo de las puertas, no por barricadas. Lo que ve queda marcado: defensores, barricadas, cámaras y la bomba. Un defensor que lo vea 0,6 s lo derriba. |
| **Planificación** | sin límite | Tiempo detenido. Rutas, miradas, esperas en grupos GO de **color** (violeta, rosa, blanco), cómo entra por cada puerta, a qué paso, y qué lanza. |
| **Ejecución** | 5 s (menos si ve a alguien) | Todo corre a la vez. La única orden durante el turno es el **GO de un color**: ese grupo sale junto. |
| **Fin** | 10 s | Resultado, con un "por qué" que explica cómo murió cada uno y qué falló. |

**Fases que se suman con la experiencia.** La primera partida va directo a la
planificación: compra, entrada y dron llegan solos después (entrada a la 2.ª ronda,
compra y dron a la 3.ª), cada uno con una tarjeta que lo explica la primera vez. La
opción "Ronda completa" de la ayuda las muestra todas desde el principio. La partida al
mejor de 7 se juega siempre completa.

**Objetivo.** Los atacantes ganan si desactivan la bomba (7 s quieto al lado) o si
eliminan a todos los defensores. Los defensores ganan si explota o si eliminan a todos
los atacantes.

### Controlar la escuadra

- **Rutas.** Tocar el suelo agrega un punto (con pathfinding); arrastrar desde el
  operador o desde el final de su ruta la dibuja a mano. **Arrastrar un punto lo
  mueve**, arrastrar un tramo inserta uno nuevo. Arrastrar el suelo mueve la cámara (un
  dedo en el celular).
- **Ruta de escuadra (ESCUADRA / Q).** Los demás siguen al seleccionado en fila, a
  0,85 m uno de otro. Una sola ruta mueve a los tres, y en cada espera del líder se
  apilan detrás de él con su mismo color. Una orden propia saca a uno de la fila.
- **Menú del punto.** Tocar un punto, su etiqueta o el final de la ruta abre un menú
  junto a él:
  - **Puerta:** Abrir / Patada / Flash, y "Más" con Entreabrir / Granada / Carga.
  - **Cuándo:** Ya, o un GO de color.
  - **Paso:** Normal o **Sigilo**. A la mitad de velocidad, se oye a 2 m en vez de 6.
  - **Lanzar:** flash, granada o humo. El siguiente toque elige dónde cae, a 9 m como
    mucho, y se corta en la primera pared o puerta cerrada. La línea punteada muestra
    dónde cae de verdad.
- **Puertas.** Si nadie decide, el operador **la abre y pasa**. El "?" sobre una puerta
  de la ruta es una invitación, no un freno.
- **GO por colores.** ESPERAR en un punto lo asigna a un grupo de color. Durante el
  turno, el botón de ese color (o Z / X / C) libera a todos los que esperan con él. Una
  entrada coordinada de tres por dos puertas al mismo color funciona distinto que
  entrar de a uno.

**Ruido.** Pasos, puertas, golpes, disparos, cargas, granadas, humo y las herramientas
de desactivar se oyen a través de las paredes dentro de un radio. Al final de cada turno
lo que oyó cada bando aparece en **su** mapa como un pulso aproximado que se apaga en 3
turnos. El paso sigiloso casi no se oye.

**Reintentar.** Fuera de una partida, al final de la ronda R la repite con la misma
semilla y las mismas órdenes grabadas, fase por fase. Cambiar una cosa toma el control
desde ahí. El bucle buscado: fallar, entender por qué, cambiar **una** cosa, probar de
nuevo.

### Partida al mejor de 7

Desde el menú, "Partida al mejor de 7": rondas seguidas contra la IA hasta que alguien
gane 4. Cada operador cobra por ronda:

- **Victoria** +$600. **Derrota** +$300, más $100 por cada derrota seguida (hasta 3).
- **+$100 por baja** y **+$200 a quien desactiva**.
- El dinero tiene tope de $2000.

Pasan a la ronda siguiente la **clase**, el **dinero** y el **equipo sin usar de los
que sobrevivieron**. El que cae pierde lo que llevaba. En una partida no hay reintentos.
El resultado muestra el marcador, cuánto cobró cada uno y SIGUIENTE RONDA. Por ahora se
juega siempre de atacante (ver sección 5).

---

## 3. Clases y utilidad

| Clase | Bando | Arma | Equipo de clase | Qué la hace distinta |
| --- | --- | --- | --- | --- |
| **Asaltante** | atacante | rifle | flash, granada | El que gana los duelos |
| **Brecha** | atacante (una) | subfusil | flash, 2 cargas | Planta la carga en la mitad de tiempo y rompe barricadas a mano un 40 % más rápido |
| **Explorador** | atacante (uno) | rifle | flash, humo | Algo más rápido y con más alcance de vista. **Al final de cada turno detecta a los defensores a 8 m, aun tras las paredes**: quedan marcados para el plan |
| **Defensor** | defensor | según el puesto | — | El de siempre |
| **Ancla** | defensor | según el puesto | — | Los que sostienen el sitio: 120 de vida y reacción un 15 % más rápida |

**Humo.** Una nube de 2,6 m de radio que crece en 1,4 s y dura unos 14 s. Tapa **la vista de
todos**: operadores, IA, niebla de guerra, dron y cámaras. **No para balas ni
explosiones.**

**Cámaras de los defensores.** Una por sitio: en A mira el pasillo, en B la sala. Si
tiene a un atacante a la vista 0,5 s, **todos los defensores saben dónde está** y
apuntan a esa entrada. Los atacantes la descubren con un operador o con el dron (punto
rojo con su cono) y **la rompen de un tiro** si no tienen a quién más dispararle. Si ya
la conocían, la rompen antes de que alcance a verlos. El humo también la ciega.

---

## 4. Las dos IA

**IA defensora** (`sim/ai.js`). Las órdenes de vigilancia del defensor *son* los
comportamientos de la IA: mantener un ángulo, barrer, patrullar, o replegarse a un punto
con el primer tiroteo que oiga. Ante una alerta (ruido, dolor o **una cámara**) no se
giran hacia el ruido, sino hacia la **primera esquina o puerta del camino hacia él**.
Pre-apuntan la entrada que el atacante tiene que usar. Oyen mucho menos a quien va en
sigilo.

**IA atacante** (`sim/aiAttack.js`). Un comandante que da a su escuadra las mismas
órdenes que un jugador, sabiendo solo lo que sabe su bando: compra, maneja el dron,
elige entrada, traza rutas y arma cada puerta con un flash o una carga y un GO
compartido.

Ninguna usa el azar de la ronda para decidir: una ronda contra la IA se repite igual.

---

## 5. Qué está implementado y qué falta

Todo lo de abajo está probado (81 pruebas) y jugable en el HTML.

**Ronda y ritmo**
- Fases dentro de la simulación: compra → preparación → dron → planificación ⇄ ejecución → fin.
- Turnos de 5 s que se cortan al ver un enemigo nuevo (opción), bomba de 90 s.
- Grupos GO de color en vivo.
- Fases que se desbloquean con las rondas jugadas, con tarjeta de presentación.
- Reintentar con el plan grabado (fuera de partida).
- **Partida al mejor de 7 con economía**, marcador y equipo que se conserva.
- Menú, tutorial guiado sobre una ronda real más fácil, pantalla de "por qué".

**Atacante**
- Clases elegibles en la compra, compra por operador con dinero propio.
- 3 entradas, ocultas para el defensor. Dron de 15 s.
- Rutas con pathfinding, editables (mover, insertar), ruta de escuadra en fila, miradas, esperas de color, paso sigiloso.
- 6 formas de entrar por una puerta, con "abrir" por defecto; lanzar flash, granada o humo a cualquier punto.
- El Explorador detecta a través de las paredes.

**Defensor**
- Sitio A/B oculto, colocación, 4 órdenes de vigilancia, 2 barricadas, una cámara por sitio, Anclas.

**Simulación y presentación**
- Determinista por semilla, paso fijo de 60 Hz. Visión compartida entre percepción y niebla de guerra (el humo entra en las dos).
- Renderer WebGL2 propio, HUD en DOM para celular horizontal, audio 100 % procedural (con siseo de humo), mouse/teclado y gestos táctiles.

**PR abierto, sin mergear:** [#10](https://github.com/tomasrojasmurua/tactic-squad/pull/10)
agrega **jugar de defensor**. Esta rama sale de `main` y **no lo incluye**: se juega
solo de atacante, y por eso la partida no tiene cambio de bando.

| Del diseño | Estado |
| --- | --- |
| Una ronda completa contra la IA, jugable en celular | **Hecho** |
| El jugador elige bando | En el PR #10, sin mergear |
| Partida al mejor de 7 | **Hecho**, de atacante. Falta el cambio de bando tras la ronda 3 (necesita el PR #10) |
| Economía entre rondas | **Hecho**, con números escalados a la compra de $800: +$600 ganar, +$300 perder (+$100 por racha), +$100 por baja, +$200 por desactivar, tope $2000. Los del diseño (+$3.250 / +$1.400) eran para una compra de otra escala |
| Clases de operador con habilidad | **Parcial.** Asaltante, Brecha, Explorador y Ancla. Faltan Escudo, Tirador, Granadero, Merodeador, Trampero y Vigía, y la elección a ciegas del defensor |
| Contras entre clases | **Parcial.** Brecha contra barricadas, Explorador contra Anclas escondidos, humo contra cámaras y anclas |
| Refuerzos: puerta trabada, sensor, cámara | **Parcial.** Barricadas y cámaras (fijas por mapa, gratis). Sensor y elección de refuerzos por el defensor: faltan |
| **Paredes blandas destructibles** | **Falta, diseñado** (ver `ARCHITECTURE.md` §11). Se dejó para no romper el pathfinding en una pasada apurada |
| Plazos de las fases | **Parcial.** El reloj existe (`PhaseClock`), pero contra la IA no hay límite |
| Versiones 3v3 y 5v5, más mapas, dificultades de IA | **Falta** |
| Online | **Falta.** El código está preparado (determinismo, órdenes serializables, grabador de planes, `teamView`). Bloquea que el render lea la sim entera |
| Equilibrio 45-55 % | **Sin medir** con las clases y las cámaras nuevas |

---

## 6. Dónde mirar si querés opinar

1. **La primera partida.** Va directo a planificar, con puertas que se abren solas. ¿Se
   entiende qué hacer sin leer la ayuda?
2. **Ruta de escuadra + GO por colores.** ¿Mover a los tres con una ruta y entrar con un
   color se siente como Door Kickers?
3. **El corte del turno al contacto.** ¿Ayuda a reaccionar o rompe el ritmo de 5 s?
4. **Cámaras y dron.** ¿El dron ahora tiene un trabajo claro (encontrar la cámara antes
   de entrar)?
5. **Clases.** ¿El Explorador es demasiado bueno? ¿La Brecha justifica su lugar?
6. **La economía de la partida.** ¿Perder deja con lo justo para comprar algo? ¿La racha
   de derrotas alcanza para volver?
7. **Celular.** Todo pensado para un celular horizontal. Vale probarlo ahí.
