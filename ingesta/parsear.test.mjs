/*
 *  Tests del parser de eventos.
 *
 *  Las lineas de ejemplo replican exactamente los formatex() de dod_stats_registro.sma.
 *  Si se cambia el formato en el plugin, estos tests tienen que cambiar tambien.
 *
 *  Correr con:  node --test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsearLinea, parsearFragmento } from './parsear.mjs'

const T = '\t'
const linea = (...campos) => campos.join(T)

/* M ts mapa  m_steam m_nick m_eq  v_steam v_nick v_eq  arma hitbox tk  vx vy vz  mx my mz */
const muerte = (sobrescribir = {}) => {
  const c = {
    ts: 1789999999, mapa: 'dod_kalt',
    mSteam: 'STEAM_0:1:111', mNick: 'Trevor', mEq: 1,
    vSteam: 'STEAM_0:0:222', vNick: 'Pepe', vEq: 2,
    arma: 'kar', hitbox: 2, tk: 0,
    vx: 100, vy: -250, vz: 36, mx: 400, my: -300, mz: 36,
    ...sobrescribir
  }
  return linea('M', c.ts, c.mapa, c.mSteam, c.mNick, c.mEq, c.vSteam, c.vNick, c.vEq,
    c.arma, c.hitbox, c.tk, c.vx, c.vy, c.vz, c.mx, c.my, c.mz)
}

/* ------------------------------------------------------------------ */
/*  Muertes                                                            */
/* ------------------------------------------------------------------ */

test('muerte normal: extrae matador, victima, arma y posiciones', () => {
  const e = parsearLinea(muerte())

  assert.equal(e.tipo, 'muerte')
  assert.equal(e.mapa, 'dod_kalt')
  assert.equal(e.matador.steamid, 'STEAM_0:1:111')
  assert.equal(e.matador.nick, 'Trevor')
  assert.equal(e.matador.equipo, 1)
  assert.equal(e.victima.steamid, 'STEAM_0:0:222')
  assert.equal(e.victima.equipo, 2)
  assert.equal(e.arma, 'kar')
  assert.deepEqual([e.victima.x, e.victima.y, e.victima.z], [100, -250, 36])
  assert.deepEqual([e.matador.x, e.matador.y, e.matador.z], [400, -300, 36])
})

test('hitbox 1 se marca como headshot', () => {
  assert.equal(parsearLinea(muerte({ hitbox: 1 })).headshot, true)
  assert.equal(parsearLinea(muerte({ hitbox: 2 })).headshot, false)
})

test('suicidio: campos del matador vacios -> matador null', () => {
  /* El plugin deja mSteam y mNick vacios, equipo 0 y origen en 0,0,0 */
  const e = parsearLinea(muerte({ mSteam: '', mNick: '', mEq: 0, mx: 0, my: 0, mz: 0 }))
  assert.equal(e.matador, null)
  assert.equal(e.victima.nick, 'Pepe')
})

test('teamkill se marca', () => {
  assert.equal(parsearLinea(muerte({ tk: 1 })).teamkill, true)
  assert.equal(parsearLinea(muerte({ tk: 0 })).teamkill, false)
})

test('bots llegan con steamid BOT', () => {
  const e = parsearLinea(muerte({ mSteam: 'BOT', mNick: '[BOT] Sturm' }))
  assert.equal(e.matador.steamid, 'BOT')
})

test('coordenadas negativas se leen bien', () => {
  const e = parsearLinea(muerte({ vx: -1696, vy: -48, vz: -65 }))
  assert.deepEqual([e.victima.x, e.victima.y, e.victima.z], [-1696, -48, -65])
})

/* ------------------------------------------------------------------ */
/*  Otros eventos                                                      */
/* ------------------------------------------------------------------ */

test('conexion, desconexion e inicio de mapa', () => {
  assert.deepEqual(parsearLinea(linea('P', 1789999999, 'dod_kalt')),
    { tipo: 'inicio_mapa', ts: 1789999999, mapa: 'dod_kalt' })

  assert.deepEqual(parsearLinea(linea('C', 1789999999, 'STEAM_0:1:111', 'Trevor')),
    { tipo: 'conexion', ts: 1789999999, steamid: 'STEAM_0:1:111', nick: 'Trevor' })

  assert.deepEqual(parsearLinea(linea('D', 1789999999, 'STEAM_0:1:111', 'Trevor', 1834)),
    { tipo: 'desconexion', ts: 1789999999, steamid: 'STEAM_0:1:111', nick: 'Trevor', segundos: 1834 })
})

/* ------------------------------------------------------------------ */
/*  Seguridad y lineas rotas                                           */
/* ------------------------------------------------------------------ */

test('nick con intento de inyeccion SQL se preserva como texto literal', () => {
  const malicioso = "Pepe'); DROP TABLE jugadores; --"
  const e = parsearLinea(muerte({ vNick: malicioso }))
  assert.equal(e.victima.nick, malicioso)
})

test('lineas mal formadas devuelven null en vez de romper', () => {
  assert.equal(parsearLinea('M\t1789999999\tdod_kalt'), null, 'faltan campos')
  assert.equal(parsearLinea(muerte() + '\textra'), null, 'sobran campos')
  assert.equal(parsearLinea(linea('X', 1789999999, 'algo')), null, 'tipo desconocido')
  assert.equal(parsearLinea(linea('P', 'no-es-numero', 'dod_kalt')), null, 'ts invalido')
  assert.equal(parsearLinea(muerte({ hitbox: 'abc' })), null, 'numero invalido')
  assert.equal(parsearLinea(''), null, 'vacia')
})

/* ------------------------------------------------------------------ */
/*  Fragmentos: lectura parcial mientras el plugin escribe             */
/* ------------------------------------------------------------------ */

test('linea cortada al final no se consume', () => {
  const completa = muerte() + '\n'
  const cortada = 'M\t1789999999\tdod_ka'   /* el plugin estaba escribiendo */

  const r = parsearFragmento(completa + cortada)

  assert.equal(r.eventos.length, 1)
  assert.equal(r.bytesConsumidos, Buffer.byteLength(completa))
})

test('retome: la segunda pasada procesa la linea completada sin duplicar', () => {
  const primera = muerte({ vNick: 'Uno' }) + '\n'
  const segunda = muerte({ vNick: 'Dos' }) + '\n'

  /* Primera pasada: la segunda linea llega a medias */
  const archivoParcial = primera + segunda.slice(0, 20)
  const r1 = parsearFragmento(archivoParcial)
  assert.equal(r1.eventos.length, 1)
  assert.equal(r1.eventos[0].victima.nick, 'Uno')

  /* Segunda pasada: el archivo ya esta completo, retomamos desde el offset */
  const archivoCompleto = Buffer.from(primera + segunda)
  const r2 = parsearFragmento(archivoCompleto.subarray(r1.bytesConsumidos))
  assert.equal(r2.eventos.length, 1)
  assert.equal(r2.eventos[0].victima.nick, 'Dos')

  assert.equal(r1.bytesConsumidos + r2.bytesConsumidos, archivoCompleto.length)
})

test('nicks con ñ y tildes: el offset se cuenta en bytes, no en caracteres', () => {
  /* "Ñandú" son 5 caracteres pero 7 bytes en UTF-8 */
  const conAcentos = muerte({ vNick: 'Ñandú', mNick: 'José' }) + '\n'
  const siguiente = muerte({ vNick: 'Siguiente' }) + '\n'
  const archivo = Buffer.from(conAcentos + siguiente.slice(0, 10))

  const r = parsearFragmento(archivo)

  assert.equal(r.eventos[0].victima.nick, 'Ñandú')
  assert.equal(r.eventos[0].matador.nick, 'José')
  assert.equal(r.bytesConsumidos, Buffer.byteLength(conAcentos))

  /* Lo que queda despues del offset tiene que ser exactamente la linea cortada */
  assert.equal(archivo.subarray(r.bytesConsumidos).toString('utf8'), siguiente.slice(0, 10))
})

test('fragmento sin ningun salto de linea no consume nada', () => {
  const r = parsearFragmento('M\t1789999999\tdod_kalt\tSTEAM')
  assert.deepEqual(r, { eventos: [], descartadas: 0, bytesConsumidos: 0 })
})

test('tolera fin de linea Windows y lineas vacias', () => {
  const texto = muerte() + '\r\n\n' + linea('P', 1789999999, 'dod_kalt') + '\r\n'
  const r = parsearFragmento(texto)
  assert.equal(r.eventos.length, 2)
  assert.equal(r.descartadas, 0)
})

test('las lineas corruptas se cuentan como descartadas sin frenar el resto', () => {
  const texto = [muerte(), 'basura sin formato', linea('P', 1789999999, 'dod_kalt'), ''].join('\n')
  const r = parsearFragmento(texto)
  assert.equal(r.eventos.length, 2)
  assert.equal(r.descartadas, 1)
})
