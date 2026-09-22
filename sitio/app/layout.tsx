import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Geist, Geist_Mono, Oswald } from 'next/font/google'
import { resumenGeneral } from '@/lib/consultas'
import { Hace } from '@/components/Hace'
import { BanderaArgentina } from '@/components/Banderas'
import { CopiarIp } from '@/components/CopiarIp'
import { Menu } from '@/components/Menu'
import { estadoServidor, SERVIDOR } from '@/lib/estado'
import './globals.css'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const oswald = Oswald({ variable: '--font-oswald', subsets: ['latin'], weight: ['500', '600', '700'] })

export const metadata: Metadata = {
  title: {
    default: 'Tributo Server — Estadísticas',
    template: '%s · Tributo Server'
  },
  description: 'Ranking y estadísticas de los jugadores del server DoD 1.3 :::aU::: Tributo.',
  /* Instalada en iPhone: pantalla completa y nombre corto bajo el icono */
  appleWebApp: { capable: true, title: 'Tributo Stats', statusBarStyle: 'black-translucent' }
}

export const viewport: Viewport = { themeColor: '#13150f' }

async function UltimaActualizacion () {
  const { actualizado } = await resumenGeneral()
  if (!actualizado) return <span>Todavía sin datos</span>
  return <span>Actualizado <Hace fecha={actualizado} /></span>
}

const DIRECCION = `${SERVIDOR.host}:${SERVIDOR.puerto}`

/* Jugadores y mapa en este momento (cacheado un minuto: ver lib/estado.ts) */
async function EstadoServidor () {
  const e = await estadoServidor()
  if (!e.enLinea) {
    return <span className='estado-servidor fuera'><span className='punto' aria-hidden='true' /><strong>Server caído</strong></span>
  }
  const humanos = Math.max(0, e.jugadores - e.bots)
  return (
    <span className='estado-servidor'>
      <span className='punto' aria-hidden='true' />
      <strong className='en-linea'>En línea</strong>
      <span className='separador'>·</span>
      <strong className='numero'>{humanos}/{e.maximo}</strong> jugando
      <span className='separador'>·</span>
      <span className='numero'>{e.mapa}</span>
    </span>
  )
}

export default function RootLayout ({ children }: LayoutProps<'/'>) {
  return (
    <html lang='es' className={`${geist.variable} ${geistMono.variable} ${oswald.variable}`}>
      <body>
        <header className='cabecera'>
          <div className='contenedor'>
            <div className='marca-bloque'>
              <div className='marca-fila'>
                <Link href='/' className='marca'>
                  <span className='banderas' aria-hidden='true'>
                    <BanderaArgentina className='bandera' />
                    {/* eslint-disable-next-line @next/next/no-img-element -- icono de 64 px, no hace falta optimizarlo */}
                    <img src='/dod.png' alt='' width={64} height={64} className='logo-dod' />
                  </span>
                  <span className='titular'>Tributo</span>
                  <small>DoD 1.3 · Estadísticas</small>
                </Link>
              </div>
              <Suspense fallback={<span className='estado-servidor cargando'><span className='punto' aria-hidden='true' />Consultando el server…</span>}>
                <EstadoServidor />
              </Suspense>
              <CopiarIp direccion={DIRECCION} />
            </div>
            <Suspense fallback={<div className='menu-boton' aria-hidden='true' />}>
              <Menu />
            </Suspense>
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
