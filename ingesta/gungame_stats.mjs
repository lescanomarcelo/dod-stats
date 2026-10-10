/*
 *  La planilla de victorias que lleva el propio gungame.
 *
 *  El plugin gungame_base guarda en dod/gungame.stats una linea por jugador, con
 *  tabs:
 *
 *    STEAM_0:0:25087132	5	El Uru	1791511818	0
 *    steamid              ganadas  nick  visto (unix)  (sin uso)
 *
 *  Es un contador acumulado, no un registro de rondas: dice cuantos gungames ganó
 *  cada uno, no cuando. Para un ranking de "quien gana mas" alcanza.
 *
 *  El gungame puede podar jugadores viejos de su planilla (gg_stats_prune), asi que
 *  de este lado nos quedamos con el maximo visto y no perdemos a nadie.
 */

const STEAMID_VALIDO = /^STEAM_[0-5]:[01]:\d+$/

/**
 * Lee el archivo y devuelve [{ steamid, nick, ganadas, visto }].
 *
 * visto es un Date. Las lineas que no se entienden se saltean en silencio: el
 * archivo lo escribe otro plugin y no queremos que un renglon raro trabe la ingesta.
 */
export function parsearGungameStats (texto) {
  const jugadores = []

  for (const linea of String(texto ?? '').split('\n')) {
    const campos = linea.replace(/\r$/, '').split('\t')
    if (campos.length < 4) continue

    const [steamid, ganadasTexto, nick, vistoTexto] = campos
    if (!STEAMID_VALIDO.test(steamid)) continue

    const ganadas = Number(ganadasTexto)
    if (!Number.isInteger(ganadas) || ganadas <= 0) continue

    const visto = Number(vistoTexto)
    jugadores.push({
      steamid,
      nick: nick ?? '',
      ganadas,
      visto: Number.isFinite(visto) && visto > 0 ? new Date(visto * 1000) : null
    })
  }

  return jugadores
}
