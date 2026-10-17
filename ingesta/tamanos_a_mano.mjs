/*
 *  La lista de tamaños que se revisa a mano: ingesta/tamanos-mapas.tsv
 *
 *  Esta lista MANDA sobre la medida del .bsp. La medida dice que tan grande es el
 *  mapa fisicamente, que no es lo mismo que para cuanta gente va bien: eso lo sabe
 *  el que juega. La medida queda para los mapas nuevos, que arrancan con el tamaño
 *  que les toca hasta que alguien los revise.
 *
 *  Formato: una linea por mapa, campos separados por TAB.
 *
 *    mapa              area   tamano
 *    au_gris_torres    10.7   chico
 *
 *  Las lineas que arrancan con # son comentarios, y la primera con los nombres de
 *  las columnas tambien se saltea.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { TAMANOS } from './tamano_mapas.mjs'

export const RUTA = fileURLToPath(new URL('./tamanos-mapas.tsv', import.meta.url))

/**
 * Lee el texto del archivo y devuelve un Map de mapa -> tamaño.
 *
 * Una linea con un tamaño que no existe se saltea y se avisa: mejor que ese mapa
 * quede con la medida automatica a que se rompa la carga entera por una falta de
 * ortografia.
 */
export function parsearTamanosAMano (texto, avisar = () => {}) {
  const porMapa = new Map()

  for (const cruda of String(texto ?? '').split('\n')) {
    const linea = cruda.replace(/\r$/, '').trim()
    if (!linea || linea.startsWith('#')) continue

    const [mapa, , tamano] = linea.split('\t').map((c) => c.trim())
    if (!mapa || mapa === 'mapa') continue   /* la fila de los titulos */
    if (!tamano) continue                    /* sin decidir: queda la medida */

    const elegido = tamano.toLowerCase()
    if (!TAMANOS.includes(elegido)) {
      avisar(`${mapa}: "${tamano}" no es un tamaño valido, se ignora`)
      continue
    }
    porMapa.set(mapa, elegido)
  }

  return porMapa
}

/** Lee el archivo del disco. Si no esta, no es un error: no hay nada revisado. */
export async function leerTamanosAMano (avisar = () => {}, ruta = RUTA) {
  try {
    return parsearTamanosAMano(await readFile(ruta, 'utf8'), avisar)
  } catch (error) {
    if (error.code !== 'ENOENT') avisar(`No se pudo leer ${ruta} (${error.code})`)
    return new Map()
  }
}
