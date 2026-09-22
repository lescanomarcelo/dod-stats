/*
 *  Baja del server de juego, por SFTP, la lista de mapas instalados y los overviews
 *  (.txt + imagen) de cada uno. Es el primer paso para regenerar las imagenes del sitio.
 *
 *    mapas/server-mapas.json   que mapas y que overviews hay en el server
 *    mapas/cache/              los overviews bajados
 *
 *  Usa las credenciales SFTP de ingesta/.env.
 *
 *  Uso:  node --env-file=../ingesta/.env bajar-overviews.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import SftpClient from 'ssh2-sftp-client'

const aqui = (ruta) => fileURLToPath(new URL(ruta, import.meta.url))
const CARPETA_SERVER = '45.235.98.67_27017/dod'
const CACHE = aqui('./cache')

const faltan = ['SFTP_HOST', 'SFTP_USER', 'SFTP_PASS'].filter((k) => !process.env[k])
if (faltan.length) {
  console.error(`Faltan ${faltan.join(', ')}. Correr con --env-file=../ingesta/.env`)
  process.exit(2)
}

const cliente = new SftpClient()
await cliente.connect({
  host: process.env.SFTP_HOST,
  port: Number(process.env.SFTP_PORT || 8822),
  username: process.env.SFTP_USER,
  password: process.env.SFTP_PASS,
  readyTimeout: 30000
})

try {
  const mapas = (await cliente.list(`${CARPETA_SERVER}/maps`))
    .filter((f) => /\.bsp$/i.test(f.name))
    .map((f) => f.name.replace(/\.bsp$/i, '').toLowerCase())
    .sort()
  const overviews = (await cliente.list(`${CARPETA_SERVER}/overviews`)).map((f) => f.name)
  writeFileSync(aqui('./server-mapas.json'), JSON.stringify({ mapas, overviews }, null, 1))

  /* Agrupa los archivos de overview por nombre de mapa, sin distinguir mayusculas */
  const porMapa = new Map()
  for (const nombre of overviews) {
    const base = nombre.replace(/\.[^.]+$/, '').toLowerCase()
    if (!porMapa.has(base)) porMapa.set(base, [])
    porMapa.get(base).push(nombre)
  }

  mkdirSync(CACHE, { recursive: true })
  let completos = 0
  for (const mapa of mapas) {
    const archivos = (porMapa.get(mapa) ?? []).filter((n) => /\.(txt|bmp|tga)$/i.test(n))
    const tieneTxt = archivos.some((n) => /\.txt$/i.test(n))
    const tieneImagen = archivos.some((n) => /\.(bmp|tga)$/i.test(n))
    if (!tieneTxt || !tieneImagen) continue

    for (const nombre of archivos) {
      writeFileSync(join(CACHE, nombre), await cliente.get(`${CARPETA_SERVER}/overviews/${nombre}`))
    }
    completos++
  }

  console.log(`Mapas en el server: ${mapas.length}. Con overview completo, bajados: ${completos}.`)
} finally {
  await cliente.end()
}
