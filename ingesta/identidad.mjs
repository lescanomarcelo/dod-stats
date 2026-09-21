/*
 *  Como identificar a un jugador a lo largo del tiempo.
 *
 *  El steamid es la identidad ideal: no cambia aunque el jugador cambie de nick.
 *  Pero no todos los clientes tienen uno valido. Los clientes no-Steam suelen llegar
 *  como STEAM_ID_LAN, y un jugador que todavia no termino de autenticarse aparece
 *  como STEAM_ID_PENDING. Si usaramos esos valores como identidad, todos esos
 *  jugadores se fundirian en uno solo.
 *
 *  Para esos casos caemos al nick como identidad. Es peor (un cambio de nick crea
 *  un jugador nuevo) pero no mezcla a gente distinta.
 */

const STEAMID_VALIDO = /^STEAM_[0-5]:[01]:\d+$/

/**
 * Devuelve la clave de identidad del jugador, o null si hay que ignorarlo (bots).
 *
 *   { identidad: 'STEAM_0:1:123', steamid: 'STEAM_0:1:123' }   steamid valido
 *   { identidad: 'NICK:Pepe',     steamid: null }              sin steamid valido
 *   null                                                       bot
 */
export function identidadDe (steamid, nick) {
  if (steamid === 'BOT') return null

  if (STEAMID_VALIDO.test(steamid)) {
    return { identidad: steamid, steamid }
  }

  return { identidad: `NICK:${nick}`, steamid: null }
}
