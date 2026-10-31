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
import { ARMAS_DELATORAS, clasificarSesiones } from './gungame.mjs'
import { tamanoDe } from './tamano_mapas.mjs'

const RUTA_ESQUEMA = fileURLToPath(new URL('./esquema.sql', import.meta.url))
/* En orden de borrado: las que apuntan a jugadores, antes que jugadores */
const TABLAS = ['muertes', 'sesiones', 'impactos', 'acostado', 'jugado', 'puntos', 'comandos', 'kicks', 'admin_logins', 'gungame_ganadas', 'votos_mapas', 'mapas_catalogo', 'visitas', 'partidas', 'mapas_jugados', 'admines', 'ingesta_estado', 'jugadores']
const FILAS_POR_INSERT = 500

/* Recorta a lo que entra en la columna. Un dato raro no puede trabar la ingesta:
   si un INSERT falla por un campo largo, el lote entero hace rollback y el offset
   no avanza nunca. */
const recortar = (texto, largo) => String(texto ?? '').slice(0, largo)
const fecha = (ts) => new Date(ts * 1000)

/* Argentina es UTC-3 todo el año (igual que sitio/lib/periodos.ts) */
const MS_DESFASE_ARGENTINA = -3 * 3600 * 1000
const MS_DIA = 86400 * 1000
/* Medianoche argentina del dia en que cayo ts, como instante UTC */
const diaArgentino = (ts) =>
  new Date(Math.floor((ts * 1000 + MS_DESFASE_ARGENTINA) / MS_DIA) * MS_DIA - MS_DESFASE_ARGENTINA)

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

  /* Cada linea E pisa el marcador de su partida, salvo que sea mas vieja que el
     guardado (una re-carga fuera de orden no puede volver atras el resultado) */
/* Las lineas A y J traen diferencias: se suman a la fila (jugador, mapa, dia) */
  async function acumularSegundos (tabla, filas) {
    for (let i = 0; i < filas.length; i += FILAS_POR_INSERT) {
      await conexion.query(
        `INSERT INTO ${t(tabla)} (jugador_id, mapa, dia, segundos, actualizado) VALUES ?
         ON DUPLICATE KEY UPDATE segundos = segundos + VALUES(segundos), actualizado = GREATEST(actualizado, VALUES(actualizado))`,
        [filas.slice(i, i + FILAS_POR_INSERT)])
    }
  }

  async function guardarMarcadores (filas) {
    for (let i = 0; i < filas.length; i += FILAS_POR_INSERT) {
      await conexion.query(
        `INSERT INTO ${t('partidas')} (mapa, inicio, fin, aliados, eje) VALUES ?
         ON DUPLICATE KEY UPDATE
           aliados = IF(VALUES(fin) >= fin, VALUES(aliados), aliados),
           eje     = IF(VALUES(fin) >= fin, VALUES(eje), eje),
           fin     = GREATEST(fin, VALUES(fin))`,
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
    const resumen = { muertes: 0, sesiones: 0, mapas: 0, impactos: 0, acostado: 0, jugado: 0, puntos: 0, marcadores: 0, comandos: 0, kicks: 0, ignorados: 0 }

    await conexion.beginTransaction()
    try {
      const cache = new Map()
      const muertes = []
      const sesiones = []
      const mapas = []
      const impactos = []
      const puntos = []
      const acostado = []
      const jugado = []
      const marcadores = []
      const comandos = []
      const kicks = []

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

        if (e.tipo === 'puntos') {
          const id = await asegurarJugador(cache, e.steamid, e.nick, e.ts)
          if (!id) { resumen.ignorados++; continue }
          puntos.push([fecha(e.ts), recortar(e.mapa, 40).toLowerCase(), id, e.equipo, Math.min(e.puntos, 65535)])
          continue
        }

        if (e.tipo === 'acostado' || e.tipo === 'jugado') {
          const id = await asegurarJugador(cache, e.steamid, e.nick, e.ts)
          if (!id) { resumen.ignorados++; continue }
          const fila = [id, recortar(e.mapa, 40).toLowerCase(), diaArgentino(e.ts), e.segundos, fecha(e.ts)]
          ;(e.tipo === 'acostado' ? acostado : jugado).push(fila)
          continue
        }

        if (e.tipo === 'marcador') {
          marcadores.push([recortar(e.mapa, 40).toLowerCase(), fecha(e.inicio), fecha(e.ts),
            Math.min(Math.max(e.aliados, 0), 65535), Math.min(Math.max(e.eje, 0), 65535)])
          continue
        }

        if (e.tipo === 'comando') {
          const id = await asegurarJugador(cache, e.steamid, e.nick, e.ts)
          if (!id) { resumen.ignorados++; continue }
          comandos.push([fecha(e.ts), id, recortar(e.comando, 40).toLowerCase()])
          continue
        }

        if (e.tipo === 'kick') {
          const id = await asegurarJugador(cache, e.steamid, e.nick, e.ts)
          if (!id) { resumen.ignorados++; continue }
          kicks.push([fecha(e.ts), id, Math.max(0, e.segundos)])
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
      await insertarEnTandas('puntos', ['momento', 'mapa', 'jugador_id', 'equipo', 'puntos'], puntos)
      await guardarMarcadores(marcadores)
      await acumularSegundos('acostado', acostado)
      await acumularSegundos('jugado', jugado)
      await insertarEnTandas('comandos', ['momento', 'jugador_id', 'comando'], comandos)
      await insertarEnTandas('kicks', ['momento', 'jugador_id', 'segundos'], kicks)

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
      resumen.puntos = puntos.length
      resumen.acostado = acostado.length
      resumen.jugado = jugado.length
      resumen.marcadores = marcadores.length
      resumen.comandos = comandos.length
      resumen.kicks = kicks.length
      return resumen
    } catch (error) {
      await conexion.rollback()
      throw error
    }
  }

  /**
   * Deja la tabla de admines igual que el users.ini del server: agrega los nuevos,
   * actualiza el acceso de los que ya estaban y borra a los que ya no figuran.
   * Nunca recibe contrasenas: admines.mjs las descarta al parsear.
   */
  /** Guarda los pares cuenta -> steamid del log de AMX Mod X. No borra los viejos. */
  async function guardarAdminLogins (logins) {
    if (!logins.length) return 0

    const momento = new Date()
    const filas = logins.map((l) => [recortar(l.cuenta, 80), recortar(l.steamid, 32), momento])
    await conexion.query(
      `INSERT INTO ${t('admin_logins')} (cuenta, steamid, visto) VALUES ?
       ON DUPLICATE KEY UPDATE visto = VALUES(visto)`,
      [filas])

    return logins.length
  }

  /*
   *  Las victorias de gungame, tal como las lleva el propio plugin del gungame.
   *
   *  Se guarda el MAXIMO entre lo que ya teniamos y lo que dice el archivo: el
   *  gungame puede podar jugadores viejos de su planilla (gg_stats_prune), y si
   *  despues vuelven a jugar arrancarian de cero. De este lado no se pierde nada.
   *
   *  Solo se guardan los que ya estan en la base. No se crea un jugador desde este
   *  archivo: el que gano un gungame mato a alguien, asi que ya tiene que estar.
   */
  async function guardarGungameGanadas (jugadores) {
    if (!jugadores.length) return { guardados: 0, sinJugador: [] }

    const porIdentidad = new Map()
    for (const j of jugadores) {
      const quien = identidadDe(j.steamid, j.nick)
      if (quien) porIdentidad.set(quien.identidad, j)
    }
    if (!porIdentidad.size) return { guardados: 0, sinJugador: [] }

    const filas = await conexion.query(
      `SELECT id, identidad FROM ${t('jugadores')} WHERE identidad IN (?)`,
      [[...porIdentidad.keys()]])

    const momento = new Date()
    const aGuardar = []
    const encontrados = new Set()
    for (const f of filas[0]) {
      const j = porIdentidad.get(f.identidad)
      encontrados.add(f.identidad)
      aGuardar.push([Number(f.id), j.ganadas, j.visto, momento])
    }

    if (aGuardar.length) {
      await conexion.query(
        `INSERT INTO ${t('gungame_ganadas')} (jugador_id, ganadas, visto, actualizado) VALUES ?
         ON DUPLICATE KEY UPDATE
           ganadas     = GREATEST(ganadas, VALUES(ganadas)),
           visto       = GREATEST(COALESCE(visto, VALUES(visto)), COALESCE(VALUES(visto), visto)),
           actualizado = VALUES(actualizado)`,
        [aGuardar])
    }

    const sinJugador = [...porIdentidad.keys()].filter((i) => !encontrados.has(i))
    return { guardados: aGuardar.length, sinJugador }
  }

  /*
   *  El catalogo de mapas que se pueden votar, con su tamaño.
   *
   *  Los que no vengan en la lista quedan como inactivos en vez de borrarse: si un
   *  mapa se saca del server, los votos que ya tiene siguen apuntando a algo.
   *
   *  El tamaño sale de tamanos-mapas.tsv, la lista que se revisa a mano, y si el
   *  mapa no esta ahi, de la medida del .bsp. La medida dice que tan grande es el
   *  mapa fisicamente, que no es lo mismo que para cuanta gente va bien.
   */
  async function guardarCatalogoMapas (mapas, aMano = new Map()) {
    const momento = new Date()
    await conexion.beginTransaction()
    try {
      if (mapas.length) {
        const filas = mapas.map((m) => {
          const decidido = aMano.get(m.mapa)
          return [
            recortar(m.mapa, 40),
            Number.isFinite(m.area) ? m.area : null,
            decidido ?? tamanoDe(m.area),
            decidido ? 1 : 0,
            momento
          ]
        })
        await conexion.query(
          `INSERT INTO ${t('mapas_catalogo')} (mapa, area, tamano, a_mano, actualizado) VALUES ?
           ON DUPLICATE KEY UPDATE
             area        = VALUES(area),
             tamano      = VALUES(tamano),
             a_mano      = VALUES(a_mano),
             activo      = 1,
             actualizado = VALUES(actualizado)`,
          [filas])

        /* Los que ya no estan en la lista dejan de poder votarse */
        await conexion.query(
          `UPDATE ${t('mapas_catalogo')} SET activo = 0 WHERE mapa NOT IN (?)`,
          [mapas.map((m) => recortar(m.mapa, 40))])
      }
      await conexion.commit()
    } catch (error) {
      await conexion.rollback()
      throw error
    }

    const [[fila]] = await conexion.query(
      `SELECT COUNT(*) AS activos FROM ${t('mapas_catalogo')} WHERE activo = 1`)
    return { guardados: mapas.length, activos: Number(fila.activos) }
  }

  async function guardarAdmines (admines) {
    const momento = new Date()
    await conexion.beginTransaction()
    try {
      if (admines.length) {
        const filas = admines.map((a) => [recortar(a.clave, 80), recortar(a.tipo, 10), recortar(a.acceso, 40), momento])
        await conexion.query(
          `INSERT INTO ${t('admines')} (clave, tipo, acceso, actualizado) VALUES ?
           ON DUPLICATE KEY UPDATE tipo = VALUES(tipo), acceso = VALUES(acceso), actualizado = VALUES(actualizado)`,
          [filas])
        await conexion.query(
          `DELETE FROM ${t('admines')} WHERE clave NOT IN (?)`, [admines.map((a) => a.clave)])
      } else {
        await conexion.query(`DELETE FROM ${t('admines')}`)
      }
      await conexion.commit()
      return admines.length
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
      segundos_jugados: Number(f.segundos_jugados),
      puntos: Number(f.puntos),
      segundos_acostado: Number(f.segundos_acostado),
      segundos_en_juego: Number(f.segundos_en_juego)
    }))
  }

  /* ---------------------------------------------------------------- */
  /*  GunGame                                                         */
  /* ---------------------------------------------------------------- */

  /*
   *  Marca que paso en gungame y que no. La regla vive en gungame.mjs; aca esta
   *  solo el ir y venir con la base.
   *
   *  Se recalcula entero en cada ingesta, a proposito: una partida puede empezar
   *  en un archivo y seguir en el siguiente, asi que recien se la puede juzgar
   *  cuando estan todas sus muertes. Recalcular es barato (son un par de cientos
   *  de sesiones) y hace que el resultado no dependa del orden en que se cargo.
   *
   *  Una sesion de mapa va desde su linea P hasta la P siguiente. No se usa la
   *  tabla de partidas para esto: su inicio y fin salen de las lineas de marcador,
   *  y hay un 11% de las muertes que caen fuera de esas ventanas.
   */
  async function marcarGungame () {
    const SESIONES = `
      SELECT id, mapa, inicio, gg,
             LEAD(inicio) OVER (ORDER BY inicio, id) AS fin
      FROM ${t('mapas_jugados')}`
    const DENTRO = `mu.momento >= s.inicio AND (s.fin IS NULL OR mu.momento < s.fin)`

    /* Cuantas muertes tuvo cada sesion de mapa */
    const [totales] = await conexion.query(
      `WITH s AS (${SESIONES})
       SELECT s.id, s.mapa, COUNT(mu.id) AS muertes
       FROM s LEFT JOIN ${t('muertes')} mu ON ${DENTRO}
       GROUP BY s.id, s.mapa`)

    /* Y cuantas con cada arma de las que delatan el gungame. Son pocas filas:
       solo las armas de los dos arsenales, no todas. */
    const [detalle] = await conexion.query(
      `WITH s AS (${SESIONES})
       SELECT s.id, mu.arma, COUNT(*) AS n
       FROM s JOIN ${t('muertes')} mu ON ${DENTRO}
       WHERE mu.arma IN (?)
       GROUP BY s.id, mu.arma`,
      [ARMAS_DELATORAS])

    const armasPorSesion = new Map()
    for (const f of detalle) {
      const id = Number(f.id)
      if (!armasPorSesion.has(id)) armasPorSesion.set(id, {})
      armasPorSesion.get(id)[f.arma] = Number(f.n)
    }

    const sesiones = totales.map((f) => ({
      id: Number(f.id),
      mapa: f.mapa,
      muertes: Number(f.muertes),
      armas: armasPorSesion.get(Number(f.id)) ?? {}
    }))

    const { gg, mapasPuros } = clasificarSesiones(sesiones)

    /* Las sesiones. Se pone todo en 0 y se prende lo que corresponde, asi un
       cambio en la regla tambien puede DESmarcar lo que ya estaba marcado. */
    await conexion.query(`UPDATE ${t('mapas_jugados')} SET gg = 0 WHERE gg = 1`)
    if (gg.length) {
      await conexion.query(`UPDATE ${t('mapas_jugados')} SET gg = 1 WHERE id IN (?)`, [gg])
    }

    /* Los eventos con momento propio: se copia la marca de su sesion */
    const ventanas = await rangosGungame(SESIONES)

    for (const tabla of ['muertes', 'puntos']) {
      await conexion.query(`UPDATE ${t(tabla)} SET gg = 0 WHERE gg = 1`)
      for (const [desde, hasta] of ventanas) {
        await conexion.query(
          hasta
            ? `UPDATE ${t(tabla)} SET gg = 1 WHERE momento >= ? AND momento < ?`
            : `UPDATE ${t(tabla)} SET gg = 1 WHERE momento >= ?`,
          hasta ? [desde, hasta] : [desde])
      }
    }

    /* Las partidas se identifican por su inicio */
    await conexion.query(`UPDATE ${t('partidas')} SET gg = 0 WHERE gg = 1`)
    for (const [desde, hasta] of ventanas) {
      await conexion.query(
        hasta
          ? `UPDATE ${t('partidas')} SET gg = 1 WHERE inicio >= ? AND inicio < ?`
          : `UPDATE ${t('partidas')} SET gg = 1 WHERE inicio >= ?`,
        hasta ? [desde, hasta] : [desde])
    }

    /* Las que suman por jugador y mapa: solo se puede marcar el mapa entero */
    for (const tabla of ['impactos', 'acostado', 'jugado']) {
      await conexion.query(`UPDATE ${t(tabla)} SET gg = 0 WHERE gg = 1`)
      if (mapasPuros.length) {
        await conexion.query(`UPDATE ${t(tabla)} SET gg = 1 WHERE mapa IN (?)`, [mapasPuros])
      }
    }

    return { sesiones: sesiones.length, sesionesGg: gg.length, mapasPuros }
  }

  /** Las ventanas [desde, hasta) de las sesiones marcadas como gungame */
  async function rangosGungame (SESIONES) {
    const [filas] = await conexion.query(
      `WITH s AS (${SESIONES}) SELECT inicio, fin FROM s WHERE gg = 1 ORDER BY inicio`)
    return filas.map((f) => [f.inicio, f.fin])
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
    guardarAdmines,
    guardarAdminLogins,
    guardarGungameGanadas,
    guardarCatalogoMapas,
    marcarGungame,
    ranking,
    contar,
    consultar,
    cerrar: () => conexion.end()
  }
}
