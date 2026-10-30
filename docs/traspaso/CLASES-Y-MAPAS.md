# Clases y mapas

Estado al 30 oct 2026 (`main`, con los PR #43 de clases y #44 de mapas). Los números viven en
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

Tres mapas en el lobby, más grandes que los de antes (40 × 28 m) y apaisados para el celular
horizontal. Diseño completo, planos ASCII y decisiones en `docs/diseno/mapas-v2.md`. El tutorial
sigue en el almacén original (`training`, 40 × 28 m, fuera del lobby).

| Mapa | Tamaño | Concepto | Sitio A | Sitio B |
| --- | --- | --- | --- | --- |
| **Almacén**, "Distribuidora Ferrol" | 56 × 34 m | Centro de distribución de noche, el turno se fue a medias. Carriles: andén de camiones, nave de estanterías, callejón. | Muelle de carga: portón del andén, paso de carga de la nave, expedición. | Taller de carretillas: nave, expedición, portón del callejón. |
| **Hotel**, "Hotel Miramar, planta baja" | 56 × 34 m | Hotel de costa: pasillo de habitaciones de 28 m, vestíbulo con columnas, bar con terraza, cocina. | La suite: puerta del pasillo, la 106 y room service; tabique que deja rincones. | El bar: arco, office, cocina y terraza; ventanas a la terraza. |
| **Puerto**, "Terminal 3" | 60 × 38 m | Terminal de contenedores en turno de noche: grúa, reach stacker a medio apilar, contenedor abierto, pilas de 1-3 alturas giradas y con huecos. | Los reefers, al aire libre: muelle, pasillo del reach, carril. | Cámara de frío: dos puertas pesadas y la de máquinas. |

**Reglas que cumplen los tres.** Tres entradas del atacante separadas más de 12 m (no salen de la
misma pared); cada sitio con tres o más accesos de tipos distintos y cobertura alta y baja;
ninguna pared destructible; 7 soportes de cámara; 4 puestos de defensa por sitio (se juegan los
3 primeros). La ficha del lobby (tres rasgos por mapa y tres por sitio, de 45 caracteres o menos
para que quepan en el celular) **nunca sugiere clases**: leer el mapa es parte del juego. Las
pruebas exigen ambas cosas.

**Callouts.** Almacén: el camión, pasillo 1-4, la estantería vacía, expedición, los cargadores.
Hotel: las columnas, recepción, ascensores, la 106, room service, la barra, las ventanas, el
vaivén. Puerto: la grúa, el reach, el abierto, el golpeado, reefers, consolidación, máquinas.

> **Equilibrio vigente en `main` (30 oct, tras fusionar clases y mapas):** con la IA de
> composiciones nueva los mapas quedaron fuera de la meta. `node scripts/balance.mjs 800 ciegas
> <mapa>`, victorias del atacante: **Almacén 52 % (A 45, B 58)**, **Hotel 40 % (A 33, B 46)**,
> **Puerto 39 % (A 32, B 47)**. Pendiente re-equilibrar con los datos de cada mapa. La tabla
> de abajo es la de la rama de mapas, medida antes de fusionar con las clases nuevas.

**Equilibrio antes de fusionar con las clases nuevas** (IA contra IA con las escuadras que
sortea el lobby, semillas 1-1600 por mapa; victorias del atacante):

| Mapa | Sitio A | Sitio B | Total |
| --- | --- | --- | --- |
| Almacén | 51,1 % (410/802) | 53,8 % (429/798) | 52,4 % |
| Hotel | 47,5 % (381/802) | 52,5 % (419/798) | 50,0 % |
| Puerto | 48,8 % (391/802) | 48,1 % (384/798) | 48,4 % |

Se ajusta con geometría, puestos de la IA (`defense`), barricadas (`aiBarricades`), cámaras
(`aiCameras`) y pesos de entrada de la IA atacante (`aiEntries`), nunca con las clases. Ojo: el
Puerto es sensible; mover una pila 0,8 m llegó a cambiar el sitio A en 13 puntos. Medir siempre
con 800 rondas o más y con dos tandas de semillas distintas.

> La tabla de equilibrio por clase de abajo se midió con los mapas anteriores (40 × 28 m); hay que volver a medirla con los mapas v2.

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
