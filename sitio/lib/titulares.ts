import 'server-only'
import { marcadorDeBandos, mejorDodero } from './consultas'
import { rangoDe } from './periodos'
import { enlaceDeEquipos } from './enlaces'

/*
 *  Los "titulares": un resumen de a un periodo por vez para la banda de arriba
 *  del ranking, al estilo "jugador de la semana".
 *
 *  Ayer siempre esta cerrado (el dia anterior ya termino) y cambia solo, una vez
 *  por dia. Semana y mes en cambio muestran el PERIODO YA CERRADO -la semana
 *  pasada, el mes pasado-, no el que esta en curso: el dato queda fijo desde que
 *  cierra hasta el proximo cierre (la semana cierra el domingo a la noche, el mes
 *  el ultimo dia). Mientras no haya ningun periodo cerrado con partidas (server
 *  nuevo, o nadie jugo la semana/el mes anterior), se avisa la fecha del proximo
 *  cierre en vez de mostrar numeros.
 *
 *  Cada slide trae el resultado en mapas ganados y el "dodero estrella": el que
 *  mas banderas tomo del bando que gano ese periodo (o de los dos bandos juntos,
 *  si el resultado en mapas quedo empatado), desempatando por kills.
 */

export type SlideTitular =
  | {
    estado: 'con-datos'
    etiqueta: string
    ganadosAliados: number
    ganadosEje: number
    /** 1 aliados, 2 eje, 0 empate en mapas ganados */
    ganador: 1 | 2 | 0
    dodero: { nick: string, banderas: number } | null
    href: string
  }
  | {
    /** Todavia no hubo un cierre con partidas: solo se avisa cuando va a cerrar */
    estado: 'sin-cerrar'
    etiqueta: string
    cierra: string
    href: string
  }

const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: 'numeric', timeZone: 'America/Argentina/Buenos_Aires'
})

/** "Agosto de 2026" -> "Agosto". El mes solo, para un titular corto */
const soloMes = (etiquetaMes: string) => etiquetaMes.split(' de ')[0]

async function slideConDatos (
  etiqueta: string,
  marcador: { ganadosAliados: number, ganadosEje: number },
  ventana: { desde: string | null, hasta: string | null },
  href: string
): Promise<SlideTitular> {
  const ganador: 1 | 2 | 0 = marcador.ganadosAliados > marcador.ganadosEje
    ? 1
    : marcador.ganadosEje > marcador.ganadosAliados ? 2 : 0

  const dodero = await mejorDodero(ganador === 0 ? null : ganador, ventana)

  return {
    estado: 'con-datos',
    etiqueta,
    ganadosAliados: marcador.ganadosAliados,
    ganadosEje: marcador.ganadosEje,
    ganador,
    dodero: dodero ? { nick: dodero.nick, banderas: dodero.banderas } : null,
    href
  }
}

async function slideDia (): Promise<SlideTitular | null> {
  const rango = rangoDe('dia')
  const ventana = { desde: rango.desde, hasta: rango.hasta }
  const marcador = await marcadorDeBandos(null, ventana)
  if (marcador.partidas === 0) return null

  return slideConDatos('Ayer', marcador, ventana, enlaceDeEquipos('dia', rango.clave))
}

/** Semana o mes: el ultimo periodo YA CERRADO, no el que esta en curso */
async function slideCerrable (periodo: 'semana' | 'mes', nombre: string, etiquetaCerrado: (etiqueta: string) => string): Promise<SlideTitular> {
  const actual = rangoDe(periodo)
  const cerrado = rangoDe(periodo, actual.anterior)
  const ventana = { desde: cerrado.desde, hasta: cerrado.hasta }
  const marcador = await marcadorDeBandos(null, ventana)

  if (marcador.partidas === 0) {
    return {
      estado: 'sin-cerrar',
      etiqueta: nombre,
      cierra: FORMATO_FECHA.format(new Date(actual.hasta!)),
      href: enlaceDeEquipos(periodo, actual.clave)
    }
  }

  return slideConDatos(etiquetaCerrado(cerrado.etiqueta), marcador, ventana, enlaceDeEquipos(periodo, cerrado.clave))
}

export async function titulares (): Promise<SlideTitular[]> {
  const [dia, semana, mes] = await Promise.all([
    slideDia(),
    slideCerrable('semana', 'Semana', () => 'La semana pasada'),
    slideCerrable('mes', 'Mes', soloMes)
  ])

  return [dia, semana, mes].filter((s): s is SlideTitular => s !== null)
}
