import overviews from './overviews.json'
import type { Overview } from './overview'

/*
 *  Que mapas tienen overview y con que parametros.
 *  overviews.json lo genera mapas/generar.mjs a partir de los overviews del server.
 */

export type InfoMapa = Overview & { ancho: number, alto: number }

const TABLA = overviews as Record<string, InfoMapa>

/** Los nombres de mapa pueden venir con mayusculas (dod_Assault2): se buscan en minuscula */
export function overviewDe (mapa: string): InfoMapa | null {
  return TABLA[mapa.toLowerCase()] ?? null
}

export function imagenDe (mapa: string): string {
  return `/mapas/${mapa.toLowerCase()}.webp`
}
