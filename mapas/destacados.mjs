/*
 *  Prepara las imagenes del sitio: los destacados del ranking, recortados a cuadrado,
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
  'el dodero fiel': ['fiel', 'centre'],
  'La vieja mas pelada': ['melee', 'centre']
}

/* Las que no son figuritas del ranking: van anchas, de banda, arriba de una seccion */
const BANDAS = {
  admines: { destino: '../sitio/public/server', nombre: 'admines', ancho: 1600 }
}

await mkdir(DESTINO, { recursive: true })

for (const [base, banda] of Object.entries(BANDAS)) {
  const archivo = (await readdir(ORIGEN)).find((a) => a.replace(/.[^.]+$/, '') === base)
  if (!archivo) { console.log(`(falta) ${base}`); continue }

  await mkdir(banda.destino, { recursive: true })
  const salida = `${banda.destino}/${banda.nombre}.webp`
  /* Sin recortar: el alto lo decide el CSS, que en el celular necesita otra proporcion */
  await sharp(`${ORIGEN}/${archivo}`).resize(banda.ancho).webp({ quality: 72 }).toFile(salida)
  const { size } = await stat(salida)
  console.log(`${archivo} -> ${banda.nombre}.webp (${Math.round(size / 1024)} KB)`)
}

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
