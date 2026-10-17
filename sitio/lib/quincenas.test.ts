/*
 *  Tests de las quincenas de la votación. Correr con:  npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quincenaDe, quincenaAnterior, diaArgentino, diasDelMes, faltaPara } from './quincenas.ts'

/* Un instante dado en hora de Argentina (UTC-3) */
const arg = (texto: string) => new Date(`${texto}-03:00`)

test('del 1 al 15 es la primera quincena', () => {
  const q = quincenaDe(arg('2026-10-07T20:00:00'))
  assert.equal(q.clave, '2026-10-01')
  assert.equal(q.nombre, '1 al 15 de octubre')
})

test('del 16 a fin de mes es la segunda', () => {
  const q = quincenaDe(arg('2026-10-20T10:00:00'))
  assert.equal(q.clave, '2026-10-16')
  assert.equal(q.nombre, '16 al 31 de octubre')
})

test('el cambio es a medianoche argentina del 16, no del 15 a la noche', () => {
  /* Las 23:59 del 15 todavia son de la primera */
  assert.equal(quincenaDe(arg('2026-10-15T23:59:00')).clave, '2026-10-01')
  /* Las 00:00 del 16 ya son de la segunda */
  assert.equal(quincenaDe(arg('2026-10-16T00:00:00')).clave, '2026-10-16')
})

test('la medianoche argentina son las 03:00 UTC', () => {
  const q = quincenaDe(arg('2026-10-20T10:00:00'))
  assert.equal(q.desde.toISOString(), '2026-10-16T03:00:00.000Z')
  assert.equal(q.hasta.toISOString(), '2026-11-01T03:00:00.000Z')
})

test('las nueve de la noche en Argentina siguen siendo el mismo dia', () => {
  /* A esa hora en UTC ya es el dia siguiente: es el error que hay que no cometer */
  const momento = arg('2026-10-15T21:00:00')
  assert.equal(momento.toISOString().slice(0, 10), '2026-10-16', 'en UTC ya es 16')
  assert.equal(diaArgentino(momento), '2026-10-15', 'pero en Argentina es 15')
  assert.equal(quincenaDe(momento).clave, '2026-10-01')
})

test('la segunda quincena llega hasta el ultimo dia del mes', () => {
  assert.equal(quincenaDe(arg('2026-02-20T12:00:00')).nombre, '16 al 28 de febrero')
  assert.equal(quincenaDe(arg('2024-02-20T12:00:00')).nombre, '16 al 29 de febrero', 'bisiesto')
  assert.equal(quincenaDe(arg('2026-04-20T12:00:00')).nombre, '16 al 30 de abril')
})

test('el 31 de diciembre a la noche sigue en su quincena', () => {
  const q = quincenaDe(arg('2026-12-31T23:30:00'))
  assert.equal(q.clave, '2026-12-16')
  assert.equal(q.hasta.toISOString(), '2027-01-01T03:00:00.000Z')
})

test('la quincena anterior', () => {
  assert.equal(quincenaAnterior(arg('2026-10-20T10:00:00')).clave, '2026-10-01')
  assert.equal(quincenaAnterior(arg('2026-10-07T10:00:00')).clave, '2026-09-16')
  /* Cruzando el año */
  assert.equal(quincenaAnterior(arg('2027-01-05T10:00:00')).clave, '2026-12-16')
})

test('la anterior termina justo cuando empieza la actual', () => {
  const ahora = arg('2026-10-20T10:00:00')
  assert.equal(quincenaAnterior(ahora).hasta.getTime(), quincenaDe(ahora).desde.getTime())
})

test('dias del mes', () => {
  assert.equal(diasDelMes(2026, 1), 31)
  assert.equal(diasDelMes(2026, 2), 28)
  assert.equal(diasDelMes(2024, 2), 29)
  assert.equal(diasDelMes(2026, 12), 31)
})

test('cuanto falta para que cierre', () => {
  const cierre = arg('2026-10-16T00:00:00')
  assert.equal(faltaPara(cierre, arg('2026-10-10T00:00:00')), 'faltan 6 días')
  assert.equal(faltaPara(cierre, arg('2026-10-14T12:00:00')), 'falta un día')
  assert.equal(faltaPara(cierre, arg('2026-10-15T20:00:00')), 'faltan 4 horas')
  assert.equal(faltaPara(cierre, arg('2026-10-15T23:30:00')), 'faltan 30 minutos')
  assert.equal(faltaPara(cierre, arg('2026-10-16T00:00:01')), 'cierra en instantes')
})

test('cada instante cae en una sola quincena, y todas se tocan', () => {
  /* Recorre un año entero: ninguna fecha queda afuera ni en dos a la vez */
  let momento = arg('2026-01-01T00:00:00')
  let q = quincenaDe(momento)
  let vueltas = 0

  while (q.clave < '2027-01-01' && vueltas < 40) {
    assert.ok(momento >= q.desde && momento < q.hasta, `${momento.toISOString()} fuera de ${q.clave}`)
    const siguiente = quincenaDe(q.hasta)
    assert.equal(siguiente.desde.getTime(), q.hasta.getTime(), `hueco despues de ${q.clave}`)
    momento = q.hasta
    q = siguiente
    vueltas++
  }
  assert.equal(vueltas, 24, 'tiene que haber 24 quincenas en el año')
})
