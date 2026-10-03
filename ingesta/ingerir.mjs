/*
 *  Ingesta: baja lo nuevo de cada archivo de eventos y lo carga en la base.
 *
 *  Por cada archivo eventos_AAAAMMDD.tsv:
 *    1. mira hasta que byte ya se cargo (ingesta_estado)
 *    2. baja solo desde ahi hasta el final
 *    3. parsea las lineas completas (una linea cortada queda para la proxima)
 *    4. guarda eventos + nuevo offset en una sola transaccion
 *
 *  Se puede correr tantas veces como se quiera: si no hay nada nuevo, no hace nada,
 *  y nunca carga dos veces el mismo evento.
 *
 *  Uso:  npm run ingerir
 */

import { parsearFragmento } from './parsear.mjs'
import { parsearUsuarios } from './admines.mjs'
import { parsearLogins, nombresDeLog } from './admin_logins.mjs'

/* users.ini esta dos carpetas mas arriba que los eventos: data/stats -> configs */
const RUTA_USERS = '../../configs/users.ini'
const CARPETA_LOGS = '../../logs'

export async function ingerir ({ fuente, base, registrar = () => {} }) {
  const resultado = { ocupado: false, archivos: 0, admines: 0, adminLogins: 0, muertes: 0, sesiones: 0, mapas: 0, impactos: 0, acostado: 0, jugado: 0, puntos: 0, marcadores: 0, ignorados: 0, descartadas: 0, alertas: [] }

  if (!await base.tomarCandado()) {
    registrar('Hay otra ingesta corriendo. Esta termina sin hacer nada.')
    resultado.ocupado = true
    return resultado
  }

  try {
    await refrescarAdmines(fuente, base, registrar, resultado)
    await refrescarAdminLogins(fuente, base, registrar, resultado)
    await procesarArchivos(fuente, base, registrar, resultado)
  } finally {
    await base.soltarCandado()
  }

  return resultado
}

/*
 *  La lista de admines del server (users.ini). Es un extra: si el archivo no esta
 *  o no se puede leer, se avisa y la ingesta de eventos sigue igual.
 *
 *  Del archivo solo salen quienes son admins y con que acceso. Las contrasenas que
 *  tiene adentro las descarta parsearUsuarios(): no se guardan ni se registran.
 */
async function refrescarAdmines (fuente, base, registrar, resultado) {
  if (!fuente.leerTexto) return

  try {
    const admines = parsearUsuarios(await fuente.leerTexto(RUTA_USERS))
    resultado.admines = await base.guardarAdmines(admines)
    registrar(`users.ini: ${admines.length} admines`)
  } catch (error) {
    registrar(`No se pudo leer la lista de admines (${error.code || error.message}). Sigo con los eventos.`)
  }
}

/*
 *  Los logins de admin del log de AMX Mod X: atan cada cuenta del users.ini con el
 *  steamid de quien la usa. Como el de users.ini, es un extra: si no se puede leer,
 *  se avisa y la ingesta sigue.
 */
async function refrescarAdminLogins (fuente, base, registrar, resultado) {
  if (!fuente.leerTexto) return

  const logins = new Map()

  for (const nombre of nombresDeLog()) {
    try {
      const texto = await fuente.leerTexto(`${CARPETA_LOGS}/${nombre}`)
      for (const l of parsearLogins(texto)) logins.set(`${l.cuenta}\u0000${l.steamid}`, l)
    } catch {
      /* El log de ese dia puede no existir (el server no arranco): no es un problema */
    }
  }

  if (!logins.size) return

  try {
    resultado.adminLogins = await base.guardarAdminLogins([...logins.values()])
    registrar(`logins de admin: ${resultado.adminLogins}`)
  } catch (error) {
    registrar(`No se pudieron guardar los logins de admin (${error.code || error.message}).`)
  }
}

async function procesarArchivos (fuente, base, registrar, resultado) {
  const archivos = (await fuente.listar()).sort((a, b) => a.nombre.localeCompare(b.nombre))

  for (const { nombre, tamano } of archivos) {
    const offset = await base.leerOffset(nombre)

    if (tamano === offset) continue

    /* El archivo es mas chico de lo que ya cargamos: alguien lo borro y se
       recreo, o se trunco. Reprocesarlo desde 0 duplicaria eventos y seguir
       desde el offset leeria basura. No adivinamos: avisamos y lo salteamos. */
    if (tamano < offset) {
      const alerta = `${nombre}: tiene ${tamano} bytes pero ya se cargaron ${offset}. Salteado, revisar a mano.`
      resultado.alertas.push(alerta)
      registrar(`ALERTA ${alerta}`)
      continue
    }

    const datos = await fuente.leer(nombre, offset)
    const { eventos, descartadas, bytesConsumidos } = parsearFragmento(datos)

    if (bytesConsumidos === 0) continue   /* solo habia una linea a medio escribir */

    const lote = await base.guardarLote(nombre, offset + bytesConsumidos, eventos, descartadas)

    resultado.archivos++
    resultado.muertes += lote.muertes
    resultado.sesiones += lote.sesiones
    resultado.mapas += lote.mapas
    resultado.impactos += lote.impactos
    resultado.puntos += lote.puntos
    resultado.acostado += lote.acostado
    resultado.jugado += lote.jugado
    resultado.marcadores += lote.marcadores
    resultado.ignorados += lote.ignorados
    resultado.descartadas += descartadas

    registrar(`${nombre}: +${bytesConsumidos} bytes, ${lote.muertes} muertes, ` +
      `${lote.sesiones} sesiones, ${lote.mapas} mapas, ${lote.impactos} lineas de impactos, ${lote.puntos} de puntos, ${lote.acostado} de acostado, ${lote.jugado} de tiempo jugado, ${lote.marcadores} marcadores, ${lote.ignorados} ignorados (bots), ` +
      `${descartadas} lineas descartadas`)
  }
}

/* ------------------------------------------------------------------ */
/*  Ejecucion por linea de comandos                                    */
/* ------------------------------------------------------------------ */

if (import.meta.main) {
  const { conectar, configDesdeEntorno } = await import('./base.mjs')
  const { crearFuenteSftp, configSftpDesdeEntorno } = await import('./fuentes.mjs')

  const sftp = configSftpDesdeEntorno()
  if (!sftp.host || !sftp.user || !sftp.password) {
    console.error('Faltan SFTP_HOST / SFTP_USER / SFTP_PASS en el .env')
    process.exit(2)
  }

  const base = await conectar(configDesdeEntorno())
  const fuente = await crearFuenteSftp(sftp)

  if (!sftp.huella) {
    console.log(`Huella del server SFTP: ${fuente.huellaVista}`)
    console.log('Para verificarla en cada conexion, agregala al .env como SFTP_HUELLA.\n')
  }

  try {
    const r = await ingerir({ fuente, base, registrar: (m) => console.log(m) })
    if (!r.ocupado) {
      console.log(`\nListo: ${r.archivos} archivos con novedades, ${r.muertes} muertes, ` +
        `${r.sesiones} sesiones, ${r.mapas} mapas.`)
    }
    if (r.alertas.length) process.exitCode = 1
  } finally {
    await fuente.cerrar()
    await base.cerrar()
  }
}
