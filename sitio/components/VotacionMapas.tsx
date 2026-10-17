'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { VOTOS_POR_DIA, type Conteo } from '@/lib/votos'
import type { MapaVotable, Tamano } from '@/lib/consultas'

const TAMANOS: Tamano[] = ['chico', 'mediano', 'grande']
const JUGADORES: Record<Tamano, number> = { chico: 10, mediano: 16, grande: 24 }
const RECUERDO = 'dodero'

type Dodero = { id: number, nick: string }

const todosLosVotos = (): Conteo => ({ chico: VOTOS_POR_DIA, mediano: VOTOS_POR_DIA, grande: VOTOS_POR_DIA })

/*
 *  El nick elegido vive en el navegador, no en React. useSyncExternalStore es la
 *  forma de leerlo sin romper la hidratacion (en el server no hay localStorage) y
 *  sin provocar un render en cascada.
 *
 *  Que se pueda guardar es una comodidad: en incognito falla y no pasa nada, solo
 *  hay que elegir el nick de nuevo.
 */
const oyentes = new Set<() => void>()
let elegido: number | null | undefined

function leerDelNavegador (): number | null {
  try {
    const guardado = Number(window.localStorage.getItem(RECUERDO))
    return Number.isInteger(guardado) && guardado > 0 ? guardado : null
  } catch {
    return null
  }
}

function leerElegido (): number | null {
  if (elegido === undefined) elegido = leerDelNavegador()
  return elegido
}

function elegir (id: number | null) {
  elegido = id
  try {
    if (id) window.localStorage.setItem(RECUERDO, String(id))
    else window.localStorage.removeItem(RECUERDO)
  } catch { /* en incognito no se puede guardar: igual sirve por esta visita */ }
  for (const avisar of oyentes) avisar()
}

function suscribir (avisar: () => void) {
  oyentes.add(avisar)
  return () => { oyentes.delete(avisar) }
}

/* En el server todavia no hay nick elegido */
const enElServidor = () => null

type MisVotos = { de: number, mios: string[], quedan: Conteo }

export function VotacionMapas (
  { mapas, doderos, votantes }:
  { mapas: MapaVotable[], doderos: Dodero[], votantes: { mapa: string, nick: string }[] }
) {
  const jugadorId = useSyncExternalStore(suscribir, leerElegido, enElServidor)

  const [misVotos, setMisVotos] = useState<MisVotos | null>(null)
  const [votos, setVotos] = useState<Record<string, number>>(
    () => Object.fromEntries(mapas.map((m) => [m.mapa, m.votos])))
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  /* Lo que ya voto hoy. Mientras no vuelva, se muestra como si no hubiera votado. */
  useEffect(() => {
    if (!jugadorId) return
    let vigente = true
    fetch(`/api/voto?jugadorId=${jugadorId}`)
      .then((r) => r.json())
      .then((d: { mios?: string[], quedan?: Conteo }) => {
        if (vigente && d.mios && d.quedan) setMisVotos({ de: jugadorId, mios: d.mios, quedan: d.quedan })
      })
      .catch(() => {})
    return () => { vigente = false }
  }, [jugadorId])

  /* Lo que se sabe del dodero que esta elegido AHORA, no del anterior */
  const delDodero = misVotos?.de === jugadorId ? misVotos : null
  const mios = delDodero?.mios ?? []
  const quedan = delDodero?.quedan ?? todosLosVotos()

  const porMapa = useMemo(() => {
    const agrupado: Record<string, string[]> = {}
    for (const v of votantes) (agrupado[v.mapa] ??= []).push(v.nick)
    return agrupado
  }, [votantes])

  async function votar (mapa: string) {
    if (!jugadorId) { setAviso('Elegí tu nick arriba para poder votar'); return }

    setEnviando(mapa)
    setAviso(null)
    try {
      const r = await fetch('/api/voto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jugadorId, mapa, sacar: mios.includes(mapa) })
      })
      const d = await r.json()
      if (!r.ok) { setAviso(d.error ?? 'No se pudo votar'); return }

      setVotos((antes) => ({ ...antes, [mapa]: d.votos }))
      setMisVotos({ de: jugadorId, mios: d.mios, quedan: d.quedan })
    } catch {
      setAviso('No se pudo votar. Probá de nuevo en un rato.')
    } finally {
      setEnviando(null)
    }
  }

  const buscado = busqueda.toLowerCase().trim()
  const listaDe = (tamano: Tamano) => mapas
    .filter((m) => m.tamano === tamano && (!buscado || m.mapa.includes(buscado)))
    .map((m) => ({ ...m, votos: votos[m.mapa] ?? m.votos }))
    .sort((a, b) => b.votos - a.votos || a.mapa.localeCompare(b.mapa))

  return (
    <>
      <div className='panel votar-quien'>
        <label htmlFor='dodero'>Votás como</label>
        <select
          id='dodero'
          value={jugadorId ?? ''}
          onChange={(e) => {
            elegir(e.target.value ? Number(e.target.value) : null)
            setAviso(null)
          }}
        >
          <option value=''>— elegí tu nick —</option>
          {doderos.map((d) => <option key={d.id} value={d.id}>{d.nick}</option>)}
        </select>
        <input
          type='search'
          placeholder='Buscar un mapa…'
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label='Buscar un mapa'
        />
      </div>

      {aviso && <p className='aviso'>{aviso}</p>}

      {TAMANOS.map((tamano) => {
        const lista = listaDe(tamano)
        return (
          <section className='seccion' key={tamano}>
            <h2>
              Mapas {tamano}s
              <span className='votar-para'>hasta {JUGADORES[tamano]} jugadores</span>
              {jugadorId && (
                <span className='votar-quedan numero'>te quedan {quedan[tamano]} hoy</span>
              )}
            </h2>

            {lista.length === 0
              ? <p className='vacio'>Ningún mapa {tamano} con ese nombre.</p>
              : (
                <ul className='votar-lista'>
                  {lista.map((m) => {
                    const mio = mios.includes(m.mapa)
                    const sinVotos = !mio && quedan[tamano] === 0
                    return (
                      <li key={m.mapa} className={mio ? 'votado' : ''}>
                        <button
                          type='button'
                          onClick={() => votar(m.mapa)}
                          disabled={enviando === m.mapa || (!!jugadorId && sinVotos)}
                          title={mio ? 'Sacar mi voto' : 'Votar este mapa'}
                        >
                          <span className='votar-tilde' aria-hidden='true'>{mio ? '✔' : '+'}</span>
                          <span className='votar-mapa'>{m.mapa}</span>
                          <span className='votar-votos numero'>{m.votos}</span>
                        </button>
                        {(porMapa[m.mapa]?.length ?? 0) > 0 && (
                          <span className='votar-quienes'>{porMapa[m.mapa].join(', ')}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
                )}
          </section>
        )
      })}
    </>
  )
}
