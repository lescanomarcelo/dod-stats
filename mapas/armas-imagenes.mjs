/*
 *  Saca el dibujo de cada arma de los sprites del juego (dod/sprites/weapons1..5.spr)
 *  y los guarda como webp con fondo transparente para el sitio.
 *
 *  Que parte de cada lamina corresponde a cada arma lo dice el propio juego en
 *  dod/sprites/hud.txt, con lineas como:
 *
 *    weapon_thompson   640   weapons1   0   0   170   48
 *                            lamina     x   y   ancho alto
 *
 *  Formato .spr de Half-Life: cabecera, paleta de 256 colores y los cuadros, con
 *  un byte por pixel que es el indice en la paleta. Los iconos del HUD son
 *  "additive": el negro es transparente, y cuanto mas claro el pixel, mas opaco.
 *
 *  Uso:  node armas-imagenes.mjs
 */

import { readFileSync } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const CARPETA_JUEGO = process.env.DOD_SPRITES ??
  'C:/Program Files (x86)/Steam/steamapps/common/Half-Life/dod/sprites'
const DESTINO = '../sitio/public/armas'
const DESTINO_GOLPES = '../sitio/public/armas/golpes'
const ALTO_SALIDA = 90
const ALTO_GOLPE = 60

/* Lee un .spr y devuelve el primer cuadro como pixeles RGBA */
function leerSprite (ruta) {
  const b = readFileSync(ruta)
  if (b.toString('latin1', 0, 4) !== 'IDSP') throw new Error(`${ruta}: no es un sprite`)

  const texFormat = b.readInt32LE(12)
  let i = 40                                   /* fin de la cabecera */
  const colores = b.readUInt16LE(i); i += 2
  const paleta = b.subarray(i, i + colores * 3); i += colores * 3

  i += 4                                       /* tipo de cuadro (grupo) */
  i += 8                                       /* origen x, y */
  const ancho = b.readInt32LE(i); i += 4
  const alto = b.readInt32LE(i); i += 4

  const pixeles = Buffer.alloc(ancho * alto * 4)
  for (let p = 0; p < ancho * alto; p++) {
    const indice = b[i + p]
    const r = paleta[indice * 3]
    const g = paleta[indice * 3 + 1]
    const azul = paleta[indice * 3 + 2]
    /* additive (1): el brillo es la opacidad. alphatest (3): el ultimo color es el hueco */
    const alfa = texFormat === 1 ? Math.max(r, g, azul) : (indice === colores - 1 ? 0 : 255)
    pixeles.set([r, g, azul, alfa], p * 4)
  }
  return { ancho, alto, pixeles }
}

/* Las armas como las nombra el sprite; el sitio las relaciona con las de la base */
async function main () {
  const hud = readFileSync(join(CARPETA_JUEGO, 'hud.txt'), 'latin1')
  const laminas = new Map()
  await mkdir(DESTINO, { recursive: true })
  await mkdir(DESTINO_GOLPES, { recursive: true })

  let hechas = 0
  for (const linea of hud.split('\n')) {
    const campos = linea.trim().split(/\s+/)
    /* weapon_*: el arma como se ve en el inventario.
       d_*: el iconito chico que sale en la lista de muertes al matar con ella */
    const esGolpe = Boolean(campos[0]?.startsWith('d_'))
    if (!campos[0]?.startsWith('weapon_') && !esGolpe) continue

    const [nombre, , lamina, x, y, ancho, alto] = campos
    const arma = nombre.slice(esGolpe ? 'd_'.length : 'weapon_'.length)
    if (!laminas.has(lamina)) laminas.set(lamina, leerSprite(join(CARPETA_JUEGO, `${lamina}.spr`)))
    const hoja = laminas.get(lamina)

    const recorte = { left: Number(x), top: Number(y), width: Number(ancho), height: Number(alto) }
    if (recorte.left + recorte.width > hoja.ancho || recorte.top + recorte.height > hoja.alto) {
      console.log(`(salteada) ${arma}: el recorte se sale de ${lamina}`)
      continue
    }

    await sharp(hoja.pixeles, { raw: { width: hoja.ancho, height: hoja.alto, channels: 4 } })
      .extract(recorte)
      .resize({ height: esGolpe ? ALTO_GOLPE : ALTO_SALIDA, fit: 'inside', kernel: 'lanczos3' })
      .webp({ quality: 85 })
      .toFile(join(esGolpe ? DESTINO_GOLPES : DESTINO, `${arma}.webp`))
    hechas++
  }

  const archivos = await readdir(DESTINO)
  console.log(`${hechas} armas en ${DESTINO} (${archivos.length} archivos)`)
}

await main()
