# Estado actual y pendientes de Tactic Squad

Al 30 de octubre de 2026.

## 1. Dónde está todo

| Qué | Dónde |
| --- | --- |
| Código | github.com/tomasrojasmurua/Tactic-Squad, rama `main` (último merge: PR #44, mapas v2, commit `8e3144a`) |
| Juego en línea | https://tomasrojasmurua.github.io/Tactic-Squad/ (se publica solo en cada push a `main` si pasan las pruebas; `.github/workflows/pages.yml` sirve `index.html` + `src/` sin empaquetar) |
| Juego en un archivo | `npm run build` → `dist/tactic-squad.html` (~700 KB, se abre directo en el navegador o el celular) |
| Qué es el juego | `RESUMEN-DEL-JUEGO.md` |
| Cómo está hecho | `ARCHITECTURE.md` (sección 10, "Hacia el online", es la base del multijugador) |
| Multijugador | `docs/traspaso/MULTIJUGADOR.md` y rama `claude/multijugador` |
| Decisiones | `docs/traspaso/DECISIONES-DE-DISENO.md` |
| Clases y mapas | `docs/traspaso/CLASES-Y-MAPAS.md`, `docs/diseno/composiciones.md`, `docs/diseno/mapas-v2.md` |
| Gráficos | rama `claude/graficos-realismo`: `docs/diseno/graficos-realismo.md` y `prototipos/iluminacion-almacen.html` |

## 2. Qué hay en `main`

Todo lo descrito en `RESUMEN-DEL-JUEGO.md`: ronda completa contra la IA jugando de atacante o
defensor, partida al mejor de 3/5/7 sin dinero, tutorial de 5 lecciones, menú → lobby → roster
de clases. Además, lo fusionado el 29 de octubre:

- **PR #43, equilibrio de clases.** 12 clases rebalanceadas (cepo 0,6 s y 5 de daño, Escopetero
  0,72 de reacción de cerca, Merodeador 0,93, Ancla 0,9, Asaltante 0,5 en el umbral, Granadero
  con flash, oído del Explorador en `src/sim/ears.js`, conmoción de la Brecha, sacudida del
  Escudo). **5 composiciones arquetípicas por bando** (`COMPOSITIONS` en
  `src/config/operators.js`) que las dos IA juegan con un plan propio (brecha dura, pinza,
  utilidad, cobertura larga, asalto rápido; fortaleza, retoma, red de información, emboscada,
  línea larga). Contras del diseño cerradas: Brecha > Ancla, Explorador > Merodeador,
  Escudo > Tirador, Granadero > Vigía. Script `scripts/balance-clases.mjs` mide por clase y
  composición.
- **PR #44, mapas v2.** Almacén "Distribuidora Ferrol" (56 × 34 m), Hotel "Miramar" (56 × 34 m),
  Puerto "Terminal 3" (60 × 38 m, contenedores de 1-3 alturas girados y con huecos, grúa, reach
  stacker). El tutorial y varias pruebas usan el almacén original de 40 × 28 m (`training`, fuera
  del lobby). Rasgos de la ficha de 45 caracteres o menos.
- **213 pruebas** pasan (`node --test "tests/*.test.mjs"`).

## 3. Equilibrio actual (importante)

Los mapas v2 se equilibraron antes de fusionarse con la IA nueva de las clases. Juntos quedaron
fuera de la meta, y se fusionaron igual porque Tomás priorizó el multijugador
(`node scripts/balance.mjs 800 ciegas <mapa>`, % de victorias del atacante):

| Mapa | Total | Sitio A | Sitio B | Clases más desviadas |
| --- | --- | --- | --- | --- |
| Almacén | 52 % | 45 % | **58 %** | Escudo 64 %, Tirador atacante 61 %, Merodeador 59 % |
| Hotel | **40 %** | **33 %** | 46 % | Explorador 29 %, Brecha 33 % |
| Puerto | **39 %** | **32 %** | 47 % | parejo entre clases: el problema es el sitio A |

Se corrige con los datos de cada mapa (`defense`, `aiBarricades`, `aiCameras`, `aiTraps`,
`aiEntries`, y geometría solo si hace falta), no con las clases. El Puerto es frágil: mover una
pila 0,8 m cambió el sitio A en 13 puntos. Medir con ≥800 rondas y dos tandas de semillas.
Herramientas de medición por sitio, entrada y clase: `scripts/balance.mjs`,
`scripts/balance-clases.mjs`.

## 4. Ramas y PR

| Rama / PR | Estado |
| --- | --- |
| `claude/multijugador` | **Activa.** Un commit sobre `main`: `src/core/dmath.js` (sin, cos, atan2, hypot, etc. propios, con solo + − × ÷ y raíz, idénticos en V8 y JavaScriptCore) usado en toda la `src/sim/`. Pruebas en verde y equilibrio idéntico bit a bit antes y después. Lo demás del multijugador está por hacer (ver `MULTIJUGADOR.md`) |
| `claude/graficos-realismo` | Sin PR. Auditoría gráfica, plan en 8 etapas, prototipo de iluminación v2 y 70 capturas del juego actual. No toca el juego |
| PR #41, Operación Embajada (`claude/project-thread-giorkj`) | Abierto, sin revisar. Hecho sobre los mapas de 40 × 28 m antes de los mapas v2: al retomarlo hay que rebasearlo y pasar las pruebas nuevas de mapas (rasgos ≤45 caracteres, entradas separadas, etc.) |
| `claude/equilibrio-clases`, `claude/mapas-personalidad` | Fusionadas (PR #43 y #44). Se pueden borrar |
| `claude/project-thread-*` y otras viejas | Restos de trabajos ya fusionados. Se pueden borrar |

## 5. Pendientes, en orden

1. **Multijugador funcional** (etapas en `MULTIJUGADOR.md`): servidor, sala, invitación por
   WhatsApp, lobby, partida 1v1 por lockstep con reconexión; después 2v2.
2. **Re-equilibrar los mapas v2** con la IA de clases (sección 3).
3. **Gráficos, etapa 1** (HDR, fogonazos que deslumbran, viñeta, grano). Antes:
   - Tomás debe probar el prototipo v2 en el iPhone (en Safari y sin modo bajo consumo) y
     anotar fps en calidad baja, media y alta. El v1 dio 61 fps "antes", 30 fps "después" y se
     veía pixelado; el v2 corrige el pixelado y el escalado adaptativo.
   - Falta decidir el **ambiente**: operación nocturna (salas en penumbra, luz local, como el
     prototipo) o luz de día más pareja.
   - El juego tiene el mismo error de escalado adaptativo que tenía el prototipo (solo sube la
     resolución con cuadros de menos de 13 ms, cosa que a 60 Hz casi nunca pasa): arreglo rápido
     anotado en la etapa 8 del plan.
4. **PR #41 Embajada**: rebasear sobre los mapas v2 y revisar.
5. **Del diseño original que falta**: sonido propio de la incendiaria (hoy suena como el humo),
   puerta trabada y sensor, 5 contra 5, niveles de dificultad de la IA.
6. **Limpieza**: borrar la carpeta suelta `undefined/` de la raíz y las ramas viejas; comentarios
   que mencionan `docs/BRIEF.md` y `tests/sim-plans.mjs` (no existen).

**No proponer:** paredes destructibles o blandas, pausa al contacto, economía con dinero,
reintentar rondas, migrar a Three.js (ver `DECISIONES-DE-DISENO.md`).

## 6. Particularidades del entorno en la nube (cuenta anterior)

Pueden repetirse en la cuenta nueva; conviene saberlas para no perder tiempo:

- **El registro de npm estaba bloqueado** por el proxy (`npm ci` daba 403). Había esbuild
  0.28.2, `ws`, Playwright y Puppeteer preinstalados en `/opt/npm-tools/node_modules`. Las pruebas
  no necesitan dependencias (`node --test`). Si npm funciona, mejor.
- **`gh pr create` fallaba** (GraphQL bloqueado). Los PR se abrían y fusionaban con la API REST:
  `gh api repos/tomasrojasmurua/Tactic-Squad/pulls -f title=… -f head=… -f base=main -f body=…`
  y `gh api -X PUT repos/tomasrojasmurua/Tactic-Squad/pulls/N/merge -f merge_method=merge`.
- **No se podía leer la pestaña Actions** de GitHub (ni los secretos) desde la sesión: el
  resultado de un despliegue lo tiene que mirar Tomás en github.com → Actions.
- **No hay acceso directo a Cloudflare** desde la sesión: el servidor se despliega desde GitHub
  Actions con los secretos.
- El repo se llama `Tactic-Squad` (con mayúsculas); la URL en minúsculas funciona pero GitHub
  avisa que se movió.
