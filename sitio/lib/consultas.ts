import 'server-only'
import { cacheLife } from 'next/cache'
import { consultar } from './db'
import { MIN_KILLS_PORCENTAJES, MIN_SEGUNDOS_CAMPER } from './calculos'
import { HORAS_ARGENTINA, type Ventana, type Balance } from './periodos'

/*
 *  Cuanto vive lo cacheado. La ingesta carga datos nuevos cada 15 minutos, asi que
 *  recalcular cada minuto era gastar por gusto: con 5 minutos las visitas casi nunca
 *  tocan la base y el sitio responde de entrada.
 */
const VIDA_CACHE = { stale: 300, revalidate: 300, expire: 3600 }

/*
 *  Todas las lecturas del sitio.
 *
 *  Cada funcion se cachea con el perfil "minutes" (se revalida cada minuto).
 *  La ingesta corre cada 15 minutos, asi que las stats nunca estan mas viejas que
 *  eso, y la mayoria de las visitas no llegan a tocar la base.
 *
 *  Los argumentos forman parte de la clave de cache: ranking('kd') y ranking('kills')
 *  se cachean por separado.
 */

/*
 *  Filtro de mapa y fechas como fragmentos fijos + parametros: nada de la URL entra
 *  al SQL. alias = prefijo de tabla cuando la consulta tiene JOIN.
 */
function filtro (mapa: string | null, v: Ventana, alias = '', columnaFecha = 'momento') {
  const partes: string[] = []
  const valores: (string | Date)[] = []
  if (mapa) { partes.push(`AND LOWER(${alias}mapa) = ?`); valores.push(mapa.toLowerCase()) }
  if (v.desde) { partes.push(`AND ${alias}${columnaFecha} >= ?`); valores.push(new Date(v.desde)) }
  if (v.hasta) { partes.push(`AND ${alias}${columnaFecha} < ?`); valores.push(new Date(v.hasta)) }
  return { sql: partes.join(' '), valores }
}

const TODO: Ventana = { desde: null, hasta: null }

/** Una ventana sin limites: la consulta mira todo el historico */
export const esTodo = (v: Ventana) => !v.desde && !v.hasta

const n = (valor: unknown) => Number(valor ?? 0)
const iso = (valor: unknown) => (valor instanceof Date ? valor.toISOString() : null)

export type Jugador = {
  id: number
  nick: string
  steamid: string | null
  kills: number
  muertes: number
  headshots: number
  teamkills: number
  suicidios: number
  segundos: number
  puntos: number
  segundosAcostado: number
}

export type JugadorDetalle = Jugador & { primeraVez: string | null, ultimaVez: string | null }

function aJugador (f: Record<string, unknown>): Jugador {
  return {
    id: n(f.id),
    nick: String(f.nick),
    steamid: (f.steamid as string | null) ?? null,
    kills: n(f.kills),
    muertes: n(f.muertes),
    headshots: n(f.headshots),
    teamkills: n(f.teamkills),
    suicidios: n(f.suicidios),
    segundos: n(f.segundos_jugados),
    puntos: n(f.puntos),
    segundosAcostado: n(f.segundos_acostado)
  }
}

/* ------------------------------------------------------------------ */
/*  General                                                            */
/* ------------------------------------------------------------------ */

export async function resumenGeneral () {
  'use cache'
  cacheLife(VIDA_CACHE)

  const [totales] = await consultar(`
    SELECT
      (SELECT COUNT(*) FROM {p}ranking WHERE kills + muertes + puntos > 0)              AS jugadores,
      (SELECT COUNT(*) FROM {p}muertes)                                        AS muertes,
      (SELECT COUNT(*) FROM {p}muertes WHERE matador_id IS NOT NULL AND teamkill = 0) AS kills,
      (SELECT COUNT(*) FROM {p}muertes WHERE headshot = 1 AND teamkill = 0)    AS headshots,
      (SELECT COUNT(*) FROM {p}mapas_jugados)                                  AS mapas,
      (SELECT MAX(actualizado) FROM {p}ingesta_estado)                         AS actualizado
  `)

  return {
    jugadores: n(totales.jugadores),
    muertes: n(totales.muertes),
    kills: n(totales.kills),
    headshots: n(totales.headshots),
    mapas: n(totales.mapas),
    actualizado: iso(totales.actualizado)
  }
}

/* ------------------------------------------------------------------ */
/*  Ranking                                                            */
/* ------------------------------------------------------------------ */

export type Orden = 'puntos' | 'kills' | 'kd' | 'hs' | 'tiempo' | 'camper'

/* Lista cerrada: el orden llega por la URL y NUNCA se interpola tal cual en el SQL */
const ORDENES: Record<Orden, { sql: string, soloConMinimo?: boolean, soloCamper?: boolean }> = {
  puntos: { sql: 'puntos DESC, kills DESC, muertes ASC', soloConMinimo: false },
  kills: { sql: 'kills DESC, muertes ASC', soloConMinimo: false },
  kd: { sql: 'kills / GREATEST(muertes, 1) DESC, kills DESC', soloConMinimo: true },
  hs: { sql: 'headshots / GREATEST(kills, 1) DESC, kills DESC', soloConMinimo: true },
  tiempo: { sql: 'segundos_jugados DESC', soloConMinimo: false },
  camper: { sql: 'segundos_acostado / GREATEST(segundos_jugados, 1) DESC, segundos_acostado DESC', soloCamper: true }
}

export function esOrden (valor: unknown): valor is Orden {
  return typeof valor === 'string' && valor in ORDENES
}

/*
 *  Totales de cada jugador dentro de una ventana, calculados desde los eventos.
 *  Es la vista ranking pero acotada en el tiempo; para "global" se usa la vista, que
 *  ya esta lista. El tiempo jugado sale de las sesiones que TERMINARON dentro de la
 *  ventana, asi que una partida a caballo de la medianoche cuenta el dia que termino.
 */
function sqlTotales (v: Ventana) {
  const fm = filtro(null, v)
  const fs = filtro(null, v, '', 'desconexion')
  const fp = filtro(null, v)
  const fa = filtro(null, v, '', 'dia')
  return {
    sql: `
      SELECT j.id, j.identidad, j.steamid, j.nick, j.primera_vez, j.ultima_vez,
             SUM(x.kills) AS kills, SUM(x.headshots) AS headshots, SUM(x.teamkills) AS teamkills,
             SUM(x.muertes) AS muertes, SUM(x.suicidios) AS suicidios,
             SUM(x.segundos_jugados) AS segundos_jugados, SUM(x.puntos) AS puntos,
             SUM(x.segundos_acostado) AS segundos_acostado
      FROM (
        SELECT matador_id AS jugador_id, SUM(teamkill = 0) AS kills,
               SUM(teamkill = 0 AND headshot = 1) AS headshots, SUM(teamkill = 1) AS teamkills,
               0 AS muertes, 0 AS suicidios, 0 AS segundos_jugados, 0 AS puntos, 0 AS segundos_acostado
        FROM {p}muertes WHERE matador_id IS NOT NULL ${fm.sql} GROUP BY matador_id
        UNION ALL
        SELECT victima_id, 0, 0, 0, COUNT(*), SUM(matador_id IS NULL), 0, 0, 0
        FROM {p}muertes WHERE 1 = 1 ${fm.sql} GROUP BY victima_id
        UNION ALL
        SELECT jugador_id, 0, 0, 0, 0, 0, SUM(segundos), 0, 0
        FROM {p}sesiones WHERE 1 = 1 ${fs.sql} GROUP BY jugador_id
        UNION ALL
        SELECT jugador_id, 0, 0, 0, 0, 0, 0, SUM(puntos), 0
        FROM {p}puntos WHERE 1 = 1 ${fp.sql} GROUP BY jugador_id
        UNION ALL
        SELECT jugador_id, 0, 0, 0, 0, 0, 0, 0, SUM(segundos)
        FROM {p}acostado WHERE 1 = 1 ${fa.sql} GROUP BY jugador_id
      ) x
      JOIN {p}jugadores j ON j.id = x.jugador_id
      GROUP BY j.id, j.identidad, j.steamid, j.nick, j.primera_vez, j.ultima_vez
    `,
    valores: [...fm.valores, ...fm.valores, ...fs.valores, ...fp.valores, ...fa.valores]
  }
}

export async function ranking (orden: Orden, v: Ventana = TODO): Promise<Jugador[]> {
  'use cache'
  cacheLife(VIDA_CACHE)

  const { sql, soloConMinimo, soloCamper } = ORDENES[orden]
  /* Camper: solo con tiempo acostado registrado (plugin 0.4) y un minimo de tiempo jugado */
  const condicion = soloConMinimo ? 'AND kills >= ?' : soloCamper ? 'AND segundos_acostado > 0 AND segundos_jugados >= ?' : ''
  const valores = soloConMinimo ? [MIN_KILLS_PORCENTAJES] : soloCamper ? [MIN_SEGUNDOS_CAMPER] : []
  const base = esTodo(v) ? { sql: 'SELECT * FROM {p}ranking', valores: [] as unknown[] } : sqlTotales(v)
  const filas = await consultar(`
    SELECT * FROM (${base.sql}) t
    WHERE kills + muertes + puntos > 0 ${condicion}
    ORDER BY ${sql}, id
    LIMIT 200
  `, [...base.valores, ...valores])

  return filas.map(aJugador)
}

export async function listaJugadores (): Promise<{ id: number, nick: string }[]> {
  'use cache'
  cacheLife(VIDA_CACHE)

  const filas = await consultar(`
    SELECT id, nick FROM {p}ranking WHERE kills + muertes + puntos > 0 ORDER BY nick
  `)
  return filas.map((f) => ({ id: n(f.id), nick: String(f.nick) }))
}

/* ------------------------------------------------------------------ */
/*  Perfil de jugador                                                  */
/* ------------------------------------------------------------------ */

export async function jugador (id: number): Promise<JugadorDetalle | null> {
  'use cache'
  cacheLife(VIDA_CACHE)

  const [fila] = await consultar(`SELECT * FROM {p}ranking WHERE id = ?`, [id])
  if (!fila) return null
  return { ...aJugador(fila), primeraVez: iso(fila.primera_vez), ultimaVez: iso(fila.ultima_vez) }
}

/** Totales de un jugador dentro de una ventana. Para comparar por periodo. */
export async function jugadorEnPeriodo (id: number, v: Ventana): Promise<JugadorDetalle | null> {
  'use cache'
  cacheLife(VIDA_CACHE)

  if (esTodo(v)) return jugador(id)

  const base = sqlTotales(v)
  const [fila] = await consultar(`SELECT * FROM (${base.sql}) t WHERE id = ?`, [...base.valores, id])
  if (!fila) return null
  return { ...aJugador(fila), primeraVez: iso(fila.primera_vez), ultimaVez: iso(fila.ultima_vez) }
}

export async function armasDeJugador (id: number) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const filas = await consultar(`
    SELECT arma, COUNT(*) AS kills, SUM(headshot) AS headshots
    FROM {p}muertes
    WHERE matador_id = ? AND teamkill = 0
    GROUP BY arma
    ORDER BY kills DESC
    LIMIT 10
  `, [id])
  return filas.map((f) => ({ arma: String(f.arma), kills: n(f.kills), headshots: n(f.headshots) }))
}

export async function hitboxesDeJugador (id: number) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const filas = await consultar(`
    SELECT hitbox, COUNT(*) AS veces
    FROM {p}muertes
    WHERE matador_id = ? AND teamkill = 0 AND hitbox > 0
    GROUP BY hitbox
    ORDER BY veces DESC
  `, [id])
  return filas.map((f) => ({ hitbox: n(f.hitbox), veces: n(f.veces) }))
}

/** Rivales: de quien murio mas veces (nemesis) o a quien mato mas veces (victimas) */
export async function rivales (id: number, tipo: 'nemesis' | 'victimas') {
  'use cache'
  cacheLife(VIDA_CACHE)

  /* Columnas de una lista cerrada, no del usuario */
  const [yo, otro] = tipo === 'nemesis' ? ['victima_id', 'matador_id'] : ['matador_id', 'victima_id']
  const filas = await consultar(`
    SELECT j.id, j.nick, COUNT(*) AS veces
    FROM {p}muertes m
    JOIN {p}jugadores j ON j.id = m.${otro}
    WHERE m.${yo} = ? AND m.teamkill = 0 AND m.${otro} IS NOT NULL
    GROUP BY j.id, j.nick
    ORDER BY veces DESC
    LIMIT 5
  `, [id])
  return filas.map((f) => ({ id: n(f.id), nick: String(f.nick), veces: n(f.veces) }))
}

export async function mapasDeJugador (id: number) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const filas = await consultar(`
    SELECT mapa,
           SUM(matador_id = ? AND teamkill = 0) AS kills,
           SUM(victima_id = ?)                  AS muertes
    FROM {p}muertes
    WHERE matador_id = ? OR victima_id = ?
    GROUP BY mapa
    ORDER BY kills DESC
    LIMIT 8
  `, [id, id, id, id])
  return filas.map((f) => ({ mapa: String(f.mapa), kills: n(f.kills), muertes: n(f.muertes) }))
}

/* ------------------------------------------------------------------ */
/*  Donde pega: todos los impactos                                     */
/* ------------------------------------------------------------------ */

/** Suma de impactos por zona en todos los mapas, mas danio y disparos */
export async function impactosDeJugador (id: number) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const [f] = await consultar(`
    SELECT SUM(cabeza) AS cabeza, SUM(pecho) AS pecho, SUM(estomago) AS estomago,
           SUM(brazo_izq) AS brazo_izq, SUM(brazo_der) AS brazo_der,
           SUM(pierna_izq) AS pierna_izq, SUM(pierna_der) AS pierna_der,
           SUM(generico) AS generico, SUM(danio) AS danio, SUM(disparos) AS disparos
    FROM {p}impactos WHERE jugador_id = ?
  `, [id])
  return {
    zonas: {
      cabeza: n(f?.cabeza),
      pecho: n(f?.pecho),
      estomago: n(f?.estomago),
      brazo_izq: n(f?.brazo_izq),
      brazo_der: n(f?.brazo_der),
      pierna_izq: n(f?.pierna_izq),
      pierna_der: n(f?.pierna_der)
    },
    generico: n(f?.generico),
    danio: n(f?.danio),
    disparos: n(f?.disparos)
  }
}

/* ------------------------------------------------------------------ */
/*  Mapa de calor                                                      */
/* ------------------------------------------------------------------ */

/** Todos los mapas donde el jugador mato o murio, del mas jugado al menos jugado */
export async function mapasJugadosPor (id: number) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const filas = await consultar(`
    SELECT LOWER(mapa) AS mapa, COUNT(*) AS eventos
    FROM {p}muertes
    WHERE matador_id = ? OR victima_id = ?
    GROUP BY LOWER(mapa)
    ORDER BY eventos DESC
  `, [id, id])
  return filas.map((f) => ({ mapa: String(f.mapa), eventos: n(f.eventos) }))
}

export type TipoCalor = 'kills' | 'muertes'
export const MAX_PUNTOS_CALOR = 5000

/**
 * Coordenadas del mundo para el mapa de calor.
 *   kills:   desde donde disparaba el jugador cuando mato (sin teamkills)
 *   muertes: donde estaba cuando lo mataron (incluye suicidios y caidas)
 * Las mas recientes primero, con tope para no mandar de mas al navegador.
 */
export async function puntosDeCalor (id: number, mapa: string, tipo: TipoCalor): Promise<[number, number][]> {
  'use cache'
  cacheLife(VIDA_CACHE)

  /* Dos consultas fijas en vez de armar columnas con el tipo: nada del usuario entra al SQL */
  const filas = tipo === 'kills'
    ? await consultar(`
        SELECT matador_x AS x, matador_y AS y FROM {p}muertes
        WHERE matador_id = ? AND LOWER(mapa) = ? AND teamkill = 0 AND matador_x IS NOT NULL
        ORDER BY id DESC LIMIT ?`, [id, mapa.toLowerCase(), MAX_PUNTOS_CALOR])
    : await consultar(`
        SELECT victima_x AS x, victima_y AS y FROM {p}muertes
        WHERE victima_id = ? AND LOWER(mapa) = ?
        ORDER BY id DESC LIMIT ?`, [id, mapa.toLowerCase(), MAX_PUNTOS_CALOR])

  return filas.map((f) => [n(f.x), n(f.y)])
}

/* ------------------------------------------------------------------ */
/*  Comparacion                                                        */
/* ------------------------------------------------------------------ */

/** Cuantas veces a mato a b y b mato a a */
export async function enfrentamiento (a: number, b: number, v: Ventana = TODO) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const f = filtro(null, v)
  const [fila] = await consultar(`
    SELECT
      SUM(matador_id = ? AND victima_id = ?) AS a_sobre_b,
      SUM(matador_id = ? AND victima_id = ?) AS b_sobre_a
    FROM {p}muertes
    WHERE teamkill = 0 AND matador_id IN (?, ?) AND victima_id IN (?, ?) ${f.sql}
  `, [a, b, b, a, a, b, a, b, ...f.valores])
  return { aSobreB: n(fila?.a_sobre_b), bSobreA: n(fila?.b_sobre_a) }
}

/** Los mejores con un arma: top por kills, con sus headshots */
export async function rankingDeArma (arma: string, v: Ventana = TODO, limite = 10) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const f = filtro(null, v, 'm.')
  const filas = await consultar(`
    SELECT j.id, j.nick, COUNT(*) AS kills, SUM(m.headshot) AS headshots
    FROM {p}muertes m JOIN {p}jugadores j ON j.id = m.matador_id
    WHERE m.teamkill = 0 AND m.arma = ? ${f.sql}
    GROUP BY j.id, j.nick
    ORDER BY kills DESC, headshots DESC
    LIMIT ?
  `, [arma, ...f.valores, limite])
  return filas.map((r) => ({ id: n(r.id), nick: String(r.nick), kills: n(r.kills), headshots: n(r.headshots) }))
}

/** Totales de un arma en la ventana */
export async function resumenDeArma (arma: string, v: Ventana = TODO) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const f = filtro(null, v)
  const [fila] = await consultar(`
    SELECT COUNT(*) AS kills, SUM(headshot) AS headshots, COUNT(DISTINCT matador_id) AS jugadores
    FROM {p}muertes
    WHERE matador_id IS NOT NULL AND teamkill = 0 AND arma = ? ${f.sql}
  `, [arma, ...f.valores])
  return { kills: n(fila?.kills), headshots: n(fila?.headshots), jugadores: n(fila?.jugadores) }
}

/* ------------------------------------------------------------------ */
/*  Destacados del ranking                                             */
/* ------------------------------------------------------------------ */

/* Armas que son granadas, para "El Aero-Player" */
const GRANADAS = ['handgrenade', 'stickgrenade', 'mills_bomb', 'grenade']

export type Destacado = { id: number, nick: string, valor: number } | null

export type Destacados = {
  camper: Destacado
  granadas: Destacado
  banderas: Destacado
  teamkills: Destacado
  headshots: Destacado
}

/* Minimos para que un porcentaje signifique algo */
const MIN_KILLS_HEADSHOTS = 20

/**
 * El que mas se destaca en cada categoria dentro de la ventana. Cada consulta
 * devuelve una sola fila: el primero de su rubro.
 */
export async function destacados (v: Ventana = TODO): Promise<Destacados> {
  'use cache'
  cacheLife(VIDA_CACHE)

  const fm = filtro(null, v)
  const fp = filtro(null, v)
  const fa = filtro(null, v, 'a.', 'dia')
  const fse = filtro(null, v, 's.', 'desconexion')
  const marcadores = GRANADAS.map(() => '?').join(', ')

  const [camper, granadas, banderas, teamkills, headshots] = await Promise.all([
    /* Camper: mayor parte del tiempo jugado acostado, con un minimo de tiempo jugado */
    consultar(`
      SELECT j.id, j.nick, ROUND(100 * a.segundos / s.segundos) AS valor
      FROM (SELECT jugador_id, SUM(segundos) AS segundos FROM {p}acostado a WHERE 1 = 1 ${fa.sql} GROUP BY jugador_id) a
      JOIN (SELECT jugador_id, SUM(segundos) AS segundos FROM {p}sesiones s WHERE 1 = 1 ${fse.sql} GROUP BY jugador_id) s
        ON s.jugador_id = a.jugador_id
      JOIN {p}jugadores j ON j.id = a.jugador_id
      WHERE s.segundos >= ? AND a.segundos > 0
      ORDER BY a.segundos / s.segundos DESC LIMIT 1
    `, [...fa.valores, ...fse.valores, MIN_SEGUNDOS_CAMPER]),

    consultar(`
      SELECT j.id, j.nick, COUNT(*) AS valor
      FROM {p}muertes m JOIN {p}jugadores j ON j.id = m.matador_id
      WHERE m.teamkill = 0 AND m.arma IN (${marcadores}) ${filtro(null, v, 'm.').sql}
      GROUP BY j.id, j.nick ORDER BY valor DESC LIMIT 1
    `, [...GRANADAS, ...fm.valores]),

    consultar(`
      SELECT j.id, j.nick, COUNT(*) AS valor
      FROM {p}puntos p JOIN {p}jugadores j ON j.id = p.jugador_id
      WHERE 1 = 1 ${filtro(null, v, 'p.').sql}
      GROUP BY j.id, j.nick ORDER BY valor DESC LIMIT 1
    `, fp.valores),

    consultar(`
      SELECT j.id, j.nick, COUNT(*) AS valor
      FROM {p}muertes m JOIN {p}jugadores j ON j.id = m.matador_id
      WHERE m.teamkill = 1 ${filtro(null, v, 'm.').sql}
      GROUP BY j.id, j.nick ORDER BY valor DESC LIMIT 1
    `, fm.valores),

    consultar(`
      SELECT j.id, j.nick, ROUND(100 * SUM(m.headshot) / COUNT(*)) AS valor
      FROM {p}muertes m JOIN {p}jugadores j ON j.id = m.matador_id
      WHERE m.teamkill = 0 ${filtro(null, v, 'm.').sql}
      GROUP BY j.id, j.nick
      HAVING COUNT(*) >= ?
      ORDER BY SUM(m.headshot) / COUNT(*) DESC, COUNT(*) DESC LIMIT 1
    `, [...fm.valores, MIN_KILLS_HEADSHOTS])
  ])

  const uno = (filas: Record<string, unknown>[]): Destacado =>
    filas.length ? { id: n(filas[0].id), nick: String(filas[0].nick), valor: n(filas[0].valor) } : null

  return {
    camper: uno(camper),
    granadas: uno(granadas),
    banderas: uno(banderas),
    teamkills: uno(teamkills),
    headshots: uno(headshots)
  }
}

/* ------------------------------------------------------------------ */
/*  Eje vs Aliados                                                     */
/* ------------------------------------------------------------------ */

/*
 *  Quien gana se define por el marcador de cada partida (tabla partidas: los puntos
 *  de equipo por banderas y objetivos). Las kills son otra estadistica.
 *
 *  El equipo de las kills sale de cada muerte (matador_equipo, victima_equipo): un
 *  jugador puede jugar de los dos lados, y cada kill cuenta para el bando con el que
 *  la hizo. Lo mismo con los puntos de cada jugador. 1 = Aliados, 2 = Eje.
 *
 *  mapa null = todos los mapas. La ventana [desde, hasta) sale de lib/periodos.ts.
 */

export type Bando = { kills: number, muertes: number, headshots: number, teamkills: number, suicidios: number }
const bandoVacio = (): Bando => ({ kills: 0, muertes: 0, headshots: 0, teamkills: 0, suicidios: 0 })

/** Mapas con actividad en la ventana: muertes o partidas con marcador */
export async function mapasConActividad (v: Ventana = TODO) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const fm = filtro(null, v)
  const fp = filtro(null, v, '', 'inicio')
  const filas = await consultar(`
    SELECT mapa, SUM(partidas) AS partidas, SUM(muertes) AS muertes FROM (
      SELECT LOWER(mapa) AS mapa, 0 AS partidas, COUNT(*) AS muertes FROM {p}muertes WHERE 1 = 1 ${fm.sql} GROUP BY LOWER(mapa)
      UNION ALL
      SELECT LOWER(mapa), COUNT(*), 0 FROM {p}partidas WHERE 1 = 1 ${fp.sql} GROUP BY LOWER(mapa)
    ) x
    GROUP BY mapa ORDER BY partidas DESC, muertes DESC
  `, [...fm.valores, ...fp.valores])
  return filas.map((f) => ({ mapa: String(f.mapa), partidas: n(f.partidas), muertes: n(f.muertes) }))
}

/** Resultado por marcadores: mapas ganados por cada bando y puntos sumados */
export async function marcadorDeBandos (mapa: string | null, v: Ventana = TODO) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const f = filtro(mapa, v, '', 'inicio')
  const [fila] = await consultar(`
    SELECT COUNT(*) AS partidas,
           SUM(aliados > eje) AS ganados_aliados, SUM(eje > aliados) AS ganados_eje, SUM(aliados = eje) AS empates,
           SUM(aliados) AS puntos_aliados, SUM(eje) AS puntos_eje
    FROM {p}partidas WHERE 1 = 1 ${f.sql}
  `, f.valores)
  return {
    partidas: n(fila?.partidas),
    ganadosAliados: n(fila?.ganados_aliados),
    ganadosEje: n(fila?.ganados_eje),
    empates: n(fila?.empates),
    puntosAliados: n(fila?.puntos_aliados),
    puntosEje: n(fila?.puntos_eje)
  }
}

/** Puntos de jugadores (banderas y objetivos) sumados por bando */
export async function puntosDeJugadoresPorBando (mapa: string | null, v: Ventana = TODO) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const f = filtro(mapa, v)
  const filas = await consultar(`
    SELECT equipo, SUM(puntos) AS puntos FROM {p}puntos WHERE equipo IN (1, 2) ${f.sql} GROUP BY equipo
  `, f.valores)
  const de = (e: number) => n(filas.find((r) => n(r.equipo) === e)?.puntos)
  return { aliados: de(1), eje: de(2) }
}

export async function duelo (mapa: string | null, v: Ventana = TODO): Promise<{ aliados: Bando, eje: Bando }> {
  'use cache'
  cacheLife(VIDA_CACHE)

  const f = filtro(mapa, v)
  const [ataque, defensa] = await Promise.all([
    consultar(`
      SELECT matador_equipo AS equipo,
             SUM(teamkill = 0)                  AS kills,
             SUM(teamkill = 0 AND headshot = 1) AS headshots,
             SUM(teamkill = 1)                  AS teamkills
      FROM {p}muertes
      WHERE matador_id IS NOT NULL AND matador_equipo IN (1, 2) ${f.sql}
      GROUP BY matador_equipo
    `, f.valores),
    consultar(`
      SELECT victima_equipo AS equipo, COUNT(*) AS muertes, SUM(matador_id IS NULL) AS suicidios
      FROM {p}muertes
      WHERE victima_equipo IN (1, 2) ${f.sql}
      GROUP BY victima_equipo
    `, f.valores)
  ])

  const bandos = { 1: bandoVacio(), 2: bandoVacio() } as Record<number, Bando>
  for (const r of ataque) {
    const b = bandos[n(r.equipo)]
    if (b) { b.kills = n(r.kills); b.headshots = n(r.headshots); b.teamkills = n(r.teamkills) }
  }
  for (const r of defensa) {
    const b = bandos[n(r.equipo)]
    if (b) { b.muertes = n(r.muertes); b.suicidios = n(r.suicidios) }
  }
  return { aliados: bandos[1], eje: bandos[2] }
}

export type Figura = { id: number, nick: string, puntos: number, kills: number }

/** Los que mas aportaron a cada bando: primero por puntos, despues por kills */
export async function figurasPorBando (mapa: string | null, v: Ventana = TODO) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const fk = filtro(mapa, v, 'm.')
  const fp = filtro(mapa, v, 'p.')
  const filas = await consultar(`
    SELECT x.equipo, j.id, j.nick, SUM(x.puntos) AS puntos, SUM(x.kills) AS kills FROM (
      SELECT m.matador_equipo AS equipo, m.matador_id AS jugador_id, 0 AS puntos, COUNT(*) AS kills
      FROM {p}muertes m
      WHERE m.teamkill = 0 AND m.matador_id IS NOT NULL AND m.matador_equipo IN (1, 2) ${fk.sql}
      GROUP BY m.matador_equipo, m.matador_id
      UNION ALL
      SELECT p.equipo, p.jugador_id, SUM(p.puntos), 0
      FROM {p}puntos p
      WHERE p.equipo IN (1, 2) ${fp.sql}
      GROUP BY p.equipo, p.jugador_id
    ) x
    JOIN {p}jugadores j ON j.id = x.jugador_id
    GROUP BY x.equipo, j.id, j.nick
    ORDER BY puntos DESC, kills DESC
  `, [...fk.valores, ...fp.valores])
  const top = (equipo: number): Figura[] => filas.filter((r) => n(r.equipo) === equipo).slice(0, 5)
    .map((r) => ({ id: n(r.id), nick: String(r.nick), puntos: n(r.puntos), kills: n(r.kills) }))
  return { aliados: top(1), eje: top(2) }
}

export async function armasPorBando (mapa: string | null, v: Ventana = TODO) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const f = filtro(mapa, v)
  const filas = await consultar(`
    SELECT matador_equipo AS equipo, arma, COUNT(*) AS kills
    FROM {p}muertes
    WHERE matador_id IS NOT NULL AND teamkill = 0 AND matador_equipo IN (1, 2) ${f.sql}
    GROUP BY matador_equipo, arma
    ORDER BY kills DESC
  `, f.valores)
  const top = (equipo: number) => filas.filter((r) => n(r.equipo) === equipo).slice(0, 6)
    .map((r) => ({ arma: String(r.arma), kills: n(r.kills) }))
  return { aliados: top(1), eje: top(2) }
}

/** Mapa por mapa: partidas, mapas ganados, puntos y kills de cada bando */
export async function balancePorMapa (v: Ventana = TODO) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const fm = filtro(null, v)
  const fp = filtro(null, v, '', 'inicio')
  const filas = await consultar(`
    SELECT mapa,
           SUM(partidas) AS partidas, SUM(ganados_aliados) AS ganados_aliados, SUM(ganados_eje) AS ganados_eje,
           SUM(puntos_aliados) AS puntos_aliados, SUM(puntos_eje) AS puntos_eje,
           SUM(kills_aliados) AS kills_aliados, SUM(kills_eje) AS kills_eje
    FROM (
      SELECT LOWER(mapa) AS mapa, 0 AS partidas, 0 AS ganados_aliados, 0 AS ganados_eje, 0 AS puntos_aliados, 0 AS puntos_eje,
             SUM(matador_equipo = 1 AND teamkill = 0 AND matador_id IS NOT NULL) AS kills_aliados,
             SUM(matador_equipo = 2 AND teamkill = 0 AND matador_id IS NOT NULL) AS kills_eje
      FROM {p}muertes WHERE 1 = 1 ${fm.sql} GROUP BY LOWER(mapa)
      UNION ALL
      SELECT LOWER(mapa), COUNT(*), SUM(aliados > eje), SUM(eje > aliados), SUM(aliados), SUM(eje), 0, 0
      FROM {p}partidas WHERE 1 = 1 ${fp.sql} GROUP BY LOWER(mapa)
    ) x
    GROUP BY mapa
    ORDER BY partidas DESC, (kills_aliados + kills_eje) DESC
  `, [...fm.valores, ...fp.valores])
  return filas.map((r) => ({
    mapa: String(r.mapa),
    partidas: n(r.partidas),
    ganadosAliados: n(r.ganados_aliados),
    ganadosEje: n(r.ganados_eje),
    puntosAliados: n(r.puntos_aliados),
    puntosEje: n(r.puntos_eje),
    killsAliados: n(r.kills_aliados),
    killsEje: n(r.kills_eje)
  }))
}

/*
 *  Historial semana a semana o mes a mes. Las fechas se pasan a hora argentina en
 *  el SQL (mismo corrimiento que lib/periodos.ts): la semana arranca el lunes
 *  (WEEKDAY = 0) y la clave coincide con la de rangoDe().
 */
const CLAVE_SQL = {
  semana: (col: string) => `DATE_FORMAT(DATE(${col} + INTERVAL ${HORAS_ARGENTINA} HOUR) - INTERVAL WEEKDAY(${col} + INTERVAL ${HORAS_ARGENTINA} HOUR) DAY, '%Y-%m-%d')`,
  mes: (col: string) => `DATE_FORMAT(${col} + INTERVAL ${HORAS_ARGENTINA} HOUR, '%Y-%m')`
}

export async function historial (tipo: 'semana' | 'mes', mapa: string | null, desde: string): Promise<Record<string, Balance>> {
  'use cache'
  cacheLife(VIDA_CACHE)

  const v: Ventana = { desde, hasta: null }
  const fm = filtro(mapa, v)
  const fp = filtro(mapa, v, '', 'inicio')
  const [muertes, partidas] = await Promise.all([
    consultar(`
      SELECT ${CLAVE_SQL[tipo]('momento')} AS clave,
             SUM(matador_equipo = 1 AND teamkill = 0 AND matador_id IS NOT NULL) AS kills_aliados,
             SUM(matador_equipo = 2 AND teamkill = 0 AND matador_id IS NOT NULL) AS kills_eje
      FROM {p}muertes WHERE 1 = 1 ${fm.sql} GROUP BY clave
    `, fm.valores),
    consultar(`
      SELECT ${CLAVE_SQL[tipo]('inicio')} AS clave, COUNT(*) AS partidas,
             SUM(aliados > eje) AS ganados_aliados, SUM(eje > aliados) AS ganados_eje,
             SUM(aliados) AS puntos_aliados, SUM(eje) AS puntos_eje
      FROM {p}partidas WHERE 1 = 1 ${fp.sql} GROUP BY clave
    `, fp.valores)
  ])

  const porClave: Record<string, Balance> = {}
  const de = (clave: string) => (porClave[clave] ??= {
    partidas: 0, ganadosAliados: 0, ganadosEje: 0, puntosAliados: 0, puntosEje: 0, killsAliados: 0, killsEje: 0
  })
  for (const r of muertes) Object.assign(de(String(r.clave)), { killsAliados: n(r.kills_aliados), killsEje: n(r.kills_eje) })
  for (const r of partidas) {
    Object.assign(de(String(r.clave)), {
      partidas: n(r.partidas),
      ganadosAliados: n(r.ganados_aliados),
      ganadosEje: n(r.ganados_eje),
      puntosAliados: n(r.puntos_aliados),
      puntosEje: n(r.puntos_eje)
    })
  }
  return porClave
}

/* ------------------------------------------------------------------ */
/*  Armas                                                              */
/* ------------------------------------------------------------------ */

export async function armas (v: Ventana = TODO) {
  'use cache'
  cacheLife(VIDA_CACHE)

  const f = filtro(null, v)
  const filas = await consultar(`
    SELECT arma,
           COUNT(*)                   AS kills,
           SUM(headshot)              AS headshots,
           COUNT(DISTINCT matador_id) AS jugadores
    FROM {p}muertes
    WHERE matador_id IS NOT NULL AND teamkill = 0 ${f.sql}
    GROUP BY arma
    ORDER BY kills DESC
  `, f.valores)
  return filas.map((f) => ({
    arma: String(f.arma),
    kills: n(f.kills),
    headshots: n(f.headshots),
    jugadores: n(f.jugadores)
  }))
}
