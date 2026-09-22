/*
 *  Iconos de la web app (para instalarla en el celular): el mismo logo de Day of
 *  Defeat del encabezado (sitio/public/dod.png), agrandado. No hay una version mas
 *  grande del logo (el juego trae 32 px y Steam no guarda otra), asi que se agranda
 *  el de 64 px con un filtro suave (lanczos).
 *
 *  La version "maskable" (Android la recorta en circulo o gota) lleva un margen
 *  extra que repite los bordes del logo, verde y rojo, para que el recorte no se
 *  coma la estrella ni la cruz.
 *
 *  Uso:  node iconos.mjs      (escribe en ../sitio/public/iconos y ../sitio/app)
 */

import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const LOGO = '../sitio/public/dod.png'

const agrandado = (lado) => sharp(LOGO).resize(lado, lado, { kernel: 'lanczos3' })

/* El logo ocupa el 80% central y el resto repite los bordes */
async function conMargen (lado) {
  const interno = Math.round(lado * 0.8)
  const margen = Math.round((lado - interno) / 2)
  const logo = await agrandado(interno).png().toBuffer()
  return sharp(logo)
    .extend({ top: margen, bottom: lado - interno - margen, left: margen, right: lado - interno - margen, extendWith: 'copy' })
    .png({ compressionLevel: 9 })
}

await mkdir('../sitio/public/iconos', { recursive: true })

for (const [ruta, lado] of [['../sitio/public/iconos/icono-192.png', 192], ['../sitio/public/iconos/icono-512.png', 512], ['../sitio/app/apple-icon.png', 180]]) {
  await agrandado(lado).png({ compressionLevel: 9 }).toFile(ruta)
  console.log(`${ruta} (${lado}px)`)
}
await (await conMargen(512)).toFile('../sitio/public/iconos/icono-maskable-512.png')
console.log('../sitio/public/iconos/icono-maskable-512.png (512px, con margen)')
