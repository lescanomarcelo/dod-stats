import type { Periodo } from './periodos'
import type { ClaveDestacado } from './consultas'

/*
 *  Enlaces que arma más de una página. El nombre del arma viene del juego y puede
 *  tener mayúsculas y espacios ("scoped K98"), así que va codificado en la URL.
 */

export function enlaceDeArma (arma: string, periodo: Periodo, fecha: string | null) {
  const q = new URLSearchParams()
  if (periodo !== 'global') q.set('periodo', periodo)
  if (fecha) q.set('fecha', fecha)
  const texto = q.toString()
  const base = `/armas/${encodeURIComponent(arma)}`
  return texto ? `${base}?${texto}` : base
}

export function enlaceDeDestacado (clave: ClaveDestacado, periodo: Periodo, fecha: string | null) {
  const q = new URLSearchParams()
  if (periodo !== 'global') q.set('periodo', periodo)
  if (fecha) q.set('fecha', fecha)
  const texto = q.toString()
  const base = `/destacados/${clave}`
  return texto ? `${base}?${texto}` : base
}
