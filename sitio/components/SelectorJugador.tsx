'use client'

import { useId, useMemo, useRef, useState } from 'react'

type Jugador = { id: number, nick: string }

const MAXIMO = 60

/* Los que empiezan con lo escrito van primero; despues los que lo contienen */
function filtrar (jugadores: Jugador[], texto: string): Jugador[] {
  const t = texto.trim().toLowerCase()
  if (!t) return jugadores.slice(0, MAXIMO)
  const empiezan: Jugador[] = []
  const contienen: Jugador[] = []
  for (const j of jugadores) {
    const n = j.nick.toLowerCase()
    if (n.startsWith(t)) empiezan.push(j)
    else if (n.includes(t)) contienen.push(j)
  }
  return [...empiezan, ...contienen].slice(0, MAXIMO)
}

export function SelectorJugador ({ nombre, elegido, jugadores }: { nombre: string, elegido: number | null, jugadores: Jugador[] }) {
  const inicial = jugadores.find((j) => j.id === elegido) ?? null
  const [id, setId] = useState<number | null>(inicial?.id ?? null)
  const [texto, setTexto] = useState(inicial?.nick ?? '')
  const [abierto, setAbierto] = useState(false)
  const [resaltado, setResaltado] = useState(0)
  const [filtrando, setFiltrando] = useState(false)
  const lista = useRef<HTMLUListElement>(null)
  const idLista = useId()

  const visibles = useMemo(() => filtrar(jugadores, filtrando ? texto : ''), [jugadores, texto, filtrando])

  function elegir (j: Jugador) {
    setId(j.id)
    setTexto(j.nick)
    setAbierto(false)
    setFiltrando(false)
  }

  function teclado (e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setAbierto(true)
      const siguiente = Math.max(0, Math.min(visibles.length - 1, resaltado + (e.key === 'ArrowDown' ? 1 : -1)))
      setResaltado(siguiente)
      lista.current?.children[siguiente]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter' && abierto && visibles[resaltado]) {
      e.preventDefault()
      elegir(visibles[resaltado])
    } else if (e.key === 'Escape') {
      setAbierto(false)
    }
  }

  return (
    <div className='selector-jugador'>
      <input type='hidden' name={nombre} value={id ?? ''} />
      <input
        type='text'
        role='combobox'
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-label={`Jugador ${nombre.toUpperCase()}`}
        autoComplete='off'
        placeholder='Elegí un jugador'
        value={texto}
        onFocus={(e) => { e.target.select(); setFiltrando(false); setResaltado(0); setAbierto(true) }}
        onBlur={() => setTimeout(() => setAbierto(false), 120)}
        onChange={(e) => { setTexto(e.target.value); setId(null); setFiltrando(true); setResaltado(0); setAbierto(true) }}
        onKeyDown={teclado}
      />
      {abierto && (
        <ul ref={lista} id={idLista} role='listbox' className='selector-lista'>
          {visibles.length === 0 && <li className='selector-vacio'>Nadie con ese nick</li>}
          {visibles.map((j, i) => (
            <li
              key={j.id}
              role='option'
              aria-selected={j.id === id}
              className={i === resaltado ? 'resaltado' : ''}
              onMouseDown={(e) => { e.preventDefault(); elegir(j) }}
              onMouseEnter={() => setResaltado(i)}
            >
              {j.nick}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
