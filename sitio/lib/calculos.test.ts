/*
 *  Tests de los calculos del sitio.  Correr con:  npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  kd, porcentaje, formatoKd, formatoPorcentaje, formatoTiempo,
  tiempoRelativo, nombreArma, nombreHitbox, nombreEquipo
} from './calculos.ts'

test('K/D: kills sobre muertes', () => {
  assert.equal(kd(30, 10), 3)
  assert.equal(kd(10, 20), 0.5)
})

test('K/D sin muertes no es infinito: divide por 1', () => {
  assert.equal(kd(15, 0), 15)
  assert.equal(kd(0, 0), 0)
})

test('porcentaje con total 0 da 0 y no NaN', () => {
  assert.equal(porcentaje(0, 0), 0)
  assert.equal(porcentaje(5, 0), 0)
  assert.equal(porcentaje(25, 100), 25)
  assert.equal(porcentaje(1, 3).toFixed(2), '33.33')
})

test('formatos de K/D y porcentaje', () => {
  assert.equal(formatoKd(1.23456), '1.23')
  assert.equal(formatoKd(15), '15.00')
  assert.equal(formatoPorcentaje(33.333), '33.3%')
  assert.equal(formatoPorcentaje(0), '0.0%')
})

test('formato de tiempo jugado', () => {
  assert.equal(formatoTiempo(0), '0m')
  assert.equal(formatoTiempo(59), '0m')
  assert.equal(formatoTiempo(540), '9m')
  assert.equal(formatoTiempo(3600), '1h')
  assert.equal(formatoTiempo(5460), '1h 31m')
  assert.equal(formatoTiempo(90061), '25h 1m')
  assert.equal(formatoTiempo(-10), '0m', 'un valor negativo no rompe')
})

test('tiempo relativo en singular y plural', () => {
  const ahora = new Date('2026-09-21T22:00:00Z')
  const antes = (seg: number) => new Date(ahora.getTime() - seg * 1000)
  assert.equal(tiempoRelativo(antes(10), ahora), 'hace instantes')
  assert.equal(tiempoRelativo(antes(60), ahora), 'hace 1 minuto')
  assert.equal(tiempoRelativo(antes(600), ahora), 'hace 10 minutos')
  assert.equal(tiempoRelativo(antes(3600), ahora), 'hace 1 hora')
  assert.equal(tiempoRelativo(antes(7200), ahora), 'hace 2 horas')
  assert.equal(tiempoRelativo(antes(86400 * 3), ahora), 'hace 3 dias')
  assert.equal(tiempoRelativo(antes(-30), ahora), 'hace instantes', 'una fecha futura no rompe')
})

test('nombres de armas conocidas y fallback para las desconocidas', () => {
  assert.equal(nombreArma('kar'), 'Kar98k')
  assert.equal(nombreArma('garand'), 'M1 Garand')
  assert.equal(nombreArma('30cal'), '.30 cal')
  assert.equal(nombreArma('arma_nueva_rara'), 'arma_nueva_rara')
})

test('nombres de hitbox y equipo', () => {
  assert.equal(nombreHitbox(1), 'Cabeza')
  assert.equal(nombreHitbox(7), 'Pierna der.')
  assert.equal(nombreHitbox(99), 'Zona 99')
  assert.equal(nombreEquipo(1), 'Aliados')
  assert.equal(nombreEquipo(2), 'Eje')
  assert.equal(nombreEquipo(null), '—')
})
