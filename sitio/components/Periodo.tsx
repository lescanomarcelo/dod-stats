import Link from 'next/link'
import type { ReactNode } from 'react'
import { PERIODOS, type Periodo, type Rango } from '@/lib/periodos'

/*
 *  Control de periodo, igual en todas las paginas: las pestañas (Ayer, Semana, Mes,
 *  Global) y, abajo, el periodo elegido con las flechas para moverse.
 *
 *  Cada pagina arma sus propios enlaces, porque cada una tiene sus otros parametros
 *  (el orden del ranking, el mapa, los jugadores a comparar).
 */

export const NOMBRE_PERIODO: Record<Periodo, string> = {
  dia: 'Ayer',
  semana: 'Semana',
  mes: 'Mes',
  global: 'Global'
}

type Props = {
  rango: Rango
  /** Enlace a un periodo (con su fecha, o null para el actual) conservando lo demas */
  enlace: (periodo: Periodo, fecha: string | null) => string
  /** Controles extra a la derecha de las pestañas, como el selector de mapa */
  children?: ReactNode
}

export function ControlPeriodo ({ rango, enlace, children }: Props) {
  return (
    <>
      <div className='controles-equipos'>
        <nav className='pestanas' aria-label='Período'>
          {PERIODOS.map((x) => (
            <Link key={x} href={enlace(x, null)} scroll={false} className={x === rango.periodo ? 'activa' : ''}>
              {NOMBRE_PERIODO[x]}
            </Link>
          ))}
        </nav>
        {children}
      </div>

      {rango.periodo !== 'global' && (
        <div className='navegador-periodo'>
          {rango.anterior
            ? <Link href={enlace(rango.periodo, rango.anterior)} scroll={false} aria-label='Período anterior'>‹</Link>
            : <span />}
          <strong>
            {rango.etiqueta}
            {rango.actual && <small> (en curso)</small>}
          </strong>
          {rango.siguiente
            ? <Link href={enlace(rango.periodo, rango.siguiente)} scroll={false} aria-label='Período siguiente'>›</Link>
            : <span />}
        </div>
      )}
    </>
  )
}
