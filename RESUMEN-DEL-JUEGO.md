# Tactic Squad — resumen del juego

Estado al 27 de octubre de 2026, rama `claude/revision-ux-fases` (sale de `main` después del PR #9).
Este documento es para que alguien de fuera entienda qué es el juego, qué está hecho y
qué falta, sin leer el código. La arquitectura del código está en `ARCHITECTURE.md`; el
juego se puede probar en el HTML único que acompaña a este resumen.

> **Qué cambió en esta revisión** (detalle en la sección 5): GO por colores en vez de
> letras, puertas que se abren solas si no decidís, menú del punto junto a la puerta,
> menú con JUGAR y lobby (formato, bando, clases), ruta de escuadra en fila, editar rutas,
> paso sigiloso, turno que se corta al ver un enemigo, lanzar flash/granada/humo a
> cualquier punto, humo, cámaras de los defensores, clases (Asaltante, Brecha,
> Explorador / Ancla), y partidas al mejor de 3, 5 o 7 con puntos de utilidad.

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
clases con su equipo, puntos de utilidad para los dos bandos y partidas al mejor de 3, 5 o 7.

La decisión de diseño que define el juego es el ritmo **We-Go**: nadie juega en tiempo
real contra el reloj. Se planifica a ciegas, sin límite contra la IA, y al apretar
LISTO los dos bandos resuelven 5 segundos a la vez. Después se vuelve a planificar. El
temporizador de la bomba (90 s) **solo corre durante esos turnos**, así que pensar es
gratis pero cada turno la acerca: 18 turnos y explota. Contra la IA, el turno **se corta
antes si tu escuadra ve a un enemigo nuevo** (opción, activa por defecto), para que
puedas reaccionar en vez de mirar cómo te matan.

---

## 2. Cómo se juega una ronda

Tres mapas, de 40 × 28 m. **Operación Almacén**, el equilibrado (patio de salida, oficina y
cocina al norte, pasillo al centro, baño y sala con el sitio B al sur, nave con el sitio A
al este). **Operación Hotel**, el de puertas: un pasillo recto de 23 m con habitaciones
comunicadas a los lados (cada una con su baño junto a la entrada), la lavandería con el
sitio B y la suite al fondo con el sitio A, a la que solo se entra por dos puertas (la del
pasillo, tras un recibidor, y la que la comunica con la 705). Premia abrir y mirar antes
de entrar (Brecha, Explorador) y castiga cruzar el pasillo a la vista (Ancla, Trampero).
**Operación Puerto**, el abierto: una terminal de contenedores con medio mapa al aire libre.
El sitio A es el patio de contenedores, sin puertas y con tres carriles largos (el muelle,
de 31 m; el carril del medio y la explanada de camiones): premia a los Tiradores y al Escudo
para cruzar, y al Merodeador entre las pilas. El sitio B es la cámara de frío de la bodega,
con dos puertas pesadas que dan a la bodega, y a la bodega se entra por el andén, la puerta
del frente o la aduana: premia al Ancla y al Trampero, y la abren la Brecha y el Granadero.
La ronda es **3 contra 3**: el mapa trae 4 puestos de defensa por sitio y se usan los 3
primeros (`config/squad.js` `DEFENDERS`).

**Paridad.** Ningún bando tiene ventaja de fábrica: los dos reaccionan y apuntan con las
mismas reglas, y decide la postura. Reacción base 0,24 s; si el enemigo aparece donde ya
apuntaba, la mitad; si además **sostiene el ángulo** (0,6 s quieto con la mira puesta),
otro 25 % menos; recién cruzada una puerta, +0,05 s. Resultado: quien entra a lo bruto
pierde contra quien lo espera, y gana si entra con un flash, un humo o por otro lado. El
equilibrio se mide con `node scripts/balance.mjs` (rondas IA contra IA, meta 45-55 % por
bando; hoy 52 % atacantes en 200 rondas: 55 % en A, 49 % en B).

| Fase | Plazo | Qué pasa |
| --- | --- | --- |
| **Compra** | sin límite | Los dos bandos a la vez. Cada operador lleva gratis el equipo de su **clase** (elegida antes de la partida) y suma utilidad con sus **2 puntos**: el atacante flash, granada, humo o carga; el defensor flash, granada o humo (1 punto cada una). |
| **Preparación** | sin límite | A ciegas y a la vez. El atacante elige una de **3 entradas** (norte, principal, sur); el defensor primero hace su **Reconocimiento**: elige **sitio A o B**, pone **2 barricadas** y **1 alambre de púas** y monta **2 cámaras** en los soportes que elija (7 en el mapa); al confirmar quedan **fijos toda la ronda**. Después coloca a los suyos y les da vigilancia. |
| **Dron** | 15 s | El atacante maneja un dron en tiempo real. Pasa por debajo de las puertas, no por barricadas. Lo que ve queda marcado: defensores, barricadas, cámaras y la bomba. Un defensor que lo vea 0,6 s lo derriba. Las cámaras ya no se mueven. |
| **Planificación** | sin límite | Tiempo detenido. Rutas, miradas, esperas en grupos GO de **color** (violeta, rosa, blanco), cómo entra por cada puerta, a qué paso, y qué lanza. |
| **Ejecución** | 5 s (menos si ve a alguien) | Todo corre a la vez. La única orden durante el turno es el **GO de un color**: ese grupo sale junto. |
| **Fin** | 10 s | Resultado, con un "por qué" que explica cómo murió cada uno y qué falló. |

**Toda ronda es completa.** Desde la primera partida hay compra, entrada y dron; cada
fase trae una tarjeta que la explica la primera vez. Solo las lecciones del tutorial que no las usan las saltan
(enseña el asalto).

**Menú y lobby.** JUGAR → CONTRA LA IA (MULTIJUGADOR, próximamente) → el lobby:
**formato** (una ronda suelta o al mejor de 3, 5 o 7), **con
qué bando empiezas** y **mapa** (Almacén, Hotel, Puerto o al azar, en una lista a la izquierda con el plano del elegido a la derecha: el azar se sortea al pasar a las clases, para elegirlas sabiendo dónde se juega). Cada mapa tiene su **ficha**: el plano con sitios y entradas y tres rasgos; tocar A o B muestra la lectura de ese sitio. No sugiere clases: leer el mapa es parte del juego. En la elección de clases, VER PLANO la vuelve a abrir. ELEGIR CLASES
lleva al **roster**, como el pick phase de un MOBA: un grupo de personajes por bando,
cada uno con su símbolo y su color, del que se eligen los 3 de tu escuadra (en una
partida, una pestaña para cuando atacas y otra para cuando defiendes). Al tocar uno se ve
su ficha: arma (con barras de daño, cadencia y precisión), equipo de cada ronda y
características; AÑADIR lo suma al primer puesto libre y tocar un puesto lo quita. Duran toda la
partida: dentro de ella no se cambian. Abajo, quién está y si está listo; CONFIRMAR
empieza cuando las escuadras tienen sus 3 (contra la IA, la IA elige la suya a ciegas).
El menú recuerda lo elegido.

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
  - **Puerta: una rueda alrededor del punto** con las seis entradas a la vista (Abrir,
    Patada, Carga, Granada, Flash, Entreabrir); × en el centro o Esc la cierra. Lo demás
    (cuándo, paso, lanzar) queda en un panel al lado. **Tocar una puerta directamente**
    apila al operador del lado por donde llega y abre la rueda: un toque y una elección.
  - **Granada, Flash y Carga se hacen desde el costado del marco**, pegado a la pared y no
    parado frente al vano: al abrir la puerta, desde adentro casi no se lo ve. Abrir,
    Patada y Entreabrir siguen frente a la puerta.
  - **Puerta compartida.** Si dos rutas cruzan la misma puerta y uno ya decidió cómo
    entrar, al otro no se le pregunta: espera al costado libre del marco (etiqueta
    ESPERA) y cruza recién cuando el primero terminó su entrada (después del estallido).
  - **Entreabrir** deja la puerta a 20° y el operador mira por la rendija: ve **una franja
    de la sala** hacia el lado del pestillo, no la sala entera. Lo que ve se marca, pero no
    dispara a través de la puerta; con el GO la abre y entra.
  - **Cuándo:** Ya, o un GO de color.
  - **Paso:** Normal o **Sigilo**. A la mitad de velocidad, se oye a 2 m en vez de 6.
  - **Lanzar:** flash, granada o humo. El siguiente toque elige dónde cae, a 9 m como
    mucho, y se corta en la primera pared. Si el punto está junto a una puerta y el
    blanco del otro lado, **abre la puerta y lanza adentro** (detrás del marco, su propia
    granada no lo alcanza). El que lanza **se queda quieto hasta que explota** y después
    sigue su ruta. La línea punteada muestra dónde cae de verdad; en rojo si una granada
    lo alcanzaría a él. Mientras eliges dónde, el menú se reduce a "¿Dónde cae?" y ×
    (o Esc) cancela.
  - **Asomarse y volver** (en el último punto): se queda 1,5 s mirando hacia donde
    marcaste en ese punto y vuelve a donde estaba, mirando como antes. Sirve para
    chequear un pasillo sin abandonar el puesto. Vuelve sosteniendo el ángulo, más lento.
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

**Las rondas no se repiten.** Una ronda termina y su resultado queda: sin reintento ni
"empezar de nuevo" (solo una lección del tutorial se puede repetir). Al terminar, antes
del resultado, se ve la **repetición de la última baja**: 3,5 s antes del disparo,
el momento del disparo en cámara lenta, y quién abatió a quién, con el que dispara a la
vista aunque nunca se lo haya visto. ESPACIO o SALTAR va directo al resultado, que ofrece
verla de nuevo y OTRA RONDA. La repetición no graba nada aparte: la ronda se juega otra
vez, fuera de pantalla, con la misma semilla y las órdenes de cada fase
(`session/KillCam.js`).

### Partida al mejor de 3, 5 o 7

Desde el lobby: rondas seguidas contra la IA hasta que alguien gane la mayoría (2, 3 o
4). A la mitad (tras 1, 2 o 3 rondas) se cambia de bando. No hay dinero: cada ronda,
en los dos bandos, cada operador lleva **el equipo de su clase, gratis y completo** (también
el que cayó en la anterior) y **2 puntos de utilidad**. Lo que no se gasta se pierde.
**El bando que perdió la ronda tiene +1 punto por operador en la siguiente.**

Pasa a la ronda siguiente la **clase** de cada atacante. En una partida no hay reintentos.
El resultado muestra el marcador, quién tiene el punto extra y SIGUIENTE RONDA. El jugador
ataca las 3 primeras rondas y después **cambia de bando** y defiende. Como en el medio
tiempo, todo empieza de cero (sin punto extra). El
marcador cuenta las rondas del jugador contra las de la IA, en los dos bandos.

---

## 3. Clases y utilidad

| Clase | Bando | Arma | Equipo de clase | Qué la hace distinta |
| --- | --- | --- | --- | --- |
| **Asaltante** | atacante | rifle | flash, granada | El que gana los duelos al cruzar una puerta: reacciona el doble de rápido en el umbral |
| **Brecha** | atacante (una) | subfusil | flash, 2 cargas | Planta en la mitad de tiempo, rompe barricadas antes, su carga aturde 2,5 veces más y su conmoción deja aturdido al que espera en la sala de detrás, y **corta el alambre en silencio con la tenaza** |
| **Explorador** | atacante (uno) | rifle | flash, humo | **Cámara de fibra**: pasa la lente bajo una puerta cerrada y ve el cuarto sin abrirla (nueva entrada "Cámara"). Oído fino: los ruidos le llegan en el punto exacto y, si alguien camina a menos de 5 m (aunque pise suave), se gira hacia donde va a aparecer. Ve las trampas desde más lejos |
| **Escudo** | atacante (uno) | pistola | flash | Escudo balístico al frente: para las balas que vienen de adelante (algo se filtra a brazos y piernas). Más lento, gira y apunta peor; golpea más fuerte. Si lo ciegan o aturden, lo baja |
| **Tirador** | atacante | fusil de tirador | humo | Mira larga: reacciona un 45 % más rápido mientras está quieto sosteniendo un ángulo, pero gira despacio y anda más lento |
| **Granadero** | atacante | subfusil | 2 de gas, flash | Lanzador: tira el doble de lejos. **Gas lacrimógeno**: los enemigos adentro ven a 3 m, reaccionan más lento, apuntan peor y tosen (se los oye) |
| **Escopetero** | defensor (hasta 2) | escopeta | flash, granada | Espera pegado a la puerta al que entra: a menos de 5 m tumba de un tiro y reacciona un 28 % más rápido. Lejos la rosa de perdigones se abre y pierde fuerza |
| **Ancla** | defensor (hasta 2) | según el puesto | granada | 120 de vida y reacción un 10 % más rápida. **Parapeto**: en la preparación arma una cobertura de metal a la altura del pecho frente a su puesto |
| **Merodeador** | defensor (uno) | su propia arma | flash | Fuera del sitio, a la caza del flanco: 12 % más rápido, sus pasos se oyen a un tercio de distancia y **sus tiros llevan silenciador** |
| **Trampero** | defensor (uno) | según el puesto | 2 trampas, humo | Cepos en la preparación (0,6 s atrapado, 5 de daño, ruido y delación) y **un alambre más** para el equipo. Las trampas se ven con sigilo, dron o la cámara del Explorador |
| **Vigía** | defensor (uno) | según el puesto | flash | **Una cámara más** y la orden "Monitor": se queda en el monitor y las cámaras detectan al instante y revelan a todos los que ven. Mientras mira, ve poco a su alrededor |
| **Tirador** (defensor) | defensor (uno) | rifle de francotirador | flash | Sostiene un ángulo largo con reacción mucho más rápida; un impacto al torso tumba a cualquiera de 100 de vida. Gira lento |

Las clases se eligen antes de la partida, a ciegas (no ve las del
atacante, y el atacante no ve las suyas). La IA elige su escuadra a ciegas entre combinaciones con sentido, según la semilla de la ronda.

**Alambre de púas.** Solo del defensor: uno por ronda, en una puerta que podría atrancar (nunca junto a una barricada). No para a nadie ni hace daño: el atacante que lo cruza va a la mitad de velocidad y **suena** (los defensores cercanos se giran hacia ahí). El defensor pasa libre. Una granada o una carga cerca lo quita. El atacante lo ve como una barricada: a la vista, con el dron o al pisarlo. La IA pone el suyo en una de sus puertas sin barricada.

**Incendiaria.** Solo del defensor, 2 puntos (máx. 1). Se lanza como una granada y deja **fuego de 1,8 m de radio durante 7 s**: quema a quien esté adentro, de cualquier bando (22 de daño por segundo). **El humo la apaga.** Sirve para cortar una puerta o cubrir la bomba: la IA defensora la compra para uno de los suyos y la lanza a la puerta que vigila o sobre la bomba si alguien la está desactivando. La IA atacante espera a que se consuma antes de cruzarla.

**Utilidad del defensor.** Con sus puntos suma flash, granada o humo (las cargas son
solo del atacante). Un jugador defensor la lanza planificando, como el atacante. La IA
defensora compra una flash y, cuando oye venir a alguien, lanza su granada o su humo a la
puerta o esquina por donde va a aparecer, si la ve, está a su alcance y la granada no
alcanza a ningún compañero. En 200 rondas IA contra IA los atacantes ganan el 47 %.

**Humo.** Una nube de 2,6 m de radio que crece en 1,4 s y dura unos 14 s. Tapa **la vista de
todos**: operadores, IA, niebla de guerra, dron y cámaras. **No para balas ni
explosiones.**

**Cámaras de los defensores.** El defensor monta **2** en los **7 soportes** de la pared
del mapa (pasillo este y oeste, cocina, sala norte y sur, nave norte y sur). En la
preparación y mientras vuela el dron enemigo, cada soporte es un botón redondo sobre el
mapa: **+** la pone, **×** la quita, y el cono de lo que vería se dibuja punteado. Cada
soporte apunta a un lado fijo. La IA usa las de su sitio (A: pasillo este y nave sur;
B: sala sur y sala norte), que también son las iniciales del jugador. Se ven como una
cámara de seguridad blanca con su lente y su cono de visión en el suelo, cortado por
paredes, puertas y humo. Un soporte que el atacante ya descubrió sigue descubierto
aunque la cámara se quite y se vuelva a poner. Si tiene a un atacante a la vista 0,5 s, **todos los defensores saben dónde está** y
apuntan a esa entrada. Si juegas de defensor, **lo ves en tu mapa** y la primera vez
cuenta como contacto (corta el turno); con **CÁMARAS** (tecla O) las recorres al planificar. Los atacantes la descubren con un operador o con el dron (la
cámara con su cono) y **la rompen de un tiro** si no tienen a quién más dispararle. Si ya
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
- Todas las fases desde la primera ronda, con tarjeta de presentación.
- Repetición de la última baja al terminar la ronda (las rondas no se reintentan).
- **Partidas al mejor de 3, 5 o 7**, marcador, clase que se conserva y +1 punto de utilidad para el que pierde.
- Menú con lobby (formato, bando, mapa, clases), tutorial en lecciones (1. Básico, sobre una ronda real más fácil; 5. Ronda completa, con tarjeta en cada fase; las otras tres en camino), pantalla de "por qué".

**Atacante**
- Clases elegibles en la compra, cada una con su equipo; 2 puntos de utilidad por operador en los dos bandos.
- 3 entradas, ocultas para el defensor. Dron de 15 s.
- Rutas con pathfinding, editables (mover, insertar), ruta de escuadra en fila, miradas, esperas de color, paso sigiloso.
- 6 formas de entrar por una puerta, con "abrir" por defecto; lanzar flash, granada o humo a cualquier punto.
- Cámara de fibra del Explorador, escudo, gas lacrimógeno, fusil de tirador.

**Defensor**
- Sitio A/B oculto, colocación, 4 órdenes de vigilancia, 2 barricadas, 2 cámaras en los soportes que elige (también durante el dron), Anclas.

**Simulación y presentación**
- Determinista por semilla, paso fijo de 60 Hz. Visión compartida entre percepción y niebla de guerra (el humo entra en las dos).
- Renderer WebGL2 propio, HUD en DOM para celular horizontal, audio 100 % procedural (con siseo de humo), mouse/teclado y gestos táctiles.


| Del diseño | Estado |
| --- | --- |
| Una ronda completa contra la IA, jugable en celular | **Hecho** |
| El jugador elige bando | **Hecho** (en el lobby) |
| Partida al mejor de 7 | **Hecho**, también al mejor de 3 y 5, con cambio de bando a la mitad |
| Economía entre rondas | **Cambiado** (28 oct 2026): sin dinero. Equipo de clase gratis cada ronda y 2 puntos de utilidad por operador en los dos bandos, +1 al que perdió. Con mitades de 3 rondas el dinero casi no pesaba y solo compraba el atacante |
| Clases de operador con habilidad | **Hecho** (28 oct 2026): 6 atacantes y 6 defensores, cada uno con algo que lo hace jugar distinto (el Defensor genérico queda solo para el tutorial); elección a ciegas en los dos bandos, también la IA |
| Contras entre clases | **Hecho** (29 oct 2026): Brecha > Ancla (conmoción), Explorador > Merodeador (oído), Escudo > Tirador (el tiro lento no lo sacude), Granadero > Vigía (gas); además cámara de fibra contra trampas, flash contra escudo, humo contra cámaras. Composiciones arquetípicas en `docs/diseno/composiciones.md` |
| Refuerzos: puerta trabada, sensor, cámara | **Parcial.** Barricadas y cámaras (soportes del mapa a elegir, gratis). Sensor y elección de refuerzos por el defensor: faltan |
| Paredes blandas destructibles | **Descartado** por decisión de diseño (27 oct 2026): no se implementan |
| Plazos de las fases | **Parcial.** El reloj existe (`PhaseClock`), pero contra la IA no hay límite |
| Versiones 3v3 y 5v5, más mapas, dificultades de IA | **Parcial.** Tres mapas (Almacén, Hotel y Puerto; IA contra IA con escuadras al azar: 51 %, 52 % y 53 % para el atacante); Embajada en camino. 5v5 y dificultades: faltan |
| Online | **Falta.** El código está preparado (determinismo, órdenes serializables, grabador de planes, `teamView`). Bloquea que el render lea la sim entera |
| Equilibrio 45-55 % | **Medido** (29 oct 2026, 600 rondas por mapa, escuadras a ciegas): atacantes 54 % Almacén, 46 % Hotel, 50 % Puerto. Por clase, tabla en `docs/traspaso/CLASES-Y-MAPAS.md` |

---

## 6. Dónde mirar si querés opinar

1. **La primera partida.** Va directo a planificar, con puertas que se abren solas. ¿Se
   entiende qué hacer sin leer la ayuda?
2. **Ruta de escuadra + GO por colores.** ¿Mover a los tres con una ruta y entrar con un
   color se siente como Door Kickers?
3. **El corte del turno al contacto.** ¿Ayuda a reaccionar o rompe el ritmo de 5 s?
4. **Cámaras y dron.** ¿El dron ahora tiene un trabajo claro (encontrar la cámara antes
   de entrar)?
5. **Clases.** El Tirador defensor sigue flojo en el Almacén (36 %, sitios de líneas cortas) y el Trampero fuerte en el Hotel (65 %). ¿Se ajustan por mapa (puestos) o por clase?
6. **Los puntos de utilidad.** ¿2 puntos alcanzan para adaptar el plan? ¿El punto extra del que pierde ayuda a volver? ¿La racha
   de derrotas alcanza para volver?
7. **Celular.** Todo pensado para un celular horizontal. Vale probarlo ahí.
