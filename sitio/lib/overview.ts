/*
 *  Conversion de coordenadas del mundo del juego a posicion sobre la imagen del mapa.
 *
 *  Cada mapa de HL1 trae un overview: una imagen de 1024x768 y un .txt con
 *
 *    ZOOM     escala del overview
 *    ORIGIN   punto del mundo (x y z) que cae en el centro de la imagen
 *    ROTATED  como estan orientados los ejes del mundo respecto de la imagen
 *
 *  El motor dibuja el overview cubriendo 8192/zoom unidades del mundo a lo ancho y
 *  6144/zoom a lo alto (8192 / (zoom * 4/3)). Como la imagen es 4:3, la escala es la
 *  misma en los dos ejes: cada pixel equivale a 8/zoom unidades.
 *
 *  Funcion pura, sin dependencias: la usan el sitio y las herramientas de mapas/,
 *  y la valida mapas/validar.mjs contra las posiciones reales de spawns y banderas
 *  leidas de los .bsp.
 */

export type Overview = {
  zoom: number
  origenX: number
  origenY: number
  rotado: boolean
}

const ANCHO_MUNDO = 8192   /* unidades del mundo a lo ancho de la imagen, a zoom 1 */
const ALTO_MUNDO = 6144    /* a lo alto: 8192 / (4/3) */

/**
 * Posicion de un punto del mundo sobre la imagen, como fraccion (0 a 1) del ancho y
 * del alto, medida desde la esquina superior izquierda. Fuera de 0..1 = fuera de la imagen.
 */
export function mundoAImagen (ov: Overview, x: number, y: number): { u: number, v: number } {
  if (ov.rotado) {
    return {
      u: ((x - ov.origenX) * ov.zoom) / ANCHO_MUNDO + 0.5,
      v: ((ov.origenY - y) * ov.zoom) / ALTO_MUNDO + 0.5
    }
  }
  return {
    u: ((ov.origenY - y) * ov.zoom) / ANCHO_MUNDO + 0.5,
    v: ((ov.origenX - x) * ov.zoom) / ALTO_MUNDO + 0.5
  }
}

/**
 * Convierte muchos puntos del mundo a la imagen, descartando los que caen afuera.
 * Devuelve una lista plana [u0, v0, u1, v1, ...] redondeada a 4 decimales: es lo
 * que viaja al navegador, asi que conviene que sea compacta.
 */
export function puntosAImagen (ov: Overview, puntos: ReadonlyArray<readonly [number, number]>): number[] {
  const salida: number[] = []
  for (const [x, y] of puntos) {
    const { u, v } = mundoAImagen(ov, x, y)
    if (u < 0 || u > 1 || v < 0 || v > 1) continue
    salida.push(Math.round(u * 1e4) / 1e4, Math.round(v * 1e4) / 1e4)
  }
  return salida
}

/** Lee el .txt de un overview. Devuelve null si le falta algun dato. */
export function leerOverviewTxt (texto: string): Overview | null {
  const sinComentarios = texto.replace(/\/\/[^\n]*/g, '')
  const numero = (clave: string) => {
    const m = sinComentarios.match(new RegExp(`\\b${clave}\\s+(-?[\\d.]+)`, 'i'))
    return m ? Number(m[1]) : NaN
  }
  const origen = sinComentarios.match(/\bORIGIN\s+(-?[\d.]+)\s+(-?[\d.]+)/i)

  const zoom = numero('ZOOM')
  const rotado = numero('ROTATED')
  if (!origen || !Number.isFinite(zoom) || zoom <= 0) return null

  return {
    zoom,
    origenX: Number(origen[1]),
    origenY: Number(origen[2]),
    rotado: rotado === 1
  }
}
