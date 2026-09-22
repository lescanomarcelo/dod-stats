/*
 *  Estado del server de juego con las consultas estandar de Valve: la misma que usa
 *  el buscador de servidores del juego. Paquetes chicos: ~25 bytes de ida y ~100 de
 *  vuelta el estado, un poco mas la lista de jugadores.
 *
 *  A2S_INFO   (0x54) -> nombre, mapa, cuantos juegan
 *  A2S_PLAYER (0x55) -> quienes juegan, con su puntaje y su tiempo
 *
 *  El sitio las cachea (lib/estado.ts), asi que al server le llega como mucho una
 *  consulta por minuto sin importar cuanta gente entre.
 *
 *  Los servers actualizados piden un "challenge": responden con 0x41 y 4 bytes, y
 *  hay que repetir la consulta con esos bytes.
 */

import { createSocket } from 'node:dgram'

export type EstadoServidor =
  | { enLinea: true, nombre: string, mapa: string, jugadores: number, maximo: number, bots: number }
  | { enLinea: false }

export type JugadorEnLinea = { nombre: string, puntos: number, segundos: number }

const CABECERA = [0xff, 0xff, 0xff, 0xff]
const CONSULTA_ESTADO = Buffer.concat([
  Buffer.from([...CABECERA, 0x54]),
  Buffer.from('Source Engine Query', 'latin1'),
  Buffer.from([0])
])
const CONSULTA_JUGADORES = Buffer.from([...CABECERA, 0x55, 0xff, 0xff, 0xff, 0xff])

/* Lector secuencial: textos terminados en 0, bytes, enteros y decimales */
function lector (b: Buffer, desde: number) {
  let i = desde
  return {
    texto () {
      const fin = b.indexOf(0, i)
      if (fin < 0) throw new Error('respuesta cortada')
      const s = b.toString('utf8', i, fin)
      i = fin + 1
      return s
    },
    byte () {
      if (i >= b.length) throw new Error('respuesta cortada')
      return b[i++]
    },
    entero () {
      if (i + 4 > b.length) throw new Error('respuesta cortada')
      const v = b.readInt32LE(i)
      i += 4
      return v
    },
    decimal () {
      if (i + 4 > b.length) throw new Error('respuesta cortada')
      const v = b.readFloatLE(i)
      i += 4
      return Number.isFinite(v) ? v : 0
    },
    saltar (n: number) { i += n }
  }
}

function cabeceraValida (b: Buffer) {
  if (b.length < 5 || b.readInt32LE(0) !== -1) throw new Error('respuesta invalida')
  return b[4]
}

/** Interpreta la respuesta de A2S_INFO. Exportada para los tests. */
export function leerRespuesta (b: Buffer): EstadoServidor | { challenge: Buffer } {
  const tipo = cabeceraValida(b)

  if (tipo === 0x41) return { challenge: b.subarray(5, 9) }

  /* Formato actual (Source y GoldSrc nuevos): version, nombre, mapa, carpeta, juego, app, jugadores... */
  if (tipo === 0x49) {
    const r = lector(b, 6)
    const nombre = r.texto()
    const mapa = r.texto()
    r.texto()
    r.texto()
    r.saltar(2)
    return { enLinea: true, nombre, mapa, jugadores: r.byte(), maximo: r.byte(), bots: r.byte() }
  }

  /* Formato viejo de GoldSrc: direccion, nombre, mapa, carpeta, juego, jugadores, maximo */
  if (tipo === 0x6d) {
    const r = lector(b, 5)
    r.texto()
    const nombre = r.texto()
    const mapa = r.texto()
    r.texto()
    r.texto()
    return { enLinea: true, nombre, mapa, jugadores: r.byte(), maximo: r.byte(), bots: 0 }
  }

  throw new Error(`tipo de respuesta desconocido: ${tipo}`)
}

/**
 * Interpreta la lista de jugadores (respuesta 0x44): cantidad y, por cada uno,
 * indice, nombre, puntaje y segundos jugados. Exportada para los tests.
 */
export function leerJugadores (b: Buffer): JugadorEnLinea[] | { challenge: Buffer } {
  const tipo = cabeceraValida(b)
  if (tipo === 0x41) return { challenge: b.subarray(5, 9) }
  if (tipo !== 0x44) throw new Error(`tipo de respuesta desconocido: ${tipo}`)

  const r = lector(b, 5)
  const cantidad = r.byte()
  const jugadores: JugadorEnLinea[] = []
  for (let i = 0; i < cantidad; i++) {
    r.byte()                                      /* indice: el juego no lo usa */
    const nombre = r.texto()
    const puntos = r.entero()
    const segundos = Math.max(0, Math.round(r.decimal()))
    /* Los que estan entrando todavia no tienen nombre: no son jugadores */
    if (nombre) jugadores.push({ nombre, puntos, segundos })
  }
  return jugadores
}

/*
 *  Las dos consultas siguen el mismo camino: mandar, atender el challenge si lo
 *  pide, volver a mandar e interpretar. Nunca tiran excepcion: si el server no
 *  contesta a tiempo, devuelven lo que se les pase como respuesta de fallo.
 */
function preguntar<T> (
  host: string,
  puerto: number,
  espera: number,
  consulta: Buffer,
  leer: (b: Buffer) => T | { challenge: Buffer },
  siFalla: T
): Promise<T> {
  return new Promise((resolver) => {
    const socket = createSocket('udp4')
    let terminado = false

    const terminar = (valor: T) => {
      if (terminado) return
      terminado = true
      clearTimeout(reloj)
      socket.close()
      resolver(valor)
    }
    const reloj = setTimeout(() => terminar(siFalla), espera)

    socket.on('error', () => terminar(siFalla))
    socket.on('message', (mensaje) => {
      try {
        const r = leer(mensaje)
        if (r !== null && typeof r === 'object' && 'challenge' in r) {
          /* A2S_INFO lleva el challenge al final; A2S_PLAYER reemplaza con el sus ultimos 4 bytes */
          const base = consulta === CONSULTA_JUGADORES ? consulta.subarray(0, 5) : consulta
          socket.send(Buffer.concat([base, r.challenge]), puerto, host)
        } else {
          terminar(r as T)
        }
      } catch {
        terminar(siFalla)
      }
    })

    socket.send(consulta, puerto, host)
  })
}

export function consultarServidor (host: string, puerto: number, espera = 2500): Promise<EstadoServidor> {
  return preguntar<EstadoServidor>(host, puerto, espera, CONSULTA_ESTADO, leerRespuesta, { enLinea: false })
}

/** Quienes estan jugando ahora. Si el server no contesta, lista vacia. */
export function consultarJugadores (host: string, puerto: number, espera = 2500): Promise<JugadorEnLinea[]> {
  return preguntar<JugadorEnLinea[]>(host, puerto, espera, CONSULTA_JUGADORES, leerJugadores, [])
}
