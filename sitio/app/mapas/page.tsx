import type { Metadata } from 'next'
import { Suspense } from 'react'
import { rankingDeMapas, mapasPorTamano, type Tamano } from '@/lib/consultas'
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
    locale: 'es_AR'
  }
}

/* Para cuanta gente va bien cada tamaño. Igual que ingesta/tamano_mapas.mjs */
const JUGADORES: Record<Tamano, number> = { chico: 10, mediano: 16, grande: 24 }
const TAMANOS: Tamano[] = ['chico', 'mediano', 'grande']

async function Contenido () {
  const [mapas, porTamano] = await Promise.all([rankingDeMapas(), mapasPorTamano()])
  const totalPartidas = mapas.reduce((suma, m) => suma + m.partidas, 0)

  return (
    <>
      <section className='seccion con-compartir'>
        <h2>Por tamaño</h2>
        <a
          className='boton-whatsapp'
          href={compartirPorWhatsApp('/mapas', `${TITULO} · ${BAJADA}`)}
          target='_blank' rel='noopener noreferrer'
          aria-label='Compartir los mapas por WhatsApp' title='Compartir por WhatsApp'
        >
          <IconoWhatsApp className='icono-boton' />
        </a>
        <div className='tarjetas'>
          {TAMANOS.map((t) => <Tarjeta key={t} etiqueta={`${t}s`} valor={porTamano[t]} />)}
        </div>
        <p className='nota'>
          Los chicos van bien hasta {JUGADORES.chico} jugadores, los medianos hasta{' '}
          {JUGADORES.mediano} y los grandes hasta {JUGADORES.grande}. Cada tamaño va a tener su
          propia votación.
        </p>
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

      <Suspense fallback={<Cargando texto='Contando partidas…' />}>
        <Contenido />
      </Suspense>
    </>
  )
}
