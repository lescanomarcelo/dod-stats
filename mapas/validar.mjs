/*
 *  Valida la conversion de coordenadas mundo -> imagen con datos reales.
 *
 *  Para cada mapa lee su overview (.txt + imagen) y las entidades del .bsp: spawns
 *  de ambos equipos y banderas. Proyecta esas posiciones sobre la imagen y mide
 *  cuantas caen sobre zona dibujada del mapa (no sobre el fondo, ni fuera de la imagen).
 *
 *  No da por buena la formula del sitio: prueba las 8 orientaciones posibles
 *  (ejes cruzados o no, cada eje invertido o no) y compara. Si la formula de
 *  sitio/lib/overview.ts es la que mas acierta, queda confirmada por los datos.
 *
 *  Uso:  node validar.mjs [carpeta_dod] [carpeta_overviews]
 *        (sin carpeta_overviews usa <carpeta_dod>/overviews; con ./cache valida los del server)
 *  Deja una imagen por mapa con los puntos marcados en mapas/validacion/.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { leerEntidades, puntosDe } from './bsp.mjs'
import { leerImagen, colorEn, aRgba, escribirPng } from './imagenes.mjs'
import { mundoAImagen, leerOverviewTxt } from '../sitio/lib/overview.ts'

const DOD = process.argv[2] ?? 'C:/Program Files (x86)/Steam/steamapps/common/Half-Life/dod'
/* Carpeta de overviews: por defecto la de la instalacion; se puede pasar la del server (cache/) */
const OVERVIEWS = process.argv[3] ?? join(DOD, 'overviews')
const SALIDA = new URL('./validacion/', import.meta.url)
const CLASES = ['info_player_allies', 'info_player_axis', 'dod_control_point']
const STOCK = ['dod_kalt', 'dod_jagd', 'dod_zalec', 'dod_flash', 'dod_avalanche', 'dod_anzio',
  'dod_caen', 'dod_donner', 'dod_saints', 'dod_vicenza', 'dod_kraftstoff', 'dod_chemille',
  'dod_charlie', 'dod_merderet', 'dod_escape', 'dod_falaise', 'dod_forest', 'dod_glider',
  'dod_flugplatz', 'dod_northbound', 'dod_sturm', 'dod_switch']

/* Las 8 orientaciones: que eje del mundo va a lo ancho, y el signo de cada eje */
const VARIANTES = []
for (const cruzado of [false, true]) {
  for (const su of [1, -1]) {
    for (const sv of [1, -1]) {
      VARIANTES.push({
        nombre: `${cruzado ? 'u=y v=x' : 'u=x v=y'} ${su > 0 ? '+' : '-'}${sv > 0 ? '+' : '-'}`,
        proyectar (ov, x, y) {
          const [a, a0, b, b0] = cruzado ? [y, ov.origenY, x, ov.origenX] : [x, ov.origenX, y, ov.origenY]
          return { u: (su * (a - a0) * ov.zoom) / 8192 + 0.5, v: (sv * (b - b0) * ov.zoom) / 6144 + 0.5 }
        }
      })
    }
  }
}

function buscarArchivo (carpeta, base, extensiones) {
  const nombres = readdirSync(carpeta)
  for (const ext of extensiones) {
    const encontrado = nombres.find((n) => n.toLowerCase() === `${base}${ext}`.toLowerCase())
    if (encontrado) return join(carpeta, encontrado)
  }
  return null
}

/* El color de fondo es el mas repetido en el borde de la imagen */
function colorDeFondo (img) {
  const cuenta = new Map()
  const sumar = (x, y) => { const k = colorEn(img, x, y).join(','); cuenta.set(k, (cuenta.get(k) ?? 0) + 1) }
  for (let x = 0; x < img.ancho; x++) { sumar(x, 0); sumar(x, img.alto - 1) }
  for (let y = 0; y < img.alto; y++) { sumar(0, y); sumar(img.ancho - 1, y) }
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number)
}

/* Un spawn puede quedar pegado a una pared oscura: se mira un entorno de 5x5 */
function caeSobreMapa (img, fondo, u, v) {
  const px = Math.floor(u * img.ancho)
  const py = Math.floor(v * img.alto)
  if (px < 0 || py < 0 || px >= img.ancho || py >= img.alto) return false
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = px + dx; const y = py + dy
      if (x < 0 || y < 0 || x >= img.ancho || y >= img.alto) continue
      const c = colorEn(img, x, y)
      if (Math.abs(c[0] - fondo[0]) + Math.abs(c[1] - fondo[1]) + Math.abs(c[2] - fondo[2]) > 30) return true
    }
  }
  return false
}

function marcar (rgba, ancho, alto, u, v, color) {
  const cx = Math.floor(u * ancho); const cy = Math.floor(v * alto)
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      if (dx * dx + dy * dy > 16) continue
      const x = cx + dx; const y = cy + dy
      if (x < 0 || y < 0 || x >= ancho || y >= alto) continue
      rgba.set(color, (y * ancho + x) * 4)
    }
  }
}

const COLORES = {
  info_player_allies: [80, 220, 80, 255],
  info_player_axis: [230, 70, 60, 255],
  dod_control_point: [255, 215, 0, 255]
}

mkdirSync(SALIDA, { recursive: true })
const aciertos = VARIANTES.map(() => 0)
let aciertosSitio = 0
let totalPuntos = 0
const filas = []

for (const mapa of STOCK) {
  const txt = buscarArchivo(OVERVIEWS, mapa, ['.txt'])
  const imagen = buscarArchivo(OVERVIEWS, mapa, ['.bmp', '.tga'])
  const bsp = join(DOD, 'maps', `${mapa}.bsp`)
  if (!txt || !imagen || !existsSync(bsp)) { filas.push({ mapa, estado: 'falta overview o .bsp' }); continue }

  const ov = leerOverviewTxt(readFileSync(txt, 'utf8'))
  const img = leerImagen(readFileSync(imagen), imagen)
  const fondo = colorDeFondo(img)
  const puntos = puntosDe(leerEntidades(readFileSync(bsp)), CLASES)

  VARIANTES.forEach((variante, i) => {
    for (const p of puntos) {
      const { u, v } = variante.proyectar(ov, p.x, p.y)
      if (caeSobreMapa(img, fondo, u, v)) aciertos[i]++
    }
  })

  /* La formula real del sitio, medida por separado */
  let bienSitio = 0
  const lienzo = aRgba(img)
  for (const p of puntos) {
    const { u, v } = mundoAImagen(ov, p.x, p.y)
    if (caeSobreMapa(img, fondo, u, v)) bienSitio++
    marcar(lienzo.rgba, img.ancho, img.alto, u, v, COLORES[p.clase])
  }
  writeFileSync(new URL(`${mapa}.png`, SALIDA), escribirPng(lienzo))

  aciertosSitio += bienSitio
  totalPuntos += puntos.length
  filas.push({ mapa, rotado: ov.rotado, puntos: puntos.length, aciertos: bienSitio, porcentaje: ((bienSitio / puntos.length) * 100).toFixed(0) + '%' })
}

console.log('Formula del sitio, mapa por mapa:')
console.table(filas)

console.log('\nLas 8 orientaciones posibles, sobre todos los mapas:')
const ranking = VARIANTES.map((v, i) => ({ orientacion: v.nombre, aciertos: aciertos[i], porcentaje: ((aciertos[i] / totalPuntos) * 100).toFixed(1) + '%' }))
  .sort((a, b) => b.aciertos - a.aciertos)
console.table(ranking)

const mejor = ranking[0].aciertos
console.log(`\nFormula del sitio: ${aciertosSitio}/${totalPuntos} puntos sobre el mapa (${((aciertosSitio / totalPuntos) * 100).toFixed(1)}%)`)
console.log(aciertosSitio >= mejor
  ? 'CONFIRMADA: ninguna otra orientacion acierta mas que la del sitio.'
  : `NO CONFIRMADA: hay una orientacion con ${mejor} aciertos contra ${aciertosSitio}. Revisar sitio/lib/overview.ts.`)
process.exitCode = aciertosSitio >= mejor ? 0 : 1
