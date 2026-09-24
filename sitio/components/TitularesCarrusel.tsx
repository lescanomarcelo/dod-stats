'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { SlideTitular } from '@/lib/titulares'
import { formatoNumero } from '@/lib/calculos'
import { EscudoAliados, EscudoEje } from '@/components/Banderas'

/*
 *  Va mostrando "Ayer", "Esta semana" y "Este mes" de a uno, solos o mezclados
 *  con los que ya tienen partidas jugadas (los que no tienen ninguna ni llegan
 *  aca: se filtran en lib/titulares.ts). Todo el recuadro es un solo enlace a
 *  Eje vs Aliados con ese periodo elegido, nunca al perfil de la figura.
 *
 *  Cada 5 segundos pasa al siguiente. Tocar un punto salta ahi y reinicia la
 *  cuenta, asi no compite con el avance automatico.
 */

const SEGUNDOS_POR_SLIDE = 5000

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
      <Link href={slide.href} className='titulares-slide' key={slide.periodo}>
        <span className='titulares-periodo'>{slide.etiqueta}</span>

        <span className='titulares-marcador'>
          <EscudoAliados className='escudo-chico' />
          <strong className={`numero${slide.ganador === 1 ? ' titulares-gana aliados' : ''}`}>{formatoNumero(slide.ganadosAliados)}</strong>
          <span className='titulares-vs'>vs</span>
          <strong className={`numero${slide.ganador === 2 ? ' titulares-gana eje' : ''}`}>{formatoNumero(slide.ganadosEje)}</strong>
          <EscudoEje className='escudo-chico' />
        </span>

        {slide.ganador === 0
          ? <span className='titulares-figura'>Empate en mapas</span>
          : slide.figura && (
            <span className={`titulares-figura ${slide.ganador === 1 ? 'aliados' : 'eje'}`}>
              Figura {slide.ganador === 1 ? 'aliada' : 'del Eje'}: <strong>{slide.figura.nick}</strong> · {formatoNumero(slide.figura.banderas)} banderas
            </span>
            )}
      </Link>

      {slides.length > 1 && (
        <div className='titulares-puntos' role='tablist' aria-label='Período de los titulares'>
          {slides.map((s, i) => (
            <button
              key={s.periodo}
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
