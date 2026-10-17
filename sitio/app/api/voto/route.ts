import { NextResponse } from 'next/server'
import { consultar } from '@/lib/db'
import { quincenaDe, diaArgentino } from '@/lib/quincenas'
import { contarPorTamano, motivoParaRechazar, quedan, TEXTO_RECHAZO } from '@/lib/votos'
import type { Tamano } from '@/lib/consultas'

/*
 *  Recibe un voto de la votación de mapas, o lo saca.
 *
 *  No hay contraseña: cada uno elige su nick de la lista. El server es chico y se
 *  confía, y al verse quién votó qué, eso mismo lo mantiene honesto.
 *
 *  Lo que sí está cerrado con llave es el "una vez por día": la clave única de
 *  votos_mapas lo garantiza en la base, así que no hay forma de meter el mismo
 *  voto dos veces aunque lleguen dos pedidos a la vez. El límite de 3 por día y
 *  por tamaño se cuenta acá.
 */

const sinCache = { 'Cache-Control': 'no-store' }
const error = (mensaje: string, codigo = 400) =>
  NextResponse.json({ error: mensaje }, { status: codigo, headers: sinCache })

type Pedido = { jugadorId?: unknown, mapa?: unknown, sacar?: unknown }

/** Lo que el dodero votó hoy, con el tamaño de cada mapa */
async function votosDeHoy (jugadorId: number, dia: string) {
  return consultar<{ mapa: string, tamano: Tamano }>(`
    SELECT v.mapa, c.tamano
    FROM {p}votos_mapas v
    JOIN {p}mapas_catalogo c ON c.mapa = v.mapa
    WHERE v.jugador_id = ? AND v.dia = ?
  `, [jugadorId, dia])
}

export async function POST (pedido: Request) {
  let cuerpo: Pedido
  try {
    cuerpo = await pedido.json()
  } catch {
    return error('No se entendió el pedido')
  }

  const jugadorId = Number(cuerpo.jugadorId)
  const mapa = String(cuerpo.mapa ?? '')
  const sacar = cuerpo.sacar === true

  if (!Number.isInteger(jugadorId) || jugadorId <= 0) return error('Elegí tu nick para votar')
  if (!mapa) return error('Falta el mapa')

  const ahora = new Date()
  const quincena = quincenaDe(ahora).clave
  const dia = diaArgentino(ahora)

  /* Que el dodero exista de verdad: el id viene del navegador */
  const [dodero] = await consultar<{ id: number, nick: string }>(
    'SELECT id, nick FROM {p}jugadores WHERE id = ?', [jugadorId])
  if (!dodero) return error('Ese dodero no está en las estadísticas')

  /* Que el mapa se pueda votar hoy */
  const [delCatalogo] = await consultar<{ tamano: Tamano | null }>(
    'SELECT tamano FROM {p}mapas_catalogo WHERE mapa = ? AND activo = 1', [mapa])
  if (!delCatalogo?.tamano) return error('Ese mapa no se puede votar')

  if (sacar) {
    /* Solo se puede sacar un voto del mismo día: es para corregir un toque mal dado */
    await consultar(
      'DELETE FROM {p}votos_mapas WHERE mapa = ? AND jugador_id = ? AND dia = ?',
      [mapa, jugadorId, dia])
  } else {
    const hoy = await votosDeHoy(jugadorId, dia)
    const motivo = motivoParaRechazar(
      delCatalogo.tamano, contarPorTamano(hoy), hoy.map((v) => v.mapa), mapa)
    if (motivo) return error(TEXTO_RECHAZO[motivo], 409)

    try {
      await consultar(
        `INSERT INTO {p}votos_mapas (quincena, dia, mapa, jugador_id, momento)
         VALUES (?, ?, ?, ?, ?)`,
        [quincena, dia, mapa, jugadorId, ahora])
    } catch (e) {
      /* Dos pestañas a la vez: la clave unica lo frena y no es un error del dodero */
      const codigo = (e as { code?: string }).code
      if (codigo !== 'ER_DUP_ENTRY') throw e
    }
  }

  const hoy = await votosDeHoy(jugadorId, dia)
  const [{ votos } = { votos: 0 }] = await consultar<{ votos: number }>(
    'SELECT COUNT(*) AS votos FROM {p}votos_mapas WHERE mapa = ? AND quincena = ?',
    [mapa, quincena])

  return NextResponse.json({
    nick: dodero.nick,
    mapa,
    votos: Number(votos),
    mios: hoy.map((v) => v.mapa),
    quedan: quedan(contarPorTamano(hoy))
  }, { headers: sinCache })
}

/*
 *  Que votó hoy ese dodero. Lo pide la pantalla al elegir el nick, para marcar
 *  los mapas que ya votó y saber cuántos votos le quedan.
 */
export async function GET (pedido: Request) {
  const jugadorId = Number(new URL(pedido.url).searchParams.get('jugadorId'))
  if (!Number.isInteger(jugadorId) || jugadorId <= 0) return error('Falta el dodero')

  const hoy = await votosDeHoy(jugadorId, diaArgentino())
  return NextResponse.json({
    mios: hoy.map((v) => v.mapa),
    quedan: quedan(contarPorTamano(hoy))
  }, { headers: sinCache })
}
