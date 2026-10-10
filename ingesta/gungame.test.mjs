/*
 *  Tests de la deteccion de gungame. Correr con:  npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  esGungame, clasificarSesiones, MINIMO, MUERTES_PARA_JUZGAR,
  ARSENAL_BRITANICO, ARSENAL_YANQUI, ARMAS_DELATORAS
} from './gungame.mjs'

/* Las cuatro partidas de gungame del historial, con sus numeros reales */
const GG_REALES = [
  { Sten: 17, Webley: 14, Bren: 10, Enfield: 11, 'Enfield bayonet': 3, BAR: 40, Garand: 30, Thompson: 19 },
  { Sten: 15, Webley: 7, Bren: 5, Enfield: 5, 'Enfield bayonet': 2, BAR: 25, Garand: 18, Thompson: 9 },
  { Sten: 25, Webley: 13, Bren: 7, Enfield: 11, BAR: 42, Garand: 28, Thompson: 16 },
  { Sten: 14, Webley: 10, Bren: 12, Enfield: 5, 'Enfield bayonet': 1, BAR: 35, Garand: 24, Thompson: 15 }
]

test('las cuatro partidas de gungame reales dan gungame', () => {
  for (const armas of GG_REALES) assert.equal(esGungame(armas), true)
})

test('un mapa yanqui normal no da gungame', () => {
  assert.equal(esGungame({ BAR: 120, Garand: 98, Thompson: 40, Springfield: 30, Colt: 12 }), false)
})

test('un mapa britanico normal tampoco da gungame', () => {
  /* Si algun dia entra un mapa britanico de verdad: britanicas sin yanquis */
  assert.equal(esGungame({ Sten: 40, Bren: 22, Enfield: 35, Webley: 8 }), false)
})

test('el PIAT solo no delata nada', () => {
  /* au_gris_torres le da el PIAT a los aliados en juego normal */
  assert.equal(esGungame({ piat: 7, BAR: 60, Garand: 45 }), false)
})

test('una sola muerte britanica suelta no ensucia un mapa normal', () => {
  assert.equal(esGungame({ Sten: 1, BAR: 80, Garand: 60 }), false)
})

test('el minimo se cumple justo', () => {
  const justo = { Sten: MINIMO, BAR: MINIMO }
  assert.equal(esGungame(justo), true)
  assert.equal(esGungame({ Sten: MINIMO - 1, BAR: MINIMO }), false)
  assert.equal(esGungame({ Sten: MINIMO, BAR: MINIMO - 1 }), false)
})

test('suma las armas de cada arsenal, no las cuenta por separado', () => {
  /* Una de cada arma britanica suma 3, aunque ninguna llegue a 3 sola */
  assert.equal(esGungame({ Sten: 1, Bren: 1, Webley: 1, BAR: 3 }), true)
})

test('una partida sin muertes no es gungame', () => {
  assert.equal(esGungame({}), false)
  assert.equal(esGungame(null), false)
  assert.equal(esGungame(undefined), false)
})

test('ignora cantidades invalidas o negativas', () => {
  assert.equal(esGungame({ Sten: 'muchas', BAR: 10 }), false)
  assert.equal(esGungame({ Sten: -50, BAR: 10 }), false)
})

test('un arma desconocida no cuenta para ningun arsenal', () => {
  assert.equal(esGungame({ lanzallamas: 999, BAR: 10 }), false)
})

test('los dos arsenales no se pisan', () => {
  for (const arma of ARSENAL_BRITANICO) assert.ok(!ARSENAL_YANQUI.includes(arma), arma)
  assert.equal(ARMAS_DELATORAS.length, ARSENAL_BRITANICO.length + ARSENAL_YANQUI.length)
  assert.equal(new Set(ARMAS_DELATORAS).size, ARMAS_DELATORAS.length)
})

test('el PIAT no esta en ningun arsenal', () => {
  assert.ok(!ARMAS_DELATORAS.includes('piat'))
})

/* ------------------------------------------------------------------ */
/*  clasificarSesiones                                                 */
/* ------------------------------------------------------------------ */

const gg = (id, mapa, muertes = 300) => ({ id, mapa, muertes, armas: GG_REALES[0] })
const normal = (id, mapa, muertes = 300) => ({ id, mapa, muertes, armas: { BAR: 100, Garand: 80 } })

test('devuelve los ids de las sesiones de gungame', () => {
  const r = clasificarSesiones([gg(1, 'dod_7quick'), normal(2, 'dod_saints'), gg(3, 'dod_7quick')])
  assert.deepEqual(r.gg, [1, 3])
})

test('un mapa que solo se jugo en gungame queda como puro', () => {
  const r = clasificarSesiones([gg(1, 'dod_7quick'), gg(2, 'dod_7quick'), normal(3, 'dod_saints')])
  assert.deepEqual(r.mapasPuros, ['dod_7quick'])
})

test('un mapa con una partida normal de verdad ya no es puro', () => {
  const r = clasificarSesiones([gg(1, 'dod_7quick'), normal(2, 'dod_7quick')])
  assert.deepEqual(r.mapasPuros, [])
})

test('una sesion corta no le saca la pureza al mapa', () => {
  /* Arranco el mapa, lo cambiaron enseguida: no prueba que se jugo normal */
  const corta = normal(2, 'dod_7quick', MUERTES_PARA_JUZGAR - 1)
  const r = clasificarSesiones([gg(1, 'dod_7quick'), corta])
  assert.deepEqual(r.mapasPuros, ['dod_7quick'])
})

test('una sesion normal justo en el limite si le saca la pureza', () => {
  const alLimite = normal(2, 'dod_7quick', MUERTES_PARA_JUZGAR)
  const r = clasificarSesiones([gg(1, 'dod_7quick'), alLimite])
  assert.deepEqual(r.mapasPuros, [])
})

test('un mapa sin ninguna partida de gungame no es puro', () => {
  const r = clasificarSesiones([normal(1, 'dod_saints'), normal(2, 'dod_saints')])
  assert.deepEqual(r.mapasPuros, [])
  assert.deepEqual(r.gg, [])
})

test('sin sesiones no devuelve nada', () => {
  const r = clasificarSesiones([])
  assert.deepEqual(r.gg, [])
  assert.deepEqual(r.mapasPuros, [])
})
