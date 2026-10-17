/*
 *  Tests de integracion del catalogo de mapas, contra la base MySQL real.
 *  La clasificacion por tamaño se prueba aparte en tamano_mapas.test.mjs.
 *
 *  Correr con:  npm test
 */

import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { conectar, configDesdeEntorno } from './base.mjs'

const PREFIJO = `t${Math.floor(Math.random() * 1e8)}_`

let base

const catalogo = () => base.consultar(
  'SELECT mapa, area, tamano, activo, a_mano FROM {p}mapas_catalogo ORDER BY mapa'
    .replaceAll('{p}', PREFIJO))

before(async () => { base = await conectar(configDesdeEntorno(), PREFIJO) })

beforeEach(async () => {
  await base.borrarTablas()
  await base.aplicarEsquema()
})

after(async () => {
  await base.borrarTablas()
  await base.cerrar()
})

test('guarda los mapas con su tamaño calculado', async () => {
  const r = await base.guardarCatalogoMapas([
    { mapa: 'au_3v3_ctf', area: 2.4 },
    { mapa: 'au_gris_torres', area: 10.7 },
    { mapa: 'dod_charlie', area: 64.5 }
  ])

  assert.deepEqual(r, { guardados: 3, activos: 3 })
  assert.deepEqual((await catalogo()).map((m) => [m.mapa, m.tamano]), [
    ['au_3v3_ctf', 'chico'],
    ['au_gris_torres', 'mediano'],
    ['dod_charlie', 'grande']
  ])
})

test('correrlo dos veces no cambia nada', async () => {
  const mapas = [{ mapa: 'au_3v3_ctf', area: 2.4 }, { mapa: 'dod_charlie', area: 64.5 }]
  await base.guardarCatalogoMapas(mapas)
  const antes = await catalogo()
  await base.guardarCatalogoMapas(mapas)
  assert.deepEqual(await catalogo(), antes)
})

test('un mapa que ya no esta en la lista queda inactivo, no se borra', async () => {
  await base.guardarCatalogoMapas([
    { mapa: 'au_3v3_ctf', area: 2.4 },
    { mapa: 'dod_viejo', area: 30 }
  ])
  const r = await base.guardarCatalogoMapas([{ mapa: 'au_3v3_ctf', area: 2.4 }])

  assert.equal(r.activos, 1)
  /* Sigue estando: los votos que tenga apuntan a algo */
  assert.deepEqual((await catalogo()).map((m) => [m.mapa, m.activo]), [
    ['au_3v3_ctf', 1],
    ['dod_viejo', 0]
  ])
})

test('un mapa que vuelve a la lista se reactiva', async () => {
  await base.guardarCatalogoMapas([{ mapa: 'dod_charlie', area: 64.5 }])
  await base.guardarCatalogoMapas([{ mapa: 'au_3v3_ctf', area: 2.4 }])
  await base.guardarCatalogoMapas([{ mapa: 'dod_charlie', area: 64.5 }])

  const vuelto = (await catalogo()).find((m) => m.mapa === 'dod_charlie')
  assert.equal(vuelto.activo, 1)
})

test('el tamaño puesto a mano no se pisa, pero el area se actualiza igual', async () => {
  await base.guardarCatalogoMapas([{ mapa: 'dod_raro', area: 9 }])
  /* Alguien lo corrige: por area daba chico, pero se juega como grande */
  await base.consultar(
    `UPDATE ${PREFIJO}mapas_catalogo SET tamano = 'grande', a_mano = 1 WHERE mapa = 'dod_raro'`)

  await base.guardarCatalogoMapas([{ mapa: 'dod_raro', area: 9.5 }])

  const [m] = await catalogo()
  assert.equal(m.tamano, 'grande', 'la correccion a mano manda')
  assert.equal(Number(m.area), 9.5, 'el area si se actualiza')
})

test('un mapa sin medir queda sin tamaño en vez de caer en el grupo equivocado', async () => {
  await base.guardarCatalogoMapas([{ mapa: 'dod_sinmedir', area: null }])
  const [m] = await catalogo()
  assert.equal(m.tamano, null)
  assert.equal(m.area, null)
})

test('una lista vacia no desactiva todo', async () => {
  /* Si el server no contesta y la lista viene vacia, no hay que borrar el catalogo */
  await base.guardarCatalogoMapas([{ mapa: 'au_3v3_ctf', area: 2.4 }])
  const r = await base.guardarCatalogoMapas([])

  assert.equal(r.activos, 1)
  assert.deepEqual((await catalogo()).map((m) => m.activo), [1])
})
