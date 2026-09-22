/*
 *  Iconos de la web app (para instalarla en el celular) a partir de un dibujo
 *  vectorial con el estilo del logo de DoD: mitad verde con la estrella aliada,
 *  mitad roja con la cruz del Eje. El logo original es de 64 px: agrandarlo a 512
 *  quedaria borroso.
 *
 *  El dibujo ocupa el 70% central, asi sirve tambien como icono "maskable" (Android
 *  lo recorta en circulo o gota y no se come la estrella ni la cruz).
 *
 *  Uso:  node iconos.mjs      (escribe en ../sitio/public/iconos y ../sitio/app)
 */

import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const VERDE = '#4b7242'
const ROJO = '#c2151c'

function estrella (cx, cy, r) {
  return Array.from({ length: 10 }, (_, i) => {
    const radio = i % 2 === 0 ? r : r * 0.4
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    return `${(cx + Math.cos(a) * radio).toFixed(1)},${(cy + Math.sin(a) * radio).toFixed(1)}`
  }).join(' ')
}

/* Cruz de brazos ensanchados: un brazo trapezoidal girado cuatro veces, unidos por
   un cuadrado central. Primero todo con el borde grueso y encima el relleno sin
   borde: asi no quedan lineas blancas entre los brazos. */
function cruz (cx, cy, largo, relleno, borde) {
  const medio = largo * 0.14
  const brazo = `M${cx - medio} ${cy - medio} L${cx - largo * 0.42} ${cy - largo} L${cx + largo * 0.42} ${cy - largo} L${cx + medio} ${cy - medio} Z`
  const forma = (extra) => [0, 90, 180, 270].map((giro) =>
    `<path d="${brazo}" transform="rotate(${giro} ${cx} ${cy})" ${extra}/>`).join('') +
    `<rect x="${cx - medio}" y="${cy - medio}" width="${medio * 2}" height="${medio * 2}" ${extra}/>`
  return `<g>${forma(`fill="${borde}" stroke="${borde}" stroke-width="${largo * 0.16}" stroke-linejoin="round"`)}</g>` +
    `<g>${forma(`fill="${relleno}"`)}</g>`
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="256" height="512" fill="${VERDE}"/>
  <rect x="256" width="256" height="512" fill="${ROJO}"/>
  <polygon points="${estrella(214, 262, 150)}" fill="#ffffff"/>
  ${cruz(318, 258, 112, '#141414', '#ffffff')}
</svg>`

await mkdir('../sitio/public/iconos', { recursive: true })
const salidas = [
  ['../sitio/public/iconos/icono-192.png', 192],
  ['../sitio/public/iconos/icono-512.png', 512],
  ['../sitio/app/apple-icon.png', 180]
]
for (const [ruta, lado] of salidas) {
  await sharp(Buffer.from(svg)).resize(lado, lado).png({ compressionLevel: 9 }).toFile(ruta)
  console.log(`${ruta} (${lado}px)`)
}
