/*
 *  Tests del archivo de tamaños revisados a mano. Correr con:  npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parsearTamanosAMano, leerTamanosAMano, RUTA } from './tamanos_a_mano.mjs'
import { TAMANOS } from './tamano_mapas.mjs'

const tsv = (...lineas) => lineas.join('\n') + '\n'

test('lee mapa y tamaño, salteando comentarios y titulos', () => {
  const r = parsearTamanosAMano(tsv(
    '# un comentario',
    '',
    'mapa\tarea\ttamano',
    'au_gris_torres\t10.7\tchico',
    'dod_charlie\t64.5\tgrande'
  ))
  assert.equal(r.size, 2)
  assert.equal(r.get('au_gris_torres'), 'chico')
  assert.equal(r.get('dod_charlie'), 'grande')
})

test('un mapa sin tamaño queda sin decidir, con su medida', () => {
  const r = parsearTamanosAMano(tsv('dod_nuevo\t12.3\t'))
  assert.equal(r.has('dod_nuevo'), false)
})

test('un tamaño mal escrito se avisa y se saltea, no rompe el resto', () => {
  const avisos = []
  const r = parsearTamanosAMano(tsv(
    'dod_uno\t5\tchiko',
    'dod_dos\t5\tchico'
  ), (m) => avisos.push(m))

  assert.equal(r.has('dod_uno'), false)
  assert.equal(r.get('dod_dos'), 'chico')
  assert.equal(avisos.length, 1)
  assert.match(avisos[0], /dod_uno/)
})

test('no importan las mayusculas ni los espacios de mas', () => {
  const r = parsearTamanosAMano(tsv('  au_plaza \t 13.3 \t  CHICO  '))
  assert.equal(r.get('au_plaza'), 'chico')
})

test('tolera fin de linea de Windows', () => {
  const r = parsearTamanosAMano('au_plaza\t13.3\tchico\r\n')
  assert.equal(r.get('au_plaza'), 'chico')
})

test('un archivo vacio o ausente no rompe', async () => {
  assert.equal(parsearTamanosAMano('').size, 0)
  assert.equal(parsearTamanosAMano(null).size, 0)

  const avisos = []
  const r = await leerTamanosAMano((m) => avisos.push(m), 'no-existe-este-archivo.tsv')
  assert.equal(r.size, 0)
  assert.deepEqual(avisos, [], 'que no exista no es un error')
})

/* ------------------------------------------------------------------ */
/*  El archivo de verdad                                               */
/* ------------------------------------------------------------------ */

test('el archivo del repo se lee y tiene los 83 mapas clasificados', async () => {
  const avisos = []
  const r = await leerTamanosAMano((m) => avisos.push(m))

  assert.deepEqual(avisos, [], 'no deberia haber tamaños mal escritos')
  assert.ok(r.size >= 80, `solo ${r.size} mapas clasificados`)
  for (const [mapa, tamano] of r) assert.ok(TAMANOS.includes(tamano), mapa)
})

test('el archivo no tiene mapas repetidos', async () => {
  const texto = await readFile(RUTA, 'utf8')
  const nombres = texto.split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('\t')[0])
    .filter((m) => m && m !== 'mapa')

  assert.equal(new Set(nombres).size, nombres.length, 'hay un mapa dos veces')
})
