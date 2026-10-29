# Clases y mapas de Tactic Squad

Al 29 de octubre de 2026 (rama `main`, más el PR #41 abierto). Los datos salen de
`src/config/operators.js` y `src/data/maps/`. Los porcentajes son de
`node scripts/balance.mjs 200 ciegas <mapa>` (IA contra IA, cada IA elige su escuadra a
ciegas; % de rondas que gana el atacante).

---

## 1. Cómo se eligen

- Antes de la partida, en un **roster** (pick phase): cada bando ve su grupo de personajes,
  cada uno con símbolo y color, toca uno para ver su ficha (arma con barras de daño,
  cadencia y precisión; equipo; características) y suma 3 a su escuadra.
- **A ciegas:** ningún bando ve las clases del otro. La IA elige entre combinaciones con
  sentido (`AI_SQUADS`), según la semilla.
- **Duran toda la partida.** En una partida al mejor de N hay una pestaña para cuando atacas
  y otra para cuando defiendes.
- Límites: en los atacantes, todas menos el Asaltante son únicas por escuadra; en los
  defensores, Escopetero y Ancla hasta 2, el resto 1.
- **Kit gratis cada ronda** + 2 puntos de utilidad por operador (+1 al bando que perdió la
  ronda anterior). Precios: flash, granada, humo y carga 1 punto; incendiaria 2. Máximos
  por operador: flash 2, granada 1, humo 1, carga 2, incendiaria 1.

## 2. Atacantes

| Clase | Arma | Kit | Firma |
| --- | --- | --- | --- |
| **Asaltante** | rifle | flash, granada | El primero en cruzar: reacciona un 40 % más rápido justo después de pasar una puerta. Se puede repetir |
| **Brecha** | subfusil | flash, 2 cargas | Prepara la carga en la mitad de tiempo, rompe barricadas antes, su carga aturde 2,5 veces más al que espera detrás y **corta el alambre con alicate en silencio** |
| **Explorador** | rifle | flash, humo | **Cámara de fibra óptica**: la pasa bajo una puerta cerrada y ve la sala sin abrir (entrada "Cámara"). Oído fino: los ruidos le llegan en el punto exacto. Ve las trampas de más lejos. 8 % más rápido |
| **Escudo** | pistola | flash | Escudo balístico al frente: para las balas que vienen de adelante y cubre al que va pegado detrás. Más lento, gira y apunta peor, golpea más fuerte. Si lo ciegan o aturden, lo baja |
| **Tirador** | fusil de tirador | humo | Quieto cubriendo una zona, reacciona un 45 % más rápido. Gira despacio, anda más lento, malo de cerca |
| **Granadero** | subfusil | 2 de gas, humo | Lanzagranadas de 40 mm, tira el doble de lejos. **Gas lacrimógeno**: los enemigos adentro ven a 4 m, reaccionan más lento, apuntan peor y tosen (se los oye) |

## 3. Defensores

| Clase | Arma | Kit | Firma |
| --- | --- | --- | --- |
| **Escopetero** (hasta 2) | escopeta | flash, granada | Espera pegado a la puerta: a menos de 5 m tumba de un tiro y a menos de 4 m reacciona un 30 % más rápido. Lejos pierde |
| **Ancla** (hasta 2) | rifle | granada | 120 de vida, reacción un 15 % más rápida y **parapeto** de metal a la altura del pecho frente a su puesto |
| **Merodeador** | subfusil con supresor | flash | Caza fuera del sitio: 12 % más rápido, pasos a un tercio de distancia, sus tiros se oyen pero no de dónde |
| **Trampero** | rifle | 2 cepos, humo | Cepos en la preparación (atrapan 2 s, 15 de daño, ruido y delación) y **un alambre más** para el equipo |
| **Vigía** | rifle | flash | **Una cámara más** y la vigilancia "Monitor": las cámaras detectan al instante y revelan todo lo que ven, pero él no cuida su ángulo |
| **Tirador** | fusil de precisión | flash | Sostiene una línea larga con reacción mucho más rápida; fuera de ese ángulo, lento |

El **Defensor** genérico (rifle y flash) existe solo para el tutorial.

**Utilidad del defensor:** flash, granada, humo e **incendiaria** (solo defensor). Además, en
el Reconocimiento: 2 barricadas, 1 alambre de púas y 2 cámaras en los soportes del mapa.

## 4. Contras entre clases (hoy)

Brecha contra barricadas, alambre y Anclas; cámara de fibra contra Anclas y trampas; gas
contra parapetos y salas cerradas; flash contra Escudo, Merodeador y trampas; humo contra
cámaras, Tiradores y Anclas. Las contras del diseño original (Brecha > Ancla, Explorador >
Merodeador, Escudo > Tirador, Granadero > Vigía) están cubiertas solo en parte.

## 5. Equilibrio por clase (29 oct, 200 rondas por mapa)

| Clase | Almacén | Hotel | Puerto | Lectura |
| --- | --- | --- | --- | --- |
| Explorador (A) | 64 % | 65 % | 51 % | Fuerte en mapas de puertas |
| Granadero (A) | 46 % | 39 % | 61 % | Flojo en el Hotel, fuerte en el Puerto |
| Escopetero (D) | 58 % | 54 % | 51 % | Algo flojo en el Almacén |
| Tirador (D) | 59 % | 62 % | 56 % | El más flojo de los defensores: revisar |

Un número alto significa que con esa clase en la escuadra el atacante gana más.
Las muestras por clase son chicas (34 a 75 operadores), así que son tendencias, no veredictos.

---

## 6. Mapas

Todos miden 40 × 28 m y tienen sitios A y B, 3 entradas para el atacante (ocultas al
defensor), 4 puestos de defensa por sitio (se usan 3), 7 soportes de cámara, ficha con
plano y tres rasgos, y su propia IA (puestos, barricadas, cámaras y trampas por sitio).

| Mapa | Carácter | Sitio A | Sitio B | Entradas | Atacante gana |
| --- | --- | --- | --- | --- | --- |
| **Operación Almacén** | El equilibrado. Patio de salida, oficina y cocina al norte, pasillo central de 18 m, ventanas de la oficina y el baño al patio | Nave amplia con cajas y estanterías; tres accesos (pasillo, sala, arco de la cocina) | Sala con sofás (cobertura baja); tres puertas (pasillo, baño, nave) | norte, principal, sur | 51 % (A 52, B 50) |
| **Operación Hotel** | Puertas. Pasillo recto de 23 m casi sin cobertura, habitaciones con baño comunicadas por puertas, sin ventanas | La suite: solo dos puertas (la del pasillo tras un recibidor y la que la comunica con la 705) | La lavandería: sin puerta al pasillo, se llega por el oficio o por la 707; secadoras y estanterías tapan la vista | incendios, vestíbulo, servicio | 52 % (A 49, B 53) |
| **Operación Puerto** | Abierto. Terminal de contenedores con medio mapa al aire libre; carriles largos (el muelle mide 31 m) | Patio de contenedores sin puertas; se cruza al descubierto | Cámara de frío tras dos puertas pesadas, dentro de la bodega (andén, puerta del frente o aduana) | muelle, portón, aduana | 54 % (A 56, B 52) |
| **Operación Embajada** (PR #41) | Circuito y ventanas. Residencia con patio central y galería en anillo | El despacho, pegado al patio, con ventanas a la galería | El comedor, abierto a la galería, con puertas a la cocina y al salón | garaje, portada, cocina | 46 % (A 47, B 45) en el PR |

Qué premia cada uno, según la propuesta aprobada: Hotel premia a Brecha, Explorador y
Escudo contra el Ancla; Puerto, a los Tiradores y al Escudo en el patio y a Ancla, Trampero,
Brecha y Granadero en la cámara de frío; Embajada, al Vigía y al Merodeador.

### Agregar un mapa

1. Un archivo de datos en `src/data/maps/` (paredes, puertas, ventanas, muebles, pisos,
   zonas, `sites`, `entries`, `deployment`, `defense`, `aiBarricades`, `aiEntries`,
   `cameraMounts`, `aiCameras`, `aiTraps`, `traits`, `siteTraits`) y una línea en
   `maps/index.js`.
2. Muebles y pisos nuevos en `src/data/props.js` y `src/render/decor/` si hacen falta.
3. Textos en español (lugares, puertas, entradas).
4. `tests/maps.test.mjs` y equilibrio con `node scripts/balance.mjs 400 ciegas <mapa>`
   hasta quedar en 45-55 % por sitio.
5. Capturas en celular y la ficha del lobby.
