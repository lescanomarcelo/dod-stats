import Link from 'next/link'
import { veredicto, etiquetaCorta, nombrePeriodo, type Balance } from '@/lib/periodos'
import { formatoNumero } from '@/lib/calculos'

/*
 *  Quien gano cada semana o cada mes: dos columnas por periodo, la verde de los
 *  Aliados y la roja del Eje, con los mapas que gano cada uno.
 *
 *  Antes era una sola barra que salia hacia arriba o hacia abajo segun la VENTAJA.
 *  Se leia mal: un 28 a 35 -una diferencia chica sobre muchos mapas- quedaba como
 *  una rayita de nada, y encima el bando perdedor no se veia por ningun lado. Con
 *  las dos columnas se ve el volumen de mapas jugados y de que tamaño fue la
 *  diferencia.
 *
 *  Las dos columnas comparten escala entre todos los periodos, asi una semana de
 *  60 mapas no se ve igual que una de 6. La del que gano va llena; la del que
 *  perdio, mas apagada.
 *
 *  Antes de que existieran los marcadores (plugin 0.3) no hay mapas ganados: esos
 *  periodos no dibujan columnas y el resultado, que sale de las kills, queda en el
 *  globito.
 *
 *  SVG armado en el servidor. Cada periodo es un enlace a ese periodo.
 */

type Props = {
  tipo: 'semana' | 'mes'
  claves: string[]
  datos: Record<string, Balance>
  elegida: string | null
  enlace: (clave: string) => string
}

const ANCHO_COLUMNA = 52
const ALTO = 200
const BASE = 158
const MAX_BARRA = 118
const ANCHO_BARRA = 16
const SEPARACION = 6

function descripcion (tipo: 'semana' | 'mes', clave: string, b: Balance | undefined) {
  const nombre = nombrePeriodo(tipo, clave)
  if (!b) return `${nombre}: sin partidas`
  const v = veredicto(b)
  const quien = v.ganador === 1 ? 'Ganaron los Aliados' : v.ganador === 2 ? 'Ganó el Eje' : 'Empate'
  const partes = [`${nombre}: ${quien}`]
  if (b.partidas > 0) {
    partes.push(`Mapas ganados ${b.ganadosAliados} a ${b.ganadosEje} (de ${b.partidas})`)
    partes.push(`Puntos ${formatoNumero(b.puntosAliados)} a ${formatoNumero(b.puntosEje)}`)
  }
  partes.push(`Kills ${formatoNumero(b.killsAliados)} a ${formatoNumero(b.killsEje)}${v.segun === 'kills' ? ' (sin marcadores: decide por kills)' : ''}`)
  return partes.join('\n')
}

export function HistorialBandos ({ tipo, claves, datos, elegida, enlace }: Props) {
  const ancho = claves.length * ANCHO_COLUMNA + 16
  const hayKills = claves.some((c) => datos[c] && veredicto(datos[c]).segun === 'kills')

  /* Escala compartida: la manda el periodo con mas mapas ganados de un lado */
  const maximo = Math.max(1, ...claves.flatMap((c) => {
    const b = datos[c]
    return b ? [b.ganadosAliados, b.ganadosEje] : []
  }))
  const altoDe = (valor: number) => (valor > 0 ? Math.max(3, (valor / maximo) * MAX_BARRA) : 0)

  return (
    <figure className='historial'>
      <div className='historial-leyenda'>
        <span className='marca aliados' />Aliados
        <span className='marca eje' />Eje
        <span className='historial-unidad'>mapas ganados</span>
      </div>

      <div className='historial-desplazable'>
        <svg viewBox={`0 0 ${ancho} ${ALTO}`} role='img' aria-label={`Mapas ganados por cada bando, ${tipo} a ${tipo}`} style={{ minWidth: `${Math.min(ancho, 520)}px` }}>
          <line x1='4' x2={ancho - 4} y1={BASE} y2={BASE} className='historial-cero' />

          {claves.map((clave, i) => {
            const b = datos[clave]
            const v = b ? veredicto(b) : null
            const x = 8 + i * ANCHO_COLUMNA
            const centroX = x + ANCHO_COLUMNA / 2
            const izq = centroX - SEPARACION / 2 - ANCHO_BARRA
            const der = centroX + SEPARACION / 2
            const conMapas = Boolean(b && b.partidas > 0)
            const altoAliados = conMapas ? altoDe(b!.ganadosAliados) : 0
            const altoEje = conMapas ? altoDe(b!.ganadosEje) : 0

            /* El que gano va lleno; el otro, apagado */
            const clase = (bando: 1 | 2) =>
              `historial-barra ${bando === 1 ? 'aliados' : 'eje'}${v?.ganador && v.ganador !== bando ? ' perdio' : ''}`

            return (
              <Link key={clave} href={enlace(clave)} scroll={false} className={clave === elegida ? 'historial-columna elegida' : 'historial-columna'}>
                <title>{descripcion(tipo, clave, b)}</title>
                <rect x={x + 1} y='4' width={ANCHO_COLUMNA - 2} height={ALTO - 8} rx='5' className='historial-fondo' />

                {conMapas
                  ? (
                    <>
                      <rect x={izq} y={BASE - altoAliados} width={ANCHO_BARRA} height={altoAliados} rx='2' className={clase(1)} />
                      <rect x={der} y={BASE - altoEje} width={ANCHO_BARRA} height={altoEje} rx='2' className={clase(2)} />
                      <text x={izq + ANCHO_BARRA / 2} y={BASE - altoAliados - 5} textAnchor='middle' className='historial-marcador aliados'>{b!.ganadosAliados}</text>
                      <text x={der + ANCHO_BARRA / 2} y={BASE - altoEje - 5} textAnchor='middle' className='historial-marcador eje'>{b!.ganadosEje}</text>
                    </>
                    )
                  : v?.ganador
                    ? <rect x={centroX - 9} y={BASE - 4} width='18' height='4' rx='2' className={`historial-barra ${v.ganador === 1 ? 'aliados' : 'eje'} por-kills`} />
                    : null}

                <text x={centroX} y={ALTO - 14} textAnchor='middle' className='historial-eje-x'>{etiquetaCorta(tipo, clave)}</text>
              </Link>
            )
          })}
        </svg>
      </div>

      <figcaption className='nota'>
        Cada período, los mapas que ganó cada bando. La columna llena es la del que ganó. Tocá un período para verlo.
        {hayKills && ' Los períodos con una rayita al pie son de antes de registrar los marcadores: ahí no hay mapas ganados y el resultado lo decide la cantidad de kills.'}
      </figcaption>
    </figure>
  )
}
