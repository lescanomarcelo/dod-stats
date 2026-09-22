'use client'

import { useEffect, useState } from 'react'
import type { JugadorEnLinea } from '@/lib/servidor'
import { formatoTiempo } from '@/lib/calculos'

/*
 *  "2/24 jugando" es un boton: al tocarlo se abre una ventana con quienes estan
 *  en el server ahora, su puntaje y hace cuanto estan. Se cierra con la X, con
 *  Escape o tocando afuera.
 *
 *  Los datos vienen del server (cacheados un minuto), no se consultan al abrir.
 */

type Props = {
  jugadores: JugadorEnLinea[]
  humanos: number
  maximo: number
  mapa: string
}

export function JugadoresEnLinea ({ jugadores, humanos, maximo, mapa }: Props) {
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (!abierto) return
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [abierto])

  const cifra = <><strong className='numero'>{humanos}/{maximo}</strong> jugando</>

  if (humanos === 0) return <span className='sin-gente'>{cifra}</span>

  return (
    <>
      <button type='button' className='boton-jugando' onClick={() => setAbierto(true)}>
        {cifra}
      </button>

      {abierto && (
        <div className='fondo-ventana' onClick={() => setAbierto(false)}>
          <div className='ventana' role='dialog' aria-modal='true' aria-label='Jugadores en el server' onClick={(e) => e.stopPropagation()}>
            <div className='ventana-cabecera'>
              <div>
                <h2>Jugando ahora</h2>
                <span className='ventana-mapa numero'>{mapa}</span>
              </div>
              <button type='button' className='ventana-cerrar' aria-label='Cerrar' onClick={() => setAbierto(false)}>×</button>
            </div>

            {jugadores.length === 0
              ? <p className='vacio'>El server no devolvió la lista.</p>
              : (
                <ul className='lista'>
                  {jugadores
                    .slice()
                    .sort((a, b) => b.puntos - a.puntos)
                    .map((j) => (
                      <li key={`${j.nombre}-${j.segundos}`}>
                        <span className='jugando-nick'>{j.nombre}</span>
                        <span className='cifra numero'>
                          <strong>{j.puntos}</strong> pts · {formatoTiempo(j.segundos)}
                        </span>
                      </li>
                    ))}
                </ul>
                )}
          </div>
        </div>
      )}
    </>
  )
}
