/*
 *  Tests de la actividad del server (los graficos de "El Server"). Correr con: npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cubos, escalaDe, jugadoresPorCubo, permanenciaPorCubo, permanenciaTotal, pico, MAX_CUBOS,
  bordes, mediana, concurrenciaAlEmpezar, permanenciaConGente, proporcionFugaz, visitas, picoSimultaneo,
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

test('la permanencia es de las sesiones que empezaron en el cubo', () => {
  const lista = cubos('hora', DIA_DESDE, DIA_HASTA)
  const sesiones = [
    sesion(1, '2026-09-22T00:00:00Z', '2026-09-22T00:10:00Z'), /* 10 min, empieza 21h */
    sesion(2, '2026-09-22T00:20:00Z', '2026-09-22T01:20:00Z'), /* 60 min, empieza 21h */
    sesion(3, '2026-09-22T01:00:00Z', '2026-09-22T01:30:00Z') /*  30 min, empieza 22h */
  ]
  const p = permanenciaPorCubo(sesiones, lista)

  assert.deepEqual(p[21], { mediana: 35 * 60, promedio: 35 * 60, maximo: 60 * 60, cuantas: 2 })
  assert.deepEqual(p[22], { mediana: 30 * 60, promedio: 30 * 60, maximo: 30 * 60, cuantas: 1 })
  assert.deepEqual(p[20], { mediana: 0, promedio: 0, maximo: 0, cuantas: 0 })

  assert.deepEqual(permanenciaTotal(sesiones),
    { mediana: 30 * 60, promedio: (10 + 60 + 30) * 60 / 3, maximo: 3600, cuantas: 3 })
  assert.deepEqual(permanenciaTotal([]), { mediana: 0, promedio: 0, maximo: 0, cuantas: 0 })
})

test('la mediana no se deja arrastrar por las pasadas fugaces', () => {
  /* Nueve pasadas de un minuto y una partida de dos horas */
  const cortas = Array.from({ length: 9 }, (_, i) => ({ jugadorId: i, inicio: 0, fin: 60000 }))
  const larga = { jugadorId: 99, inicio: 0, fin: 2 * 3600 * 1000 }
  const p = permanenciaTotal([...cortas, larga])

  assert.equal(p.mediana, 60)
  assert.equal(p.promedio, Math.round((9 * 60 + 7200) / 10))
  assert.equal(mediana([]), 0)
  assert.equal(mediana([10, 20, 30, 40]), 25)
})

test('cuenta cuanta gente habia cuando empezo cada sesion', () => {
  const sesiones = [
    sesion(1, '2026-09-21T20:00:00Z', '2026-09-21T23:00:00Z'),
    sesion(2, '2026-09-21T21:00:00Z', '2026-09-21T22:00:00Z'),
    sesion(3, '2026-09-21T21:30:00Z', '2026-09-21T21:40:00Z'),
    /* Arranca justo cuando se fue el primero: no se cruzan */
    sesion(4, '2026-09-21T23:00:00Z', '2026-09-21T23:30:00Z')
  ]
  assert.deepEqual(concurrenciaAlEmpezar(sesiones), [1, 2, 3, 1])
  assert.equal(picoSimultaneo(sesiones), 3)
  assert.equal(picoSimultaneo([]), 0)
})

test('la permanencia con el server movido solo mira a los que entraron con gente', () => {
  /* Dos que entran solos y se quedan mucho; tres que entran juntos y se van rapido */
  const sesiones = [
    sesion(1, '2026-09-21T18:00:00Z', '2026-09-21T20:00:00Z'),
    sesion(2, '2026-09-21T21:00:00Z', '2026-09-21T21:10:00Z'),
    sesion(3, '2026-09-21T21:00:00Z', '2026-09-21T21:20:00Z'),
    sesion(4, '2026-09-21T21:01:00Z', '2026-09-21T21:31:00Z')
  ]
  /* Con umbral 3, solo la ultima entro con tres en el server */
  assert.equal(permanenciaConGente(sesiones, 3).cuantas, 1)
  assert.equal(permanenciaConGente(sesiones, 3).mediana, 30 * 60)
  assert.equal(permanenciaConGente(sesiones, 9).cuantas, 0)
})

test('la proporcion de pasadas fugaces', () => {
  const sesiones = [
    sesion(1, '2026-09-21T21:00:00Z', '2026-09-21T21:01:00Z'),
    sesion(2, '2026-09-21T21:00:00Z', '2026-09-21T21:02:00Z'),
    sesion(3, '2026-09-21T21:00:00Z', '2026-09-21T22:00:00Z'),
    sesion(4, '2026-09-21T21:00:00Z', '2026-09-21T23:00:00Z')
  ]
  assert.equal(proporcionFugaz(sesiones), 0.5)
  assert.equal(proporcionFugaz([]), 0)
})

test('el pico es el cubo con mas gente; sin nadie no hay pico', () => {
  const lista = cubos('hora', DIA_DESDE, DIA_HASTA)
  const cantidades = lista.map((_, i) => (i === 22 ? 8 : i === 21 ? 5 : 0))

  assert.deepEqual(pico(lista, cantidades), { etiqueta: '22h', jugadores: 8 })
  assert.equal(pico(lista, lista.map(() => 0)), null)
})

test('las sesiones cortadas por el cambio de mapa se pegan en una sola visita', () => {
  const sesiones = [
    /* Tres mapas seguidos del mismo jugador, con la reconexion de por medio */
    sesion(1, '2026-09-21T21:00:00Z', '2026-09-21T21:10:00Z'),
    sesion(1, '2026-09-21T21:10:03Z', '2026-09-21T21:25:00Z'),
    sesion(1, '2026-09-21T21:25:20Z', '2026-09-21T21:40:00Z'),
    /* Se fue y volvio dos horas despues: es otra visita */
    sesion(1, '2026-09-21T23:40:00Z', '2026-09-21T23:50:00Z'),
    /* Otro jugador, en el medio: no se mezcla con el primero */
    sesion(2, '2026-09-21T21:05:00Z', '2026-09-21T21:12:00Z')
  ]
  const lista = visitas(sesiones)

  assert.equal(lista.length, 3)
  assert.deepEqual(lista[0], {
    jugadorId: 1,
    inicio: Date.parse('2026-09-21T21:00:00Z'),
    fin: Date.parse('2026-09-21T21:40:00Z')
  })
  assert.equal(lista[1].jugadorId, 2)
  assert.equal(lista[2].fin, Date.parse('2026-09-21T23:50:00Z'))
})

test('una visita de un solo mapa queda igual, y sin sesiones no hay visitas', () => {
  const una = [sesion(7, '2026-09-21T21:00:00Z', '2026-09-21T21:08:00Z')]
  assert.deepEqual(visitas(una), una)
  assert.deepEqual(visitas([]), [])
})

test('los bordes salen del periodo, y en global de la sesion mas vieja hasta ahora', () => {
  const ahora = Date.parse('2026-09-22T13:00:00Z')
  const sesiones = [sesion(1, '2026-09-20T22:00:00Z', '2026-09-20T23:00:00Z')]

  assert.deepEqual(bordes({ desde: '2026-09-21T03:00:00Z', hasta: '2026-09-22T03:00:00Z' }, [], ahora),
    [DIA_DESDE, DIA_HASTA])
  assert.deepEqual(bordes({ desde: null, hasta: null }, sesiones, ahora), [sesiones[0].inicio, ahora])
  assert.deepEqual(bordes({ desde: null, hasta: null }, [], ahora), [ahora, ahora])
})
