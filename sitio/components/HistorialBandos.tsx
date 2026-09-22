import Link from 'next/link'
import { veredicto, etiquetaCorta, nombrePeriodo, type Balance } from '@/lib/periodos'
import { formatoNumero } from '@/lib/calculos'

/*
 *  Quien gano cada semana o cada mes: una barra por periodo, hacia arriba si gano
 *  Aliados y hacia abajo si gano el Eje. La altura es la ventaja (mapas ganados de
 *  uno contra otro), asi un 10 a 2 se ve distinto de un 6 a 5.
 *
 *  Antes de que existieran los marcadores (plugin 0.3) el resultado sale de las
 *  kills: esas barras van tenues y con borde punteado para que no se confundan.
 *
 *  SVG armado en el servidor. Cada barra es un enlace a ese periodo.
 */

type Props = {
  tipo: 'semana' | 'mes'
  claves: string[]
  datos: Record<string, Balance>
  elegida: string | null
  enlace: (clave: string) => string
}

const ANCHO_COLUMNA = 56
const ALTO = 230
const CENTRO = 112
const MAX_BARRA = 84

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
  const ancho = claves.length * ANCHO_COLUMNA + 70
  const hayKills = claves.some((c) => datos[c] && veredicto(datos[c]).segun === 'kills')

  return (
    <figure className='historial'>
      <div className='historial-desplazable'>
        <svg viewBox={`0 0 ${ancho} ${ALTO}`} role='img' aria-label={`Quién ganó cada ${tipo}`} style={{ minWidth: `${Math.min(ancho, 520)}px` }}>
          <text x='4' y='24' className='historial-bando aliados'>Aliados</text>
          <text x='4' y={ALTO - 30} className='historial-bando eje'>Eje</text>
          <line x1='62' x2={ancho} y1={CENTRO} y2={CENTRO} className='historial-cero' />

          {claves.map((clave, i) => {
            const b = datos[clave]
            const v = b ? veredicto(b) : null
            const x = 70 + i * ANCHO_COLUMNA
            const centroX = x + ANCHO_COLUMNA / 2
            const alto = v && v.ganador ? Math.max(8, Math.abs(v.margen) * MAX_BARRA) : 0
            const arriba = v?.ganador === 1
            const clase = [
              'historial-barra',
              v?.ganador === 1 ? 'aliados' : v?.ganador === 2 ? 'eje' : '',
              v?.segun === 'kills' ? 'por-kills' : ''
            ].join(' ')
            const marcador = b && b.partidas > 0 ? `${b.ganadosAliados}-${b.ganadosEje}` : ''

            return (
              <Link key={clave} href={enlace(clave)} scroll={false} className={clave === elegida ? 'historial-columna elegida' : 'historial-columna'}>
                <title>{descripcion(tipo, clave, b)}</title>
                <rect x={x + 2} y='6' width={ANCHO_COLUMNA - 4} height={ALTO - 12} rx='5' className='historial-fondo' />
                {v?.ganador
                  ? <rect x={x + 12} y={arriba ? CENTRO - alto : CENTRO} width={ANCHO_COLUMNA - 24} height={alto} rx='3' className={clase} />
                  : v && <rect x={x + 12} y={CENTRO - 2} width={ANCHO_COLUMNA - 24} height='4' rx='2' className='historial-barra empate' />}
                {marcador && (
                  <text x={centroX} y={arriba ? CENTRO - alto - 6 : CENTRO + alto + 15} textAnchor='middle' className='historial-marcador'>{marcador}</text>
                )}
                <text x={centroX} y={ALTO - 10} textAnchor='middle' className='historial-eje-x'>{etiquetaCorta(tipo, clave)}</text>
              </Link>
            )
          })}
        </svg>
      </div>
      <figcaption className='nota'>
        Altura = ventaja en mapas ganados. El número es el resultado en mapas (Aliados-Eje). Tocá una barra para ver ese período.
        {hayKills && ' Las barras tenues con borde punteado son de antes de registrar los marcadores: ahí decide la cantidad de kills.'}
      </figcaption>
    </figure>
  )
}
