/*
 *  Tests del parser de users.ini (la lista de admines).
 *
 *  Lo mas importante que se prueba aca: la contrasena del admin, que esta en el
 *  archivo, no sale por ningun lado.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsearUsuarios, tipoDeClave } from './admines.mjs'

const ARCHIVO = `
; Format: "<name|ip|steamid>" "<password>" "<access flags>" "<account flags>"
"STEAM_0:1:12345" "" "abcdefghijklmnopqrstu" "ce"
"Trevor"          "mi-clave-secreta" "abcdefghij" "a"
"127.0.0.1"       "otra" "b" "de"
loopback          "" "abcdefghijklmnopqrstuv" "de"

basura
`

test('saca los admines con su tipo y su acceso', () => {
  const admines = parsearUsuarios(ARCHIVO)
  assert.deepEqual(admines, [
    { clave: 'STEAM_0:1:12345', tipo: 'steamid', acceso: 'abcdefghijklmnopqrstu' },
    { clave: 'Trevor', tipo: 'nick', acceso: 'abcdefghij' },
    { clave: '127.0.0.1', tipo: 'ip', acceso: 'b' },
    { clave: 'loopback', tipo: 'nick', acceso: 'abcdefghijklmnopqrstuv' }
  ])
})

test('la contrasena no queda en ningun campo de la salida', () => {
  const texto = JSON.stringify(parsearUsuarios(ARCHIVO))
  assert.ok(!texto.includes('mi-clave-secreta'))
  assert.ok(!texto.includes('otra'))
})

test('ignora comentarios, lineas vacias y lineas sin contrasena', () => {
  assert.deepEqual(parsearUsuarios('; nada\n\n// tampoco\nsolo-un-campo\n'), [])
})

test('no repite a un admin que figura dos veces', () => {
  const admines = parsearUsuarios('"Trevor" "a" "bc"\n"Trevor" "a" "de"\n')
  assert.equal(admines.length, 1)
  assert.equal(admines[0].acceso, 'bc')
})

test('el tipo de clave', () => {
  assert.equal(tipoDeClave('STEAM_0:0:1'), 'steamid')
  assert.equal(tipoDeClave('10.0.0.7'), 'ip')
  assert.equal(tipoDeClave('=CMAX= Fenix'), 'nick')
})
