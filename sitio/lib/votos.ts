/*
 *  Las reglas de la votación de mapas.
 *
 *  Hay tres votaciones, una por tamaño, y cada dodero puede votar hasta 3 mapas
 *  por día en cada una. El mismo mapa, una sola vez por día: eso lo hace cumplir
 *  la clave única de la tabla, no este archivo.
 *
 *  No hace falta gastar los votos de una: se puede votar un mapa hoy y otro el
 *  jueves, y todo suma para la quincena.
 */

import type { Tamano } from './consultas'

export const VOTOS_POR_DIA = 3

export type Conteo = Record<Tamano, number>

const vacio = (): Conteo => ({ chico: 0, mediano: 0, grande: 0 })

/** Cuántos votó hoy en cada votación */
export function contarPorTamano (votos: { tamano: Tamano }[]): Conteo {
  const cuenta = vacio()
  for (const v of votos) cuenta[v.tamano]++
  return cuenta
}

/** Cuántos le quedan hoy en cada votación */
export function quedan (usados: Conteo): Conteo {
  const resto = vacio()
  for (const t of Object.keys(resto) as Tamano[]) {
    resto[t] = Math.max(0, VOTOS_POR_DIA - usados[t])
  }
  return resto
}

export type Rechazo = 'sin-votos' | 'repetido'

/**
 * Si puede votar ese mapa hoy. Devuelve null si puede, o el motivo si no.
 * La comprobación de "repetido" es para avisar bien: lo que de verdad lo impide
 * es la clave única de la tabla.
 */
export function motivoParaRechazar (
  tamano: Tamano,
  usados: Conteo,
  yaVotadosHoy: string[],
  mapa: string
): Rechazo | null {
  if (yaVotadosHoy.includes(mapa)) return 'repetido'
  if (usados[tamano] >= VOTOS_POR_DIA) return 'sin-votos'
  return null
}

export const TEXTO_RECHAZO: Record<Rechazo, string> = {
  'sin-votos': `Ya votaste ${VOTOS_POR_DIA} mapas de ese tamaño hoy. Mañana podés votar de nuevo.`,
  repetido: 'Ya votaste ese mapa hoy. Mañana podés votarlo otra vez.'
}
