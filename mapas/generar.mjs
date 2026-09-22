/*
 *  Genera los recursos de mapas para el sitio:
 *
 *    sitio/public/mapas/<mapa>.webp   imagen del overview, liviana para la web
 *    sitio/lib/overviews.json         parametros de conversion de cada mapa
 *
 *  Fuente: los overviews bajados del server (mapas/cache/), que son los que estan
 *  instalados de verdad. Solo se incluyen mapas que existen en el server.
 *
 *  Uso:  node generar.mjs
 *  Antes: bajar los overviews a mapas/cache/ (ver README).
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { leerImagen, aRgba } from './imagenes.mjs'
import { leerOverviewTxt } from '../sitio/lib/overview.ts'

const aqui = (ruta) => fileURLToPath(new URL(ruta, import.meta.url))
const CACHE = aqui('./cache')
const IMAGENES = aqui('../sitio/public/mapas')
const MANIFIESTO = aqui('../sitio/lib/overviews.json')

const { mapas } = JSON.parse(readFileSync(aqui('./server-mapas.json'), 'utf8'))
const enCache = readdirSync(CACHE)
const buscar = (base, patron) => enCache.find((n) => n.replace(/\.[^.]+$/, '').toLowerCase() === base && patron.test(n))

mkdirSync(IMAGENES, { recursive: true })
const manifiesto = {}
const salteados = []
let pesoOriginal = 0
let pesoFinal = 0

for (const mapa of mapas) {
  const txt = buscar(mapa, /\.txt$/i)
  const imagen = buscar(mapa, /\.(bmp|tga)$/i)
  if (!txt || !imagen) continue

  const ov = leerOverviewTxt(readFileSync(join(CACHE, txt), 'utf8'))
  if (!ov) { salteados.push(`${mapa} (txt sin ZOOM u ORIGIN)`); continue }

  let img
  try {
    img = aRgba(leerImagen(readFileSync(join(CACHE, imagen)), imagen))
  } catch (error) {
    salteados.push(`${mapa} (${error.message})`)
    continue
  }

  const destino = join(IMAGENES, `${mapa}.webp`)
  await sharp(Buffer.from(img.rgba), { raw: { width: img.ancho, height: img.alto, channels: 4 } })
    .webp({ quality: 80, effort: 6 })
    .toFile(destino)

  pesoOriginal += statSync(join(CACHE, imagen)).size
  pesoFinal += statSync(destino).size
  manifiesto[mapa] = { ...ov, ancho: img.ancho, alto: img.alto }
}

writeFileSync(MANIFIESTO, JSON.stringify(manifiesto, null, 2) + '\n')

console.log(`Mapas generados: ${Object.keys(manifiesto).length}`)
console.log(`Peso: ${(pesoOriginal / 1048576).toFixed(1)} MB en BMP -> ${(pesoFinal / 1048576).toFixed(1)} MB en WebP`)
if (salteados.length) console.log(`Salteados: ${salteados.join(', ')}`)
