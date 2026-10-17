import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
import {
  rankingDeMapas, mapasPorTamano, catalogoDeMapas,
  mapasParaVotar, quienVoto, doderosParaVotar, type Tamano
} from '@/lib/consultas'
import { quincenaDe, faltaPara } from '@/lib/quincenas'
import { VotacionMapas } from '@/components/VotacionMapas'
import { formatoNumero } from '@/lib/calculos'
import { Cargando, Tarjeta } from '@/components/Ui'
import { IconoWhatsApp } from '@/components/Iconos'
import { compartirPorWhatsApp } from '@/lib/enlaces'

const TITULO = 'Mapas'
const BAJADA = 'Los mapas que más se juegan en el server'

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
          Quincena del {quincena.nombre} · {faltaPara(quincena.hasta)} · hasta 3 mapas por día
          en cada lista
        </p>
      </div>
      <VotacionMapas mapas={mapas} doderos={doderos} votantes={votantes} />
    </>
  )
}

async function Contenido () {
  const [mapas, porTamano, catalogo] = await Promise.all([rankingDeMapas(), mapasPorTamano(), catalogoDeMapas()])
  const totalPartidas = mapas.reduce((suma, m) => suma + m.partidas, 0)

  return (
    <>
      <section className='seccion'>
        <h2>Por tamaño</h2>
        <div className='tarjetas'>
          {TAMANOS.map((t) => <Tarjeta key={t} etiqueta={`${t}s`} valor={porTamano[t]} />)}
        </div>
        <p className='nota'>
          Los chicos van bien hasta {JUGADORES.chico} jugadores, los medianos hasta{' '}
          {JUGADORES.mediano} y los grandes hasta {JUGADORES.grande}. Cada tamaño va a tener su
          propia votación.
        </p>
      </section>

      <section className='seccion'>
        <details className='lista-plegable'>
          <summary>
            Todos los mapas, por tamaño
            <span className='cuantos numero'>{catalogo.length}</span>
          </summary>

          {TAMANOS.map((tamano) => {
            const delTamano = catalogo.filter((m) => m.tamano === tamano)
            return (
              <div key={tamano}>
                <h3 className='mapas-grupo'>
                  {tamano}s · hasta {JUGADORES[tamano]} jugadores
                  <span className='cuantos numero'>{delTamano.length}</span>
                </h3>
                <ul className='mapas-lista'>
                  {delTamano.map((m) => (
                    <li key={m.mapa}>
                      {m.mapa}
                      <span className='nota'>{m.area}{m.aMano ? ' · a mano' : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </details>
      </section>

      <section className='seccion tabla-envoltorio'>
        <table>
          <thead>
            <tr>
              <th className='num'>#</th>
              <th>Mapa</th>
              <th>Tamaño</th>
              <th className='num'>Partidas</th>
            </tr>
          </thead>
          <tbody>
            {mapas.map((m, i) => (
              <tr key={m.mapa}>
                <td className='posicion num'>{i + 1}</td>
                <td>
                  {m.mapa}
                  {!m.enElServer && <span className='nota'> · ya no está en el server</span>}
                </td>
                <td>{m.tamano ?? '—'}</td>
                <td className='num'>{formatoNumero(m.partidas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className='nota'>
        {formatoNumero(mapas.length)} mapas jugados y {formatoNumero(totalPartidas)} partidas desde
        que arrancaron las estadísticas. El tamaño sale de la medida real del mapa y decide en cuál
        de las tres votaciones entra.
      </p>
    </>
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

      <Suspense fallback={<Cargando texto='Contando partidas…' />}>
        <Contenido />
      </Suspense>
    </>
  )
}
