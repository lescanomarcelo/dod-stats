/*
 *  Tests de la conversion mundo -> imagen.
 *
 *  Estos tests fijan la matematica. La prueba de que la orientacion es la correcta
 *  para los mapas reales esta en mapas/validar.mjs: proyecta spawns y banderas de los
 *  22 mapas stock y verifica que caigan sobre el mapa (902 de 902).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mundoAImagen, puntosAImagen, leerOverviewTxt, type Overview } from './overview.ts'

const normal: Overview = { zoom: 1, origenX: 100, origenY: 200, rotado: false }
const rotado: Overview = { ...normal, rotado: true }
const cerca = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('el ORIGIN cae en el centro de la imagen', () => {
  for (const ov of [normal, rotado]) {
    const { u, v } = mundoAImagen(ov, 100, 200)
    cerca(u, 0.5); cerca(v, 0.5)
  }
})

test('overview normal: el eje Y del mundo va a lo ancho, el X a lo alto (ambos invertidos)', () => {
  /* 4096 unidades a zoom 1 = medio ancho de imagen */
  let p = mundoAImagen(normal, 100, 200 - 4096)
  cerca(p.u, 1); cerca(p.v, 0.5)
  p = mundoAImagen(normal, 100 - 3072, 200)
  cerca(p.u, 0.5); cerca(p.v, 1)
})

test('overview rotado: el eje X del mundo va a lo ancho, el Y a lo alto (invertido)', () => {
  let p = mundoAImagen(rotado, 100 + 4096, 200)
  cerca(p.u, 1); cerca(p.v, 0.5)
  p = mundoAImagen(rotado, 100, 200 - 3072)
  cerca(p.u, 0.5); cerca(p.v, 1)
})

test('el zoom achica la porcion del mundo que cubre la imagen', () => {
  const ov: Overview = { ...rotado, zoom: 2 }
  const p = mundoAImagen(ov, 100 + 2048, 200)
  cerca(p.u, 1)
})

test('misma escala en los dos ejes: 8/zoom unidades por pixel en una imagen de 1024x768', () => {
  const ov: Overview = { ...rotado, zoom: 1.3 }
  const a = mundoAImagen(ov, 100, 200)
  const b = mundoAImagen(ov, 100 + 800, 200 - 800)
  const pxAncho = (b.u - a.u) * 1024
  const pxAlto = (b.v - a.v) * 768
  cerca(pxAncho, pxAlto)
  cerca(pxAncho, 800 / (8 / 1.3))
})

test('puntosAImagen descarta lo que cae fuera y devuelve una lista plana redondeada', () => {
  const r = puntosAImagen(rotado, [[100, 200], [100 + 99999, 200], [100 + 1234.5678, 200]])
  assert.equal(r.length, 4, 'el punto de afuera se descarta')
  assert.deepEqual(r.slice(0, 2), [0.5, 0.5])
  assert.equal(r[2], Math.round((0.5 + 1234.5678 / 8192) * 1e4) / 1e4)
})

test('lee el .txt real de dod_kalt', () => {
  const kalt = `global \n{\n\tZOOM\t\t1.30\n\tORIGIN\t128.91\t-791.03\t128.00\n\tROTATED\t0\n}\nlayer \n{\n\tIMAGE\t"overviews/dod_kalt.bmp"\n\tHEIGHT\t-273.00\n}`
  assert.deepEqual(leerOverviewTxt(kalt), { zoom: 1.3, origenX: 128.91, origenY: -791.03, rotado: false })
})

test('lee valores tipo ".85" e ignora comentarios', () => {
  const txt = '// overview description file for dod_flugplatz.bsp\nglobal\n{\n\tZOOM\t.85\n\tORIGIN\t199.50\t-33.00\t-559.00\n\tROTATED\t1\n}'
  assert.deepEqual(leerOverviewTxt(txt), { zoom: 0.85, origenX: 199.5, origenY: -33, rotado: true })
})

test('un .txt incompleto devuelve null en vez de valores inventados', () => {
  assert.equal(leerOverviewTxt('global { ROTATED 0 }'), null)
  assert.equal(leerOverviewTxt('global { ZOOM 0 ORIGIN 1 2 3 }'), null, 'zoom 0 no es valido')
})
