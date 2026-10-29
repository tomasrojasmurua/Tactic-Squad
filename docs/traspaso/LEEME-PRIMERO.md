# Traspaso de Tactic Squad a otra cuenta

Al 29 de octubre de 2026. Esta carpeta tiene todo lo necesario para seguir el proyecto desde
otra cuenta de Claude sin perder contexto.

## Qué hay en el paquete

| Archivo | Para qué sirve |
| --- | --- |
| `LEEME-PRIMERO.md` | Esta guía |
| `INSTRUCCIONES-DEL-PROYECTO.md` | Texto listo para pegar como instrucciones del proyecto nuevo |
| `ESTADO-Y-PENDIENTES.md` | Qué hay en `main`, PR abiertos y próximos pasos |
| `DECISIONES-DE-DISENO.md` | El diseño original y todas las decisiones posteriores, con fecha |
| `CLASES-Y-MAPAS.md` | Las 12 clases, los mapas y su equilibrio |
| `RESUMEN-DEL-JUEGO.md` | Qué es el juego y cómo se juega, para alguien de fuera |
| `ARCHITECTURE.md` | Cómo está construido el código |
| `tactic-squad-jugable.html` | El juego de `main` en un solo archivo (abrir en el navegador o el celular) |
| `referencias/economia-o-kit-de-clase.html` | El análisis que llevó a quitar el dinero |

Los documentos también quedan en el repositorio, en `docs/traspaso/` (y `RESUMEN-DEL-JUEGO.md`
y `ARCHITECTURE.md` en la raíz), así que la cuenta nueva los encuentra aunque no subas nada.

## Pasos en la cuenta nueva

1. **Acceso al repositorio.** El código vive en GitHub
   (github.com/tomasrojasmurua/Tactic-Squad), no en la cuenta de Claude. En la cuenta nueva,
   conecta GitHub en claude.ai/connect-github. Si entras con el mismo usuario de GitHub
   (`tomasrojasmurua`), ya tienes acceso. Si la cuenta nueva usa otro usuario de GitHub,
   agrégalo como colaborador del repositorio (Settings → Collaborators) y verifica que la
   app de Claude para GitHub esté instalada en el repositorio.
2. **Crea un proyecto** y pega como instrucciones el texto de `INSTRUCCIONES-DEL-PROYECTO.md`
   (lo que está entre las dos líneas).
3. **Agrega el repositorio** al proyecto.
4. **Sube los archivos de este paquete** como archivos del proyecto (sobre todo los `.md` y el
   HTML jugable). Es opcional, porque están en el repo, pero ayuda a que el primer hilo
   arranque con contexto.
5. **Primer mensaje sugerido:** "Lee docs/traspaso/ en el repo y dime en qué estado está el
   proyecto y qué sigue". Con eso puedes comprobar que la cuenta nueva entendió todo.
6. **Lo primero pendiente** es revisar el PR #41 (mapa Embajada). Después, lo que está en
   `ESTADO-Y-PENDIENTES.md`.

## Lo que no se lleva solo

- **Los hilos y el chat de este proyecto** se quedan en esta cuenta. Lo importante de ellos
  está resumido en `DECISIONES-DE-DISENO.md`.
- **Los documentos publicados en esta cuenta** (enlaces de claude.ai) no se abren desde otra
  cuenta. Sus conclusiones están en los documentos del paquete, pero si quieres conservarlos
  completos, ábrelos desde esta cuenta y expórtalos (PDF o Markdown):
  - Diseño: defensor y sub-tutoriales — https://claude.ai/artifact/CoM3giH8GPpgFjV2iYBar6
  - Mapas que premian clases: propuesta — https://claude.ai/artifact/7U2GHXemq6seXQUnkca6Va
  - Hito 2: fases de ronda y asalto We-Go — https://claude.ai/artifact/9FDMW4ZB3MUjWNRc3pXnDa
  - Tactic Squad frente a Door Kickers, CS y R6 — https://claude.ai/artifact/MEDkienBhpQG369enFno8y
  - Tactic Squad: diseño vs. código — https://claude.ai/artifact/A7bjVG9Ay969Tk7Fr5gS3y
  - Economía o kit de clase — https://claude.ai/artifact/4L3MdXHR8dQrCKLNABn7Fx (ya va
    copiado en `referencias/`)
- **El juego publicado** en https://tomasrojasmurua.github.io/Tactic-Squad/ no depende de
  ninguna cuenta de Claude: sigue funcionando.
- **El archivo `respaldo/trabajo-local.bundle`** de los archivos del proyecto es viejo: todo lo
  que tenía ya está en `main`. No hace falta llevarlo.
