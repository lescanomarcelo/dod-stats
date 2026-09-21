/*
 *  Tests de integracion de la ingesta, contra la base MySQL real.
 *
 *  Cada corrida usa tablas con un prefijo aleatorio (t<numero>_) que se borran al
 *  terminar. Las tablas de produccion no se tocan: borrarTablas() se niega a correr
 *  sin prefijo.
 *
 *  Correr con:  npm test
 */

import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, appendFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { conectar, configDesdeEntorno } from './base.mjs'
import { crearFuenteLocal } from './fuentes.mjs'
import { ingerir } from './ingerir.mjs'
import { parsearFragmento } from './parsear.mjs'

const PREFIJO = `t${Math.floor(Math.random() * 1e8)}_`
const ARCHIVO = 'eventos_20260921.tsv'

let base, carpeta, fuente

/* Constructores de lineas: replican los formatex() de dod_stats_registro.sma */
const P = (ts, mapa = 'dod_kalt') => ['P', ts, mapa].join('\t')
const C = (ts, steam, nick) => ['C', ts, steam, nick].join('\t')
const D = (ts, steam, nick, segundos) => ['D', ts, steam, nick, segundos].join('\t')
const M = ({ ts, mapa = 'dod_kalt', mS = '', mN = '', mE = 0, vS, vN, vE = 2,
  arma = 'kar', hb = 2, tk = 0, v = [100, 200, 36], m = [0, 0, 0] }) =>
  ['M', ts, mapa, mS, mN, mE, vS, vN, vE, arma, hb, tk, ...v, ...m].join('\t')

const TREVOR = 'STEAM_0:1:111'
const PEPE = 'STEAM_0:0:222'

const escribir = (lineas, nombre = ARCHIVO) =>
  writeFile(join(carpeta, nombre), lineas.join('\n') + '\n')
const agregar = (lineas, nombre = ARCHIVO) =>
  appendFile(join(carpeta, nombre), lineas.join('\n') + '\n')

const correr = () => ingerir({ fuente, base })
const jugador = async (nick) => (await base.ranking()).find((j) => j.nick === nick)

before(async () => {
  base = await conectar(configDesdeEntorno(), PREFIJO)
})

beforeEach(async () => {
  await base.borrarTablas()
  await base.aplicarEsquema()
  if (carpeta) await rm(carpeta, { recursive: true, force: true })
  carpeta = await mkdtemp(join(tmpdir(), 'dodstats-'))
  fuente = crearFuenteLocal(carpeta)
})

after(async () => {
  await base.borrarTablas()
  await base.cerrar()
  if (carpeta) await rm(carpeta, { recursive: true, force: true })
})

/* ------------------------------------------------------------------ */
/*  Camino feliz                                                       */
/* ------------------------------------------------------------------ */

test('una partida completa termina bien reflejada en el ranking', async () => {
  await escribir([
    P(1000),
    C(1001, TREVOR, 'Trevor'),
    C(1002, PEPE, 'Pepe'),
    M({ ts: 1010, mS: TREVOR, mN: 'Trevor', mE: 1, vS: PEPE, vN: 'Pepe', hb: 1 }),
    M({ ts: 1020, mS: TREVOR, mN: 'Trevor', mE: 1, vS: PEPE, vN: 'Pepe', hb: 2 }),
    M({ ts: 1030, mS: PEPE, mN: 'Pepe', mE: 2, vS: TREVOR, vN: 'Trevor', vE: 1 }),
    D(1600, TREVOR, 'Trevor', 599),
    D(1300, PEPE, 'Pepe', 298)
  ])

  const r = await correr()
  assert.equal(r.muertes, 3)
  assert.equal(r.sesiones, 2)
  assert.equal(r.mapas, 1)

  const trevor = await jugador('Trevor')
  assert.equal(trevor.kills, 2)
  assert.equal(trevor.headshots, 1)
  assert.equal(trevor.muertes, 1)
  assert.equal(trevor.segundos_jugados, 599)

  const pepe = await jugador('Pepe')
  assert.equal(pepe.kills, 1)
  assert.equal(pepe.muertes, 2)
  assert.equal(pepe.segundos_jugados, 298)
})

test('las coordenadas de la muerte quedan guardadas para los heatmaps', async () => {
  await escribir([M({ ts: 1010, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe',
    v: [-1696, -48, -65], m: [400, -300, 36] })])
  await correr()

  const [fila] = await base.consultar('SELECT * FROM {p}muertes')
  assert.deepEqual([fila.victima_x, fila.victima_y, fila.victima_z], [-1696, -48, -65])
  assert.deepEqual([fila.matador_x, fila.matador_y, fila.matador_z], [400, -300, 36])
})

/* ------------------------------------------------------------------ */
/*  Nunca duplicar, nunca perder                                       */
/* ------------------------------------------------------------------ */

test('correr la ingesta dos veces no duplica nada', async () => {
  await escribir([M({ ts: 1010, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe' })])

  await correr()
  const segunda = await correr()

  assert.equal(segunda.archivos, 0, 'la segunda pasada no debe encontrar novedades')
  assert.equal(await base.contar('muertes'), 1)
  assert.equal((await jugador('Trevor')).kills, 1)
})

test('si el archivo crece, la siguiente pasada carga solo lo nuevo', async () => {
  await escribir([M({ ts: 1010, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe' })])
  await correr()

  await agregar([
    M({ ts: 1020, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe' }),
    M({ ts: 1030, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe' })
  ])
  const r = await correr()

  assert.equal(r.muertes, 2)
  assert.equal((await jugador('Trevor')).kills, 3)
})

test('una linea a medio escribir se carga una sola vez cuando se completa', async () => {
  const completa = M({ ts: 1010, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe' })
  const segunda = M({ ts: 1020, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe' })

  /* El plugin estaba escribiendo la segunda linea cuando bajamos el archivo */
  await writeFile(join(carpeta, ARCHIVO), completa + '\n' + segunda.slice(0, 25))
  await correr()
  assert.equal(await base.contar('muertes'), 1)

  /* El plugin termino de escribirla */
  await appendFile(join(carpeta, ARCHIVO), segunda.slice(25) + '\n')
  await correr()
  assert.equal(await base.contar('muertes'), 2)

  await correr()
  assert.equal(await base.contar('muertes'), 2, 'una pasada extra no agrega nada')
})

test('un corte antes del COMMIT no deja nada a medias y se puede reintentar', async () => {
  const contenido = [
    C(1001, TREVOR, 'Trevor'),
    M({ ts: 1010, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe' })
  ].join('\n') + '\n'
  const { eventos, bytesConsumidos } = parsearFragmento(contenido)

  await assert.rejects(
    base.guardarLote(ARCHIVO, bytesConsumidos, eventos, 0, { fallarAntesDeConfirmar: true }),
    /corte simulado/)

  assert.equal(await base.contar('muertes'), 0, 'no quedaron muertes')
  assert.equal(await base.contar('jugadores'), 0, 'tampoco quedaron jugadores creados en el lote')
  assert.equal(await base.leerOffset(ARCHIVO), 0, 'el offset no avanzo')

  /* Reintento normal */
  await writeFile(join(carpeta, ARCHIVO), contenido)
  await correr()
  assert.equal(await base.contar('muertes'), 1)
})

test('con otra ingesta en curso, la segunda termina sin tocar nada', async () => {
  await escribir([M({ ts: 1010, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe' })])

  const otra = await conectar(configDesdeEntorno(), PREFIJO)
  try {
    assert.equal(await otra.tomarCandado(), true, 'la "otra ingesta" toma el candado')

    const r = await correr()
    assert.equal(r.ocupado, true)
    assert.equal(await base.contar('muertes'), 0)

    await otra.soltarCandado()
    await correr()
    assert.equal(await base.contar('muertes'), 1, 'liberado el candado, la siguiente carga normal')
  } finally {
    await otra.cerrar()
  }
})

test('dos ingestas lanzadas en paralelo no duplican muertes', async () => {
  const lineas = []
  for (let i = 0; i < 200; i++) {
    lineas.push(M({ ts: 1000 + i, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe' }))
  }
  await escribir(lineas)

  const otra = await conectar(configDesdeEntorno(), PREFIJO)
  try {
    const resultados = await Promise.all([
      correr(),
      ingerir({ fuente, base: otra })
    ])
    assert.equal(await base.contar('muertes'), 200, 'exactamente 200, ni una de mas')
    const cargadas = resultados.reduce((total, r) => total + r.muertes, 0)
    assert.equal(cargadas, 200, 'entre las dos cargaron 200 en total')
  } finally {
    await otra.cerrar()
  }
})

test('varios archivos (cambio de dia) se cargan cada uno con su offset', async () => {
  await escribir([M({ ts: 1010, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe' })], 'eventos_20260921.tsv')
  await escribir([M({ ts: 90010, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe' })], 'eventos_20260922.tsv')

  const r = await correr()
  assert.equal(r.archivos, 2)
  assert.equal(await base.contar('muertes'), 2)
  assert.ok(await base.leerOffset('eventos_20260921.tsv') > 0)
  assert.ok(await base.leerOffset('eventos_20260922.tsv') > 0)
})

test('un archivo mas chico que lo ya cargado se saltea con alerta', async () => {
  await escribir([
    M({ ts: 1010, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe' }),
    M({ ts: 1020, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe' })
  ])
  await correr()

  /* Alguien borro y recreo el archivo del dia */
  await escribir([P(5000)])
  const r = await correr()

  assert.equal(r.alertas.length, 1)
  assert.equal(await base.contar('muertes'), 2, 'no se perdio ni duplico nada')
})

/* ------------------------------------------------------------------ */
/*  Reglas de conteo                                                   */
/* ------------------------------------------------------------------ */

test('un teamkill no suma como kill', async () => {
  await escribir([M({ ts: 1010, mS: TREVOR, mN: 'Trevor', mE: 1, vS: PEPE, vN: 'Pepe', vE: 1, tk: 1 })])
  await correr()

  const trevor = await jugador('Trevor')
  assert.equal(trevor.kills, 0)
  assert.equal(trevor.teamkills, 1)
  assert.equal((await jugador('Pepe')).muertes, 1)
})

test('un suicidio suma como muerte y como suicidio, sin kill para nadie', async () => {
  await escribir([M({ ts: 1010, vS: PEPE, vN: 'Pepe', arma: 'world' })])
  await correr()

  const pepe = await jugador('Pepe')
  assert.equal(pepe.muertes, 1)
  assert.equal(pepe.suicidios, 1)
  assert.equal(pepe.kills, 0)
  assert.equal((await base.ranking()).length, 1, 'no se creo un jugador fantasma para el matador')
})

test('las muertes con bots se ignoran enteras', async () => {
  await escribir([
    C(1000, 'BOT', '[BOT] Sturm'),
    M({ ts: 1010, mS: 'BOT', mN: '[BOT] Sturm', vS: PEPE, vN: 'Pepe' }),
    M({ ts: 1020, mS: PEPE, mN: 'Pepe', vS: 'BOT', vN: '[BOT] Sturm' })
  ])
  const r = await correr()

  assert.equal(r.muertes, 0)
  assert.equal(r.ignorados, 3)
  assert.equal(await base.contar('jugadores'), 0, 'ni los bots ni Pepe entran por jugar solo contra bots')
})

/* ------------------------------------------------------------------ */
/*  Identidad                                                          */
/* ------------------------------------------------------------------ */

test('clientes sin steamid valido no se funden en un solo jugador', async () => {
  await escribir([
    M({ ts: 1010, mS: 'STEAM_ID_LAN', mN: 'Carlitos', vS: 'STEAM_ID_LAN', vN: 'Juancho' }),
    M({ ts: 1020, mS: 'STEAM_ID_LAN', mN: 'Carlitos', vS: 'STEAM_ID_PENDING', vN: 'Lucas' })
  ])
  await correr()

  const ranking = await base.ranking()
  assert.equal(ranking.length, 3)
  const carlitos = ranking.find((j) => j.nick === 'Carlitos')
  assert.equal(carlitos.identidad, 'NICK:Carlitos')
  assert.equal(carlitos.steamid, null)
  assert.equal(carlitos.kills, 2)
})

test('un cambio de nick no crea un jugador nuevo y queda el nick mas reciente', async () => {
  await escribir([C(1000, TREVOR, 'Trevor_viejo')])
  await correr()

  await agregar([M({ ts: 2000, mS: TREVOR, mN: 'Trevor_nuevo', vS: PEPE, vN: 'Pepe' })])
  await correr()

  const conSteam = (await base.ranking()).filter((j) => j.steamid === TREVOR)
  assert.equal(conSteam.length, 1)
  assert.equal(conSteam[0].nick, 'Trevor_nuevo')
  assert.equal(conSteam[0].kills, 1)
})

/* ------------------------------------------------------------------ */
/*  Datos hostiles o raros                                             */
/* ------------------------------------------------------------------ */

test('un nick con inyeccion SQL se guarda literal y las tablas siguen intactas', async () => {
  const malicioso = `x'); DROP TABLE ${PREFIJO}jugadores; --`
  await escribir([M({ ts: 1010, mS: TREVOR, mN: malicioso, vS: PEPE, vN: 'Pepe' })])
  await correr()

  assert.ok(await jugador(malicioso), 'el nick quedo tal cual')
  assert.equal(await base.contar('jugadores'), 2, 'la tabla sigue existiendo')
})

test('nicks con ñ y tildes llegan intactos a la base', async () => {
  await escribir([M({ ts: 1010, mS: TREVOR, mN: 'Ñandú', vS: PEPE, vN: 'José María' })])
  await correr()

  assert.ok(await jugador('Ñandú'))
  assert.ok(await jugador('José María'))
})

test('un campo mas largo de lo esperado se recorta en vez de trabar la ingesta', async () => {
  const armaLarga = 'arma_con_nombre_rarisimo_de_mas_de_32_caracteres'
  await escribir([M({ ts: 1010, mS: TREVOR, mN: 'Trevor', vS: PEPE, vN: 'Pepe', arma: armaLarga })])
  await correr()

  const [fila] = await base.consultar('SELECT arma FROM {p}muertes')
  assert.equal(fila.arma, armaLarga.slice(0, 32))
})
