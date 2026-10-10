import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ganadoresDeGungame, partidasDeGungame } from '@/lib/consultas'
import { formatoNumero } from '@/lib/calculos'
import { EnlaceJugador, Cargando } from '@/components/Ui'
import { IconoWhatsApp } from '@/components/Iconos'
import { compartirPorWhatsApp } from '@/lib/enlaces'

const TITULO = 'GunGame'
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
  const [ganadores, partidas] = await Promise.all([ganadoresDeGungame(), partidasDeGungame()])
  const total = ganadores.reduce((suma, g) => suma + g.ganadas, 0)

  return (
    <>
      <div className='banda-compartible'>
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen fija ya optimizada */}
        <img src='/gungame/og.jpg' alt='' width={1200} height={630} className='banda-seccion banda-ancha' />
        <a
          className='boton-whatsapp'
          href={compartirPorWhatsApp('/gungame', `${TITULO} · ${BAJADA}`)}
          target='_blank' rel='noopener noreferrer'
          aria-label='Compartir el gungame por WhatsApp' title='Compartir por WhatsApp'
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

      <section className='seccion'>
        <div className='panel'>
          <h2>Cómo se cuenta</h2>
          <p>
            El gungame lo prende un admin de vez en cuando: a cada uno le va tocando un arma
            distinta y gana el que llega al final de la escalera. Van{' '}
            <strong className='numero'>{formatoNumero(total)}</strong>{' '}
            {total === 1 ? 'gungame ganado' : 'gungames ganados'} en{' '}
            <strong className='numero'>{formatoNumero(partidas)}</strong>{' '}
            {partidas === 1 ? 'partida' : 'partidas'}.
          </p>
          <p>
            Las victorias las lleva el propio gungame, no nosotros, así que son de toda la
            historia y no se pueden cortar por semana o por mes como el resto del sitio.
          </p>
          <p>
            Lo que pasa en gungame <strong>no cuenta</strong> para ninguna otra estadística: las
            kills, las muertes, las banderas y el tiempo de esas partidas quedan afuera del
            ranking y del medallero. Ahí el arma te la reparte el modo, no la elegís, así que
            esos números no dirían nada de cómo juega cada uno.
          </p>
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
