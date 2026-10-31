# Mapas v2: personalidad, realismo y escala

Rama `claude/mapas-personalidad`. Este documento se escribió antes de construir. Las cifras finales
(tiempos, equilibrio) están en la sección 6 y se completaron después de medir.

## 1. Diagnóstico de los mapas actuales (40 × 28 m)

| Mapa | Lo que funciona | Lo que falla |
| --- | --- | --- |
| **Almacén** | Lectura clara, tres puertas cercanas, sitios con tres accesos. | Es un plano de oficina: cuadrículas de salas iguales, un pasillo central recto y una nave casi vacía. Las tres entradas están a 9 m una de otra en la misma pared, así que la elección de entrada casi no pesa. No cuenta qué es el lugar. |
| **Hotel** | Identidad de "mapa de puertas". La suite con dos accesos es memorable. | Siete habitaciones clonadas (el mismo mobiliario copiado), un pasillo de 23 m sin cobertura, el patio de servicio es un rectángulo vacío, y el sitio A solo tiene dos accesos. Para un piso de hotel es muy chico: las habitaciones miden 4,5 × 10,8 m, sin vestíbulo de ascensores ni zona pública. |
| **Puerto** | Buen contraste entre sitio abierto y sitio cerrado. | Los contenedores están en dos filas casi alineadas, todos a la misma altura y orientación: se lee como una cuadrícula y no como una terminal. No hay grúa, ni zona de trabajo, ni nada que indique que el puerto se usa. El muelle es un pasillo de 31 m sin cobertura. |

En los tres: las entradas del atacante salen de la misma pared oeste y casi de la misma franja, la
rotación del defensor nunca supera los ~30 m y los mapas no tienen rasgos para nombrar ("callouts").

## 2. Escala y cámara

- **Tamaños nuevos**: Almacén **56 × 34 m**, Hotel **56 × 34 m**, Puerto **60 × 38 m** (de 1.120 m² a
  1.900-2.280 m²). Son anchos más que altos a propósito: en un celular horizontal el área libre del
  HUD es de ~748 × 300 px (2,5 : 1), así que un mapa apaisado aprovecha mejor la pantalla.
- **Cámara**: `CameraFraming` ya calcula "ver todo" (`fitHeight`) con el tamaño del mapa, y `maxHeight`
  sube sola cuando hace falta. El primer plano del atacante (`camera.frame`) sigue encuadrando unos
  24 × 11 m alrededor de su entrada, y el del defensor (`defendFrame`) unos 30 × 24 m, de forma que
  en el celular se ven igual de grandes que hoy. Se revisa con capturas a 844 × 390.
- **Ritmo**: a 2,7 m/s, los recorridos de entrada a bomba pasan de 16-44 m a 25-55 m (de 6-16 s a
  9-20 s de marcha), dentro de los 90 s de bomba. El dron (15 s, 36 m) ya no alcanza a revisar los dos
  sitios: tiene que elegir. Es una decisión táctica nueva, no un error.
- **El tutorial** se queda en el Almacén original (ahora `training`, fuera del lobby): sus lecciones
  y las pruebas de mecánicas están escritas sobre esas coordenadas.

## 3. Principios aplicados a los tres

1. Tres carriles por mapa (norte, centro, sur) con conexiones entre ellos; cada entrada del atacante
   empieza en un carril distinto y sale de lugares distintos (no de la misma pared).
2. Cada sitio con **tres accesos** de tipos distintos (puerta, arco/abertura, ventana o puerta de
   servicio) y cobertura alta y baja.
3. Cobertura en todo recorrido largo: el único tramo descubierto de cada mapa es deliberado y tiene
   contra-juego (humo, otra ruta).
4. Verticalidad simulada: muebles altos (estanterías, pilas de contenedores de dos alturas, columnas,
   patas de grúa) cortan la vista; muebles bajos (mostradores, cajas, barreras) cubren pero dejan ver
   y disparar por encima.
5. Composición orgánica: nada en filas perfectas; pilas irregulares, huecos, objetos girados,
   zonas de trabajo con historia (algo a medio hacer).
6. Ningún rincón imposible de limpiar: cada esquina con escondite se ve desde una puerta o una
   ventana, o se puede granadear desde fuera.
7. Paridad: el defensor rota por dentro (más corto) y el atacante llega por fuera (más largo pero
   con más opciones). Se mide con `scripts/balance.mjs` y se corrige con geometría, puestos de la IA,
   barricadas y entradas de la IA, nunca con las clases.

## 4. Los mapas

### 4.1 Operación Almacén: "Distribuidora Ferrol" (56 × 34 m)

**Historia.** El centro de distribución regional de una paquetería, de noche. El turno se fue a
medias: un camión quedó con la caja abierta en el andén, una carretilla cargando en el pasillo 3,
una estantería del fondo está vaciada para inventario y en el taller hay una carretilla desarmada.

```
 y  x→ 0        10              22                      44          56
 0  ┌─────────┬─ ANDÉN DE CAMIONES (aire libre) ─────────────────────┐
    │ ESTACIO-│  camiones en ángulo   ▒▒caja▒▒      ▒▒caja▒▒          │
 8  │ NAMIENTO├──┬────────┬─────────────────────┬──[portones]──────── │
    │         │  │OFICINAS│  NAVE DE ESTANTERÍAS │   MUELLE (A)       │
    │  (spawn │  │abiertas│  ═══ ═══  ═══ ═══    │  pallets, carretilla│
    │  norte) │  ├────────┤  ═══      ═══ ═══    ├─────────┬─────────┤
    │         │  │RECEPC. │      ▓ carretilla    │EXPEDIC. │         │
    │ (spawn  ▶  │  ↓ pasillo de personal      ═══│(oficina)│ TALLER  │
    │ princip)│  ├────────┤  ═══ ═══    ═══      ├─────────┘  (B)    │
    │         │  │COMEDOR │  ═══ ═══    ═══ (vacía)  cargadores  ▒▒▒ │
 29 │         ├──┴──▲─────┴─────────────────────┴──────────▲─────────┤
    │ (spawn sur)  CALLEJÓN DE SERVICIO (contenedores de basura, coche)│
 34 └──────────────────────────────────────────────────────────────────┘
```

- **Entradas**: *Andén* (puerta de la oficina al andén, norte), *Recepción* (puerta principal, oeste),
  *Callejón* (puerta del comedor, sur). Tres puntos separados más de 12 m.
- **Sitio A: el muelle de carga** (este, norte). Accesos: los portones del andén (desde afuera,
  junto a la caja del camión), el pasillo transversal de la nave (abertura ancha) y la puerta de
  expedición. Cobertura: pallets apilados, la caja del camión, una carretilla.
- **Sitio B: el taller de carretillas** (este, sur). Accesos: el portón del callejón, la puerta de
  la nave y la de expedición. Cobertura: estanterías de repuestos, banco de trabajo, cargadores.
- **Carriles**: andén (exterior, largo, cubierto por camiones), nave (centro: pasillos de
  estanterías, largos en un sentido y cortos en el otro), callejón (exterior, estrecho, con
  contenedores de basura).
- **Callouts**: "el camión", "pasillo 3", "la estantería vacía", "expedición", "los cargadores".
- **Qué premia**: el control de los pasillos de estantería (ángulos largos en el eje este-oeste,
  cortos en el otro), el uso de los dos exteriores para flanquear, y abrir expedición, que conecta
  los dos sitios y es la rotación del defensor.

### 4.2 Operación Hotel: "Hotel Miramar, planta baja" (56 × 34 m)

**Historia.** Planta baja de un hotel de costa de cuatro estrellas: vestíbulo con columnas, bar con
terraza, cocina y el ala de habitaciones con la suite del fondo. Hay un carro de equipaje olvidado
en el vestíbulo, mesas del bar sin recoger y un pedido de servicio a la habitación a medio salir de
la cocina.

```
 x→ 0     7     12                                39         50   56
 y  ┌─────┬─────┬──101──102──103──104──105──106──┬──────────┬────┐
 1  │     │ESC. │  hab   hab   hab   hab   hab hab│  SUITE   │    │
    │CALLE│SERV.│                                 │ (A)      │PATIO│
 8  │     ├──▲──┴═══════ PASILLO DE HABITACIONES ═╡dormit.   │DE  │
    │(spawn)    ┃ascensores   ┌lencería┬office bar┤ salón    │SERV.│
 11 │     │ VESTÍBULO ▌▌     ├────────┴──────────┼─▲room srv─┤    │
    │     ▶ columnas, recep. │       BAR (B)      │  COCINA   ▶   │
    │     │ sofás, equipaje  ◀ arco  mesas, barra ▶ puerta     │    │
    │     │                  │  ventanas  ventanas│ vaivén    │    │
 27 │     ├──────▲───────────┴───────▲────────────┴───────────┘    │
    │  TERRAZA: hamacas, maceteros, mesas, barra exterior  (spawn)  │
 34 └───────────────────────────────────────────────────────────────┘
```

- **Entradas**: *Vestíbulo* (puerta principal, oeste), *Servicio* (escalera de servicio, noroeste:
  entra directo al pasillo de habitaciones), *Terraza* (puerta del jardín, sur).
- **Sitio A: la suite** (noreste). Accesos: la doble puerta al final del pasillo, la puerta que la
  comunica con la 106, y la puerta de servicio a la habitación desde la cocina. Dentro, recibidor,
  salón con sofá y dormitorio tras un tabique: rincones a corta distancia.
- **Sitio B: el bar** (centro sur). Accesos: el arco del vestíbulo, la puerta vaivén de la cocina, la
  puerta de la terraza y la del office; ventanas a la terraza a los dos lados. Cobertura baja
  (barra, mesas, sofás) y una columna.
- **Carriles**: el pasillo de habitaciones (norte: puertas a los lados, cobertura de carros), el
  vestíbulo (centro: abierto, columnas), la terraza (sur: exterior, maceteros y hamacas, vista por
  las ventanas del bar).
- **Callouts**: "las columnas", "recepción", "ascensores", "la 106", "room service", "la barra",
  "las ventanas", "el vaivén".
- **Qué premia**: abrir puertas con información (el ala de habitaciones sigue siendo de puertas),
  controlar ventanas desde los dos lados, y la rotación por la cocina, que conecta los dos sitios
  por dentro.

### 4.3 Operación Puerto: "Terminal 3" (60 × 38 m)

**Historia.** Una terminal de contenedores en plena operación nocturna: un barco atracado, una
grúa pórtico (sus patas sobre los rieles del muelle), un reach stacker parado con un contenedor a
medio apilar, una zona de desconsolidación con un contenedor abierto y su carga en el suelo, una fila
de reefers enchufados junto a la cámara de frío y un contenedor golpeado apartado para inspección.

```
 x→ 0      12                                                   60
 y  ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈ AGUA ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈
 2  │EXPLA-│ MUELLE  ▌grúa▐  bolardos  ▌grúa▐     amarras        │
 7  │NADA  ├─┐ ▒▒ ▒▓▓▒   ▓▓     ▒  ▒▓▓▒      ▓▓▒  reefers  (A)   │
    │(spawn│ │  ▒▓▓  ▒   desconsol.  ▓▓   reach   ▒▒   ▒   ▓▓     │
    │ mue- │ │ ▓▓  ▒▒▒  abierto→ cajas ▒▓   stacker   ▒  ▓▓      │
    │ lle) │ │   ▒▓▓   ▓▓   ▒▒       golpeado        ▓▓▒  ▒      │
 22 │ (spawn ▶═══════ CARRIL DE CAMIONES ═════════════════════════│
 25 │ portón)├──────────┬───────────────┬──────────────────────────┤
    │       ▶ ADUANA    │ ALMACÉN DE    │  BODEGA FRIGORÍFICA       │
    │(spawn │ inspecc.  │ CONSOLIDACIÓN │   ┌── CÁMARA (B) ──┐      │
    │aduana)│ oficina   │  pallets       │   │ racks  -22 °C  │     │
 37 └───────┴──────────┴───────────────┴───┴────────────────┴─────┘
```

(▒ contenedor de una altura, ▓▓ pila de dos alturas)

- **Entradas**: *Muelle* (reja del muelle, noroeste), *Portón* (portón de camiones, oeste), *Aduana*
  (puerta de la aduana, suroeste).
- **Sitio A: el patio de reefers** (este del patio). Abierto, sin puertas. Accesos: el muelle, el
  pasillo entre pilas que viene del reach stacker y el carril de camiones. Cobertura: reefers de una
  altura (se ve por encima de nada: altos) y pilas de dos; un generador y cajas.
- **Sitio B: la cámara de frío** (sureste, dentro de la bodega). Accesos: la puerta pesada oeste
  (desde la bodega), la norte (desde el andén interior) y una puerta de servicio desde el cuarto de
  máquinas. A la bodega se llega desde el carril (andén), desde el almacén de consolidación y por
  el pasillo de máquinas.
- **Carriles**: el muelle (norte, entre bolardos, amarras y patas de grúa: ya no es un pasillo
  vacío), el patio (centro: pasillos que cambian de ancho, pilas giradas, huecos), el carril de
  camiones y los edificios del sur.
- **Callouts**: "la grúa", "el reach", "el abierto", "el golpeado", "reefers", "consolidación",
  "máquinas".
- **Qué premia**: leer líneas de vista largas que se cortan (el patio ya no es una cuadrícula),
  cruzar descubierto con humo o escudo, y en B, abrir la bodega por el lado que el defensor no mira.

## 5. Datos que cambian por mapa

`size`, `walls`, `doors`, `windows`, `openings`, `props`, `floors`, `rooms`, `zones`, `sites`,
`entries`, `defaultEntry`, `deployment`, `paint`, `defense` (4 puestos por sitio, los 3 primeros
jugados), `aiBarricades`, `aiEntries`, `aiTraps`, `cameraMounts` (7), `aiCameras`, `traits`,
`siteNames`, `siteTraits`, `camera` (`start`, `height`, `frame`, `defendFrame`). Nombres de salas,
puertas y entradas nuevas en `src/ui/texts.js`; adornos del suelo en `src/render/decor/mapDecor.js`.

## 6. Resultado medido

IA contra IA con las escuadras que sortea el lobby (`Lobby.aiRoles`), semillas 1-1600 por mapa
(`scripts/balance.mjs` y `bal.mjs`), victorias del atacante:

| Mapa | Sitio A | Sitio B | Total |
| --- | --- | --- | --- |
| Almacén | 51,1 % (410/802) | 53,8 % (429/798) | 52,4 % |
| Hotel | 47,5 % (381/802) | 52,5 % (419/798) | 50,0 % |
| Puerto | 48,8 % (391/802) | 48,1 % (384/798) | 48,4 % |

Ajustes del cierre (sin tocar clases ni geometría que cambie rutas):

- **Puerto A** (estaba en 56 %): el merodeador del fondo de los reefers lleva rifle y se queda en
  la fila de atrás (no persigue ruidos ni rota), así cubre el muelle y el pasillo del reach.
- **Puerto B** (41-48 % según la muestra): la IA atacante reparte por igual sus entradas a B
  (aduana, portón y muelle); antes elegía la aduana el doble, la ruta que peor le va (16 %).
- **Hotel B** (estaba en 56 %): el ancla de la barra mira el arco del vestíbulo de frente (165°),
  el merodeador de la cocina lleva rifle y la IA atacante entra por el vestíbulo 4 de cada 5 veces.
- **Visual**: la pila del noreste del Puerto bajó a un contenedor de una altura (a 1 m de la
  valla, la de dos alturas se dibujaba fuera del mapa en perspectiva); el rótulo DESPLIEGUE del
  Puerto y del Hotel se movió para no quedar bajo un vehículo.
- **Ficha**: todos los rasgos tienen 45 caracteres o menos (una prueba lo exige), para que los tres
  quepan en el celular horizontal también al tocar un sitio.

La prueba de mapas (`tests/maps.test.mjs`) usa ahora las escuadras sorteadas de la IA, como una
partida real: con la escuadra por defecto el atacante del Puerto ganaba ~20 %, que no es la
escuadra contra la que se juega.

### Pasada del 1 de noviembre (después del realismo)

Con supresión, heridas, espejo y noche, el sitio A del Puerto había bajado a 44/41 % (dos tandas de
800). Se probaron, solo en ese sitio, una trampa o una cámara menos, sin barricada, puestos más
adelantados o más atrás y otras entradas de la IA atacante: los puestos y la utilidad no lo
movían; las entradas sí. **La IA atacante entra a A por el portón el doble que por el muelle** (antes
muelle 3, portón 1, aduana 1). Resultado (800 rondas × 2 tandas, % atacante):

| Mapa | Total | Sitio A | Sitio B |
| --- | --- | --- | --- |
| Puerto | 50 / 49 | 48 / 49 | 52 / 50 |

El sitio B del Almacén (55/51 en las dos tandas completas; 53/48 solo en ese sitio) queda dentro de
la meta y no se tocó.
