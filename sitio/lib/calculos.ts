/*
 *  Calculos y formatos para mostrar las stats. Funciones puras: sin base de datos,
 *  asi se testean solas (lib/calculos.test.ts).
 */

/** Para K/D y headshot % hace falta un minimo de kills: con 1 kill y 0 muertes
 *  el K/D seria infinito y encabezaria el ranking. */
export const MIN_KILLS_PORCENTAJES = 20

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
const ARMAS: Record<string, string> = {
  amerknife: 'Cuchillo (EE.UU.)',
  gerknife: 'Cuchillo (alemán)',
  brit_knife: 'Cuchillo (británico)',
  spade: 'Pala',
  colt: 'Colt .45',
  luger: 'Luger P08',
  webley: 'Webley',
  garand: 'M1 Garand',
  garandbutt: 'Culatazo M1 Garand',
  kar: 'Kar98k',
  scopedkar: 'Kar98k con mira',
  k43: 'Gewehr 43',
  k43butt: 'Culatazo Gewehr 43',
  spring: 'Springfield',
  enfield: 'Lee-Enfield',
  scoped_enfield: 'Lee-Enfield con mira',
  bayonet: 'Bayoneta',
  enf_bayonet: 'Bayoneta Lee-Enfield',
  thompson: 'Thompson',
  greasegun: 'M3 Grease Gun',
  mp40: 'MP40',
  mp44: 'StG 44',
  sten: 'Sten',
  m1carbine: 'M1 Carbine',
  bar: 'BAR',
  fg42: 'FG 42',
  scoped_fg42: 'FG 42 con mira',
  bren: 'Bren',
  mg42: 'MG 42',
  mg34: 'MG 34',
  '30cal': '.30 cal',
  handgrenade: 'Granada',
  handgrenade_ex: 'Granada',
  stickgrenade: 'Granada de palo',
  stickgrenade_ex: 'Granada de palo',
  mills_bomb: 'Granada Mills',
  bazooka: 'Bazooka',
  pschreck: 'Panzerschreck',
  piat: 'PIAT',
  mortar: 'Mortero',
  world: 'Caída / mapa'
}

export function nombreArma (codigo: string): string {
  return ARMAS[codigo] ?? codigo
}

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
