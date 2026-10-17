import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
import {
  catalogoDeMapas, mapasParaVotar, quienVoto, doderosParaVotar,
  comoQuedoLaQuincena, cuantosVotaron, type Tamano
} from '@/lib/consultas'
import { quincenaDe, quincenaAnterior, faltaPara } from '@/lib/quincenas'
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
 *  Como quedo la quincena pasada. No hace falta cerrar nada cuando termina una:
 *  cada voto queda atado a la suya, asi que el 1 y el 16 la nueva arranca vacia
 *  sola. Si la pasada no tuvo ni un voto, esto no se muestra.
 */
async function QuincenaPasada () {
  await connection()

  const pasada = quincenaAnterior()
  const [podio, votaron] = await Promise.all([
    comoQuedoLaQuincena(pasada.clave),
    cuantosVotaron(pasada.clave)
  ])
  if (podio.length === 0) return null

  return (
    <section className='seccion'>
      <details className='lista-plegable'>
        <summary>
          Cómo quedó la quincena pasada
          <span className='cuantos numero'>{pasada.nombre}</span>
        </summary>

        <div className='podios'>
          {TAMANOS.map((tamano) => {
            const delTamano = podio.filter((m) => m.tamano === tamano)
            if (delTamano.length === 0) return null
            return (
              <div className='panel podio' key={tamano}>
                <strong className='podio-nombre'>{tamano}s · hasta {JUGADORES[tamano]}</strong>
                <ol className='podio-lista'>
                  {delTamano.map((m) => (
                    <li key={m.mapa}>
                      <span className='podio-mapa'>{m.mapa}</span>
                      <span className='numero'>{m.votos}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )
          })}
        </div>
        <p className='nota'>
          Votaron {votaron} {votaron === 1 ? 'dodero' : 'doderos'} en la quincena del{' '}
          {pasada.nombre}.
        </p>
      </details>
    </section>
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
        <QuincenaPasada />
      </Suspense>

      <Suspense fallback={null}>
        <TodosLosMapas />
      </Suspense>
    </>
  )
}
