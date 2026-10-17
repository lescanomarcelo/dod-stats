/*
 *  Tests de la clasificacion de mapas por tamaño. Correr con:  npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tamanoDe, UMBRALES, TAMANOS, JUGADORES } from './tamano_mapas.mjs'

/* Mapas reales del server, con el area que midio el .bsp */
const REALES = [
  ['au_3v3_ctf', 2.4, 'chico'],
  ['dod_7quick', 4.5, 'chico'],
  ['dod_orange_ctf', 8.1, 'chico'],
  ['dod_exposed_b1', 9.9, 'chico'],
  ['dod_reign2_b1', 10.2, 'mediano'],
  ['au_gris_torres', 10.7, 'mediano'],
  ['dod_kort_b4', 13.7, 'mediano'],
  ['dod_cal_sherman2', 24.9, 'mediano'],
  ['dod_aleutian', 25.3, 'grande'],
  ['dod_saints', 31, 'grande'],
  ['dod_clash_v3', 64, 'grande'],
  ['dod_charlie', 64.5, 'grande']
]

test('clasifica los mapas reales del server', () => {
  for (const [mapa, area, esperado] of REALES) {
    assert.equal(tamanoDe(area), esperado, mapa)
  }
})

test('los limites son inclusivos hacia abajo', () => {
  assert.equal(tamanoDe(UMBRALES.chico), 'chico')
  assert.equal(tamanoDe(UMBRALES.chico + 0.1), 'mediano')
  assert.equal(tamanoDe(UMBRALES.mediano), 'mediano')
  assert.equal(tamanoDe(UMBRALES.mediano + 0.1), 'grande')
})

test('un mapa sin medir no se clasifica solo', () => {
  /* Mejor afuera que en el grupo equivocado */
  assert.equal(tamanoDe(null), null)
  assert.equal(tamanoDe(undefined), null)
  assert.equal(tamanoDe(0), null)
  assert.equal(tamanoDe(-5), null)
  assert.equal(tamanoDe('grande'), null)
  assert.equal(tamanoDe(NaN), null)
  assert.equal(tamanoDe(Infinity), null)
})

test('un area en texto se entiende igual', () => {
  /* La base devuelve los DECIMAL como string */
  assert.equal(tamanoDe('8.1'), 'chico')
  assert.equal(tamanoDe('31.0'), 'grande')
})

test('los tres tamaños estan completos y en orden', () => {
  assert.deepEqual(TAMANOS, ['chico', 'mediano', 'grande'])
  for (const t of TAMANOS) assert.ok(JUGADORES[t] > 0, t)
  assert.ok(JUGADORES.chico < JUGADORES.mediano)
  assert.ok(JUGADORES.mediano < JUGADORES.grande)
})

test('todo tamaño que devuelve esta en la lista', () => {
  for (const area of [1, 10, 10.5, 25, 26, 100, 1000]) {
    assert.ok(TAMANOS.includes(tamanoDe(area)), String(area))
  }
})
