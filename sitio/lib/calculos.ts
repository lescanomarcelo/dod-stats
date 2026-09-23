/*
 *  Calculos y formatos para mostrar las stats. Funciones puras: sin base de datos,
 *  asi se testean solas (lib/calculos.test.ts).
 */

/** Para K/D y headshot % hace falta un minimo de kills: con 1 kill y 0 muertes
 *  el K/D seria infinito y encabezaria el ranking. */
export const MIN_KILLS_PORCENTAJES = 20

/* Para el ranking Camper: con menos de media hora jugada el porcentaje no dice nada */
export const MIN_SEGUNDOS_CAMPER = 30 * 60

/** Camper: porcentaje del tiempo jugado que paso acostado, de 0 a 100 */
export function camper (segundosAcostado: number, segundosJugados: number): number {
  if (segundosJugados <= 0) return 0
  return Math.min(100, (segundosAcostado / segundosJugados) * 100)
}

/** Kills por muerte. Sin muertes, se divide por 1 (convencion habitual). */
export function kd (kills: number, muertes: number): number {
  return kills / Math.max(muertes, 1)
}

/** Porcentaje 0-100. Con total 0 devuelve 0 en vez de NaN. */
export function porcentaje (parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0
}

export function formatoKd (valor: number): string {
  return valor.toFixed(2)
}

export function formatoPorcentaje (valor: number): string {
  return `${valor.toFixed(1)}%`
}

export function formatoNumero (valor: number): string {
  return valor.toLocaleString('es-AR')
}

/** 0 -> "0m", 540 -> "9m", 3600 -> "1h", 5460 -> "1h 31m", 90061 -> "25h 1m" */
export function formatoTiempo (segundos: number): string {
  const minutosTotales = Math.floor(Math.max(0, segundos) / 60)
  const horas = Math.floor(minutosTotales / 60)
  const minutos = minutosTotales % 60
  if (horas === 0) return `${minutos}m`
  return minutos === 0 ? `${horas}h` : `${horas}h ${minutos}m`
}

/** "hace 3 minutos", "hace 2 horas", "hace 5 dias". ahora se inyecta para poder testear. */
export function tiempoRelativo (fecha: Date, ahora: Date = new Date()): string {
  const segundos = Math.max(0, Math.floor((ahora.getTime() - fecha.getTime()) / 1000))
  if (segundos < 60) return 'hace instantes'
  const plural = (n: number, singular: string, varios: string) => `hace ${n} ${n === 1 ? singular : varios}`
  if (segundos < 3600) return plural(Math.floor(segundos / 60), 'minuto', 'minutos')
  if (segundos < 86400) return plural(Math.floor(segundos / 3600), 'hora', 'horas')
  return plural(Math.floor(segundos / 86400), 'dia', 'dias')
}

/* Nombres que devuelve xmod_get_wpnname() de dodx -> nombre para mostrar.
   Si aparece un arma que no esta aca, se muestra el nombre crudo. */
/* Los nombres de las armas viven en lib/armas.ts, junto con sus dibujos */


/* hitplace del motor HL1 */
const HITBOXES = ['Genérico', 'Cabeza', 'Pecho', 'Estómago', 'Brazo izq.', 'Brazo der.', 'Pierna izq.', 'Pierna der.']

export function nombreHitbox (codigo: number): string {
  return HITBOXES[codigo] ?? `Zona ${codigo}`
}

export function nombreEquipo (codigo: number | null): string {
  if (codigo === 1) return 'Aliados'
  if (codigo === 2) return 'Eje'
  return '—'
}
