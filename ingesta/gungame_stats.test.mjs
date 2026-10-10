/*
 *  Tests del parser de la planilla de victorias del gungame. Correr con:  npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsearGungameStats } from './gungame_stats.mjs'

/* Tal cual lo que tiene el server hoy */
const REAL = [
  'STEAM_0:0:455330983\t3\tEl Gato Milaneso\t1791505691\t0',
  'STEAM_0:0:23198516\t5\tTrevor\t1791587749\t0',
  'STEAM_0:1:29606836\t4\t=AmL= | Aero-Macao\t1791511818\t0',
  'STEAM_0:0:25087132\t5\tEl Uru\t1791511818\t0'
].join('\n') + '\n'

test('lee la planilla del server', () => {
  const r = parsearGungameStats(REAL)
  assert.equal(r.length, 4)
  assert.deepEqual(r[1], {
    steamid: 'STEAM_0:0:23198516',
    nick: 'Trevor',
    ganadas: 5,
    visto: new Date(1791587749 * 1000)
  })
})

test('el total de victorias da lo que se ve en el archivo', () => {
  const total = parsearGungameStats(REAL).reduce((s, j) => s + j.ganadas, 0)
  assert.equal(total, 17)
})

test('un nick con espacios y simbolos se guarda entero', () => {
  const [j] = parsearGungameStats('STEAM_0:1:29606836\t4\t=AmL= | Aero-Macao\t1791511818\t0')
  assert.equal(j.nick, '=AmL= | Aero-Macao')
})

test('saltea lineas que no se entienden sin romper', () => {
  const r = parsearGungameStats([
    '',
    'basura',
    'STEAM_0:1:1\tmuchas\tPepe\t1791511818\t0',   /* ganadas no numerica */
    'NO_ES_STEAM\t3\tPepe\t1791511818\t0',        /* steamid invalido */
    'STEAM_0:1:1\t3\tPepe',                       /* faltan campos */
    'STEAM_0:1:2\t7\tJuan\t1791511818\t0'         /* esta si */
  ].join('\n'))
  assert.equal(r.length, 1)
  assert.equal(r[0].nick, 'Juan')
  assert.equal(r[0].ganadas, 7)
})

test('el que tiene cero victorias no entra', () => {
  assert.deepEqual(parsearGungameStats('STEAM_0:1:1\t0\tPepe\t1791511818\t0'), [])
})

test('las victorias negativas tampoco', () => {
  assert.deepEqual(parsearGungameStats('STEAM_0:1:1\t-5\tPepe\t1791511818\t0'), [])
})

test('sin fecha valida el jugador entra igual, con visto en null', () => {
  const [j] = parsearGungameStats('STEAM_0:1:1\t3\tPepe\tcuando sea\t0')
  assert.equal(j.ganadas, 3)
  assert.equal(j.visto, null)
})

test('tolera fin de linea de Windows', () => {
  const [j] = parsearGungameStats('STEAM_0:1:1\t3\tPepe\t1791511818\t0\r\n')
  assert.equal(j.ganadas, 3)
})

test('un archivo vacio o ausente no rompe', () => {
  assert.deepEqual(parsearGungameStats(''), [])
  assert.deepEqual(parsearGungameStats(null), [])
  assert.deepEqual(parsearGungameStats(undefined), [])
})

test('un nick con comillas y SQL adentro se guarda como texto', () => {
  const [j] = parsearGungameStats("STEAM_0:1:1\t3\t'); DROP TABLE jugadores; --\t1791511818\t0")
  assert.equal(j.nick, "'); DROP TABLE jugadores; --")
})
