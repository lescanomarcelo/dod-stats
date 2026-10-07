import test from 'node:test'
import assert from 'node:assert/strict'
import {
  METALES, RUBROS, rubroDeMedalla, medallaDe, proximoEscalon, medallasDe,
  contarMedallas, compararCuentas, type Escalon, type Cuenta
} from './medallas.ts'

const ESCALONES: Escalon[] = [
  { metal: 'bronce', marca: 10 },
  { metal: 'plata', marca: 100 },
  { metal: 'oro', marca: 1000 }
]

test('la medalla se gana justo en la marca, no un número antes', () => {
  assert.equal(medallaDe(9, ESCALONES), null)
  assert.equal(medallaDe(10, ESCALONES), 'bronce')
  assert.equal(medallaDe(99, ESCALONES), 'bronce')
  assert.equal(medallaDe(100, ESCALONES), 'plata')
  assert.equal(medallaDe(999, ESCALONES), 'plata')
  assert.equal(medallaDe(1000, ESCALONES), 'oro')
})

test('el que no jugó nunca no tiene nada', () => {
  assert.equal(medallaDe(0, ESCALONES), null)
})

test('pasarse de largo deja el metal más alto', () => {
  assert.equal(medallaDe(999999, ESCALONES), 'oro')
})

test('el próximo escalón dice cuánto falta', () => {
  assert.deepEqual(proximoEscalon(0, ESCALONES), { metal: 'bronce', marca: 10, falta: 10 })
  assert.deepEqual(proximoEscalon(10, ESCALONES), { metal: 'plata', marca: 100, falta: 90 })
  assert.deepEqual(proximoEscalon(999, ESCALONES), { metal: 'oro', marca: 1000, falta: 1 })
})

test('el que ya tiene el último escalón no tiene próximo', () => {
  assert.equal(proximoEscalon(1000, ESCALONES), null)
  assert.equal(proximoEscalon(5000, ESCALONES), null)
})

test('las medallas de un dodero salen de la más valiosa a la menos', () => {
  const ganadas = medallasDe({ kills: 6000, melee: 60, cohete: 0 })
  assert.deepEqual(ganadas.map((g) => [g.clave, g.metal]), [['kills', 'plata'], ['melee', 'bronce']])
})

test('un rubro sin dato es lo mismo que cero', () => {
  assert.deepEqual(medallasDe({}), [])
})

test('contar medallas da cero en los metales que no tiene', () => {
  assert.deepEqual(contarMedallas(medallasDe({ kills: 6000 })), { bronce: 0, plata: 1, oro: 0 })
})

test('para ordenar, un oro le gana a cualquier cantidad de plata', () => {
  const conOro: Cuenta = { bronce: 0, plata: 0, oro: 1 }
  const conPlatas: Cuenta = { bronce: 9, plata: 9, oro: 0 }
  assert.ok(compararCuentas(conOro, conPlatas) < 0)
  assert.ok(compararCuentas(conPlatas, conOro) > 0)
})

test('con el mismo oro desempata la plata, y después el bronce', () => {
  const a: Cuenta = { bronce: 1, plata: 2, oro: 1 }
  const b: Cuenta = { bronce: 5, plata: 1, oro: 1 }
  assert.ok(compararCuentas(a, b) < 0)

  const c: Cuenta = { bronce: 3, plata: 2, oro: 1 }
  assert.ok(compararCuentas(c, a) < 0)
  assert.equal(compararCuentas(a, a), 0)
})

test('el catálogo está sano: claves únicas y escalones de menor a mayor', () => {
  const claves = RUBROS.map((r) => r.clave)
  assert.equal(new Set(claves).size, claves.length)

  for (const rubro of RUBROS) {
    assert.ok(rubro.escalones.length > 0, `${rubro.clave} no tiene escalones`)
    for (let i = 1; i < rubro.escalones.length; i++) {
      assert.ok(
        rubro.escalones[i].marca > rubro.escalones[i - 1].marca,
        `${rubro.clave}: la marca de ${rubro.escalones[i].metal} no supera a la anterior`
      )
    }
    /* Los metales de un rubro van en el mismo orden que METALES */
    const orden = rubro.escalones.map((e) => METALES.indexOf(e.metal))
    assert.deepEqual(orden, [...orden].sort((x, y) => x - y), `${rubro.clave}: metales desordenados`)
  }
})

test('cada rubro se encuentra por su clave', () => {
  assert.equal(rubroDeMedalla('kills').nombre, 'Matador')
  assert.equal(rubroDeMedalla('acostado').formato(3600), '1h')
})
