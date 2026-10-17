import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
import {
  catalogoDeMapas, mapasParaVotar, quienVoto, doderosParaVotar, type Tamano
} from '@/lib/consultas'
import { quincenaDe, faltaPara } from '@/lib/quincenas'
import { VOTOS_POR_DIA } from '@/lib/votos'
import { VotacionMapas } from '@/components/VotacionMapas'
import { Cargando } from '@/components/Ui'
import { IconoWhatsApp } from '@/components/Iconos'
import { compartirPorWhatsApp } from '@/lib/enlaces'

const TITULO = 'Mapas'
const BAJADA = 'Votá los mapas que querés jugar en el server'

export const metadata: Metadata = {
  title: TITULO,
  description: BAJADA,
  openGraph: {
    title: `${TITULO} · Tributo Dod Stats!`,
    description: BAJADA,
    siteName: 'Tributo Dod Stats!',
    type: 'website',
    locale: 'es_AR',
    images: [{ url: '/mapas/_seccion.jpg', width: 1200, height: 630 }]
  }
}

/* Para cuanta gente va bien cada tamaño. Igual que ingesta/tamano_mapas.mjs */
const JUGADORES: Record<Tamano, number> = { chico: 10, mediano: 16, grande: 24 }
const TAMANOS: Tamano[] = ['chico', 'mediano', 'grande']

async function Votacion () {
  /* En que quincena estamos depende de la hora: sin esto, el build con Cache
     Components intentaria congelarla en el momento en que se compilo */
  await connection()

  const quincena = quincenaDe()
  const [mapas, votantes, doderos] = await Promise.all([
    mapasParaVotar(quincena.clave),
    quienVoto(quincena.clave),
    doderosParaVotar()
  ])

  return (
    <>
      <div className='encabezado-votacion'>
        <h2>Qué querés jugar</h2>
        <p className='nota'>
          Quincena del {quincena.nombre} · {faltaPara(quincena.hasta)} · hasta {VOTOS_POR_DIA} mapas
          por día en cada lista
        </p>
      </div>
      <VotacionMapas mapas={mapas} doderos={doderos} votantes={votantes} />
    </>
  )
}

/*
 *  La lista completa de los mapas del server. Va plegada, y cada tamaño adentro
 *  tambien: lo importante de la seccion es votar, esto es para consultar.
 */
async function TodosLosMapas () {
  const catalogo = await catalogoDeMapas()

  return (
    <section className='seccion'>
      <details className='lista-plegable'>
        <summary>
          Todos los mapas, por tamaño
          <span className='cuantos numero'>{catalogo.length}</span>
        </summary>

        {TAMANOS.map((tamano) => {
          const delTamano = catalogo.filter((m) => m.tamano === tamano)
          return (
            <details className='lista-plegable grupo-mapas' key={tamano}>
              <summary>
                {tamano}s · hasta {JUGADORES[tamano]} jugadores
                <span className='cuantos numero'>{delTamano.length}</span>
              </summary>
              <ul className='mapas-lista'>
                {delTamano.map((m) => <li key={m.mapa}>{m.mapa}</li>)}
              </ul>
            </details>
          )
        })}
      </details>
    </section>
  )
}

export default function PaginaMapas () {
  return (
    <>
      <div className='encabezado-pagina'>
        <h1>{TITULO}</h1>
        <p>{BAJADA}.</p>
      </div>

      <div className='banda-compartible'>
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen fija ya optimizada */}
        <img src='/mapas/_seccion.jpg' alt='' width={1200} height={630} className='banda-seccion banda-ancha' />
        <a
          className='boton-whatsapp'
          href={compartirPorWhatsApp('/mapas', `${TITULO} · ${BAJADA}`)}
          target='_blank' rel='noopener noreferrer'
          aria-label='Compartir los mapas por WhatsApp' title='Compartir por WhatsApp'
        >
          <IconoWhatsApp className='icono-boton' />
        </a>
      </div>

      <Suspense fallback={<Cargando texto='Abriendo la votación…' />}>
        <Votacion />
      </Suspense>

      <Suspense fallback={null}>
        <TodosLosMapas />
      </Suspense>
    </>
  )
}
