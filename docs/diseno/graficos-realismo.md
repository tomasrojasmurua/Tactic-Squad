# Gráficos: hacia un táctico cenital realista

Auditoría del render de Tactic Squad y propuesta para llevarlo a un nivel de realismo alto sin perder
legibilidad táctica ni rendimiento en iPhone horizontal. Fase 1: diagnóstico, comparación de caminos y
prueba de concepto. **No cambia todavía el render del juego.**

- Capturas del juego actual: `docs/diseno/graficos-capturas/antes/` (selección comprimida; el juego
  completo, 70 capturas en PNG a 844×390 DPR 3 y 1440×900, se entregó aparte).
- Prototipo: `prototipos/iluminacion-almacen.html` (un archivo, sin dependencias, 52 KB). Capturas en
  `docs/diseno/graficos-capturas/prototipo/`. Parámetros: `?t=6.3` congela el instante,
  `?modo=antes` muestra la aproximación del render actual, `?escala=1` fija la resolución, `?limpio`
  oculta los controles. Los botones prenden y apagan cada técnica para ver cuánto aporta cada una.

> Nota sobre las capturas: se tomaron con Chromium sin GPU (SwiftShader). Sirven para ver la imagen,
> no los fps: el contador del prototipo marca 12-20 fps ahí porque todo corre en CPU.

---

## 1. Cómo dibuja hoy el juego

`src/render/` es un render WebGL2 propio, bien ordenado y ya pensado para móvil:

| Pieza | Qué hace | Costo |
| --- | --- | --- |
| `FloorLayer` + `shaders/floor.js` | Suelo procedural (damero, baldosa, madera, alfombra, hormigón, asfalto, agua, alfombras) horneado **una vez por mapa** a una textura en espacio de mapa, multiplicado por `textures/shadowMap.js` | Barato por cuadro: una muestra de textura + luces |
| `textures/shadowMap.js` | Canvas2D: R = sombra **desplazada** de paredes/muebles en una sola dirección fija, G = AO al pie de paredes (blur), B = "charcos" de lámparas de techo en grilla | Una vez por mapa |
| `StaticLayer` + `shaders/lit.js` | Paredes y muebles en una malla, un draw call. Color plano por vértice, luz direccional Lambert (`ambient 0.6 + diffuse 0.5`), contorno negro procedural por arista, gradiente de altura | Barato |
| `UnitLayer` + `geometry/character.js` | Soldados de cajas rígidas (9-12 piezas), poses mezcladas (caminar, apuntar, recargar, caer) | Barato |
| `LIGHTS` (common.js) | Hasta 8 luces puntuales efímeras (fogonazos, bomba). **Sin sombras**: atraviesan paredes | Bucle por fragmento |
| `VisionLayer` | Abanicos de visión de los atacantes en una textura de mapa (12 px/m), difuminados, + memoria de explorado | Se salta si nada cambió |
| `shaders/common.js FOG` | Niebla negra en ejecución; en planificación, plano azul ("blueprint") con barrido circular | Por fragmento |
| `fx/` | Partículas (humo, sangre, vainas, fuego aditivo), calcomanías, trazadoras | Hasta 4000 partículas |
| `FramePacer` / `AdaptiveResolution` | Solo dibuja cuando algo cambió (15 fps en reposo); baja la resolución si un cuadro pasa de 25 ms | — |

Puntos fuertes que hay que conservar: separación estricta sim/render (el render solo lee), horneados por
mapa, un draw call para la geometría estática, pacing y resolución adaptativa, recuperación de contexto
perdido, tope de DPR 1,5 en táctil. **Todo lo que propongo encaja en esa arquitectura.**

Costo por cuadro hoy (estimado, iPhone 12-15 a 844×390 × 1,5): ~1,3 Mpx; el suelo es una muestra de
textura + 8 luces; las mallas, Lambert + niebla. Estamos muy por debajo del presupuesto de un iPhone:
hay margen para gastar en luz.

## 2. Diagnóstico: por qué no se siente real

1. **Luz plana y sin dirección física.** Todo está iluminado con `ambient 0.6 + diffuse 0.5`: no hay zonas
   oscuras de verdad ni contraste de luz/sombra. Las paredes y cajas se ven igual de iluminadas en
   cualquier sala (ver `antes/movil-warehouse-defenders-14-gasStart.jpg`: el sitio A es un gris uniforme).
2. **Las sombras no vienen de ninguna luz.** La sombra horneada es un desplazamiento fijo hacia abajo a la
   derecha (`shadowOffset [0.42, 0.55]`) igual para todo el mapa, mientras que la luz "real" son charcos
   de lámpara en grilla. Sombras y lámparas se contradicen; el ojo lo nota aunque no sepa por qué.
3. **Las luces dinámicas atraviesan paredes.** Un fogonazo o el destello de una flashbang ilumina la sala
   de al lado (`LIGHTS` no consulta oclusión). Un flash detrás de una pared que alumbra el pasillo es lo
   más "falso" que puede pasar en un táctico.
4. **Materiales sin respuesta a la luz.** Todo es albedo × luz difusa: el hormigón, el metal de las
   estanterías, la madera y el vidrio reflejan igual. No hay rugosidad, relieve ni brillo especular, así
   que el suelo procedural (que tiene buen detalle) se ve como una pegatina.
5. **Estética de dibujo en vez de foto.** El contorno negro de 2,8 cm en cada arista, los colores
   saturados por vértice (cajas naranjas, sofás azules) y la sangre roja pura (`bloodRed [0.86, 0.02,
   0.03]`, ver `antes/movil-warehouse-defenders-16-death.jpg` y `antes/movil-hotel-defenders-15-death.jpg`)
   empujan hacia caricatura.
6. **Sin cadena de imagen.** Se escribe directo al framebuffer en 8 bits, sin HDR, sin tonemapping, sin
   bloom ni grano: los fogonazos no "queman", el blanco del vestuario del hotel satura plano, y las
   sombras no tienen color (todo negro o gris).
7. **Personajes de cajas sin anclaje.** No tienen sombra propia ni oclusión de contacto (solo un aro
   suave en el overlay), así que parecen flotar. A la escala del celular se leen como juguetes.
8. **Niebla de guerra binaria.** Fuera de la visión todo cae a negro azulado parejo, sin relación con la
   luz de la sala; dentro, todo está igual de claro. La visión y la luz deberían ser el mismo fenómeno.

Lo que sí funciona y no hay que tocar: el plano azul de planificación (`antes/movil-warehouse-attackers-06-planning.jpg`)
es muy legible; la ficha de mapa del lobby y el HUD están bien resueltos; los colores por equipo y los
números de los operadores se leen bien.

## 3. Dirección de arte objetivo

**"Cámara de seguridad de una operación nocturna real."** Referencias:

- **Door Kickers 2**: legibilidad cenital, luz de techo local por sala, sombras suaves, paleta apagada.
- **Ready or Not** (vista táctica / planos): interiores de luz mixta, tungsteno cálido contra fluorescente
  frío, linternas de arma que recortan la oscuridad.
- **Teardown / Shadows of Doubt**: la luz es el material; cada lámpara es una fuente que proyecta sombras,
  los fogonazos iluminan la sala de verdad.
- **SWAT 4 / Rainbow Six (planos)**: arte gráfico de planificación (ya lo tenemos).

Reglas concretas:

- **La luz es geometría de juego.** Cada sala tiene 1-3 fuentes reales (fluorescente, tungsteno, ventana
  de luna/farol) con sombras suaves; los rincones quedan oscuros. La visión de los operadores es la
  linterna del arma: un cono que proyecta sombras de los mismos obstáculos que tapan la vista en la sim.
- **Paleta apagada y física.** Albedos realistas (hormigón 0,2-0,3 de reflectancia, madera, pintura de
  piso gastada). Color solo donde lo pondría el mundo: pintura de seguridad amarilla, estanterías azul y
  naranja, luces. El color de equipo vive en el HUD, los aros y un parche/banda en el uniforme.
- **Sin contornos negros.** La separación de formas la dan la luz, la sombra y el AO.
- **Cadena de cine.** HDR, exposición fija por mapa, tonemapping fílmico (ACES), bloom sutil solo en lo
  que realmente quema (fogonazos, fluorescentes, flash), viñeta suave, grano fino animado.
- **Legibilidad primero.** Aros de operador, rutas, puertas y sitios se dibujan *después* del tonemap o con
  valores calibrados para no perderse; nada táctico depende solo de la iluminación. Un modo "alto
  contraste" puede subir la exposición de las zonas oscuras para el exterior.

## 4. Dos caminos

### A. Evolucionar el render WebGL2 propio

Técnicas (todas validadas en el prototipo salvo donde se indica):

1. **Cadena HDR.** Escena a `RGBA16F` (`EXT_color_buffer_float`, presente en todos los iPhone con WebGL2;
   el prototipo cae a RGBA8 comprimido si falta), bloom a ¼ de resolución (umbral + 2 pasadas de blur
   separable), tonemapping ACES, viñeta, grano, dither. Costo: ~3 pasadas de pantalla completa, la mayoría
   a ¼.
2. **Luces con sombras suaves en espacio de mapa (2,5D).** La clave del salto. El mapa ya es un plano con
   alturas: se hornea un **heightmap de oclusores** (paredes 2,2 m, cajas, estanterías, barriles) y una
   pasada a 10-14 px/m marcha desde cada píxel del mapa hacia cada luz comparando con la altura, con
   penumbra tipo "soft shadow" (mínimo de `k·h/d`). Resultado: una textura con la visibilidad de hasta 8
   luces (2 RGBA). Personajes como cápsulas para que también proyecten sombra. El sombreado de suelo,
   paredes y personajes la muestrea. **Las luces estáticas se hornean una vez por mapa** (cero costo por
   cuadro); solo las dinámicas (linternas, fogonazos, flash, fuego) se recalculan, y solo cuando algo se
   movió (como ya hace `VisionLayer`).
3. **Visión = linterna.** La misma marcha produce la máscara de visión del equipo con penumbra real. La
   simulación sigue siendo la única que decide qué se ve (`sim/vision.js`); el render solo dibuja la
   máscara bonita. *No hay riesgo para el determinismo*: nada de esto vuelve a la sim.
4. **Materiales PBR ligeros.** BRDF GGX + Schlick + Smith (la del prototipo, ~25 líneas GLSL) con albedo,
   rugosidad y metalicidad por material. En el suelo, horneamos **normal + rugosidad + AO** junto al
   albedo (dos RGBA8 por mapa: juntas de hormigón, grietas, charcos de aceite brillantes, pintura gastada).
   En mallas, el material se elige por un id por vértice y el detalle es procedural (vetas de madera,
   tablas de cajas, óxido de barriles, cinta en cajas).
5. **AO de contacto horneada** a partir del heightmap (pie de paredes, debajo de cajas) + AO dinámico
   bajo cada operador (disco suave en el shader del suelo).
6. **Personajes**: proporciones algo más humanas, colores realistas (multicam/negro), sombra propia por la
   luz real, parche de equipo emisivo leve para la legibilidad. Más adelante (etapa 7) animación con más
   articulaciones (codos, rodillas) y skinning simple por GPU — fuera del prototipo.
7. **Partículas iluminadas**: humo que recibe la luz de las fuentes (muestreo de la textura de
   visibilidad), fuego y fogonazos aditivos en HDR para que alimenten el bloom.

**Tamaño**: +15-30 KB minificados sobre los ~690 KB actuales (el prototipo completo pesa 52 KB *sin*
minificar, con escena y UI incluidas).
**Rendimiento**: presupuesto en iPhone 12+ a 844×390 × 1,5 (~1,3 Mpx): escena ~3-5 ms, pasada de
visibilidad 240×130 px × 6-8 luces dinámicas × 24 pasos ~1-2 ms (y solo cuando algo se mueve), post ~1 ms.
Cabe en 16 ms con margen. Escalones de calidad automáticos: pasos de la marcha 32→14, resolución
1,5→0,7, bloom apagable, luces dinámicas con sombra 8→4. El prototipo ya implementa los dos primeros.
**Riesgo**: bajo-medio. El cambio vive entero en `src/render/` y `config/render.js`; no toca la sim.
El mayor riesgo es de calibración (que lo oscuro no esconda información táctica), y se mitiga con la
regla de legibilidad y un control de exposición por mapa.

### B. Migrar a Three.js

Qué se gana:
- `MeshStandardMaterial` (PBR completo), `PointLight`/`SpotLight` con shadow maps, `EffectComposer` con
  bloom/SSAO/tonemapping, carga de modelos GLTF con esqueleto y animación (`AnimationMixer`), y un
  ecosistema y documentación enormes. Si en el futuro se quisieran modelos de personaje hechos en Blender,
  Three.js es la vía directa.

Qué cuesta:
- **Tamaño**: Three.js no se recorta bien: el núcleo minificado ronda 600-700 KB; con `examples/jsm`
  (postproceso, GLTFLoader) +100-200 KB. El HTML único pasaría de ~690 KB a **~1,4-1,6 MB**. Viola la
  regla actual de "cero dependencias en tiempo de ejecución".
- **Rendimiento en móvil**: las sombras de luces puntuales en Three.js son *cube shadow maps* (6 pasadas
  de profundidad por luz). Con 6-8 luces con sombra en un iPhone es inviable a 60 fps; en la práctica se
  limitaría a 1-2 luces con sombra y el resto sin sombra, justo lo contrario de lo que el realismo pide en
  un táctico cenital. SSAO en pantalla completa también es caro. Habría que reescribir a mano la sombra
  2,5D del camino A igual, dentro de Three.js (`onBeforeCompile`), perdiendo buena parte de la ventaja.
- **Reescritura**: las 9 capas, los 6 shaders, la niebla/plano con barrido, `VisionLayer`, el overlay
  inmediato de rutas (845 líneas), partículas, calcomanías, `FramePacer`, resolución adaptativa y
  recuperación de contexto. ~5.800 líneas de `src/render/` a rehacer o adaptar.
- **Determinismo y visión por equipo**: no se rompen (el render sigue siendo de solo lectura), pero el
  filtrado por equipo (`viewer.team`, qué enemigos dibujar, qué recuerda la niebla) hay que volver a
  enchufarlo en el grafo de escena de Three.js, y es la parte con más casos borde (dron, cámaras,
  repetición).
- **Tiempo**: 4-6 semanas de un desarrollador para llegar a *paridad* con lo de hoy, antes de empezar a
  ganar calidad.

### Comparación

| | A. WebGL2 propio | B. Three.js |
| --- | --- | --- |
| Esfuerzo hasta el salto visible | 1-2 semanas (etapas 1-4) | 4-6 semanas solo para paridad |
| Esfuerzo total del plan | 4-6 semanas | 7-10 semanas |
| Riesgo | Bajo-medio, aislado en `render/` | Alto: reescritura total, regresiones en visión, plano, repetición |
| Tamaño del HTML | ~690 → ~720 KB | ~690 → ~1,4-1,6 MB |
| Rendimiento móvil | 60 fps con 8 luces con sombra (2,5D, horneable) | 1-2 luces con sombra a 60 fps; el resto sin sombra |
| Techo de calidad cenital | Alto: luz, sombras suaves, PBR, post | Alto en 3D libre; en cenital, similar a A |
| Personajes animados con huesos | Hay que escribir skinning (≈300 líneas) | Directo con GLTF |
| Regla "cero dependencias" | Se respeta | Se rompe |

### Recomendación

**Camino A.** En una vista cenital fija, el 90 % del realismo lo dan la luz, las sombras suaves y la
cadena HDR, y eso se resuelve *mejor* con la sombra 2,5D en espacio de mapa que con los shadow maps de
Three.js, que en un iPhone no dan para más de una o dos luces con sombra. El render actual ya tiene la
estructura correcta (horneados por mapa, un draw call estático, pacing, resolución adaptativa): se le
agregan pasadas, no se tira. Mantiene el HTML único y liviano, no toca la simulación y cada etapa se ve
en pantalla. Three.js solo ganaría con claridad si el juego pasara a personajes modelados y animados en
Blender o a cámara libre 3D; si eso llega, se puede reevaluar solo para los personajes.

## 5. Plan por etapas (camino A)

Cada etapa es un PR chico, con capturas antes/después en la misma ronda y la prueba de determinismo
intacta (el render no cambia la sim).

1. **Cadena HDR + post.** Render a `RGBA16F` (fallback RGBA8), tonemapping ACES, exposición por mapa en
   `config/render.js`, viñeta, grano, dither. Overlay táctico después del tonemap. *Visible*: imagen con
   rango, negros profundos, fogonazos que queman. ~2 días.
2. **Luces de mapa con sombra horneada.** Los mapas declaran sus lámparas (`lights: [{at, z, color,
   intensity, kind}]` en `src/data/maps/*`, o se generan como hoy por sala si faltan). Heightmap de
   oclusores + horneado de visibilidad de luces estáticas por mapa; reemplaza `shadowOffset` y los
   charcos en grilla. *Visible*: cada sala con su luz y sus sombras coherentes. ~3-4 días.
3. **Materiales del suelo.** Horneado de normal/rugosidad/AO junto al albedo; BRDF GGX en suelo y mallas;
   ids de material en `MeshBuilder`; quitar el contorno negro (o dejarlo solo en el plano azul). *Visible*:
   hormigón con relieve, charcos brillantes, madera y metal distintos. ~3 días.
4. **Luces dinámicas con sombra.** Pasada de visibilidad por cuadro para fogonazos, flash, explosiones,
   fuego y bomba (máx. 8, reaprovechando los datos de `FxDirector`), con personajes como cápsulas. Se
   salta cuando nada se movió. *Visible*: un flash ilumina solo su sala; los fogonazos proyectan las
   sombras de las cajas. ~3 días.
5. **Linternas y niebla unificadas.** Cada operador lleva una linterna con sombras; la máscara de visión
   dibujada sale de la misma marcha (con la lógica de visión de la sim intacta), y la memoria/explorado se
   tiñe según la luz. *Visible*: la escena del prototipo. ~3 días.
6. **Personajes y efectos realistas.** Paleta de uniformes realista, parche/banda emisiva de equipo,
   sangre oscura y absorbida, humo iluminado, chispas y polvo en impactos. ~3-4 días.
7. **Animación articulada** (opcional): codos y rodillas, skinning simple en GPU, transición de muerte
   menos rígida. ~1 semana.
8. **Calidad automática y ajustes.** Escalones (pasos de marcha, resolución, bloom, luces con sombra)
   integrados en `AdaptiveResolution`; modo de alto contraste; medición en iPhone real. ~2 días.

## 6. El prototipo

`prototipos/iluminacion-almacen.html` recrea la nave del sitio A del Almacén con tres atacantes que entran
por el pasillo y un defensor que se asoma, en un bucle de 11 s. Muestra:

- 3 lámparas de techo (cálida, ámbar, fluorescente frío con parpadeo) + luz del pasillo, todas con
  sombras suaves 2,5D de paredes, estanterías, cajas, barriles y personajes.
- Linterna en el arma de cada atacante: un foco con sombras; la zona que no ilumina ninguna linterna con
  línea de vista es la niebla de guerra (la visión y la luz son lo mismo).
- Fogonazos que iluminan la sala de verdad, trazadoras HDR con bloom.
- Suelo de hormigón horneado con normal, rugosidad y AO: juntas, grietas, manchas de aceite y un charco
  que brilla bajo la luz, pintura de seguridad gastada.
- Cajas de madera con tablas, estanterías metálicas, barriles con óxido, BRDF GGX.
- Tonemapping ACES, bloom a ¼, viñeta, grano.
- Botón **Antes (aprox.)**: la misma escena con el modelo de luz del juego actual (direccional plana,
  charcos de lámpara, sombra desplazada, contornos) para comparar en el mismo encuadre.
- Resolución adaptativa y pasos de marcha adaptativos, contador de fps.

Limitaciones honestas: los personajes son cajas, como en el juego; el humo y el fuego no están; la
visión es un cálculo de presentación (en el juego la decide la sim); no se midió en un iPhone real
(ver la decisión pendiente).

## 7. Decisión que tiene que tomar Tomás

1. **Camino**: A (evolucionar el WebGL2 propio, recomendado) o B (migrar a Three.js y aceptar ~1,5 MB y
   una dependencia en tiempo de ejecución).
2. **Dirección de arte**: ¿aceptamos "operación nocturna" (salas oscuras con luz local, contrastes fuertes)
   como identidad, o se prefiere iluminación de día más pareja? Cambia cuánto se juega con la oscuridad.
3. **Prueba en su iPhone**: abrir el prototipo en el teléfono y anotar los fps del contador. Si da 60 a
   resolución 1,5x, el plan sigue como está; si no, se ajustan los escalones de la etapa 8 antes de
   empezar.
