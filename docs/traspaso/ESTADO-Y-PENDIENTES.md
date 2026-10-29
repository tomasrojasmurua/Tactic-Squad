# Estado actual y pendientes de Tactic Squad

Al 29 de octubre de 2026.

## 1. Dónde está todo

| Qué | Dónde |
| --- | --- |
| Código | github.com/tomasrojasmurua/Tactic-Squad, rama `main` (último merge: PR #40, Operación Puerto) |
| Juego en línea | https://tomasrojasmurua.github.io/Tactic-Squad/ (se publica solo en cada push a `main` si pasan las pruebas, `.github/workflows/pages.yml`) |
| Juego en un archivo | `npm run build` → `dist/tactic-squad.html` (~690 KB, funciona abriéndolo directo en el navegador o el celular) |
| Qué es el juego | `RESUMEN-DEL-JUEGO.md` |
| Cómo está hecho | `ARCHITECTURE.md` |
| Cómo correrlo | `README.md` (`npm start` sirve en http://localhost:8080; `npm test`; `npm run build`) |
| Decisiones | `docs/traspaso/DECISIONES-DE-DISENO.md` |
| Clases y mapas | `docs/traspaso/CLASES-Y-MAPAS.md` |

## 2. Qué hay en `main`

- **Ronda completa contra la IA, jugando de atacante o de defensor**, en escritorio y celular
  horizontal: compra → preparación → dron (15 s) → asalto We-Go (planificación sin límite y
  ejecución de 5 s; bomba de 90 s que solo corre al ejecutar) → fin con repetición de la
  última baja y el "por qué".
- **Partida** de una ronda o al mejor de 3, 5 o 7, con cambio de bando a la mitad, marcador
  y +1 punto de utilidad al que perdió. Sin dinero.
- **Menú:** JUGAR → CONTRA LA IA (MULTIJUGADOR aparece como próximamente) → lobby (formato,
  bando inicial, mapa o al azar, con ficha del mapa dibujada por el motor y lista de mapas
  con scroll) → roster de clases → partida. **Tutorial** de 5 lecciones.
- **Controles del atacante:** rutas con pathfinding y editables, ruta de escuadra en fila,
  rueda de 6 entradas por puerta (más "Cámara" para el Explorador), GO por colores, paso
  sigiloso, lanzar a un punto o desde el costado de la puerta, puerta compartida, cubrir
  zona, asomarse y volver.
- **Defensor:** Compra, Reconocimiento (sitio, 2 barricadas, alambre, 2 cámaras fijas) y
  Preparación (colocar y vigilancia); vigilancia cambiable cada turno; cámaras que avisan;
  incendiaria; sus operadores no se mueven solos.
- **12 clases** (6 por bando), **3 mapas** (Almacén, Hotel, Puerto), ventanas, humo, gas,
  fuego, alambre, cepos, parapetos, escudo.
- **Dos IA**: atacante (comandante que da las mismas órdenes que un jugador) y defensora
  (vigilancia, alertas, rotación hacia la bomba, utilidad), las dos con escuadras a ciegas.
- **180 pruebas** pasan (`npm test`). Equilibrio IA contra IA dentro de la meta en los tres
  mapas (51 %, 52 %, 54 % para el atacante).
- Simulación determinista por semilla, fases dentro de la simulación, `teamView` como
  filtro de visión por bando (usado en parte).

## 3. Pull requests

**Abierto:**

- **#41 Mapa nuevo: Operación Embajada** (rama `claude/project-thread-giorkj`). Residencia con
  patio central y galería en anillo; A en el despacho, B en el comedor; entradas por garaje,
  portada y cocina. Muebles y pisos nuevos. 184 pruebas pasan, 46 % para el atacante en 400
  rondas. **Espera la revisión de Tomás.** Toca `README.md` y `RESUMEN-DEL-JUEGO.md`, así que
  puede chocar con el PR de este traspaso: el que se fusione segundo tiene que resolver el
  conflicto (es solo texto). Hay un HTML para probarlo: `mapas/tactic-squad-embajada.html` en
  los archivos del proyecto.

**Ya fusionados que a veces aparecen como pendientes en conversaciones viejas:**

- **#14 IA defensora que rota**: fusionado el 28 oct, junto con "tus defensores no se mueven
  solos".
- **El molotov**: no se hizo como PR propio; lo cubre la **incendiaria** del defensor (#26).

No hay otros PR abiertos. Los PR #2 a #40 están fusionados (ver la tabla de la sección 11 de
`ARCHITECTURE.md`).

## 4. Pendientes y próximos pasos

En el orden sugerido:

1. **Revisar y fusionar el PR #41** (Embajada).
2. **Ajustar clases desbalanceadas:** el Tirador defensor es el más flojo (el atacante gana
   56-62 % cuando está); el Explorador es fuerte en Almacén y Hotel (64-65 %); el Granadero
   varía mucho entre mapas. Medir con más rondas antes de tocar.
3. **Sonido propio de la incendiaria** (hoy suena como el humo).
4. **Refuerzos que faltan del diseño:** puerta trabada y sensor.
5. **Contras entre clases** que faltan cerrar (Escudo > Tirador, Granadero > Vigía).
6. **5 contra 5** (máximo 2 repeticiones de clase): más puestos de defensa en cada mapa y
   ajustar las IA.
7. **Niveles de dificultad de la IA.**
8. **Equilibrio en partidas reales** (con personas), no solo IA contra IA.
9. **Camino al online:**
   - que el render, la UI y el audio lean solo `teamView` (hoy leen la simulación entera);
     es lo que bloquea el multijugador;
   - plazos de fase en el servidor (`PhaseClock`; el diseño pide compra 20 s, preparación
     45-60 s, planificación 15 s);
   - servidor con lockstep de órdenes (`PlanRecorder` ya produce los paquetes de turno);
   - menú MULTIJUGADOR y elección de mapa entre jugadores.
10. **Limpieza:** borrar la carpeta suelta `undefined/` de la raíz; los comentarios que
    mencionan `docs/BRIEF.md` y `tests/sim-plans.mjs` (no existen).

**No proponer:** paredes destructibles o blandas, pausa al contacto, economía con dinero,
reintentar rondas (ver `DECISIONES-DE-DISENO.md`).
