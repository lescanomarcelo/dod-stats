/*
 *  Que ninguna consulta se olvide de sacar el gungame.
 *
 *  Lo que se jugo en gungame no cuenta para las estadisticas (ver el comentario de
 *  TABLAS_CON_GG en consultas.ts). El filtro se pone en cada consulta, y una
 *  consulta nueva que lo olvide no rompe nada: simplemente devuelve numeros con
 *  gungame adentro, que es justo lo dificil de notar.
 *
 *  Este test lee el codigo fuente y revisa que toda consulta que toque una de esas
 *  tablas tenga el filtro, sea escrito a mano o puesto por filtro().
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FUENTE = readFileSync(fileURLToPath(new URL('./consultas.ts', import.meta.url)), 'utf8')

const TABLAS = ['muertes', 'puntos', 'partidas', 'acostado', 'jugado', 'impactos']

/*
 *  El nombre tiene que terminar ahi: {p}jugado no es {p}jugadores, y sin esto
 *  cualquier consulta que haga JOIN con jugadores parecia tocar la tabla jugado.
 */
const mencion = (tabla: string) => new RegExp(`\\{p\\}${tabla}\\b`)

/*
 *  Las que miran la tabla sin ser una estadistica. Van con el motivo al lado: si
 *  alguna vez hay que agregar una, que se vea por que.
 */
const PERDONADAS = [
  /* Desde cuando hay datos de tiempo en juego: es una fecha, no una estadistica */
  'SELECT MIN(actualizado) AS desde FROM {p}jugado'
]

/** Parte el archivo en los textos de SQL que tiene adentro */
function consultasDelArchivo (fuente: string): string[] {
  /* Los template literals: es como estan escritas todas las consultas */
  /* [^`] ya incluye los saltos de linea: no hace falta la bandera s */
  const plantillas = fuente.match(/`[^`]*`/g) ?? []
  /* Y las pocas que entran en una linea con comillas simples */
  const sueltas = fuente.match(/'SELECT[^']*'/g) ?? []
  return [...plantillas, ...sueltas].filter((s) => /\{p\}/.test(s))
}

test('toda consulta que toque una tabla con gungame lo filtra', () => {
  const olvidadas: string[] = []

  for (const sql of consultasDelArchivo(FUENTE)) {
    const tabla = TABLAS.find((t) => mencion(t).test(sql))
    if (!tabla) continue
    if (PERDONADAS.some((p) => sql.includes(p))) continue

    /* O lo filtra a mano, o lo pone filtro() por su interpolacion */
    const aMano = /\bgg = 0\b/.test(sql)
    const porFiltro = /\$\{\w+\.sql\}/.test(sql)
    if (!aMano && !porFiltro) olvidadas.push(sql.trim().split('\n').slice(0, 3).join(' ').slice(0, 120))
  }

  assert.deepEqual(olvidadas, [], `consultas sin el filtro de gungame:\n  ${olvidadas.join('\n  ')}`)
})

test('el test se da cuenta cuando falta el filtro', () => {
  /* Si no, podria estar pasando por no encontrar ninguna consulta */
  const inventada = 'const q = `SELECT * FROM {p}muertes WHERE matador_id = ?`'
  const encontradas = consultasDelArchivo(inventada)
  assert.equal(encontradas.length, 1)
  assert.ok(!/\bgg = 0\b/.test(encontradas[0]))
})

test('encuentra una cantidad razonable de consultas', () => {
  /* Un cambio que rompa el troceado dejaria el test anterior sin nada que mirar */
  const conTabla = consultasDelArchivo(FUENTE).filter((s) => TABLAS.some((t) => mencion(t).test(s)))
  assert.ok(conTabla.length >= 25, `solo encontro ${conTabla.length} consultas`)
})
