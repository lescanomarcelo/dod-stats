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

El tamaño se guarda en una tabla, no en el código: si algún mapa quedó en el grupo
equivocado se corrige ahí sin tocar nada más.

## Cómo se vota

- **Te identificás eligiendo tu nick** de la lista de doderos registrados. Sin
  contraseña: cualquiera podría votar como otro, pero el server es chico y se confía.
  Al lado de cada mapa se ve quién lo votó, que es justamente lo que lo mantiene
  honesto.
- **Hasta 3 mapas por día en cada votación**, y el mismo mapa una sola vez por día.
  No hace falta gastarlos todos juntos: podés votar un mapa hoy y otro el jueves.
- **La votación se renueva cada quincena**: del 1 al 15 y del 16 a fin de mes. Al
  cambiar, el resultado anterior queda guardado y visible como "la quincena pasada".

> **A confirmar antes de arrancar:** lo de "hasta 3" lo leí como **3 por día en cada
> votación** (hasta 9 por día entre las tres). La otra lectura posible es 3 por día en
> total. Lo dejo así salvo que digas lo contrario.

## Qué hay que hacer

**Fase 1 — El catálogo de mapas.** Un script `mapas/tamanos.mjs` que lee la caja del
mundo de cada `.bsp` por SFTP y carga una tabla `mapas_catalogo (mapa, area, tamano,
activo)`. Se corre a mano cuando se agregan mapas, no en cada ingesta.

**Fase 2 — La sección.** Página `/mapas` con el ranking de los más jugados: partidas,
y de paso el tamaño de cada uno. Es toda lectura de datos que ya están.

**Fase 3 — La votación.** La tabla `votos_mapas (quincena, mapa, jugador_id, dia)` con
clave única `(mapa, jugador_id, dia)`, que es la que hace cumplir el "una vez por día"
en la base y no solo en el código. Una ruta `POST /api/voto` como la de las visitas, y
la pantalla con las tres listas, el buscador y el contador de votos que te quedan.

**Fase 4 — La quincena.** El cierre automático, el histórico y la vista de "la quincena
pasada".

**Pendiente:** una imagen para la sección, como las del Medallero y el Campeonato GG.

## Lo que ya está resuelto

- **Escribir en la base desde el sitio** ya tiene precedente: `/api/visita` hace un
  UPDATE con una cookie que evita el refresh. La votación usa el mismo molde.
- **La lista de mapas** sale de `maps.ini` (83), que es la lista curada que ya usa el
  menú de admin del server. En la carpeta `maps` hay 110 `.bsp`, pero varios no se
  ponen nunca.
