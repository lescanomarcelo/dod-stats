/*
 *  Tests de las reglas de la votación de mapas. Correr con:  npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contarPorTamano, quedan, motivoParaRechazar, VOTOS_POR_DIA, TEXTO_RECHAZO } from './votos.ts'

test('cuenta los votos de hoy por votación', () => {
  const cuenta = contarPorTamano([
    { tamano: 'chico' }, { tamano: 'chico' }, { tamano: 'grande' }
  ])
  assert.deepEqual(cuenta, { chico: 2, mediano: 0, grande: 1 })
})

test('sin votos de hoy, arranca en cero', () => {
  assert.deepEqual(contarPorTamano([]), { chico: 0, mediano: 0, grande: 0 })
})

test('cuántos quedan', () => {
  const usados = contarPorTamano([{ tamano: 'chico' }, { tamano: 'chico' }])
  assert.deepEqual(quedan(usados), { chico: VOTOS_POR_DIA - 2, mediano: VOTOS_POR_DIA, grande: VOTOS_POR_DIA })
})

test('nunca quedan menos que cero', () => {
  /* Por si alguna vez se baja el limite y alguien ya voto de mas */
  const usados = { chico: 10, mediano: 0, grande: 0 }
  assert.equal(quedan(usados).chico, 0)
})

test('las tres votaciones son independientes', () => {
  const usados = { chico: VOTOS_POR_DIA, mediano: 0, grande: 0 }
  assert.equal(motivoParaRechazar('chico', usados, [], 'dod_uno'), 'sin-votos')
  assert.equal(motivoParaRechazar('mediano', usados, [], 'dod_uno'), null, 'los medianos siguen libres')
  assert.equal(motivoParaRechazar('grande', usados, [], 'dod_uno'), null)
})

test('se puede votar mientras queden', () => {
  const usados = { chico: VOTOS_POR_DIA - 1, mediano: 0, grande: 0 }
  assert.equal(motivoParaRechazar('chico', usados, [], 'dod_uno'), null)
})

test('el mismo mapa no se vota dos veces el mismo día', () => {
  const usados = { chico: 1, mediano: 0, grande: 0 }
  assert.equal(motivoParaRechazar('chico', usados, ['dod_uno'], 'dod_uno'), 'repetido')
  assert.equal(motivoParaRechazar('chico', usados, ['dod_uno'], 'dod_dos'), null)
})

test('el repetido manda sobre el sin-votos', () => {
  /* Si ya lo voto hoy, el mensaje util es ese, no que se quedo sin votos */
  const lleno = { chico: VOTOS_POR_DIA, mediano: 0, grande: 0 }
  assert.equal(motivoParaRechazar('chico', lleno, ['dod_uno'], 'dod_uno'), 'repetido')
})

test('cada motivo tiene su explicación', () => {
  for (const motivo of ['sin-votos', 'repetido'] as const) {
    assert.ok(TEXTO_RECHAZO[motivo].length > 10, motivo)
  }
})
