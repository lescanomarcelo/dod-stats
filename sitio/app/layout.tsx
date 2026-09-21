import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Geist, Geist_Mono, Oswald } from 'next/font/google'
import { resumenGeneral } from '@/lib/consultas'
import { Hace } from '@/components/Hace'
import './globals.css'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const oswald = Oswald({ variable: '--font-oswald', subsets: ['latin'], weight: ['500', '600', '700'] })

export const metadata: Metadata = {
  title: {
    default: 'Tributo Server — Estadísticas',
    template: '%s · Tributo Server'
  },
  description: 'Ranking y estadísticas de los jugadores del server DoD 1.3 :::aU::: Tributo.'
}

async function UltimaActualizacion () {
  const { actualizado } = await resumenGeneral()
  if (!actualizado) return <span>Todavía sin datos</span>
  return <span>Actualizado <Hace fecha={actualizado} /></span>
}

export default function RootLayout ({ children }: LayoutProps<'/'>) {
  return (
    <html lang='es' className={`${geist.variable} ${geistMono.variable} ${oswald.variable}`}>
      <body>
        <header className='cabecera'>
          <div className='contenedor'>
            <Link href='/' className='marca'>
              <span className='titular'>Tributo</span>
              <small>DoD 1.3 · Estadísticas</small>
            </Link>
            <nav className='nav'>
              <Link href='/'>Ranking</Link>
              <Link href='/armas'>Armas</Link>
              <Link href='/comparar'>Comparar</Link>
            </nav>
          </div>
        </header>

        <main>
          <div className='contenedor'>{children}</div>
        </main>

        <footer className='pie'>
          <div className='contenedor'>
            <span>DoD 1.3 :::aU::: Tributo Server · 45.235.98.67:27017</span>
            <Suspense fallback={<span>&nbsp;</span>}>
              <UltimaActualizacion />
            </Suspense>
          </div>
        </footer>
      </body>
    </html>
  )
}
