/*
 *  Prepara la imagen del soldado para el muñeco de "Donde pega":
 *  le quita el fondo (blanco arriba, piso abajo), la recorta y la exporta con
 *  transparencia.
 *
 *    entrada:  mapas/fuentes/soldado.jpg
 *    salida:   sitio/public/soldado.webp  y  sitio/lib/soldado.json (recorte)
 *
 *  Las zonas del cuerpo se definen en coordenadas de la imagen ORIGINAL; el json
 *  guarda donde quedo el recorte para ubicarla.
 *
 *  Uso:  node soldado.mjs            (con --control deja mapas/validacion/soldado-zonas.png)
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const aqui = (ruta) => fileURLToPath(new URL(ruta, import.meta.url))
const ENTRADA = aqui('./fuentes/soldado.jpg')
const SALIDA_IMAGEN = aqui('../sitio/public/soldado.webp')
const SALIDA_JSON = aqui('../sitio/lib/soldado.json')

const { data, info } = await sharp(ENTRADA).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H } = info
const rgb = (x, y) => { const i = (y * W + x) * 3; return [data[i], data[i + 1], data[i + 2]] }
const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/* Color del fondo en cada fila: mediana de los extremos izquierdo y derecho.
   El piso es un degrade vertical, asi que cada fila tiene su propio color. */
const fondoFila = []
for (let y = 0; y < H; y++) {
  const muestras = []
  for (let x = 0; x < 50; x++) { muestras.push(rgb(x, y)); muestras.push(rgb(W - 1 - x, y)) }
  fondoFila.push([0, 1, 2].map((c) => muestras.map((m) => m[c]).sort((a, b) => a - b)[muestras.length >> 1]))
}

/* Donde empieza el piso: la primera fila cuyo borde deja de ser blanco */
let horizonte = H
for (let y = 0; y < H; y++) { if (Math.min(...rgb(2, y)) < 228) { horizonte = y; break } }

const pareceFondo = (x, y) => {
  const c = rgb(x, y)
  if (Math.min(...c) > 228) return true                 /* blanco del estudio */
  if (distancia(c, fondoFila[y]) < 26) return true      /* piso, segun el color de esa fila */
  /* El piso tiene un reflector en el centro, asi que no siempre coincide con el de
     los bordes. Pero es gris-marron poco saturado; el pantalon (oliva) y las botas
     (marron) tienen mas color. Solo se aplica desde un poco antes del horizonte. */
  if (y > horizonte - 80) {
    const saturacion = Math.max(...c) - Math.min(...c)
    const brillo = (c[0] + c[1] + c[2]) / 3
    if (saturacion < 26 && brillo > 58) return true
  }
  return false
}

/* Relleno desde los bordes: solo es fondo lo que se conecta con el borde. Asi, un
   pantalon del color del piso pero rodeado por la figura no se borra. */
const fondo = new Uint8Array(W * H)
const cola = []
const sembrar = (x, y) => {
  const i = y * W + x
  if (!fondo[i] && pareceFondo(x, y)) { fondo[i] = 1; cola.push(i) }
}
for (let x = 0; x < W; x++) { sembrar(x, 0); sembrar(x, H - 1) }
for (let y = 0; y < H; y++) { sembrar(0, y); sembrar(W - 1, y) }
while (cola.length) {
  const i = cola.pop()
  const x = i % W; const y = (i / W) | 0
  if (x > 0) sembrar(x - 1, y)
  if (x < W - 1) sembrar(x + 1, y)
  if (y > 0) sembrar(x, y - 1)
  if (y < H - 1) sembrar(x, y + 1)
}

/* Quedarse con la mancha de figura mas grande: descarta restos sueltos del piso */
const etiqueta = new Int32Array(W * H)
let mejor = 0; let mejorTamano = 0; let actual = 0
for (let inicio = 0; inicio < W * H; inicio++) {
  if (fondo[inicio] || etiqueta[inicio]) continue
  actual++
  let tamano = 0
  const pila = [inicio]
  etiqueta[inicio] = actual
  while (pila.length) {
    const i = pila.pop(); tamano++
    const x = i % W; const y = (i / W) | 0
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const j = ny * W + nx
      if (!fondo[j] && !etiqueta[j]) { etiqueta[j] = actual; pila.push(j) }
    }
  }
  if (tamano > mejorTamano) { mejorTamano = tamano; mejor = actual }
}

/* El blanco puro que quedo encerrado (entre el fusil y el cuerpo, por ejemplo) es
   fondo aunque no se conecte con el borde: en la figura no hay blanco puro. */
const esFigura = (i) => etiqueta[i] === mejor && Math.min(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) <= 240

/* Achicar la figura un pixel saca el halo claro que deja el antialiasing del JPG */
const alfa = Buffer.alloc(W * H)
let x0 = W; let y0 = H; let x1 = 0; let y1 = 0
for (let i = 0; i < W * H; i++) {
  if (!esFigura(i)) continue
  const x = i % W; const y = (i / W) | 0
  if (x === 0 || y === 0 || x === W - 1 || y === H - 1) continue
  if (!esFigura(i - 1) || !esFigura(i + 1) || !esFigura(i - W) || !esFigura(i + W)) continue
  alfa[i] = 255
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
}

/* Borde suave: desenfocar apenas la mascara. sharp puede devolverla con mas de un
   canal, asi que se lee con el paso que informa (no se asume 1). */
const suave = await sharp(alfa, { raw: { width: W, height: H, channels: 1 } })
  .blur(1.1).raw().toBuffer({ resolveWithObject: true })
const pasoAlfa = suave.info.channels

const rgba = Buffer.alloc(W * H * 4)
for (let i = 0; i < W * H; i++) {
  rgba[i * 4] = data[i * 3]; rgba[i * 4 + 1] = data[i * 3 + 1]; rgba[i * 4 + 2] = data[i * 3 + 2]
  rgba[i * 4 + 3] = suave.data[i * pasoAlfa]
}

const margen = 6
const recorte = {
  left: Math.max(0, x0 - margen),
  top: Math.max(0, y0 - margen),
  width: Math.min(W, x1 + margen + 1) - Math.max(0, x0 - margen),
  height: Math.min(H, y1 + margen + 1) - Math.max(0, y0 - margen)
}

await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
  .extract(recorte)
  .webp({ quality: 88, alphaQuality: 100, effort: 6 })
  .toFile(SALIDA_IMAGEN)

writeFileSync(SALIDA_JSON, JSON.stringify({
  x: recorte.left, y: recorte.top, ancho: recorte.width, alto: recorte.height, anchoOriginal: W, altoOriginal: H
}, null, 2) + '\n')

console.log(`Figura: ${mejorTamano} pixeles. Recorte: ${recorte.width}x${recorte.height} desde (${recorte.left}, ${recorte.top})`)

/* Control visual: la figura recortada sobre el fondo oscuro del sitio */
if (process.argv.includes('--control')) {
  mkdirSync(aqui('./validacion'), { recursive: true })
  const figura = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()
  await sharp({ create: { width: W, height: H, channels: 4, background: '#1b1e16' } })
    .composite([{ input: figura }])
    .png()
    .toFile(aqui('./validacion/soldado-recorte.png'))
  console.log('Control: mapas/validacion/soldado-recorte.png')

  /* Las zonas del sitio pintadas encima, cada una de un color, para ver que calcen */
  const { ZONAS_SOLDADO, ANCLAS_SOLDADO } = await import('../sitio/lib/zonasSoldado.ts')
  const colores = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#42d4f4']
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    Object.entries(ZONAS_SOLDADO).map(([zona, puntos], i) =>
      `<polygon points="${puntos.map((p) => p.join(',')).join(' ')}" fill="${colores[i]}" fill-opacity="0.45" stroke="${colores[i]}" stroke-width="2"/>` +
      `<circle cx="${ANCLAS_SOLDADO[zona][0]}" cy="${ANCLAS_SOLDADO[zona][1]}" r="5" fill="#fff"/>` +
      `<text x="${ANCLAS_SOLDADO[zona][0] + 8}" y="${ANCLAS_SOLDADO[zona][1] + 5}" fill="#fff" font-size="16" font-family="sans-serif">${zona}</text>`
    ).join('') + '</svg>'
  await sharp(aqui('./validacion/soldado-recorte.png'))
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toFile(aqui('./validacion/soldado-zonas.png'))
  console.log('Control: mapas/validacion/soldado-zonas.png')
}
