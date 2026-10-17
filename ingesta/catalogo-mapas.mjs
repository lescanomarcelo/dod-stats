/*
 *  Mantiene al dia el catalogo de mapas que se pueden votar en el sitio.
 *
 *  La lista sale de addons/amxmodx/configs/maps.ini, que es la que usa el menu de
 *  admin del server: los mapas que un admin puede poner de verdad. En la carpeta
 *  maps hay mas .bsp, pero varios no se ponen nunca.
 *
 *  El tamaño de cada mapa se saca de la caja del mundo de su .bsp. No se baja el
 *  archivo entero: con una lectura por rango alcanzan la cabecera (124 bytes) y los
 *  24 bytes del modelo 0. Y solo se miden los mapas que todavia no estan en el
 *  catalogo, asi que una corrida sin novedades es un archivo chico y nada mas.
 *
 *  Corre una vez por dia a las 04:00 de Argentina, cuando no hay nadie jugando
 *  (.github/workflows/catalogo-mapas.yml). Tambien se puede correr a mano.
 *
 *  Uso:  npm run catalogo
 *        npm run catalogo -- --ver      no escribe, solo lista
 *        npm run catalogo -- --todos    vuelve a medir los que ya estaban
 */

import Cliente from 'ssh2-sftp-client'
import { LARGO_CABECERA, lumpDeModelos, areaDelMundo } from '../mapas/bsp.mjs'
import { tamanoDe, JUGADORES } from './tamano_mapas.mjs'
import { conectar, configDesdeEntorno } from './base.mjs'
import { configSftpDesdeEntorno } from './fuentes.mjs'
import { leerTamanosAMano } from './tamanos_a_mano.mjs'

/* Las credenciales apuntan a la carpeta de eventos; el server arranca mas arriba */
const RAIZ = (carpeta) => carpeta.replace(/\/addons\/.*$/, '')
const RUTA_LISTA = 'addons/amxmodx/configs/maps.ini'

/** Los mapas de maps.ini: uno por linea, los comentarios arrancan con ; o // */
export function parsearListaDeMapas (texto) {
  return String(texto ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith(';') && !l.startsWith('//'))
}

/** Lee un pedazo de un archivo remoto sin bajarlo entero */
function trozo (cliente, ruta, desde, largo) {
  return new Promise((resolver, rechazar) => {
    const partes = []
    const flujo = cliente.createReadStream(ruta, { start: desde, end: desde + largo - 1 })
    flujo.on('data', (d) => partes.push(d))
    flujo.on('end', () => resolver(Buffer.concat(partes)))
    flujo.on('error', rechazar)
  })
}

/** El area de un mapa, o null si el .bsp no se puede leer */
export async function medirMapa (cliente, carpetaMapas, mapa, registrar = () => {}) {
  try {
    const ruta = `${carpetaMapas}/${mapa}.bsp`
    const cabecera = await trozo(cliente, ruta, 0, LARGO_CABECERA)
    const { inicio } = lumpDeModelos(cabecera)
    return areaDelMundo(await trozo(cliente, ruta, inicio, 24))
  } catch (error) {
    registrar(`  ${mapa}: no se pudo medir (${error.message})`)
    return null
  }
}

/**
 * Arma el catalogo. Devuelve los mapas con su area, listos para guardar.
 * Los que ya estaban medidos no se vuelven a medir, salvo que se pida.
 */
export async function armarCatalogo ({ cliente, carpeta, yaMedidos = new Map(), todos = false, registrar = () => {} }) {
  const raiz = RAIZ(carpeta)
  const lista = parsearListaDeMapas(await cliente.get(`${raiz}/${RUTA_LISTA}`))
  registrar(`${RUTA_LISTA}: ${lista.length} mapas`)

  const carpetaMapas = `${raiz}/maps`
  const instalados = new Set(
    (await cliente.list(carpetaMapas))
      .filter((a) => a.name.endsWith('.bsp'))
      .map((a) => a.name.replace(/\.bsp$/, ''))
  )

  const sinBsp = lista.filter((m) => !instalados.has(m))
  if (sinBsp.length) registrar(`En la lista pero sin .bsp en el server: ${sinBsp.join(', ')}`)

  const catalogo = []
  let medidos = 0
  for (const mapa of lista.filter((m) => instalados.has(m))) {
    const conocida = yaMedidos.get(mapa)
    if (!todos && Number.isFinite(conocida)) {
      catalogo.push({ mapa, area: conocida })
      continue
    }
    const area = await medirMapa(cliente, carpetaMapas, mapa, registrar)
    if (area !== null) {
      catalogo.push({ mapa, area })
      medidos++
    }
  }

  registrar(medidos ? `Medidos ${medidos} mapas nuevos` : 'Sin mapas nuevos que medir')
  return catalogo
}

/* ------------------------------------------------------------------ */
/*  Ejecucion por linea de comandos                                    */
/* ------------------------------------------------------------------ */

if (import.meta.main) {
  const soloVer = process.argv.includes('--ver')
  const todos = process.argv.includes('--todos')

  const sftp = configSftpDesdeEntorno()
  if (!sftp.host || !sftp.user || !sftp.password) {
    console.error('Faltan SFTP_HOST / SFTP_USER / SFTP_PASS en el .env')
    process.exit(2)
  }

  const base = await conectar(configDesdeEntorno())
  const cliente = new Cliente()

  try {
    await base.aplicarEsquema()

    /* Lo que ya sabemos, para no volver a medir lo mismo todos los dias */
    const yaMedidos = new Map(
      (await base.consultar('SELECT mapa, area FROM {p}mapas_catalogo WHERE area IS NOT NULL'))
        .map((f) => [f.mapa, Number(f.area)])
    )

    await cliente.connect({
      host: sftp.host,
      port: sftp.port,
      username: sftp.user,
      password: sftp.password,
      readyTimeout: 20000
    })

    const catalogo = await armarCatalogo({
      cliente, carpeta: sftp.carpeta, yaMedidos, todos, registrar: (m) => console.log(m)
    })

    if (soloVer) {
      const porTamano = {}
      for (const m of [...catalogo].sort((a, b) => a.area - b.area)) {
        (porTamano[tamanoDe(m.area)] ??= []).push(m)
      }
      for (const [tamano, mapas] of Object.entries(porTamano)) {
        console.log(`\n${tamano.toUpperCase()} (hasta ${JUGADORES[tamano]} jugadores): ${mapas.length}`)
        for (const m of mapas) console.log(`  ${m.mapa.padEnd(24)}${String(m.area).padStart(6)}`)
      }
      console.log('\n--ver: no se escribio nada en la base.')
    } else {
      const aMano = await leerTamanosAMano((m) => console.log(`  ${m}`))
      console.log(`tamanos-mapas.tsv: ${aMano.size} mapas revisados a mano`)

      const sinRevisar = catalogo.filter((m) => !aMano.has(m.mapa)).map((m) => m.mapa)
      if (sinRevisar.length) console.log(`Sin revisar, van por medida: ${sinRevisar.join(', ')}`)

      const { guardados, activos } = await base.guardarCatalogoMapas(catalogo, aMano)
      console.log(`Guardados ${guardados} mapas, ${activos} activos para votar.`)
    }
  } finally {
    await cliente.end().catch(() => {})
    await base.cerrar()
  }
}
