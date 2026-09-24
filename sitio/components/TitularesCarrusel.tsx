'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { SlideTitular } from '@/lib/titulares'
import { formatoNumero } from '@/lib/calculos'
import { EscudoAliados, EscudoEje } from '@/components/Banderas'

/*
 *  Va mostrando "Ayer", la semana pasada y el mes pasado de a uno. Todo el
 *  recuadro es un solo enlace a Eje vs Aliados con ese periodo, nunca al perfil
 *  del dodero.
 *
 *  Cada 8 segundos pasa al siguiente. Tocar un punto salta ahi y reinicia la
 *  cuenta, asi no compite con el avance automatico.
 */

const SEGUNDOS_POR_SLIDE = 8000

/* Color del dodero: el del bando que gano. Empate en mapas -> sin color de bando */
const claseBando = (ganador: 1 | 2 | 0) => (ganador === 1 ? ' aliados' : ganador === 2 ? ' eje' : '')

function Marcador ({ slide }: { slide: Extract<SlideTitular, { estado: 'con-datos' }> }) {
  return (
    <span className='titulares-marcador'>
      <EscudoAliados className='escudo-chico' />
      <strong className={`numero${slide.ganador === 1 ? ' titulares-gana aliados' : ''}`}>{formatoNumero(slide.ganadosAliados)}</strong>
      <span className='titulares-vs'>vs</span>
      <strong className={`numero${slide.ganador === 2 ? ' titulares-gana eje' : ''}`}>{formatoNumero(slide.ganadosEje)}</strong>
      <EscudoEje className='escudo-chico' />
    </span>
  )
}

function Contenido ({ slide }: { slide: SlideTitular }) {
  if (slide.estado === 'sin-cerrar') {
    return (
      <>
        <span className='titulares-fila1'>
          <span className='titulares-periodo'>{slide.etiqueta}</span>
        </span>
        <span className='titulares-figura'>Todavía no cerró. Se publica el {slide.cierra}.</span>
      </>
    )
  }

  return (
    <>
      <span className='titulares-fila1'>
        <span className='titulares-periodo'>{slide.etiqueta}</span>
        <Marcador slide={slide} />
      </span>

      {slide.ganador === 0 && <span className='titulares-figura'>Empate en mapas ganados</span>}

      {slide.dodero
        ? (
          <>
            <span className={`titulares-dodero${claseBando(slide.ganador)}`}>Dodero estrella: <strong>{slide.dodero.nick}</strong></span>
            <span className={`titulares-dodero${claseBando(slide.ganador)}`}>{formatoNumero(slide.dodero.banderas)} banderas</span>
          </>
          )
        : slide.ganador !== 0 && <span className='titulares-figura'>Nadie tomó banderas todavía.</span>}
    </>
  )
}

export function TitularesCarrusel ({ slides }: { slides: SlideTitular[] }) {
  const [indice, setIndice] = useState(0)

  useEffect(() => {
    if (slides.length < 2) return
    const reloj = setTimeout(() => setIndice((i) => (i + 1) % slides.length), SEGUNDOS_POR_SLIDE)
    return () => clearTimeout(reloj)
  }, [indice, slides.length])

  const slide = slides[indice]

  return (
    <div className='titulares'>
      <span className='titulares-etiqueta'>Titulares</span>

      {/* La key fuerza a React a rearmar el nodo en cada cambio: asi la animacion de entrada se repite */}
      <Link href={slide.href} className='titulares-slide' key={slide.etiqueta}>
        <Contenido slide={slide} />
      </Link>

      {slides.length > 1 && (
        <div className='titulares-puntos' role='tablist' aria-label='Período de los titulares'>
          {slides.map((s, i) => (
            <button
              key={s.etiqueta}
              type='button'
              role='tab'
              aria-selected={i === indice}
              aria-label={s.etiqueta}
              className={i === indice ? 'activo' : ''}
              onClick={() => setIndice(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
