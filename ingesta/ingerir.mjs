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

export async function ingerir ({ fuente, base, registrar = () => {} }) {
  const resultado = { ocupado: false, archivos: 0, muertes: 0, sesiones: 0, mapas: 0, impactos: 0, puntos: 0, marcadores: 0, ignorados: 0, descartadas: 0, alertas: [] }

  if (!await base.tomarCandado()) {
    registrar('Hay otra ingesta corriendo. Esta termina sin hacer nada.')
    resultado.ocupado = true
    return resultado
  }

  try {
    await procesarArchivos(fuente, base, registrar, resultado)
  } finally {
    await base.soltarCandado()
  }

  return resultado
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
    resultado.marcadores += lote.marcadores
    resultado.ignorados += lote.ignorados
    resultado.descartadas += descartadas

    registrar(`${nombre}: +${bytesConsumidos} bytes, ${lote.muertes} muertes, ` +
      `${lote.sesiones} sesiones, ${lote.mapas} mapas, ${lote.impactos} lineas de impactos, ${lote.puntos} de puntos, ${lote.marcadores} marcadores, ${lote.ignorados} ignorados (bots), ` +
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
