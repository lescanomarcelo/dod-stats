/*
 *  Genera partidas simuladas y las carga en tablas demo_*, para desarrollar el sitio
 *  sin esperar a que haya jugadores.
 *
 *  Los datos NO se insertan a mano: se escriben archivos eventos_AAAAMMDD.tsv con el
 *  mismo formato que el plugin y se pasan por la ingesta real. Asi la demo recorre
 *  exactamente el mismo camino que los datos de verdad.
 *
 *  Es determinista (semilla fija): cada corrida genera las mismas partidas.
 *
 *  Uso:  node --env-file=.env sembrar-demo.mjs
 */

import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { conectar, configDesdeEntorno } from './base.mjs'
import { crearFuenteLocal } from './fuentes.mjs'
import { ingerir } from './ingerir.mjs'
import { leerEntidades, puntosDe } from '../mapas/bsp.mjs'

/* Carpeta con los .bsp: de ahi salen las banderas y spawns reales de cada mapa */
const CARPETA_BSP = process.env.DOD_MAPS ?? 'C:/Program Files (x86)/Steam/steamapps/common/Half-Life/dod/maps'

const PREFIJO = 'demo_'
const DIAS = 120          /* unos 4 meses: alcanza para los graficos semana a semana y mes a mes */
const MAPAS_POR_DIA = 6
const SEGUNDOS_POR_MAPA = 900

/* PRNG con semilla (mulberry32): mismas partidas en cada corrida */
let semilla = 20260921
function azar () {
  semilla |= 0; semilla = (semilla + 0x6D2B79F5) | 0
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const entre = (min, max) => Math.floor(min + azar() * (max - min + 1))
const elegir = (lista) => lista[Math.floor(azar() * lista.length)]
function elegirPonderado (lista, peso) {
  const total = lista.reduce((s, x) => s + peso(x), 0)
  let r = azar() * total
  for (const x of lista) { r -= peso(x); if (r <= 0) return x }
  return lista[lista.length - 1]
}

/* habilidad: cuanto mata. punteria: probabilidad extra de headshot */
const JUGADORES = [
  { steam: 'STEAM_0:1:30188431', nick: 'LiNuS', habilidad: 1.6, punteria: 0.10 },
  { steam: 'STEAM_0:0:23198516', nick: 'Trevor', habilidad: 1.9, punteria: 0.14 },
  { steam: 'STEAM_0:1:44120093', nick: 'Ñandú', habilidad: 1.1, punteria: 0.05 },
  { steam: 'STEAM_0:0:51230981', nick: 'José María', habilidad: 0.9, punteria: 0.04 },
  { steam: 'STEAM_0:1:12908734', nick: '[aU] Sargento', habilidad: 2.2, punteria: 0.18 },
  { steam: 'STEAM_0:0:88123409', nick: 'Pepe_Argento', habilidad: 0.7, punteria: 0.03 },
  { steam: 'STEAM_0:1:66012345', nick: 'Kraut', habilidad: 1.4, punteria: 0.09 },
  { steam: 'STEAM_0:0:10293847', nick: 'Tanito', habilidad: 1.0, punteria: 0.06 },
  { steam: 'STEAM_0:1:57483920', nick: 'ElRusoDeFlores', habilidad: 1.3, punteria: 0.12 },
  { steam: 'STEAM_0:0:39485761', nick: 'Chuky', habilidad: 0.8, punteria: 0.05 },
  { steam: 'STEAM_0:1:20394857', nick: 'Mauri.', habilidad: 1.2, punteria: 0.07 },
  { steam: 'STEAM_0:0:75849302', nick: 'Gonza™', habilidad: 1.5, punteria: 0.11 },
  { steam: 'STEAM_0:1:93847561', nick: 'Pampa', habilidad: 0.6, punteria: 0.02 },
  { steam: 'STEAM_0:0:48573920', nick: 'Negro', habilidad: 1.0, punteria: 0.08 },
  { steam: 'STEAM_0:1:85736291', nick: 'Rulo', habilidad: 1.1, punteria: 0.06 },
  { steam: 'STEAM_ID_LAN', nick: 'Invitado_Carlos', habilidad: 0.5, punteria: 0.02 }
]

const MAPAS = ['dod_kalt', 'dod_jagd', 'dod_zalec', 'dod_flash', 'dod_avalanche', 'dod_anzio',
  'dod_caen', 'dod_donner', 'dod_saints', 'dod_vicenza', 'dod_kraftstoff', 'dod_chemille']

/* arma, peso de uso, probabilidad base de headshot */
const ARMAS = {
  1: [['garand', 10, 0.22], ['thompson', 8, 0.08], ['bar', 5, 0.10], ['spring', 3, 0.55],
    ['m1carbine', 4, 0.15], ['greasegun', 3, 0.07], ['colt', 2, 0.12], ['amerknife', 1, 0],
    ['handgrenade', 2, 0], ['30cal', 1, 0.05], ['bazooka', 1, 0]],
  2: [['kar', 10, 0.28], ['mp40', 8, 0.08], ['mp44', 5, 0.10], ['scopedkar', 3, 0.55],
    ['k43', 4, 0.18], ['luger', 2, 0.12], ['spade', 1, 0], ['stickgrenade', 2, 0],
    ['mg42', 1, 0.05], ['pschreck', 1, 0]]
}

const T = '\t'

/* Posiciones creibles: las muertes se concentran alrededor de las banderas (donde
   se pelea) y en menor medida de los spawns, con una dispersion normal. Los puntos
   salen de las entidades reales de cada .bsp. */
const PUNTOS_CALIENTES = new Map(MAPAS.map((mapa) => {
  const puntos = puntosDe(leerEntidades(readFileSync(join(CARPETA_BSP, `${mapa}.bsp`))),
    ['dod_control_point', 'info_player_allies', 'info_player_axis'])
  return [mapa, puntos.map((p) => ({ ...p, peso: p.clase === 'dod_control_point' ? 6 : 1 }))]
}))

function gauss () {
  const u = 1 - azar()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * azar())
}

function posicionVictima (mapa) {
  const h = elegirPonderado(PUNTOS_CALIENTES.get(mapa), (p) => p.peso)
  return [Math.round(h.x + gauss() * 180), Math.round(h.y + gauss() * 180), Math.round(h.z)]
}

/* El matador dispara desde cierta distancia, en cualquier direccion */
function posicionMatador ([vx, vy, vz]) {
  const angulo = azar() * 2 * Math.PI
  const distancia = entre(150, 900)
  return [Math.round(vx + Math.cos(angulo) * distancia), Math.round(vy + Math.sin(angulo) * distancia), vz]
}

/* Impactos de un jugador en un mapa, como la linea H del plugin. La punteria del
   jugador sube la proporcion de cabeza y la precision; cada uno tiene ademas un
   brazo/pierna "favorito" para que los muñecos no salgan todos iguales. */
function lineaImpactos (momento, mapa, j, segundos) {
  const pegados = Math.round((segundos / 60) * j.habilidad * entre(6, 11))
  const favorito = 4 + (j.steam.charCodeAt(j.steam.length - 1) % 4)   /* 4..7: un brazo o una pierna */
  const pesos = [2, 8 + j.punteria * 120, 26, 11, 13, 13, 9, 9]
  pesos[favorito] += 9
  const zonas = new Array(8).fill(0)
  for (let i = 0; i < pegados; i++) zonas[elegirPonderado([0, 1, 2, 3, 4, 5, 6, 7], (z) => pesos[z])]++
  const precision = Math.min(0.45, 0.12 + j.punteria * 1.3 + azar() * 0.05)
  const disparos = Math.round(pegados / precision)
  const danio = pegados * entre(28, 42)
  return ['H', momento, mapa, j.steam, j.nick, ...zonas, danio, disparos].join(T)
}

/*
 *  Banderas: cada toma da 1 punto a entre 1 y 3 jugadores del bando que la toma
 *  (linea S) y mueve el marcador del equipo (linea E). La fuerza de cada bando sale
 *  de la habilidad de sus jugadores mas una tendencia que cambia lento con los dias,
 *  para que haya semanas y meses de cada lado.
 */
function banderas (lineas, ts, mapa, presentes, equipo, dia) {
  const fuerza = (eq) => presentes.filter((j) => equipo.get(j) === eq).reduce((s, j) => s + j.habilidad, 0)
  const tendencia = 1 + Math.sin(dia / 11) * 0.35
  const pesos = { 1: fuerza(1) * tendencia, 2: fuerza(2) / tendencia }
  const marcador = { 1: 0, 2: 0 }
  const tomas = entre(4, 16)
  for (let k = 0; k < tomas; k++) {
    const momento = ts + Math.floor(((k + 0.5) / tomas) * SEGUNDOS_POR_MAPA)
    const eq = elegirPonderado([1, 2], (e) => pesos[e])
    const bando = presentes.filter((j) => equipo.get(j) === eq).sort(() => azar() - 0.5).slice(0, entre(1, 3))
    for (const j of bando) lineas.push(['S', momento, mapa, j.steam, j.nick, eq, 1].join(T))
    marcador[eq] += azar() < 0.2 ? 5 : 1        /* a veces, tomar todas da la ronda: mas puntos */
    lineas.push(['E', momento + 10, mapa, ts, marcador[1], marcador[2]].join(T))
  }
}

function generarDia (inicioDia, dia) {
  const lineas = []
  let ts = inicioDia

  for (let m = 0; m < MAPAS_POR_DIA; m++) {
    const mapa = elegir(MAPAS)
    lineas.push(['P', ts, mapa].join(T))

    /* Entre 6 y 16 jugadores por mapa, repartidos en dos equipos */
    const presentes = [...JUGADORES].sort(() => azar() - 0.5).slice(0, entre(6, 16))
    const equipo = new Map(presentes.map((j, i) => [j, (i % 2) + 1]))
    for (const j of presentes) lineas.push(['C', ts + entre(0, 20), j.steam, j.nick].join(T))

    const muertes = Math.round(presentes.length * entre(4, 8))
    for (let k = 0; k < muertes; k++) {
      const momento = ts + Math.floor((k / muertes) * SEGUNDOS_POR_MAPA) + entre(0, 5)
      const victima = elegir(presentes)
      const vEq = equipo.get(victima)

      /* 3% suicidio / caida */
      if (azar() < 0.03) {
        lineas.push(['M', momento, mapa, '', '', 0, victima.steam, victima.nick, vEq,
          'world', 0, 0, ...posicionVictima(mapa), 0, 0, 0].join(T))
        continue
      }

      /* 2% teamkill, si no, un enemigo elegido segun habilidad */
      const teamkill = azar() < 0.02
      const candidatos = presentes.filter((j) => j !== victima && (teamkill ? equipo.get(j) === vEq : equipo.get(j) !== vEq))
      if (!candidatos.length) continue
      const matador = elegirPonderado(candidatos, (j) => j.habilidad)
      const mEq = equipo.get(matador)

      const [arma, , baseHs] = elegirPonderado(ARMAS[mEq], (a) => a[1])
      const headshot = azar() < baseHs + matador.punteria
      const hitbox = headshot ? 1 : entre(2, 7)

      const donde = posicionVictima(mapa)
      lineas.push(['M', momento, mapa, matador.steam, matador.nick, mEq, victima.steam, victima.nick, vEq,
        arma, hitbox, teamkill ? 1 : 0, ...donde, ...posicionMatador(donde)].join(T))
    }

    banderas(lineas, ts, mapa, presentes, equipo, dia)

    for (const j of presentes) {
      const jugado = entre(300, SEGUNDOS_POR_MAPA)
      lineas.push(lineaImpactos(ts + jugado - 1, mapa, j, jugado))
      lineas.push(['D', ts + jugado, j.steam, j.nick, jugado].join(T))
    }

    ts += SEGUNDOS_POR_MAPA
  }

  return lineas
}

const carpeta = await mkdtemp(join(tmpdir(), 'dodstats-demo-'))
const base = await conectar(configDesdeEntorno(), PREFIJO)

try {
  await base.borrarTablas()
  await base.aplicarEsquema()

  /* El ultimo dia es ayer a las 18 de Argentina, asi los graficos llegan hasta hoy */
  const hoy = Math.floor(Date.now() / 86400000) * 86400 - 3 * 3600
  for (let d = DIAS - 1; d >= 0; d--) {
    const inicio = hoy - d * 86400
    const fecha = new Date(inicio * 1000).toISOString().slice(0, 10).replaceAll('-', '')
    await writeFile(join(carpeta, `eventos_${fecha}.tsv`), generarDia(inicio, DIAS - d).join('\n') + '\n')
  }

  const r = await ingerir({ fuente: crearFuenteLocal(carpeta), base })
  console.log(`Demo cargada en tablas ${PREFIJO}*: ${r.archivos} dias, ${r.muertes} muertes, ` +
    `${r.sesiones} sesiones, ${r.mapas} mapas, ${r.puntos} lineas de puntos, ${r.marcadores} marcadores, ${r.descartadas} descartadas.`)
} finally {
  await base.cerrar()
  await rm(carpeta, { recursive: true, force: true })
}
