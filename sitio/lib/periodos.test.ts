/*
 *  Tests de los periodos de calendario.  Correr con:  npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rangoDe, ultimosPeriodos, etiquetaCorta, veredicto, type Balance } from './periodos.ts'

/* Martes 22/9/2026 a las 10 de la mañana en Argentina (13 UTC) */
const AHORA = new Date('2026-09-22T13:00:00Z')

test('la semana va de lunes a domingo, en hora argentina', () => {
  const r = rangoDe('semana', undefined, AHORA)
  assert.equal(r.clave, '2026-09-21')
  assert.equal(r.desde, '2026-09-21T03:00:00.000Z', 'lunes 00:00 de Argentina')
  assert.equal(r.hasta, '2026-09-28T03:00:00.000Z')
  assert.equal(r.etiqueta, 'Semana del 21 al 27 de septiembre')
  assert.equal(r.actual, true)
  assert.equal(r.anterior, '2026-09-14')
  assert.equal(r.siguiente, null, 'no se puede avanzar al futuro')
})

test('el domingo a la noche en Argentina sigue siendo la misma semana aunque en UTC ya sea lunes', () => {
  const domingoNoche = new Date('2026-09-28T01:30:00Z')   /* domingo 27, 22:30 en Argentina */
  assert.equal(rangoDe('semana', undefined, domingoNoche).clave, '2026-09-21')
})

test('cualquier dia de la URL lleva a su semana', () => {
  const r = rangoDe('semana', '2026-09-03', AHORA)       /* jueves */
  assert.equal(r.clave, '2026-08-31')
  assert.equal(r.etiqueta, 'Semana del 31 de agosto al 6 de septiembre')
  assert.equal(r.siguiente, '2026-09-07')
  assert.equal(r.actual, false)
})

test('una fecha futura o invalida muestra la semana actual', () => {
  assert.equal(rangoDe('semana', '2027-01-01', AHORA).clave, '2026-09-21')
  assert.equal(rangoDe('semana', '2026-02-31', AHORA).clave, '2026-09-21')
  assert.equal(rangoDe('semana', "'; DROP TABLE x", AHORA).clave, '2026-09-21')
})

test('el mes es el de calendario', () => {
  const r = rangoDe('mes', undefined, AHORA)
  assert.equal(r.clave, '2026-09')
  assert.equal(r.desde, '2026-09-01T03:00:00.000Z')
  assert.equal(r.hasta, '2026-10-01T03:00:00.000Z')
  assert.equal(r.etiqueta, 'Septiembre de 2026')
  assert.equal(r.anterior, '2026-08')
  assert.equal(r.siguiente, null)
})

test('el mes anterior a enero es diciembre del año anterior', () => {
  const r = rangoDe('mes', '2026-01', AHORA)
  assert.equal(r.anterior, '2025-12')
  assert.equal(r.siguiente, '2026-02')
})

test('global no tiene limites', () => {
  const r = rangoDe('global', undefined, AHORA)
  assert.equal(r.desde, null)
  assert.equal(r.hasta, null)
})

test('ultimas semanas y meses, de la mas vieja a la actual', () => {
  assert.deepEqual(ultimosPeriodos('semana', 3, AHORA), ['2026-09-07', '2026-09-14', '2026-09-21'])
  assert.deepEqual(ultimosPeriodos('mes', 3, AHORA), ['2026-07', '2026-08', '2026-09'])
  assert.deepEqual(ultimosPeriodos('mes', 10, AHORA).slice(0, 2), ['2025-12', '2026-01'])
  assert.equal(etiquetaCorta('semana', '2026-09-14'), '14/9')
  assert.equal(etiquetaCorta('mes', '2026-01'), 'ene 26')
})

const balance = (b: Partial<Balance>): Balance => ({
  partidas: 0, ganadosAliados: 0, ganadosEje: 0, puntosAliados: 0, puntosEje: 0, killsAliados: 0, killsEje: 0, ...b
})

test('gana el que gano mas mapas, aunque haya hecho menos kills', () => {
  const v = veredicto(balance({ partidas: 5, ganadosAliados: 2, ganadosEje: 3, killsAliados: 900, killsEje: 400 }))
  assert.equal(v.ganador, 2)
  assert.equal(v.segun, 'mapas')
  assert.ok(v.margen < 0)
})

test('empatados en mapas, desempatan los puntos del marcador', () => {
  const v = veredicto(balance({ partidas: 4, ganadosAliados: 2, ganadosEje: 2, puntosAliados: 30, puntosEje: 22 }))
  assert.equal(v.ganador, 1)
  assert.equal(v.segun, 'puntos')
})

test('sin marcadores registrados, deciden las kills', () => {
  const v = veredicto(balance({ killsAliados: 100, killsEje: 300 }))
  assert.deepEqual(v, { ganador: 2, segun: 'kills', margen: -0.5 })
  assert.deepEqual(veredicto(balance({})), { ganador: null, segun: null, margen: 0 })
})
