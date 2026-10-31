# Instrucciones del proyecto (para pegar en la cuenta nueva)

Copia todo lo que está entre las dos líneas y pégalo como instrucciones del proyecto
(o como primer mensaje si no usas un proyecto).

---

Contexto: Tactic Squad, juego web táctico de escuadra en vista cenital (JavaScript puro con módulos ES, render propio en WebGL2, audio procedural, sin dependencias en tiempo de ejecución; esbuild solo para empaquetar). Interfaz y textos en español. Repositorio: github.com/tomasrojasmurua/Tactic-Squad (rama main). Se publica en GitHub Pages en cada push a main: https://tomasrojasmurua.github.io/Tactic-Squad/. Antes de proponer o cambiar algo, lee `docs/traspaso/` (LEEME-PRIMERO, ESTADO-Y-PENDIENTES, MULTIJUGADOR, DECISIONES-DE-DISENO, CLASES-Y-MAPAS), `RESUMEN-DEL-JUEGO.md` y `ARCHITECTURE.md`.

PRIORIDAD ACTUAL: el multijugador online, jugable de verdad desde el celular. Tomás pidió "hagámoslo funcional ya": primero algo jugable de punta a punta y desplegado, después el pulido. La especificación completa y las decisiones tomadas están en `docs/traspaso/MULTIJUGADOR.md`; el trabajo sigue en la rama `claude/multijugador`.

CÓMO TRABAJAMOS: PRs chicos sobre main, uno por tema. Para el multijugador, Tomás autoriza fusionar cada PR en cuanto pasen las pruebas, para poder probar en el teléfono; para el resto, él revisa y dice "merge". Cada PR pasa las pruebas (`node --test "tests/*.test.mjs"`, hoy 213) y, si toca reglas, IA o mapas, mide el equilibrio con `node scripts/balance.mjs 400 ciegas <mapa>` (meta 45-55 % por bando y por sitio). Entrega un HTML jugable de un solo archivo (`npm run build`) y capturas en celular horizontal, porque Tomás prueba en el iPhone. Todo debe jugarse bien en celular horizontal (iPhone y Android). Mantén el determinismo por semilla (nada de Math.random ni reloj real en la simulación; las funciones trigonométricas de la simulación salen de `src/core/dmath.js` en la rama del multijugador). Textos visibles en `src/ui/texts.js`, números en `src/config/`. Commits frecuentes: la sesión se puede cortar por límite de uso. Trabaja en una sola sesión, sin subagentes en paralelo salvo que haga falta.

PRINCIPIOS DE DISEÑO: realismo de asalto en espacios cerrados (nada futurista ni fantasioso); paridad total entre atacante y defensor; las rondas no se reintentan; el jugador no debe frustrarse por errores no forzados; cada clase se juega distinto con equipo o técnica real de CQB; los mapas premian clases distintas pero la ficha del mapa nunca sugiere clases; estándar visual igual o superior al existente.

JUEGO ACTUAL: objetivo tipo Rainbow Six (bomba en el sitio A o B que elige en secreto el defensor; el atacante la desactiva en 7 s quieto o elimina a todos; el defensor gana si se acaba el tiempo o elimina a todos). 3 contra 3. Fases: compra → preparación (atacante elige 1 de 3 entradas ocultas; defensor: sitio, 2 barricadas, 1 alambre, 2 cámaras en soportes, colocación y vigilancia) → dron del atacante 15 s en tiempo real → asalto We-Go: planificación a ciegas y ejecución simultánea de 5 s; bomba de 90 s que solo corre al ejecutar; corte del turno al contacto → fin con repetición de la última baja. Partida de una ronda o al mejor de 3, 5 o 7 con cambio de bando a la mitad. SIN DINERO: kit de clase gratis cada ronda + 2 puntos de utilidad por operador (+1 al que perdió). 12 clases (6 por bando) y 5 composiciones arquetípicas por bando que juega la IA. 3 mapas v2: Almacén "Distribuidora Ferrol" (56 × 34 m), Hotel "Miramar" (56 × 34 m), Puerto "Terminal 3" (60 × 38 m); el tutorial usa el almacén original de 40 × 28 m.

MULTIJUGADOR (decidido): 1v1 (3 soldados por jugador) y 2v2 (4 soldados por equipo, 2 por jugador). Un jugador crea una sala y la comparte por WhatsApp; lobby donde se deciden equipos, mapa y duración. Servidor en Cloudflare Workers + Durable Objects (los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` ya están en GitHub; el despliegue lo hace GitHub Actions). Netcode de lockstep de órdenes sobre la simulación determinista. Buena conexión en Wifi y red móvil, con reconexión automática.

GRÁFICOS (decidido): seguir con el render WebGL2 propio, no migrar a Three.js. Plan por etapas en `docs/diseno/graficos-realismo.md` (rama `claude/graficos-realismo`). Va después del multijugador.

DECISIONES QUE NO SE REABREN: no hay paredes destructibles ni blandas. No hay pausa táctica al contacto. No hay economía de dinero. Entreabrir ya no existe: lo reemplazó el espejo (31 oct). Los defensores del jugador nunca se mueven solos. Las rondas no se repiten. No se migra a Three.js.

---
