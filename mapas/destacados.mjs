/*
 *  Prepara las imagenes de los destacados del ranking: recorta a cuadrado,
 *  achica y pasa a webp, que pesa bastante menos que el JPEG original
 *  (las fuentes son de 2048x2048 y 3 MB cada una).
 *
 *  Fuentes: la carpeta "imagenes ranking" del proyecto, una por categoria.
 *
 *  Uso:  node destacados.mjs
 */

import { mkdir, readdir, stat } from 'node:fs/promises'
import sharp from 'sharp'

const ORIGEN = '../imagenes ranking'
const DESTINO = '../sitio/public/destacados'
const LADO = 700

/*
 *  Nombre del archivo de origen (sin extension) -> nombre en el sitio, y de donde
 *  recortar el cuadrado: casi todas tienen la cara arriba, pero la del bosque
 *  tiene al soldado en el medio.
 */
const NOMBRES = {
  'El más Kenny': ['kenny', 'top'],
  'El Aero-Player': ['granadas', 'top'],
  'El dodero ejemplar': ['banderas', 'top'],
  'El mas m_rawinput 1': ['teamkills', 'top'],
  'El chiterazo': ['headshots', 'top'],
  'el dodero fiel': ['fiel', 'centre']
}

await mkdir(DESTINO, { recursive: true })

for (const archivo of await readdir(ORIGEN)) {
  const base = archivo.replace(/\.[^.]+$/, '')
  const [nombre, posicion] = NOMBRES[base] ?? []
  if (!nombre) {
    console.log(`(salteada) ${archivo}`)
    continue
  }
  const salida = `${DESTINO}/${nombre}.webp`
  await sharp(`${ORIGEN}/${archivo}`)
    .resize(LADO, LADO, { fit: 'cover', position: posicion })
    .webp({ quality: 72 })
    .toFile(salida)
  const { size } = await stat(salida)
  console.log(`${archivo} -> ${nombre}.webp (${Math.round(size / 1024)} KB)`)
}
