import 'server-only'
import { cacheLife } from 'next/cache'
import { consultar } from './db'
import { MIN_KILLS_PORCENTAJES } from './calculos'

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
    segundos: n(f.segundos_jugados)
  }
}

/* ------------------------------------------------------------------ */
/*  General                                                            */
/* ------------------------------------------------------------------ */

export async function resumenGeneral () {
  'use cache'
  cacheLife('minutes')

  const [totales] = await consultar(`
    SELECT
      (SELECT COUNT(*) FROM {p}ranking WHERE kills + muertes > 0)              AS jugadores,
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

export type Orden = 'kills' | 'kd' | 'hs' | 'tiempo'

/* Lista cerrada: el orden llega por la URL y NUNCA se interpola tal cual en el SQL */
const ORDENES: Record<Orden, { sql: string, soloConMinimo: boolean }> = {
  kills: { sql: 'kills DESC, muertes ASC', soloConMinimo: false },
  kd: { sql: 'kills / GREATEST(muertes, 1) DESC, kills DESC', soloConMinimo: true },
  hs: { sql: 'headshots / GREATEST(kills, 1) DESC, kills DESC', soloConMinimo: true },
  tiempo: { sql: 'segundos_jugados DESC', soloConMinimo: false }
}

export function esOrden (valor: unknown): valor is Orden {
  return typeof valor === 'string' && valor in ORDENES
}

export async function ranking (orden: Orden): Promise<Jugador[]> {
  'use cache'
  cacheLife('minutes')

  const { sql, soloConMinimo } = ORDENES[orden]
  const filas = await consultar(`
    SELECT * FROM {p}ranking
    WHERE kills + muertes > 0 ${soloConMinimo ? 'AND kills >= ?' : ''}
    ORDER BY ${sql}, id
    LIMIT 200
  `, soloConMinimo ? [MIN_KILLS_PORCENTAJES] : [])

  return filas.map(aJugador)
}

export async function listaJugadores (): Promise<{ id: number, nick: string }[]> {
  'use cache'
  cacheLife('minutes')

  const filas = await consultar(`
    SELECT id, nick FROM {p}ranking WHERE kills + muertes > 0 ORDER BY nick
  `)
  return filas.map((f) => ({ id: n(f.id), nick: String(f.nick) }))
}

/* ------------------------------------------------------------------ */
/*  Perfil de jugador                                                  */
/* ------------------------------------------------------------------ */

export async function jugador (id: number): Promise<JugadorDetalle | null> {
  'use cache'
  cacheLife('minutes')

  const [fila] = await consultar(`SELECT * FROM {p}ranking WHERE id = ?`, [id])
  if (!fila) return null
  return { ...aJugador(fila), primeraVez: iso(fila.primera_vez), ultimaVez: iso(fila.ultima_vez) }
}

export async function armasDeJugador (id: number) {
  'use cache'
  cacheLife('minutes')

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
  cacheLife('minutes')

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
  cacheLife('minutes')

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
  cacheLife('minutes')

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
  cacheLife('minutes')

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
  cacheLife('minutes')

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
  cacheLife('minutes')

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
export async function enfrentamiento (a: number, b: number) {
  'use cache'
  cacheLife('minutes')

  const [fila] = await consultar(`
    SELECT
      SUM(matador_id = ? AND victima_id = ?) AS a_sobre_b,
      SUM(matador_id = ? AND victima_id = ?) AS b_sobre_a
    FROM {p}muertes
    WHERE teamkill = 0 AND matador_id IN (?, ?) AND victima_id IN (?, ?)
  `, [a, b, b, a, a, b, a, b])
  return { aSobreB: n(fila?.a_sobre_b), bSobreA: n(fila?.b_sobre_a) }
}

/* ------------------------------------------------------------------ */
/*  Eje vs Aliados                                                     */
/* ------------------------------------------------------------------ */

/*
 *  El equipo sale de cada muerte (matador_equipo, victima_equipo): un jugador puede
 *  jugar de los dos lados, y cada kill cuenta para el bando con el que la hizo.
 *  1 = Aliados, 2 = Eje. mapa null = todos los mapas.
 */

export type Bando = { kills: number, muertes: number, headshots: number, teamkills: number, suicidios: number }
const bandoVacio = (): Bando => ({ kills: 0, muertes: 0, headshots: 0, teamkills: 0, suicidios: 0 })

/*
 *  Periodo: ventana movil hacia atras desde ahora. Los momentos se guardan en UTC
 *  (timezone 'Z' en la conexion), por eso se compara contra UTC_TIMESTAMP().
 */
export const PERIODOS = ['semana', 'mes', 'global'] as const
export type Periodo = typeof PERIODOS[number]
const DIAS_PERIODO: Record<Periodo, number | null> = { semana: 7, mes: 30, global: null }

/*
 *  Filtro de mapa y periodo como fragmentos fijos + parametros: el nombre del mapa
 *  nunca entra al SQL y los dias salen de una tabla propia, no de la URL.
 *  alias = prefijo de tabla cuando la consulta tiene JOIN.
 */
function filtro (mapa: string | null, periodo: Periodo, alias = '', columnaFecha = 'momento') {
  const dias = DIAS_PERIODO[periodo]
  const partes: string[] = []
  const valores: (string | number)[] = []
  if (mapa) { partes.push(`AND LOWER(${alias}mapa) = ?`); valores.push(mapa.toLowerCase()) }
  if (dias) { partes.push(`AND ${alias}${columnaFecha} >= UTC_TIMESTAMP() - INTERVAL ? DAY`); valores.push(dias) }
  return { sql: partes.join(' '), valores }
}

export async function mapasConMuertes (periodo: Periodo = 'global') {
  'use cache'
  cacheLife('minutes')

  const f = filtro(null, periodo)
  const filas = await consultar(`
    SELECT LOWER(mapa) AS mapa, COUNT(*) AS muertes FROM {p}muertes
    WHERE 1 = 1 ${f.sql}
    GROUP BY LOWER(mapa) ORDER BY muertes DESC
  `, f.valores)
  return filas.map((f) => ({ mapa: String(f.mapa), muertes: n(f.muertes) }))
}

export async function duelo (mapa: string | null, periodo: Periodo = 'global'): Promise<{ aliados: Bando, eje: Bando }> {
  'use cache'
  cacheLife('minutes')

  const f = filtro(mapa, periodo)
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

/** Los que mas mataron jugando para cada bando */
export async function figurasPorBando (mapa: string | null, periodo: Periodo = 'global') {
  'use cache'
  cacheLife('minutes')

  const f = filtro(mapa, periodo, 'm.')
  const filas = await consultar(`
    SELECT m.matador_equipo AS equipo, j.id, j.nick, COUNT(*) AS kills
    FROM {p}muertes m
    JOIN {p}jugadores j ON j.id = m.matador_id
    WHERE m.teamkill = 0 AND m.matador_equipo IN (1, 2) ${f.sql}
    GROUP BY m.matador_equipo, j.id, j.nick
    ORDER BY kills DESC
  `, f.valores)
  const top = (equipo: number) => filas.filter((r) => n(r.equipo) === equipo).slice(0, 5)
    .map((r) => ({ id: n(r.id), nick: String(r.nick), kills: n(r.kills) }))
  return { aliados: top(1), eje: top(2) }
}

export async function armasPorBando (mapa: string | null, periodo: Periodo = 'global') {
  'use cache'
  cacheLife('minutes')

  const f = filtro(mapa, periodo)
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

/** Mapa por mapa: veces jugado y kills de cada bando */
export async function balancePorMapa (periodo: Periodo = 'global') {
  'use cache'
  cacheLife('minutes')

  const fm = filtro(null, periodo)
  const fj = filtro(null, periodo, '', 'inicio')
  const filas = await consultar(`
    SELECT k.mapa, k.aliados, k.eje, COALESCE(p.veces, 0) AS veces
    FROM (
      SELECT LOWER(mapa) AS mapa,
             SUM(matador_equipo = 1 AND teamkill = 0 AND matador_id IS NOT NULL) AS aliados,
             SUM(matador_equipo = 2 AND teamkill = 0 AND matador_id IS NOT NULL) AS eje
      FROM {p}muertes WHERE 1 = 1 ${fm.sql} GROUP BY LOWER(mapa)
    ) k
    LEFT JOIN (
      SELECT LOWER(mapa) AS mapa, COUNT(*) AS veces FROM {p}mapas_jugados
      WHERE 1 = 1 ${fj.sql} GROUP BY LOWER(mapa)
    ) p ON p.mapa = k.mapa
    ORDER BY (k.aliados + k.eje) DESC
  `, [...fm.valores, ...fj.valores])
  return filas.map((r) => ({ mapa: String(r.mapa), aliados: n(r.aliados), eje: n(r.eje), veces: n(r.veces) }))
}

/* ------------------------------------------------------------------ */
/*  Armas                                                              */
/* ------------------------------------------------------------------ */

export async function armas () {
  'use cache'
  cacheLife('minutes')

  const filas = await consultar(`
    SELECT arma,
           COUNT(*)                   AS kills,
           SUM(headshot)              AS headshots,
           COUNT(DISTINCT matador_id) AS jugadores
    FROM {p}muertes
    WHERE matador_id IS NOT NULL AND teamkill = 0
    GROUP BY arma
    ORDER BY kills DESC
  `)
  return filas.map((f) => ({
    arma: String(f.arma),
    kills: n(f.kills),
    headshots: n(f.headshots),
    jugadores: n(f.jugadores)
  }))
}
