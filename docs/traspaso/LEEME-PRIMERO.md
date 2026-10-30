# Traspaso de Tactic Squad a otra cuenta (30 oct 2026)

Esta carpeta (`docs/traspaso/`) tiene todo lo necesario para seguir el proyecto desde otra
cuenta de Claude sin perder contexto. Lo próximo es **el multijugador online**.

## Qué hay en la carpeta

| Archivo | Para qué sirve |
| --- | --- |
| `LEEME-PRIMERO.md` | Esta guía: pasos en la cuenta nueva y primer mensaje |
| `INSTRUCCIONES-DEL-PROYECTO.md` | Texto listo para pegar como instrucciones del proyecto nuevo |
| `ESTADO-Y-PENDIENTES.md` | Qué hay en `main`, ramas abiertas, números de equilibrio y lo que sigue |
| `MULTIJUGADOR.md` | **La especificación del multijugador**: lo que pidió Tomás, decisiones tomadas, arquitectura, protocolo, etapas y cómo probar |
| `DECISIONES-DE-DISENO.md` | El diseño original y todas las decisiones posteriores, con fecha |
| `CLASES-Y-MAPAS.md` | Las 12 clases, los 3 mapas y su equilibrio |

Otros documentos del repo que conviene leer: `RESUMEN-DEL-JUEGO.md` y `ARCHITECTURE.md` (raíz),
`docs/diseno/composiciones.md` (composiciones de equipo) y `docs/diseno/mapas-v2.md` (diseño de
los mapas). El plan de gráficos está en la rama `claude/graficos-realismo`
(`docs/diseno/graficos-realismo.md`).

## Pasos en la cuenta nueva

1. **GitHub.** El código vive en GitHub (github.com/tomasrojasmurua/Tactic-Squad), no en la
   cuenta de Claude. Conecta GitHub en la cuenta nueva (claude.ai → Settings → Connectors, o
   claude.ai/code). Con el mismo usuario de GitHub (`tomasrojasmurua`) ya tienes acceso. Si usas
   otro usuario, agrégalo como colaborador del repo (Settings → Collaborators) y verifica que la
   app de Claude para GitHub esté instalada en el repositorio.
2. **Sesión en la nube.** Abre Claude Code en la nube (claude.ai/code) eligiendo el repositorio
   Tactic-Squad. Ahí es donde se usan los créditos de trabajo en la nube.
3. **Instrucciones.** Si trabajas dentro de un proyecto de claude.ai, pega como instrucciones el
   texto de `INSTRUCCIONES-DEL-PROYECTO.md` (lo que está entre las dos líneas). Si no, pégalo en
   el primer mensaje.
4. **Primer mensaje sugerido:**

   > Lee `docs/traspaso/` empezando por `LEEME-PRIMERO.md`, `ESTADO-Y-PENDIENTES.md` y
   > `MULTIJUGADOR.md`. Sigue con la etapa 1 del multijugador desde la rama
   > `claude/multijugador`. Antes de escribir código, dime en pocas líneas en qué estado está y
   > cuál es tu plan para dejarlo jugable lo antes posible.

5. **Cloudflare ya está listo.** Los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`
   están cargados en GitHub (Settings → Secrets and variables → Actions) y no dependen de la
   cuenta de Claude. **Seguridad:** el token se pegó una vez en un chat; si no se hizo "Roll"
   del token en Cloudflare (dash.cloudflare.com/profile/api-tokens → ··· → Roll), hazlo y
   actualiza el secreto en GitHub.

## Créditos de trabajo en la nube (antes de empezar)

- **Vencen el 4 de noviembre de 2026 a las 23:59 hora del Pacífico** (madrugada del 5 en Chile).
  Lo que no se use se pierde.
- **Solo cubren sesiones en la nube** de Claude Code (claude.ai/code, o "nube" en la app de
  escritorio o del celular) con un repositorio de GitHub. **No cubren** el chat, los Proyectos de
  claude.ai ni Cowork: el trabajo hay que hacerlo en una sesión de Claude Code en la nube.
- Mientras quede saldo, esas sesiones no descuentan del límite del plan. El saldo se ve en el
  menú de uso de claude.ai. En Pro, elegir el modelo Fable exige créditos de uso pagados: usar el
  modelo por defecto.
- **Entorno recomendado** (selector de entorno bajo la caja de mensaje en claude.ai/code →
  editar o agregar):
  - **Network access → Custom**, con "Also include default list of common package managers"
    marcado, y en **Allowed domains**: `api.cloudflare.com` y `*.workers.dev`.
  - **Network secrets → Add secret**: el token de Cloudflare como `Authorization: Bearer …`
    para el host `api.cloudflare.com`. La sesión lo usa sin verlo.
  - **Environment variables**: `CLOUDFLARE_ACCOUNT_ID=<tu Account ID>` (no es secreto).
  - Así la sesión puede desplegar y probar el servidor ella misma, sin esperar a GitHub Actions
    ni pedirte que mires la pestaña Actions. Los secretos de GitHub siguen sirviendo para el
    despliegue automático.

Fuentes: support.claude.com/en/articles/17152539 (promoción) y
code.claude.com/docs/en/cloud-environments (entornos).

## Para que rindan los créditos

- **Una sesión a la vez y sin subagentes en paralelo**, salvo que haga falta de verdad. En la
  cuenta anterior, tres especialistas en paralelo gastaron el límite de 5 horas dos veces y
  dejaron trabajo a medias.
- **PR chicos y commits frecuentes** (también de trabajo en curso): si la sesión se corta, nada
  se pierde.
- **Las mediciones de equilibrio** (`scripts/balance.mjs`) usan la CPU de la máquina, no la
  cuenta: no gastan créditos, pero sí tiempo. Pide 400-800 rondas solo cuando se toquen reglas,
  IA o mapas.
- **Pide el resultado, no el relato**: "déjalo funcionando y fusiona cuando pasen las pruebas"
  ahorra idas y vueltas.

## Lo que no se lleva solo

- **Los chats** de la cuenta anterior. Lo importante está resumido en estos documentos.
- **Los documentos publicados en la cuenta anterior** (enlaces de claude.ai). Sus conclusiones
  están aquí y en `docs/diseno/`.
- **El prototipo de iluminación** está en la rama `claude/graficos-realismo`
  (`prototipos/iluminacion-almacen.html`); se abre directo en el navegador.
- **El juego publicado** (https://tomasrojasmurua.github.io/Tactic-Squad/) no depende de
  ninguna cuenta de Claude: se publica solo en cada push a `main`.
