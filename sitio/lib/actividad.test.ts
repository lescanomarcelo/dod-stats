/*
 *  Tests de la actividad del server (los graficos de "El Server"). Correr con: npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cubos, escalaDe, jugadoresPorCubo, permanenciaPorCubo, permanenciaTotal, pico, MAX_CUBOS,
  bordes,
  type Sesion
} from './actividad.ts'

/* Lunes 21/9/2026 en Argentina: de las 00:00 de aca (03:00 UTC) a las 00:00 del martes */
const DIA_DESDE = Date.parse('2026-09-21T03:00:00Z')
const DIA_HASTA = Date.parse('2026-09-22T03:00:00Z')

const sesion = (jugadorId: number, desde: string, hasta: string): Sesion =>
  ({ jugadorId, inicio: Date.parse(desde), fin: Date.parse(hasta) })

test('la escala depende del periodo', () => {
  assert.equal(escalaDe('dia'), 'hora')
  assert.equal(escalaDe('semana'), 'dia')
  assert.equal(escalaDe('mes'), 'dia')
  assert.equal(escalaDe('global'), 'mes')
})

test('un dia argentino son 24 cubos de una hora, etiquetados en hora de aca', () => {
  const lista = cubos('hora', DIA_DESDE, DIA_HASTA)
  assert.equal(lista.length, 24)
  assert.equal(lista[0].etiqueta, '00h')
  assert.equal(lista[0].clave, '2026-09-21 00')
  assert.equal(lista[23].etiqueta, '23h')
  assert.equal(lista[23].hasta, DIA_HASTA)
})

test('una semana son 7 cubos de un dia, y un mes tiene sus dias', () => {
  const semana = cubos('dia', DIA_DESDE, DIA_DESDE + 7 * 86400000)
  assert.equal(semana.length, 7)
  assert.equal(semana[0].etiqueta, '21/9')
  assert.equal(semana[6].etiqueta, '27/9')

  const septiembre = cubos('dia', Date.parse('2026-09-01T03:00:00Z'), Date.parse('2026-10-01T03:00:00Z'))
  assert.equal(septiembre.length, 30)
})

test('los meses se etiquetan cortos, con el año solo en enero', () => {
  const lista = cubos('mes', Date.parse('2025-12-01T03:00:00Z'), Date.parse('2026-03-01T03:00:00Z'))
  assert.deepEqual(lista.map((c) => c.etiqueta), ['dic', 'ene 26', 'feb'])
  assert.equal(lista[1].clave, '2026-01')
})

test('un rango absurdo se corta en MAX_CUBOS en vez de armar un grafico infinito', () => {
  const lista = cubos('hora', DIA_DESDE, DIA_DESDE + 1000 * 3600 * 1000)
  assert.equal(lista.length, MAX_CUBOS)
})

test('una sesion cuenta en todas las horas que pisa, no solo en la que empezo', () => {
  const lista = cubos('hora', DIA_DESDE, DIA_HASTA)
  const sesiones = [sesion(1, '2026-09-22T00:40:00Z', '2026-09-22T02:10:00Z')] /* 21:40 a 23:10 de aca */
  const cantidades = jugadoresPorCubo(sesiones, lista)

  assert.deepEqual(cantidades.slice(21, 24), [1, 1, 1])
  assert.equal(cantidades[20], 0)
})

test('el mismo jugador con dos sesiones en la misma hora cuenta una vez', () => {
  const lista = cubos('hora', DIA_DESDE, DIA_HASTA)
  const sesiones = [
    sesion(1, '2026-09-22T00:05:00Z', '2026-09-22T00:15:00Z'),
    sesion(1, '2026-09-22T00:30:00Z', '2026-09-22T00:45:00Z'),
    sesion(2, '2026-09-22T00:30:00Z', '2026-09-22T00:45:00Z')
  ]
  assert.equal(jugadoresPorCubo(sesiones, lista)[21], 2)
})

test('la permanencia es de las sesiones que empezaron en el cubo: promedio y maximo', () => {
  const lista = cubos('hora', DIA_DESDE, DIA_HASTA)
  const sesiones = [
    sesion(1, '2026-09-22T00:00:00Z', '2026-09-22T00:10:00Z'), /* 10 min, empieza 21h */
    sesion(2, '2026-09-22T00:20:00Z', '2026-09-22T01:20:00Z'), /* 60 min, empieza 21h */
    sesion(3, '2026-09-22T01:00:00Z', '2026-09-22T01:30:00Z') /*  30 min, empieza 22h */
  ]
  const p = permanenciaPorCubo(sesiones, lista)

  assert.deepEqual(p[21], { promedio: 35 * 60, maximo: 60 * 60 })
  assert.deepEqual(p[22], { promedio: 30 * 60, maximo: 30 * 60 })
  assert.deepEqual(p[20], { promedio: 0, maximo: 0 })

  assert.deepEqual(permanenciaTotal(sesiones), { promedio: (10 + 60 + 30) * 60 / 3, maximo: 3600 })
  assert.deepEqual(permanenciaTotal([]), { promedio: 0, maximo: 0 })
})

test('el pico es el cubo con mas gente; sin nadie no hay pico', () => {
  const lista = cubos('hora', DIA_DESDE, DIA_HASTA)
  const cantidades = lista.map((_, i) => (i === 22 ? 8 : i === 21 ? 5 : 0))

  assert.deepEqual(pico(lista, cantidades), { etiqueta: '22h', jugadores: 8 })
  assert.equal(pico(lista, lista.map(() => 0)), null)
})

test('los bordes salen del periodo, y en global de la sesion mas vieja hasta ahora', () => {
  const ahora = Date.parse('2026-09-22T13:00:00Z')
  const sesiones = [sesion(1, '2026-09-20T22:00:00Z', '2026-09-20T23:00:00Z')]

  assert.deepEqual(bordes({ desde: '2026-09-21T03:00:00Z', hasta: '2026-09-22T03:00:00Z' }, [], ahora),
    [DIA_DESDE, DIA_HASTA])
  assert.deepEqual(bordes({ desde: null, hasta: null }, sesiones, ahora), [sesiones[0].inicio, ahora])
  assert.deepEqual(bordes({ desde: null, hasta: null }, [], ahora), [ahora, ahora])
})
