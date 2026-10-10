import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ganadoresDeGungame } from '@/lib/consultas'
import { formatoNumero } from '@/lib/calculos'
import { EnlaceJugador, Cargando } from '@/components/Ui'
import { IconoWhatsApp } from '@/components/Iconos'
import { compartirPorWhatsApp } from '@/lib/enlaces'

const TITULO = 'Campeonato GG'
const BAJADA = 'Quiénes ganaron el gungame'

export const metadata: Metadata = {
  title: TITULO,
  description: BAJADA,
  openGraph: {
    title: `${TITULO} · Tributo Dod Stats!`,
    description: BAJADA,
    siteName: 'Tributo Dod Stats!',
    type: 'website',
    locale: 'es_AR',
    images: [{ url: '/gungame/og.jpg', width: 1200, height: 630 }]
  }
}

async function Contenido () {
  const ganadores = await ganadoresDeGungame()

  return (
    <>
      <div className='banda-compartible'>
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen fija ya optimizada */}
        <img src='/gungame/og.jpg' alt='' width={1200} height={630} className='banda-seccion banda-ancha' />
        <a
          className='boton-whatsapp'
          href={compartirPorWhatsApp('/gungame', `${TITULO} · ${BAJADA}`)}
          target='_blank' rel='noopener noreferrer'
          aria-label='Compartir el Campeonato GG por WhatsApp' title='Compartir por WhatsApp'
        >
          <IconoWhatsApp className='icono-boton' />
        </a>
      </div>

      <section className='seccion'>
        <div className='panel'>
          <h2>Los que ganaron</h2>
          {ganadores.length === 0
            ? <p className='vacio'>Todavía no ganó nadie.</p>
            : (
              <ol className='medallero-lista'>
                {ganadores.map((g, i) => (
                  <li key={g.id}>
                    <span className='posicion numero'>{i + 1}</span>
                    <EnlaceJugador id={g.id} nick={g.nick} />
                    <span className='ojitos-cuenta'>
                      <strong className='numero'>{formatoNumero(g.ganadas)}</strong>
                    </span>
                  </li>
                ))}
              </ol>
              )}
        </div>
      </section>
    </>
  )
}

export default function PaginaGungame () {
  return (
    <>
      <div className='encabezado-pagina'>
        <h1>{TITULO}</h1>
        <p>{BAJADA}.</p>
      </div>

      <Suspense fallback={<Cargando texto='Contando gungames…' />}>
        <Contenido />
      </Suspense>
    </>
  )
}
