/*
 *  Estado del server de juego con la consulta estandar de Valve (A2S_INFO): la
 *  misma que usa el buscador de servidores del juego. Un paquete UDP de 25 bytes
 *  de ida y ~100 de vuelta.
 *
 *  El sitio la cachea (lib/consultas: estadoServidor), asi que al server le llega
 *  como mucho una consulta por minuto sin importar cuanta gente entre.
 *
 *  Los servers actualizados piden un "challenge": responden con 0x41 y 4 bytes, y
 *  hay que repetir la consulta con esos bytes al final.
 */

import { createSocket } from 'node:dgram'

export type EstadoServidor =
  | { enLinea: true, nombre: string, mapa: string, jugadores: number, maximo: number, bots: number }
  | { enLinea: false }

const CONSULTA = Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]), Buffer.from('Source Engine Query\0', 'latin1')])

/* Lector secuencial: textos terminados en 0 y bytes sueltos. Si se pasa del final, error */
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
    saltar (n: number) { i += n }
  }
}

/** Interpreta la respuesta. Exportada para los tests. */
export function leerRespuesta (b: Buffer): EstadoServidor | { challenge: Buffer } {
  if (b.length < 5 || b.readInt32LE(0) !== -1) throw new Error('respuesta invalida')
  const tipo = b[4]

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

/** Consulta al server. Nunca tira excepcion: si no contesta a tiempo, esta fuera de linea. */
export function consultarServidor (host: string, puerto: number, espera = 2500): Promise<EstadoServidor> {
  return new Promise((resolver) => {
    const socket = createSocket('udp4')
    let terminado = false
    const terminar = (estado: EstadoServidor) => {
      if (terminado) return
      terminado = true
      clearTimeout(reloj)
      socket.close()
      resolver(estado)
    }
    const reloj = setTimeout(() => terminar({ enLinea: false }), espera)

    socket.on('error', () => terminar({ enLinea: false }))
    socket.on('message', (mensaje) => {
      try {
        const r = leerRespuesta(mensaje)
        if ('challenge' in r) socket.send(Buffer.concat([CONSULTA, r.challenge]), puerto, host)
        else terminar(r)
      } catch {
        terminar({ enLinea: false })
      }
    })
    socket.send(CONSULTA, puerto, host)
  })
}
