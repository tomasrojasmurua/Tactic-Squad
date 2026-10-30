# Composiciones arquetípicas

Cinco tríos por bando que reúnen las clases en torno a un plan de juego. Están como datos en
`src/config/operators.js` (`COMPOSITIONS`): las dos IA eligen una a ciegas cada ronda
(`session/Lobby.js` `aiRoles`) y juegan su plan (`sim/aiAttack.js`, `sim/aiDefend.js`). Una
escuadra que no es ninguna de ellas (la de un jugador) recibe el plan que sugieren sus clases
(`planFor`): con Escudo, brecha con el Escudo en punta; con Tirador, cobertura; con Explorador
y sin Granadero, pinza.

Nada de esto es obligatorio para el jugador. Sirve de mapa de decisiones: qué gana cada trío,
qué lo castiga y contra qué conviene no llevarlo. Los porcentajes son de IA contra IA
(`node scripts/balance-clases.mjs 600 warehouse,hotel,port ciegas`, ~120 rondas por composición
y mapa, ±9 puntos de ruido); miden el plan de la IA tanto como la composición.

Contras de diseño entre clases: **Brecha > Ancla** (la conmoción de su carga aturde al que
espera en la sala), **Explorador > Merodeador** (lo oye aunque pise suave y se gira hacia
donde va a salir), **Escudo > Tirador** (el tiro lento no lo sacude), **Granadero > Vigía**
(el gas lo saca del monitor y lo deja casi ciego).

## Atacantes

| Composición | Clases | Plan | La castiga |
| --- | --- | --- | --- |
| **Brecha dura** | Escudo, Brecha, Asaltante | El Escudo va en punta: tira la primera flash, cruza primero y absorbe los primeros tiros; la Brecha vuela lo cerrado y su conmoción deja la sala aturdida; el Asaltante entra detrás y gana el duelo del umbral. Una sola entrada, rápida y dura. | Escopetero pegado a la puerta y fuego cruzado desde dos ángulos (el escudo solo cubre el frente). Trampero: un cepo frena la fila entera. |
| **Información y pinza** | Explorador, Asaltante, Brecha | El Explorador mira con la cámara de fibra antes de abrir (la fila entra apuntando a lo que vio) y oye al Merodeador. La mitad de las rondas uno entra por otra puerta del sitio si el rodeo es corto. | Vigía con cámaras en las dos entradas: la pinza se ve venir. En el Puerto, las líneas largas del patio A. |
| **Utilidad** | Granadero, Brecha, Explorador | Gas lacrimógeno en la sala (deja a 3 m de vista, apunta y reacciona peor) y flash detrás; la Brecha abre, el Explorador confirma. Saca a los defensores de sus puestos sin entrar. | Ancla con parapeto fuera del gas y Trampero: la escuadra se gasta la utilidad antes de llegar. |
| **Cobertura larga** | Tirador, Escudo, Asaltante | El Tirador se queda a ~7 m del sitio donde lo ve entero (nunca tras una esquina) y sostiene la entrada quieto; el Escudo cruza y el Asaltante remata. Si no hay línea, entra con ellos. | Mapas de puertas cortas (Hotel): el Tirador no encuentra línea. Trampero y Escopetero en las puertas. |
| **Asalto rápido** | Asaltante, Granadero, Asaltante | Dos Asaltantes con flash extra y el gas del Granadero: velocidad y umbral; pinza en la mitad de las rondas. | Fortaleza (Ancla + Escopetero + Trampero): sin Brecha ni Explorador no abre ni ve, y cae en las trampas. Es la más débil del Hotel. |

## Defensores

| Composición | Clases | Plan | La castiga |
| --- | --- | --- | --- |
| **Fortaleza** | Ancla, Escopetero, Trampero | Cierra el sitio: Ancla con parapeto, Escopetero junto a la puerta, cepos y un alambre más en el paso. Rota uno solo (amenaza a 8 m). | Brecha (la conmoción llega al que espera tras la puerta) y gas del Granadero. Es la más fuerte del Hotel: allí todo es puerta. |
| **Retoma** | Ancla, Merodeador, Tirador | El Merodeador caza el flanco en silencio, el Tirador sostiene la línea más larga y el Ancla el sitio; rotan dos y temprano (12 m). | Explorador (oye al Merodeador) y Escudo (el tiro del Tirador no lo sacude). |
| **Red de información** | Vigía, Trampero, Ancla | Cámaras y monitor del Vigía, cepos que delatan: saben por dónde viene el ataque y rotan dos hacia allí. | Granadero (el gas saca al Vigía del monitor) y humo sobre las cámaras. |
| **Emboscada** | Escopetero, Merodeador, Vigía | Ven venir al ataque por las cámaras y lo reciben de cerca: Escopetero en la puerta, Merodeador a la espalda. Rotan dos tarde (6 m). | Escudo y flash: entra uno que no muere de un tiro y ciega al resto. Débil en el Puerto (pocas puertas). |
| **Línea larga** | Tirador, Vigía, Ancla | Ángulos largos y cámaras: el Tirador en el puesto de línea más larga del sitio, el Vigía avisa, el Ancla sostiene. Rotan dos (10 m). | Escudo y humo: el carril largo se cruza tapado. Débil en el Almacén (sitios de líneas cortas). |

## Lectura por mapa

- **Almacén** (equilibrado): favorece la información (Explorador) y la cobertura; la Línea
  larga sufre porque sus sitios tienen pocas líneas de más de 10 m.
- **Hotel** (puertas): favorece la Fortaleza y castiga el Asalto rápido; la Brecha y el
  Explorador son las clases que más rinden en ataque.
- **Puerto** (abierto): favorece la utilidad del Granadero y el Tirador; la Emboscada y la
  Fortaleza rinden menos en el patio A, sin puertas.
