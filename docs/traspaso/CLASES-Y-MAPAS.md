# Clases y mapas

Estado al 29 oct 2026 (rama `claude/equilibrio-clases`). Los números viven en
`src/config/operators.js` (clases, composiciones) y `src/config/balance.js`; esto es el resumen
para quien retome el trabajo. Las composiciones arquetípicas y sus planes, en
`docs/diseno/composiciones.md`.

## Clases

| Clase | Bando | Arma | Equipo | Lo que la hace distinta | La contrarresta |
| --- | --- | --- | --- | --- | --- |
| Asaltante | atacante (varios) | rifle | flash, granada | Reacción ×0,5 justo después de cruzar una puerta: gana el duelo del umbral | Escopetero de cerca; Ancla con parapeto |
| Brecha | atacante (uno) | subfusil | flash, 2 cargas | Planta en la mitad de tiempo, rompe barricadas antes, corta el alambre; su carga inmoviliza 2,5 veces más y su **conmoción** aturde a quien espera en la sala (hasta 6,6 m) | Trampero (cepos antes de la puerta); Merodeador por la espalda |
| Explorador | atacante (uno) | rifle | flash, humo | **Cámara de fibra** (la fila entra apuntando a lo que vio), ruidos exactos, **oído**: se gira hacia el que camina a menos de 5 m aunque pise suave; ve trampas de lejos | Vigía (lo ve antes); Tirador en línea larga |
| Escudo | atacante (uno) | pistola | flash | Escudo balístico de 60° al frente (15 % se filtra a brazos y piernas); cada bala lo **sacude** (una ráfaga lo clava, el tiro lento no). Lento | Fuego cruzado y flanco; Escopetero; flash |
| Tirador | atacante (uno) | fusil de tirador | humo | Reacción ×0,55 quieto sosteniendo; dos tiros al torso matan siempre. La IA lo deja a ~7 m del sitio solo si desde ahí lo ve | Mapas de puertas (Hotel); humo; Merodeador |
| Granadero | atacante (uno) | subfusil | 2 de gas, flash | Lanza el doble de lejos. **Gas**: 3 m de vista, apuntan ×3 peor, reaccionan ×2,1 más lento, tosen | Ancla con parapeto fuera del gas; Trampero |
| Escopetero | defensor (hasta 2) | escopeta | flash, granada | A menos de 5 m tumba de un tiro y reacciona ×0,72 | Flash, gas, Escudo; cualquier línea de más de 10 m |
| Ancla | defensor (hasta 2) | rifle | granada | 120 de vida, reacción ×0,9 y parapeto en su puesto | **Brecha** (conmoción); gas |
| Merodeador | defensor (uno) | subfusil con supresor | flash | Rápido, reacción ×0,93, pasos casi mudos, tiros que no delatan dónde | **Explorador** (lo oye) |
| Trampero | defensor (uno) | rifle | 2 cepos, humo, +1 alambre | Cepos de 0,6 s y 5 de daño que **delatan** al que cae; un alambre más | Explorador (los ve a 5,5 m × 1,6), sigilo, dron, granada |
| Vigía | defensor (uno) | rifle | flash, +1 cámara | Monitor: las cámaras detectan al instante y revelan a todos | **Granadero** (gas); humo sobre las cámaras |
| Tirador | defensor (uno) | francotirador | flash | Reacción ×0,55 quieto; un impacto al torso tumba a cualquiera de 100 de vida. La IA lo pone en el puesto de línea más larga | **Escudo** (no lo sacude); humo |

## Mapas

- **Almacén** (equilibrado): líneas cortas en los dos sitios. Rinden el Explorador, el Escudo y
  el Tirador atacante; sufre el Tirador defensor.
- **Hotel** (puertas): pasillo de 23 m y suites de dos puertas. Rinden Trampero, Escopetero y
  Ancla; en ataque, Brecha y Explorador. El Asalto rápido (sin Brecha ni Explorador) pierde.
- **Puerto** (abierto): patio de contenedores sin puertas (A) y cámara de frío (B). El más
  parejo: rinden el Granadero y la utilidad; la Emboscada sufre.

## Tabla de equilibrio

`node scripts/balance-clases.mjs 600 warehouse,hotel,port ciegas`: 600 rondas IA contra IA por
mapa, cada IA elige una de las 5 composiciones de su bando a ciegas (como en una partida).
Porcentaje de rondas que gana **el bando de la clase**; entre paréntesis, rondas con esa clase.
Con ~120-480 rondas por casilla, el ruido es de ±4 a ±9 puntos. "Antes" es `main` (54c3f42).

| Clase | Almacén antes | Almacén ahora | Hotel antes | Hotel ahora | Puerto antes | Puerto ahora |
| --- | --- | --- | --- | --- | --- | --- |
| **Atacantes (bando)** | 53,5 | **54,3** | 47,7 | **46,2** | 50,5 | **50,3** |
| A: Asaltante | 49 (352) | 56 (483) | 44 (352) | 45 (483) | 47 (352) | 49 (483) |
| A: Brecha | 54 (600) | 56 (370) | 48 (600) | 51 (370) | 51 (600) | 52 (370) |
| A: Granadero | 50 (230) | 43 (228) | 35 (230) | 43 (228) | 53 (230) | 54 (228) |
| A: Tirador | 42 (117) | 63 (119) | 50 (117) | 41 (119) | 45 (117) | 46 (119) |
| A: Explorador | 62 (253) | 56 (246) | 58 (253) | 50 (246) | 51 (253) | 52 (246) |
| A: Escudo | 60 (248) | 59 (243) | 53 (248) | 47 (243) | 55 (248) | 49 (243) |
| D: Ancla | 49 (503) | 46 (464) | 53 (503) | 55 (464) | 51 (503) | 51 (464) |
| D: Vigía | 49 (359) | 44 (398) | 57 (359) | 51 (398) | 49 (359) | 48 (398) |
| D: Merodeador | 42 (374) | 43 (233) | 51 (374) | 48 (233) | 45 (374) | 46 (233) |
| D: Escopetero | 39 (202) | 48 (241) | 49 (202) | 61 (241) | 50 (202) | 52 (241) |
| D: Tirador | 41 (136) | 36 (238) | 43 (136) | 45 (238) | 44 (136) | 47 (238) |
| D: Trampero | 54 (226) | 57 (226) | 54 (226) | 65 (226) | 58 (226) | 55 (226) |

Antes, las composiciones de la IA eran otras (5 por bando sin plan propio y sin Tirador
defensor fuera de una), por eso cambian las muestras.

**Lectura.** Los tres mapas quedan dentro de 45-55 % por bando. De 36 casillas, 26 quedan
dentro de 44-56 % (Asaltante y Explorador del Almacén, en 56,1); fuera: en el Almacén, Tirador atacante (63), Escudo (59), Trampero (57),
Granadero (43), Merodeador (43) y Tirador defensor (36); en el Hotel, Trampero (65),
Escopetero (61), Granadero (43) y Tirador atacante (41). Casi todos son efectos de mapa
(líneas largas o cortas, puertas) más que de la clase: en el Puerto las doce están entre 46
y 54, y la misma clase cambia de signo de un mapa a otro (el Tirador atacante: 63 en el
Almacén, 41 en el Hotel).

**Composiciones extremas** (≈110-140 rondas cada una): Fortaleza en el Hotel 74 %, Línea larga
en el Almacén 31 %, Asalto rápido en el Hotel 34 %. Ningún par atacante-defensor pasa de 75 %
con más de 40 rondas.

**Muestra sin composiciones** (`azar`: tríos al azar, 600 rondas por mapa): ninguna clase se
aparta más de 7 puntos del promedio de su bando en el mapa; los mapas sí se apartan (Hotel 40 %,
Puerto 59 % de victorias atacantes), señal de que lo que más pesa es el mapa con la IA
jugando escuadras sin plan.

## Pendiente

- Tirador defensor en el Almacén y Fortaleza en el Hotel: ajustar por puestos del mapa
  (lo lleva el trabajo de mapas) antes que por números de clase.
- Hotel y Puerto con tríos al azar (40 % y 59 %): mirar los puestos de los sitios A.
