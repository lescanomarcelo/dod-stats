import 'server-only'
import { cacheLife } from 'next/cache'
import { consultarServidor, consultarJugadores, type EstadoServidor, type JugadorEnLinea } from './servidor'

export const SERVIDOR = { host: '45.235.98.67', puerto: 27017 }

/**
 * Estado del server, cacheado: se renueva como mucho una vez por minuto, en segundo
 * plano, sin importar cuantas visitas haya. Al server de juego le llega una consulta
 * por minuto como maximo, menos que lo que ya le hacen GameTracker o Steam.
 * Un "fuera de linea" tambien se cachea, asi un server caido no genera reintentos.
 */
export async function estadoServidor (): Promise<EstadoServidor & { consultado: string }> {
  'use cache'
  cacheLife({ stale: 60, revalidate: 60, expire: 300 })

  const estado = await consultarServidor(SERVIDOR.host, SERVIDOR.puerto, 1200)
  return { ...estado, consultado: new Date().toISOString() }
}

/** Quienes estan jugando ahora, con la misma cache que el estado */
export async function jugadoresEnLinea (): Promise<JugadorEnLinea[]> {
  'use cache'
  cacheLife({ stale: 60, revalidate: 60, expire: 300 })

  return consultarJugadores(SERVIDOR.host, SERVIDOR.puerto, 1200)
}
