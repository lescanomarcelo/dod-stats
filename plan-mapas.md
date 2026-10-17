# Sección Mapas: los más jugados y la votación quincenal

Dos cosas en una sección:

1. **Ranking de los más jugados**, con los datos que ya tenemos.
2. **Votación**, para que el que entra diga qué quiere jugar. Son **tres votaciones
   separadas** —mapas chicos, medianos y grandes— porque el mapa que va bien con 8
   personas no es el que va bien con 24.

## Cómo se mide el tamaño de un mapa

Se saca del propio `.bsp`: la caja del mundo (el lump MODELS trae el `mins` y el
`maxs` del modelo 0). Se baja **148 bytes por mapa** con una lectura por rango, no el
archivo entero, así que medir los 83 cuesta nada.

Está probado contra el server y ordena como uno esperaría.

### Dos caminos que no sirven, y por qué

- **Contar los spawns** (`info_player_allies` / `info_player_axis`) parecía lo obvio y
  está mal: `au_3v3_ctf`, que es de 3 contra 3 por su propio nombre, tiene 30 spawns.
  Los mapeadores los ponen de sobra. Probado, descartado.
- **El zoom del overview** sí discrimina bien, pero solo 59 mapas traen overview y
  justo los `au_*`, los más jugados, no tienen.

### El reparto

Medidos los 83 mapas de `maps.ini`, que son los que un admin puede poner desde el
menú del server:

| Tamaño | Área | Mapas | Para |
|---|---|---|---|
| Chico | hasta 10 M | 24 | hasta 10 jugadores |
| Mediano | 10 a 25 M | 29 | hasta 16 jugadores |
| Grande | más de 25 M | 30 | hasta 24 jugadores |

Los cortes en 10 y 25 dejan los tres grupos parejos y caen en huecos naturales de la
distribución. Contrastado con lo que se juega de verdad: `dod_orange_ctf` (8,1, el más
jugado de todos) queda chico y se juega con unas 11 personas; `au_gris_torres` (10,7)
mediano con 14; `dod_clash_v3` (64) grande con 21.

La medida es solo el punto de partida. **Manda la lista revisada a mano**, en
`ingesta/tamanos-mapas.tsv`: la medida dice qué tan grande es el mapa físicamente, que
no es lo mismo que para cuánta gente va bien, y eso lo sabe el que juega. Los mapas
nuevos arrancan con el tamaño que les toca por medida hasta que alguien los revise.

## Cómo se vota

- **Te identificás eligiendo tu nick** de la lista de doderos registrados. Sin
  contraseña: cualquiera podría votar como otro, pero el server es chico y se confía.
  Al lado de cada mapa se ve quién lo votó, que es justamente lo que lo mantiene
  honesto.
- **Hasta 3 mapas por día en cada votación**, y el mismo mapa una sola vez por día.
  No hace falta gastarlos todos juntos: podés votar un mapa hoy y otro el jueves.
- **La votación se renueva cada quincena**: del 1 al 15 y del 16 a fin de mes. Al
  cambiar, el resultado anterior queda guardado y visible como "la quincena pasada".

Son 3 por día **en cada votación**: hasta 9 por día entre las tres.

## Qué hay que hacer

**Fase 1 — El catálogo de mapas. HECHA.** El script es `mapas/catalogo.mjs` (con
`--ver` lista sin escribir), la regla de los tamaños está en
`ingesta/tamano_mapas.mjs` (6 tests) y el guardado en `base.guardarCatalogoMapas()`
(7 tests de integración).

Cargado contra el server: **83 mapas, 83 activos**, repartidos 24 / 29 / 30.

Dos detalles que resuelve el guardado: un mapa que sale del server queda **inactivo en
vez de borrarse**, así los votos que ya tenga siguen apuntando a algo; y un tamaño
corregido a mano (`a_mano = 1`) no se pisa aunque el script vuelva a correr.

**Fase 2 — La sección. HECHA.** Página `/mapas` con el ranking de los más jugados y
el tamaño de cada uno, más el reparto por tamaño arriba. Entra al menú después de
Armas. Falta la imagen de la sección.

No lleva selector de período, igual que el resto de lo que cuenta actividad del
server: es el histórico completo. El gungame tampoco se filtra acá, porque la partida
se jugó igual.

**Fase 3 — La votación. HECHA.** Las tres listas en `/mapas`, arriba del ranking.

- Las quincenas están en `sitio/lib/quincenas.ts` (12 tests), todo medido en hora de
  Argentina: las nueve de la noche del 15 todavía son del 15, aunque en UTC ya sea 16.
- Las reglas, en `sitio/lib/votos.ts` (9 tests). Las tres votaciones son
  independientes: quedarse sin votos chicos no toca los medianos.
- La tabla `votos_mapas` tiene clave única `(mapa, jugador_id, dia)`: el "una vez por
  día" lo hace cumplir la base, no el código, así que no entra dos veces ni con dos
  pestañas abiertas a la vez.
- `POST /api/voto` recibe el voto y también lo saca, para corregir un toque mal dado
  el mismo día.

Dos cosas que salieron de probarlo en el navegador:

- El nick elegido se guarda en el navegador con `useSyncExternalStore`, no con un
  efecto: así no rompe la hidratación ni provoca renders en cascada.
- **Los conteos de votos no se cachean.** Estaban con 30 segundos de caché y, al
  recargar justo después de votar, se veía el tilde propio pero el contador en cero.
  En una votación eso confunde, y son 83 filas en una página que ya es dinámica.

**Fase 4 — La quincena.** El cierre automático, el histórico y la vista de "la quincena
pasada".

**Pendiente:** una imagen para la sección, como las del Medallero y el Campeonato GG.

## Lo que ya está resuelto

- **Escribir en la base desde el sitio** ya tiene precedente: `/api/visita` hace un
  UPDATE con una cookie que evita el refresh. La votación usa el mismo molde.
- **La lista de mapas** sale de `maps.ini` (83), que es la lista curada que ya usa el
  menú de admin del server. En la carpeta `maps` hay 110 `.bsp`, pero varios no se
  ponen nunca.
