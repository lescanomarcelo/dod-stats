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

test('la lista revisada a mano manda sobre la medida', async () => {
  /* Por area daria chico, pero el que juega dice que es grande */
  const aMano = new Map([['dod_raro', 'grande']])
  await base.guardarCatalogoMapas([{ mapa: 'dod_raro', area: 9 }], aMano)

  const [m] = await catalogo()
  assert.equal(m.tamano, 'grande')
  assert.equal(m.a_mano, 1, 'queda marcado como revisado')
  assert.equal(Number(m.area), 9, 'la medida se guarda igual, de referencia')
})

test('un mapa que no esta en la lista va por medida', async () => {
  await base.guardarCatalogoMapas(
    [{ mapa: 'dod_raro', area: 9 }, { mapa: 'dod_nuevo', area: 40 }],
    new Map([['dod_raro', 'grande']]))

  const porMapa = Object.fromEntries((await catalogo()).map((m) => [m.mapa, m]))
  assert.equal(porMapa.dod_nuevo.tamano, 'grande', 'por area, 40 es grande')
  assert.equal(porMapa.dod_nuevo.a_mano, 0, 'no esta revisado')
})

test('sacar un mapa de la lista lo devuelve a la medida', async () => {
  await base.guardarCatalogoMapas([{ mapa: 'dod_raro', area: 9 }], new Map([['dod_raro', 'grande']]))
  /* Se arrepintio y lo borro del archivo */
  await base.guardarCatalogoMapas([{ mapa: 'dod_raro', area: 9 }], new Map())

  const [m] = await catalogo()
  assert.equal(m.tamano, 'chico', 'vuelve a lo que dice la medida')
  assert.equal(m.a_mano, 0)
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
