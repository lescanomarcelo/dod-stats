import 'server-only'
import { marcadorDeBandos, mejorJugadorDeBando } from './consultas'
import { rangoDe } from './periodos'
import { enlaceDeEquipos } from './enlaces'

/*
 *  Los "titulares": un resumen de a un periodo por vez (ayer, esta semana, este
 *  mes) para la banda de arriba del ranking. Cada uno trae el resultado en mapas
 *  ganados y la figura del bando que va ganando (el que mas banderas tomo de ese
 *  lado). Los periodos sin ninguna partida no aparecen.
 */

type PeriodoTitular = 'dia' | 'semana' | 'mes'
const PERIODOS_TITULAR: PeriodoTitular[] = ['dia', 'semana', 'mes']

const ETIQUETA: Record<PeriodoTitular, string> = {
  dia: 'Ayer',
  semana: 'Esta semana',
  mes: 'Este mes'
}

export type SlideTitular = {
  periodo: PeriodoTitular
  etiqueta: string
  ganadosAliados: number
  ganadosEje: number
  /** 1 aliados, 2 eje, 0 empate */
  ganador: 1 | 2 | 0
  /** El que mas banderas tomo del bando que va ganando. null si nadie tomo ninguna */
  figura: { nick: string, banderas: number } | null
  href: string
}

export async function titulares (): Promise<SlideTitular[]> {
  const slides = await Promise.all(PERIODOS_TITULAR.map(async (periodo): Promise<SlideTitular | null> => {
    const rango = rangoDe(periodo)
    const ventana = { desde: rango.desde, hasta: rango.hasta }
    const marcador = await marcadorDeBandos(null, ventana)
    if (marcador.partidas === 0) return null

    const ganador: 1 | 2 | 0 = marcador.ganadosAliados > marcador.ganadosEje
      ? 1
      : marcador.ganadosEje > marcador.ganadosAliados ? 2 : 0

    const figuraCruda = ganador !== 0 ? await mejorJugadorDeBando(ganador, ventana) : null

    return {
      periodo,
      etiqueta: ETIQUETA[periodo],
      ganadosAliados: marcador.ganadosAliados,
      ganadosEje: marcador.ganadosEje,
      ganador,
      figura: figuraCruda ? { nick: figuraCruda.nick, banderas: figuraCruda.valor } : null,
      href: enlaceDeEquipos(periodo, rango.clave)
    }
  }))

  return slides.filter((s): s is SlideTitular => s !== null)
}
