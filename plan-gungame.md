# GunGame: sacarlo de las estadísticas y contar quién lo gana

**Sin tocar el plugin ni el server.** Las dos cosas que hacen falta ya están
disponibles: el gg se detecta con los datos que ya tenemos en la base, y las victorias
las viene contando el propio gungame en un archivo que podemos leer.

## Cómo se detecta el gungame

En DoD 1.3 cada mapa le da a los aliados **un** arsenal: el yanqui (BAR, Garand,
Thompson, Greasegun, .30 cal, Springfield) o el británico (Bren, Enfield, Sten,
Webley). Nunca los dos. El gungame hace pasar a todos por la escalera completa de
armas, así que aparecen los dos arsenales en la misma partida: una combinación
imposible en juego normal.

**La regla:** una partida es gungame si tiene kills con arsenal británico **y** kills
con arsenal yanqui. Hacen falta los dos: un mapa genuinamente británico daría
británico sin yanqui, y no hay que confundirlo.

Contrastado contra todo el historial, la separación es perfecta:

| Partida | Kills | Británico | Yanqui |
|---|---|---|---|
| dod_7quick 23/9 01:15 | 335 | 55 | 89 |
| dod_7quick 25/9 01:24 | 235 | 34 | 52 |
| dod_7quick 29/9 02:23 | 354 | 56 | 86 |
| dod_7quick 8/10 01:17 | 298 | 42 | 74 |

Todas las demás partidas del historial tienen cero británico. Son 1.222 kills de gg
sobre el total.

Dos cosas que confirman que la regla está bien apuntada:

- Las cuatro partidas son `dod_7quick`, y `dod_7quick` **nunca** se jugó fuera de gg.
  O sea que hay un mapa dedicado al gg, lo cual encaja con lo que se ve en el server.
- Dos de esas cuatro son anteriores al `amx_gungame_vote` que figura en la tabla de
  comandos (empezamos a guardar comandos el 28/9). La detección por armas encuentra
  más que el log de comandos: no depende de que un admin haya usado el comando que
  esperábamos.

También sirve si prenden el gg en medio de un mapa normal: la escalera de armas igual
reparte el arsenal británico, así que la partida queda marcada. Lo que **no** se puede
es saber el minuto exacto en que arrancó, así que en ese caso se descarta la partida
entera. Es aceptable: el gg se juega en su propio mapa y es poco frecuente.

### Variedad de armas: por qué no sirve como regla

La primera idea fue usar la cantidad de armas distintas, porque las partidas de gg
tienen 28-30 contra un promedio de 16,4. Pero hay partidas normales con 23 y 22, así
que el margen es demasiado flaco. El arsenal cruzado es categórico y no depende de
umbrales.

## Cómo se cuentan las victorias

El gungame mantiene su propia planilla en `dod/gungame.stats`, con una línea por
jugador separada por tabs:

```
STEAM_0:0:25087132	5	El Uru	1791511818	0
steamid              victorias  nick  visto (unix)  ?
```

Hoy hay 28 victorias repartidas entre 11 jugadores. Se lee por SFTP **igual que
`users.ini`**: la ingesta ya tiene ese mecanismo (`fuente.leerTexto`), probado y con
el manejo de "si el archivo no está, avisá y seguí".

**Es un contador acumulado, no un registro de eventos.** Dos consecuencias:

1. No sabemos *cuándo* se ganó cada gg, solo el total por jugador. Para un ranking de
   "quién gana más gungames" alcanza.
2. El gungame puede podar jugadores viejos de su planilla (`gg_stats_prune`). Por eso
   guardamos **nuestra propia foto** en cada ingesta y nos quedamos con el máximo
   visto por jugador: si el gg borra a alguien, nosotros no perdemos su historia.

## Qué hay que hacer

**Fase 1 — Marcar las partidas de gg. HECHA.** La regla vive en `ingesta/gungame.mjs`
(pura, 19 tests), el marcado en `base.marcarGungame()` (10 tests de integración
contra la base real), y se corre al final de cada ingesta.

La marca va en una columna `gg` de `mapas_jugados` (el origen de todo), que se copia a
`muertes`, `puntos` y `partidas` por su momento. Se recalcula entera en cada pasada, a
propósito: una partida puede empezar en un archivo y seguir en el siguiente, así que
recién se la puede juzgar cuando están todas sus muertes. Y como se pone todo en cero
antes de marcar, un cambio en la regla también desmarca.

La ventana de una sesión de mapa va de su línea `P` a la `P` siguiente, **no** del
inicio al fin de `partidas`: ahí hay un 11% de las muertes que quedan afuera.

Aplicado a producción, sobre 1.475 sesiones de mapa:

| Tabla | gg | normal |
|---|---|---|
| muertes | 1.225 | 52.633 |
| puntos (banderas) | 988 | 8.289 |
| partidas | 4 | 225 |
| impactos | 39 | 1.336 |
| acostado | 24 | 1.329 |
| jugado | 61 | 2.744 |

Las 1.225 muertes marcadas son todas de `dod_7quick`, y no quedó ninguna de ese mapa
sin marcar: las ventanas cayeron exactas. Las 988 banderas son el 11% de todas las del
historial — el gg las infla porque `gg_dod_flagcap_bonus` las premia aparte.

`impactos`, `acostado` y `jugado` suman por jugador y mapa, no tienen una fila por
evento, así que ahí la marca es a nivel mapa: solo se pueden marcar los mapas que
**nunca** se jugaron normales. Hoy `dod_7quick` es el único. Si algún día prenden el gg
en medio de un mapa normal, esas tres tablas se quedan con algo de gg adentro; las
otras, las importantes, siguen exactas.

**Fase 2 — Filtrar. HECHA.** La vista `ranking` y todas las consultas del sitio dejan
afuera lo que pasó en gungame.

En vez de ir agregando `gg = 0` a mano en cuarenta consultas y confiar en no saltearse
ninguna, `filtro()` ahora recibe **la tabla**, obligatoria y de una lista cerrada. El
compilador obliga a elegirla en cada consulta nueva, y la marca sale sola. Las que no
usan `filtro()` lo llevan escrito, y un test (`sitio/lib/consultas-gg.test.ts`) lee el
código fuente y falla si alguna consulta toca una tabla con gg sin filtrarla. Está
probado al revés: sacando un filtro, el test lo encuentra.

Lo que **no** se filtra, a propósito:

- `sesiones`: el tiempo conectado es tiempo conectado, jugue lo que jugue.
- `mapas_jugados`: ahí se cuenta actividad del server (cuántas partidas hubo, qué
  mapas se jugaron), y la partida de gungame se jugó igual. Si alguna vez se quiere
  que El Server tampoco la cuente, es sacar `mapas_jugados` de la excepción.

Sobre los datos de hoy saca 1.197 kills, 1.225 muertes, 296 headshots y 988 banderas:
exactamente lo que estaba marcado.

### Las dos medallas: se pierden

El medallero dice "se ganan y no se pierden", pero al sacar el gungame hacia atrás
**dos doderos bajan del bronce de banderas**: Peinate q viene Gente !!! (364 → 283) y
Elvis Nieto (317 → 292). En kills no pierde nadie.

Decidido dejar que se pierdan: la medalla estaba inflada por el gg, que premia las
capturas aparte con `gg_dod_flagcap_bonus`. Son dos casos, y la alternativa era
cargar con una excepción permanente en el código para siempre.

**Fase 3 — Leer `gungame.stats`. HECHA.** El parser en `ingesta/gungame_stats.mjs`
(10 tests), la tabla `gungame_ganadas` y `base.guardarGungameGanadas()` (5 tests de
integración), leído por SFTP igual que `users.ini`.

Se guarda el **máximo** entre lo que ya teníamos y lo que dice el archivo: si el
gungame poda a alguien de su planilla, de este lado no se pierde. Solo se guardan
jugadores que ya están en la base; el que no aparezca se avisa y no frena nada.

Corrido contra el server: 11 jugadores, 28 victorias, ninguno sin emparejar.

**Fase 4 — Mostrarlo. HECHA.** Sección **Campeonato GG** (en `/gungame`) con la imagen, el ranking de
ganadores, el botón de compartir y una explicación de por qué el gungame no cuenta
para el resto de las estadísticas. Entra al menú y al pie por `lib/secciones.ts`.

No se hizo como "destacado" del ranking a propósito: los destacados se cortan por
semana y por mes, y las victorias del gungame son un acumulado sin fechas.

**Más adelante:** un rubro del medallero por ganar gungames, cuando haya suficientes
rondas para poner una marca que filtre de verdad. Con 28 victorias en total todavía
es poco.

## Lo ya cargado: ahora se puede limpiar gratis

Habíamos acordado dejarlo como está, pero como la detección es retroactiva, las cuatro
partidas de gg se pueden excluir del historial sin esfuerzo extra: son los mismos
1.222 kills, y el filtro de la fase 2 los saca solos. No hay que decidirlo ahora.

## El camino descartado (y por qué)

Se puede hacer con el plugin: `gungame_base` publica un forward `ggfw_gungame_toggled`
cuando lo prenden o apagan, y escribe al log del juego una línea
`"NICK<id><STEAM_...>" triggered "Won_GunGame"` por cada ronda ganada, que se podría
agarrar con `register_logevent`. Daría precisión al segundo y el momento exacto de
cada victoria.

No vale la pena: obliga a recompilar, subir y verificar el plugin con cambio de mapa
(y ya sabemos que esa verificación cuesta varias vueltas), a cambio de una precisión
que para esto no se necesita. Queda anotado por si algún día hace falta el detalle
por ronda.

Tampoco hay que leer el log del juego por SFTP: `dod/logs` tiene 57.160 archivos y
listar esa carpeta es carísimo.
