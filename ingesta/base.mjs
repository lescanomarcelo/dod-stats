/*
 *  Acceso a la base de stats.
 *
 *  Toda escritura de eventos pasa por guardarLote(), que mete los eventos y el
 *  nuevo offset del archivo en UNA transaccion. Si algo falla a mitad de camino,
 *  rollback: no quedan eventos a medias y el offset no avanza, asi que la proxima
 *  pasada reintenta el mismo tramo. Nunca se duplica ni se pierde una muerte.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { identidadDe } from './identidad.mjs'
import { ZONAS } from './parsear.mjs'

const RUTA_ESQUEMA = fileURLToPath(new URL('./esquema.sql', import.meta.url))
/* En orden de borrado: las que apuntan a jugadores, antes que jugadores */
const TABLAS = ['muertes', 'sesiones', 'impactos', 'mapas_jugados', 'ingesta_estado', 'jugadores']
const FILAS_POR_INSERT = 500

/* Recorta a lo que entra en la columna. Un dato raro no puede trabar la ingesta:
   si un INSERT falla por un campo largo, el lote entero hace rollback y el offset
   no avanza nunca. */
const recortar = (texto, largo) => String(texto ?? '').slice(0, largo)
const fecha = (ts) => new Date(ts * 1000)

export function configDesdeEntorno () {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  }
}

export async function conectar (config, prefijo = '') {
  if (!/^[a-z0-9_]*$/.test(prefijo)) throw new Error(`prefijo invalido: ${prefijo}`)

  const conexion = await mysql.createConnection({
    ...config,
    timezone: 'Z',
    charset: 'utf8mb4',
    multipleStatements: false
  })

  const t = (nombre) => `\`${prefijo}${nombre}\``

  /* ---------------------------------------------------------------- */
  /*  Esquema                                                         */
  /* ---------------------------------------------------------------- */

  async function aplicarEsquema () {
    const sql = (await readFile(RUTA_ESQUEMA, 'utf8')).replaceAll('{p}', prefijo)
    const sentencias = sql
      .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
      .split(';').map((s) => s.trim()).filter(Boolean)
    for (const sentencia of sentencias) await conexion.query(sentencia)
  }

  /** Borra las tablas de ESTE prefijo. Se niega a correr sin prefijo: jamas toca produccion. */
  async function borrarTablas () {
    if (!prefijo) throw new Error('borrarTablas() sin prefijo: se negaria a borrar produccion')
    await conexion.query(`DROP VIEW IF EXISTS ${t('ranking')}`)
    for (const tabla of TABLAS) await conexion.query(`DROP TABLE IF EXISTS ${t(tabla)}`)
  }

  /* ---------------------------------------------------------------- */
  /*  Candado                                                         */
  /* ---------------------------------------------------------------- */

  /* Dos ingestas en paralelo leerian el mismo offset y cargarian los mismos
     eventos dos veces: la transaccion sola no lo evita. Un candado con nombre
     de MySQL garantiza que corra una sola a la vez, sin importar desde donde
     se lance (GitHub Actions, a mano, dos terminales). Se libera solo si la
     conexion se corta. */
  const nombreCandado = `${config.database}.${prefijo}ingesta`

  async function tomarCandado () {
    const [[fila]] = await conexion.query('SELECT GET_LOCK(?, 0) AS ok', [nombreCandado])
    return fila.ok === 1
  }

  async function soltarCandado () {
    await conexion.query('SELECT RELEASE_LOCK(?)', [nombreCandado])
  }

  /* ---------------------------------------------------------------- */
  /*  Offsets                                                         */
  /* ---------------------------------------------------------------- */

  async function leerOffset (archivo) {
    const [filas] = await conexion.query(
      `SELECT bytes_procesados FROM ${t('ingesta_estado')} WHERE archivo = ?`, [archivo])
    return filas.length ? Number(filas[0].bytes_procesados) : 0
  }

  /* ---------------------------------------------------------------- */
  /*  Escritura                                                       */
  /* ---------------------------------------------------------------- */

  /** Crea o actualiza al jugador y devuelve su id. El nick queda el mas reciente. */
  async function asegurarJugador (cache, steamid, nick, ts) {
    const quien = identidadDe(steamid, nick)
    if (!quien) return null

    if (cache.has(quien.identidad)) {
      const guardado = cache.get(quien.identidad)
      if (ts >= guardado.ts) { guardado.ts = ts; guardado.nick = nick }
      return guardado.id
    }

    const momento = fecha(ts)
    /* El orden de las asignaciones importa: nick se compara contra la ultima_vez
       VIEJA, por eso va antes de actualizar ultima_vez. */
    const [resultado] = await conexion.query(
      `INSERT INTO ${t('jugadores')} (identidad, steamid, nick, primera_vez, ultima_vez)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         id          = LAST_INSERT_ID(id),
         nick        = IF(VALUES(ultima_vez) >= ultima_vez, VALUES(nick), nick),
         primera_vez = LEAST(primera_vez, VALUES(primera_vez)),
         ultima_vez  = GREATEST(ultima_vez, VALUES(ultima_vez))`,
      [recortar(quien.identidad, 80), quien.steamid, recortar(nick, 64), momento, momento])

    cache.set(quien.identidad, { id: resultado.insertId, ts, nick, momento })
    return resultado.insertId
  }

  async function insertarEnTandas (tabla, columnas, filas) {
    for (let i = 0; i < filas.length; i += FILAS_POR_INSERT) {
      await conexion.query(
        `INSERT INTO ${t(tabla)} (${columnas.join(', ')}) VALUES ?`,
        [filas.slice(i, i + FILAS_POR_INSERT)])
    }
  }

  /* Las lineas H traen diferencias: se suman a la fila (jugador, mapa). Si en el
     mismo INSERT vienen dos filas con la misma clave, MySQL las aplica en orden y
     la segunda suma sobre la primera. */
  const COLUMNAS_IMPACTOS = ['jugador_id', 'mapa', ...ZONAS, 'danio', 'disparos', 'actualizado']
  const SUMAS_IMPACTOS = [...ZONAS, 'danio', 'disparos'].map((c) => `${c} = ${c} + VALUES(${c})`).join(', ')

  async function acumularImpactos (filas) {
    for (let i = 0; i < filas.length; i += FILAS_POR_INSERT) {
      await conexion.query(
        `INSERT INTO ${t('impactos')} (${COLUMNAS_IMPACTOS.join(', ')}) VALUES ?
         ON DUPLICATE KEY UPDATE ${SUMAS_IMPACTOS}, actualizado = GREATEST(actualizado, VALUES(actualizado))`,
        [filas.slice(i, i + FILAS_POR_INSERT)])
    }
  }

  /**
   * Guarda un lote de eventos y el nuevo offset del archivo, todo o nada.
   * Devuelve cuantos eventos se guardaron y cuantos se ignoraron (bots).
   *
   * opciones.fallarAntesDeConfirmar: solo para tests, simula un corte justo antes del COMMIT.
   */
  async function guardarLote (archivo, nuevoOffset, eventos, descartadas, opciones = {}) {
    const resumen = { muertes: 0, sesiones: 0, mapas: 0, impactos: 0, ignorados: 0 }

    await conexion.beginTransaction()
    try {
      const cache = new Map()
      const muertes = []
      const sesiones = []
      const mapas = []
      const impactos = []

      for (const e of eventos) {
        if (e.tipo === 'inicio_mapa') {
          mapas.push([recortar(e.mapa, 40), fecha(e.ts)])
          continue
        }

        if (e.tipo === 'impactos') {
          const id = await asegurarJugador(cache, e.steamid, e.nick, e.ts)
          if (!id) { resumen.ignorados++; continue }
          impactos.push([id, recortar(e.mapa, 40).toLowerCase(), ...ZONAS.map((z) => e.impactos[z]),
            e.danio, e.disparos, fecha(e.ts)])
          continue
        }

        if (e.tipo === 'conexion') {
          if (!await asegurarJugador(cache, e.steamid, e.nick, e.ts)) resumen.ignorados++
          continue
        }

        if (e.tipo === 'desconexion') {
          const id = await asegurarJugador(cache, e.steamid, e.nick, e.ts)
          if (id) sesiones.push([id, fecha(e.ts), Math.max(0, e.segundos)])
          else resumen.ignorados++
          continue
        }

        /* Muerte. Si participa un bot, se ignora entera: no cuenta ni para uno ni para otro.
           Se chequea ANTES de tocar la base, para no dejar creado al humano de una
           muerte que despues se descarta. */
        const hayBot = !identidadDe(e.victima.steamid, e.victima.nick) ||
                       (e.matador && !identidadDe(e.matador.steamid, e.matador.nick))
        if (hayBot) { resumen.ignorados++; continue }

        const victimaId = await asegurarJugador(cache, e.victima.steamid, e.victima.nick, e.ts)
        const matadorId = e.matador
          ? await asegurarJugador(cache, e.matador.steamid, e.matador.nick, e.ts)
          : null

        muertes.push([
          fecha(e.ts), recortar(e.mapa, 40),
          matadorId, victimaId,
          e.matador ? e.matador.equipo : null, e.victima.equipo,
          recortar(e.arma, 32), e.hitbox, e.headshot ? 1 : 0, e.teamkill ? 1 : 0,
          e.victima.x, e.victima.y, e.victima.z,
          e.matador ? e.matador.x : null, e.matador ? e.matador.y : null, e.matador ? e.matador.z : null
        ])
      }

      /* El nick definitivo de cada jugador es el del evento mas reciente del lote */
      for (const [, j] of cache) {
        await conexion.query(
          `UPDATE ${t('jugadores')} SET nick = IF(? >= ultima_vez, ?, nick),
             ultima_vez = GREATEST(ultima_vez, ?) WHERE id = ?`,
          [fecha(j.ts), recortar(j.nick, 64), fecha(j.ts), j.id])
      }

      await insertarEnTandas('muertes', [
        'momento', 'mapa', 'matador_id', 'victima_id', 'matador_equipo', 'victima_equipo',
        'arma', 'hitbox', 'headshot', 'teamkill',
        'victima_x', 'victima_y', 'victima_z', 'matador_x', 'matador_y', 'matador_z'
      ], muertes)
      await insertarEnTandas('sesiones', ['jugador_id', 'desconexion', 'segundos'], sesiones)
      await insertarEnTandas('mapas_jugados', ['mapa', 'inicio'], mapas)
      await acumularImpactos(impactos)

      await conexion.query(
        `INSERT INTO ${t('ingesta_estado')}
           (archivo, bytes_procesados, eventos_totales, descartadas_totales, actualizado)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
           bytes_procesados    = VALUES(bytes_procesados),
           eventos_totales     = eventos_totales + VALUES(eventos_totales),
           descartadas_totales = descartadas_totales + VALUES(descartadas_totales),
           actualizado         = VALUES(actualizado)`,
        [archivo, nuevoOffset, eventos.length, descartadas])

      if (opciones.fallarAntesDeConfirmar) throw new Error('corte simulado antes del COMMIT')

      await conexion.commit()

      resumen.muertes = muertes.length
      resumen.sesiones = sesiones.length
      resumen.mapas = mapas.length
      resumen.impactos = impactos.length
      return resumen
    } catch (error) {
      await conexion.rollback()
      throw error
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Lectura                                                         */
  /* ---------------------------------------------------------------- */

  async function ranking () {
    const [filas] = await conexion.query(`SELECT * FROM ${t('ranking')} ORDER BY kills DESC, id`)
    return filas.map((f) => ({
      ...f,
      kills: Number(f.kills),
      headshots: Number(f.headshots),
      teamkills: Number(f.teamkills),
      muertes: Number(f.muertes),
      suicidios: Number(f.suicidios),
      segundos_jugados: Number(f.segundos_jugados)
    }))
  }

  async function contar (tabla) {
    const [filas] = await conexion.query(`SELECT COUNT(*) AS n FROM ${t(tabla)}`)
    return Number(filas[0].n)
  }

  async function consultar (sql, valores = []) {
    const [filas] = await conexion.query(sql.replaceAll('{p}', prefijo), valores)
    return filas
  }

  return {
    prefijo,
    aplicarEsquema,
    borrarTablas,
    tomarCandado,
    soltarCandado,
    leerOffset,
    guardarLote,
    ranking,
    contar,
    consultar,
    cerrar: () => conexion.end()
  }
}
