'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/*
 *  Menu de las tres rayitas, arriba a la derecha. Se cierra solo al elegir una
 *  pagina, al tocar afuera o con Escape.
 */

const PAGINAS = [
  { href: '/', texto: 'Ranking' },
  { href: '/equipos', texto: 'Eje vs Aliados' },
  { href: '/armas', texto: 'Armas' },
  { href: '/comparar', texto: 'Comparar' },
  { href: '/links', texto: 'Links' }
]

export function Menu () {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const ruta = usePathname()

  useEffect(() => {
    if (!abierto) return
    const afuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', afuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  return (
    <div className='menu' ref={caja}>
      <button
        type='button'
        className='menu-boton'
        aria-label='Menú'
        aria-expanded={abierto}
        onClick={() => setAbierto((x) => !x)}
      >
        <span className='rayitas' aria-hidden='true'><span /><span /><span /></span>
      </button>

      {abierto && (
        <nav className='menu-panel' aria-label='Secciones'>
          {PAGINAS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className={ruta === p.href ? 'activa' : ''}
              aria-current={ruta === p.href ? 'page' : undefined}
              onClick={() => setAbierto(false)}
            >
              {p.texto}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}
