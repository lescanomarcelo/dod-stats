import Link from 'next/link'
import type { ReactNode } from 'react'

export function Tarjeta ({ etiqueta, valor, destacada = false }: { etiqueta: string, valor: ReactNode, destacada?: boolean }) {
  return (
    <div className={`tarjeta${destacada ? ' destacada' : ''}`}>
      <div className='etiqueta'>{etiqueta}</div>
      <div className='valor numero'>{valor}</div>
    </div>
  )
}

type Barra = { clave: string, nombre: string, valor: number, texto?: string, variante?: 'cabeza' }

/** Barras horizontales proporcionales al valor mas alto de la lista */
export function Barras ({ filas }: { filas: Barra[] }) {
  if (!filas.length) return <p className='vacio'>Sin datos todavía.</p>
  const maximo = Math.max(...filas.map((f) => f.valor), 1)
  return (
    <div className='barras'>
      {filas.map((f) => (
        <div className='barra-fila' key={f.clave}>
          <span className='nombre' title={f.nombre}>{f.nombre}</span>
          <div className='barra-pista'>
            <div
              className={`barra-relleno${f.variante ? ` ${f.variante}` : ''}`}
              style={{ width: `${(f.valor / maximo) * 100}%` }}
            />
          </div>
          <span className='cifra numero'>{f.texto ?? f.valor}</span>
        </div>
      ))}
    </div>
  )
}

export function EnlaceJugador ({ id, nick }: { id: number, nick: string }) {
  return <Link href={`/jugador/${id}`} className='jugador'>{nick}</Link>
}

export function Cargando ({ texto = 'Cargando…' }: { texto?: string }) {
  return <p className='cargando'>{texto}</p>
}
