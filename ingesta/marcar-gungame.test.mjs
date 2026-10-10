/*
 *  Tests de integracion del marcado de gungame, contra la base MySQL real.
 *
 *  La regla en si se prueba en gungame.test.mjs, que no toca la base. Esto prueba
 *  lo otro: que el SQL corra, que cada evento quede del lado que le toca y que
 *  volver a correrlo no cambie nada.
 *
 *  Correr con:  npm test
 */

import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { conectar, configDesdeEntorno } from './base.mjs'
import { crearFuenteLocal } from './fuentes.mjs'
import { ingerir } from './ingerir.mjs'

const PREFIJO = `t${Math.floor(Math.random() * 1e8)}_`
const ARCHIVO = 'eventos_20260921.tsv'

let base, carpeta, fuente

const P = (ts, mapa) => ['P', ts, mapa].join('\t')
const C = (ts, steam, nick) => ['C', ts, steam, nick].join('\t')
const M = ({ ts, mapa, arma, mS = 'STEAM_0:1:111', mN = 'Trevor', vS = 'STEAM_0:0:222', vN = 'Pepe' }) =>
  ['M', ts, mapa, mS, mN, 1, vS, vN, 2, arma, 2, 0, 100, 200, 36, 0, 0, 0].join('\t')
const S = (ts, mapa, puntos) => ['S', ts, mapa, 'STEAM_0:1:111', 'Trevor', 1, puntos].join('\t')
const E = (ts, mapa, inicio, aliados, eje) => ['E', ts, mapa, inicio, aliados, eje].join('\t')
const H = (ts, mapa) => ['H', ts, mapa, 'STEAM_0:1:111', 'Trevor', 0, 1, 2, 0, 0, 0, 0, 0, 150, 20].join('\t')

/* Muchas muertes con la misma arma, una por segundo desde ts */
const tanda = (ts, mapa, arma, cuantas) =>
  Array.from({ length: cuantas }, (_, i) => M({ ts: ts + i, mapa, arma }))

/*
 *  Un mapa de gungame como los de verdad: los dos arsenales en la misma partida.
 *  Arranca en ts y ocupa 200 segundos.
 */
const sesionGungame = (ts, mapa = 'dod_7quick') => [
  P(ts, mapa),
  C(ts + 1, 'STEAM_0:1:111', 'Trevor'),
  C(ts + 2, 'STEAM_0:0:222', 'Pepe'),
  ...tanda(ts + 10, mapa, 'Sten', 20),
  ...tanda(ts + 40, mapa, 'Webley', 10),
  ...tanda(ts + 60, mapa, 'BAR', 25),
  ...tanda(ts + 100, mapa, 'Garand', 20),
  S(ts + 150, mapa, 4),
  H(ts + 150, mapa),
  E(ts + 180, mapa, ts, 5, 3)
]

/* Un mapa normal: solo arsenal yanqui */
const sesionNormal = (ts, mapa = 'dod_kalt') => [
  P(ts, mapa),
  ...tanda(ts + 10, mapa, 'BAR', 30),
  ...tanda(ts + 50, mapa, 'Garand', 30),
  S(ts + 150, mapa, 7),
  H(ts + 150, mapa),
  E(ts + 180, mapa, ts, 8, 2)
]

const escribir = (lineas) => writeFile(join(carpeta, ARCHIVO), lineas.join('\n') + '\n')
const correr = () => ingerir({ fuente, base })

const traer = (sql, valores) => base.consultar(sql.replaceAll('{p}', PREFIJO), valores)
const contarGg = async (tabla) => {
  const [f] = await traer(`SELECT SUM(gg = 1) AS si, SUM(gg = 0) AS no FROM {p}${tabla}`)
  return { si: Number(f.si ?? 0), no: Number(f.no ?? 0) }
}

before(async () => {
  base = await conectar(configDesdeEntorno(), PREFIJO)
})

beforeEach(async () => {
  await base.borrarTablas()
  await base.aplicarEsquema()
  if (carpeta) await rm(carpeta, { recursive: true, force: true })
  carpeta = await mkdtemp(join(tmpdir(), 'dodstats-gg-'))
  fuente = crearFuenteLocal(carpeta)
})

after(async () => {
  await base.borrarTablas()
  await base.cerrar()
  if (carpeta) await rm(carpeta, { recursive: true, force: true })
})

test('una partida de gungame queda marcada y la normal no', async () => {
  await escribir([...sesionGungame(1000), ...sesionNormal(2000)])
  const r = await correr()

  assert.equal(r.sesionesGg, 1)

  const sesiones = await traer('SELECT mapa, gg FROM {p}mapas_jugados ORDER BY inicio')
  assert.deepEqual(sesiones.map((s) => [s.mapa, s.gg]), [['dod_7quick', 1], ['dod_kalt', 0]])
})

test('las muertes de la partida de gungame quedan marcadas, las otras no', async () => {
  await escribir([...sesionGungame(1000), ...sesionNormal(2000)])
  await correr()

  const { si, no } = await contarGg('muertes')
  assert.equal(si, 75)   /* 20 Sten + 10 Webley + 25 BAR + 20 Garand */
  assert.equal(no, 60)   /* 30 BAR + 30 Garand del mapa normal */

  /* Ninguna muerte con arma britanica quedo sin marcar */
  const [f] = await traer("SELECT COUNT(*) AS n FROM {p}muertes WHERE arma IN ('Sten','Webley') AND gg = 0")
  assert.equal(Number(f.n), 0)
})

test('los puntos y la partida tambien quedan marcados', async () => {
  await escribir([...sesionGungame(1000), ...sesionNormal(2000)])
  await correr()

  assert.deepEqual(await contarGg('puntos'), { si: 1, no: 1 })

  const partidas = await traer('SELECT mapa, gg FROM {p}partidas ORDER BY inicio')
  assert.deepEqual(partidas.map((p) => [p.mapa, p.gg]), [['dod_7quick', 1], ['dod_kalt', 0]])
})

test('los impactos del mapa que solo se jugo en gungame quedan marcados', async () => {
  await escribir([...sesionGungame(1000), ...sesionNormal(2000)])
  const r = await correr()

  assert.deepEqual(r.alertas, [])
  const impactos = await traer('SELECT mapa, gg FROM {p}impactos ORDER BY mapa')
  assert.deepEqual(impactos.map((i) => [i.mapa, i.gg]), [['dod_7quick', 1], ['dod_kalt', 0]])
})

test('si el mismo mapa se jugo normal alguna vez, ya no se marca por mapa', async () => {
  /* La misma sesion de gg, pero el mapa tambien se jugo normal: los impactos de
     ese mapa mezclan las dos cosas y no se pueden partir, asi que no se marcan */
  await escribir([...sesionGungame(1000), ...sesionNormal(2000, 'dod_7quick')])
  await correr()

  const impactos = await traer('SELECT mapa, gg FROM {p}impactos')
  assert.deepEqual(impactos.map((i) => i.gg), [0])

  /* Pero las muertes, que tienen momento propio, siguen bien separadas */
  const { si, no } = await contarGg('muertes')
  assert.equal(si, 75)
  assert.equal(no, 60)
})

test('una muerte justo en el arranque del mapa siguiente cuenta para el siguiente', async () => {
  /* El mapa normal arranca en 2000 y la muerte cae exactamente ahi */
  await escribir([...sesionGungame(1000), P(2000, 'dod_kalt'), M({ ts: 2000, mapa: 'dod_kalt', arma: 'BAR' })])
  await correr()

  /* Es la unica muerte del mapa normal, y es la ultima de todas */
  const [f] = await traer('SELECT mapa, gg FROM {p}muertes ORDER BY momento DESC, id DESC LIMIT 1')
  assert.equal(f.mapa, 'dod_kalt')
  assert.equal(f.gg, 0)
})

test('correrlo dos veces da lo mismo', async () => {
  await escribir([...sesionGungame(1000), ...sesionNormal(2000)])
  await correr()
  const antes = await contarGg('muertes')

  await base.marcarGungame()
  assert.deepEqual(await contarGg('muertes'), antes)
  assert.deepEqual(await contarGg('puntos'), { si: 1, no: 1 })
})

test('desmarca lo que dejo de corresponder', async () => {
  await escribir([...sesionGungame(1000), ...sesionNormal(2000)])
  await correr()

  /* Alguien marco todo a mano: el recalculo tiene que volver a dejarlo bien */
  for (const tabla of ['muertes', 'puntos', 'impactos', 'partidas', 'mapas_jugados']) {
    await traer(`UPDATE {p}${tabla} SET gg = 1`)
  }
  await base.marcarGungame()

  assert.deepEqual(await contarGg('muertes'), { si: 75, no: 60 })
  assert.deepEqual(await contarGg('mapas_jugados'), { si: 1, no: 1 })
  assert.deepEqual(await contarGg('impactos'), { si: 1, no: 1 })
})

test('sin ninguna partida de gungame no marca nada', async () => {
  await escribir([...sesionNormal(1000), ...sesionNormal(2000, 'dod_anzio')])
  const r = await correr()

  assert.equal(r.sesionesGg, 0)
  assert.deepEqual(await contarGg('muertes'), { si: 0, no: 120 })
})

test('una base sin mapas ni muertes no rompe', async () => {
  const r = await base.marcarGungame()
  assert.equal(r.sesiones, 0)
  assert.equal(r.sesionesGg, 0)
  assert.deepEqual(r.mapasPuros, [])
})

/* ------------------------------------------------------------------ */
/*  Victorias del gungame (la planilla que lleva el propio plugin)     */
/* ------------------------------------------------------------------ */

const TREVOR = 'STEAM_0:1:111'
const PEPE = 'STEAM_0:0:222'

/* Deja jugadores en la base para poder emparejarlos */
const conJugadores = () => escribir([
  P(1000, 'dod_kalt'),
  C(1001, TREVOR, 'Trevor'),
  C(1002, PEPE, 'Pepe'),
  M({ ts: 1010, mapa: 'dod_kalt', arma: 'BAR', mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe' }),
  M({ ts: 1011, mapa: 'dod_kalt', arma: 'BAR', mS: PEPE, mN: 'Pepe', vS: TREVOR, vN: 'Trevor' })
])

const ganadas = () => traer('SELECT j.nick, g.ganadas FROM {p}gungame_ganadas g JOIN {p}jugadores j ON j.id = g.jugador_id ORDER BY g.ganadas DESC, j.nick')

test('guarda las victorias de los jugadores que estan en la base', async () => {
  await conJugadores()
  await correr()

  const r = await base.guardarGungameGanadas([
    { steamid: TREVOR, nick: 'Trevor', ganadas: 5, visto: new Date(1791587749000) },
    { steamid: PEPE, nick: 'Pepe', ganadas: 2, visto: new Date(1791587749000) }
  ])

  assert.equal(r.guardados, 2)
  assert.deepEqual(r.sinJugador, [])
  assert.deepEqual(await ganadas(), [{ nick: 'Trevor', ganadas: 5 }, { nick: 'Pepe', ganadas: 2 }])
})

test('el que no esta en la base se avisa y no frena a los demas', async () => {
  await conJugadores()
  await correr()

  const r = await base.guardarGungameGanadas([
    { steamid: TREVOR, nick: 'Trevor', ganadas: 5, visto: null },
    { steamid: 'STEAM_0:1:999', nick: 'Fantasma', ganadas: 9, visto: null }
  ])

  assert.equal(r.guardados, 1)
  assert.deepEqual(r.sinJugador, ['STEAM_0:1:999'])
  assert.deepEqual(await ganadas(), [{ nick: 'Trevor', ganadas: 5 }])
})

test('se queda con el maximo: si el gungame poda y vuelve a cero, no se pierde', async () => {
  await conJugadores()
  await correr()

  await base.guardarGungameGanadas([{ steamid: TREVOR, nick: 'Trevor', ganadas: 5, visto: null }])
  /* El gungame lo podo y arranco de nuevo */
  await base.guardarGungameGanadas([{ steamid: TREVOR, nick: 'Trevor', ganadas: 1, visto: null }])

  assert.deepEqual(await ganadas(), [{ nick: 'Trevor', ganadas: 5 }])
})

test('si gana mas, sube', async () => {
  await conJugadores()
  await correr()

  await base.guardarGungameGanadas([{ steamid: TREVOR, nick: 'Trevor', ganadas: 5, visto: null }])
  await base.guardarGungameGanadas([{ steamid: TREVOR, nick: 'Trevor', ganadas: 8, visto: null }])

  assert.deepEqual(await ganadas(), [{ nick: 'Trevor', ganadas: 8 }])
})

test('una planilla vacia no rompe', async () => {
  const r = await base.guardarGungameGanadas([])
  assert.equal(r.guardados, 0)
})
