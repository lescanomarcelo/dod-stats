/*
 *  Tests de la lectura de la respuesta A2S_INFO del server.  Correr con:  npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leerRespuesta } from './servidor.ts'

const cabecera = (tipo: number) => Buffer.from([0xff, 0xff, 0xff, 0xff, tipo])
const texto = (s: string) => Buffer.from(s + '\0', 'utf8')

test('formato actual: nombre, mapa, jugadores, maximo y bots', () => {
  const b = Buffer.concat([
    cabecera(0x49), Buffer.from([48]),
    texto('DoD 1.3 :::aU::: Tributo Server'), texto('dod_kalt'), texto('dod'), texto('Day of Defeat'),
    Buffer.from([30, 0]), Buffer.from([12, 24, 1]), Buffer.from([0x64, 0x6c, 0, 1])
  ])
  assert.deepEqual(leerRespuesta(b), {
    enLinea: true, nombre: 'DoD 1.3 :::aU::: Tributo Server', mapa: 'dod_kalt', jugadores: 12, maximo: 24, bots: 1
  })
})

test('formato viejo de GoldSrc', () => {
  const b = Buffer.concat([
    cabecera(0x6d), texto('45.235.98.67:27017'), texto('Tributo'), texto('dod_avalanche'), texto('dod'), texto('Day of Defeat'),
    Buffer.from([7, 24, 47])
  ])
  assert.deepEqual(leerRespuesta(b), { enLinea: true, nombre: 'Tributo', mapa: 'dod_avalanche', jugadores: 7, maximo: 24, bots: 0 })
})

test('challenge: devuelve los 4 bytes para repetir la consulta', () => {
  const r = leerRespuesta(Buffer.concat([cabecera(0x41), Buffer.from([1, 2, 3, 4])]))
  assert.ok('challenge' in r)
  assert.deepEqual([...r.challenge], [1, 2, 3, 4])
})

test('basura o respuesta cortada: error, no un estado inventado', () => {
  assert.throws(() => leerRespuesta(Buffer.from('hola')))
  assert.throws(() => leerRespuesta(Buffer.concat([cabecera(0x49), Buffer.from([48]), Buffer.from('sin fin')])))
})
