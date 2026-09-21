import { test } from 'node:test'
import assert from 'node:assert/strict'
import { identidadDe } from './identidad.mjs'

test('steamid valido se usa como identidad', () => {
  assert.deepEqual(identidadDe('STEAM_0:1:23198516', 'Trevor'),
    { identidad: 'STEAM_0:1:23198516', steamid: 'STEAM_0:1:23198516' })
})

test('los bots se ignoran', () => {
  assert.equal(identidadDe('BOT', '[BOT] Sturm'), null)
})

test('steamids no validos caen al nick como identidad', () => {
  for (const invalido of ['STEAM_ID_LAN', 'STEAM_ID_PENDING', 'VALVE_ID_LAN', 'HLTV', '', 'STEAM_0:2:1']) {
    assert.deepEqual(identidadDe(invalido, 'Pepe'), { identidad: 'NICK:Pepe', steamid: null }, invalido)
  }
})
