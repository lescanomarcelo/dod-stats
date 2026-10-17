/*
 *  Carga el catalogo de mapas que se pueden votar, con el tamaño de cada uno.
 *
 *  La lista sale de addons/amxmodx/configs/maps.ini, que es la que usa el menu de
 *  admin del server: los mapas que un admin puede poner de verdad. En la carpeta
 *  maps hay mas .bsp, pero varios no se ponen nunca.
 *
 *  El tamaño se saca de la caja del mundo de cada .bsp. No se baja el archivo
 *  entero: con una lectura por rango alcanzan la cabecera (124 bytes) y los 24 del
 *  modelo 0, asi que medir los 83 mapas cuesta unos 12 KB en total en vez de 200 MB.
 *
 *  Es a mano, no va en la ingesta: la lista de mapas del server no cambia sola.
 *
 *  Uso:  node --env-file=../ingesta/.env catalogo.mjs
 *        node --env-file=../ingesta/.env catalogo.mjs --ver    (no escribe, solo lista)
 */

import Cliente from 'ssh2-sftp-client'
import { LARGO_CABECERA, lumpDeModelos, areaDelMundo } from './bsp.mjs'
import { tamanoDe, JUGADORES } from '../ingesta/tamano_mapas.mjs'

const CARPETA = process.env.SFTP_CARPETA?.replace(/\/addons\/.*$/, '') ??
  '45.235.98.67_27017/dod'
const RUTA_LISTA = 'addons/amxmodx/configs/maps.ini'

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

/** Los mapas de maps.ini: una linea cada uno, los comentarios arrancan con ; */
export function parsearListaDeMapas (texto) {
  return String(texto ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith(';') && !l.startsWith('//'))
}

/** Mide un mapa. Devuelve null si el .bsp no se puede leer. */
async function medir (cliente, carpetaMapas, mapa) {
  try {
    const ruta = `${carpetaMapas}/${mapa}.bsp`
    const cabecera = await trozo(cliente, ruta, 0, LARGO_CABECERA)
    const { inicio } = lumpDeModelos(cabecera)
    const modelo = await trozo(cliente, ruta, inicio, 24)
    return areaDelMundo(modelo)
  } catch (error) {
    console.log(`  ${mapa}: no se pudo medir (${error.message})`)
    return null
  }
}

const soloVer = process.argv.includes('--ver')

const cliente = new Cliente()
await cliente.connect({
  host: process.env.SFTP_HOST,
  port: Number(process.env.SFTP_PORT || 22),
  username: process.env.SFTP_USER,
  password: process.env.SFTP_PASS,
  readyTimeout: 20000
})

let medidos = []
try {
  const lista = parsearListaDeMapas(await cliente.get(`${CARPETA}/${RUTA_LISTA}`))
  console.log(`${RUTA_LISTA}: ${lista.length} mapas`)

  const carpetaMapas = `${CARPETA}/maps`
  const instalados = new Set(
    (await cliente.list(carpetaMapas))
      .filter((a) => a.name.endsWith('.bsp'))
      .map((a) => a.name.replace(/\.bsp$/, ''))
  )

  const sinBsp = lista.filter((m) => !instalados.has(m))
  if (sinBsp.length) console.log(`En la lista pero sin .bsp en el server: ${sinBsp.join(', ')}`)

  for (const mapa of lista.filter((m) => instalados.has(m))) {
    const area = await medir(cliente, carpetaMapas, mapa)
    if (area !== null) medidos.push({ mapa, area })
  }
} finally {
  await cliente.end()
}

medidos.sort((a, b) => a.area - b.area)

const porTamano = {}
for (const m of medidos) (porTamano[tamanoDe(m.area)] ??= []).push(m)

for (const [tamano, mapas] of Object.entries(porTamano)) {
  console.log(`\n${tamano.toUpperCase()} (hasta ${JUGADORES[tamano]} jugadores): ${mapas.length} mapas`)
  for (const m of mapas) console.log(`  ${m.mapa.padEnd(24)}${String(m.area).padStart(6)}`)
}

if (soloVer) {
  console.log('\n--ver: no se escribio nada en la base.')
} else {
  const { conectar, configDesdeEntorno } = await import('../ingesta/base.mjs')
  const base = await conectar(configDesdeEntorno())
  try {
    await base.aplicarEsquema()
    const { guardados, activos } = await base.guardarCatalogoMapas(medidos)
    console.log(`\nGuardados ${guardados} mapas, ${activos} activos para votar.`)
  } finally {
    await base.cerrar()
  }
}
