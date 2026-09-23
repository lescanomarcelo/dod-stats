import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Geist, Geist_Mono, Oswald } from 'next/font/google'
import { resumenGeneral } from '@/lib/consultas'
import { Hace } from '@/components/Hace'
import { BanderaArgentina } from '@/components/Banderas'
import { CopiarIp } from '@/components/CopiarIp'
import { Menu } from '@/components/Menu'
import { estadoServidor, jugadoresEnLinea, SERVIDOR } from '@/lib/estado'
import { JugadoresEnLinea } from '@/components/JugadoresEnLinea'
import { IconoWhatsApp, IconoDiscord, IconoCafecito } from '@/components/Iconos'
import { GRUPOS, enlaceCafecito } from '@/lib/links'
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

/* Las secciones del sitio, listadas abajo de todo ademas de en el menu */
const SECCIONES = [
  { href: '/', texto: 'Ranking' },
  { href: '/equipos', texto: 'Eje vs Aliados' },
  { href: '/armas', texto: 'Armas' },
  { href: '/comparar', texto: 'Comparar' },
  { href: '/links', texto: 'Links' }
] as const

/* Los links de la comunidad salen de lib/links.ts: se cargan en un solo lugar */
const deComunidad = (nombre: string) =>
  GRUPOS.flatMap((g) => g.enlaces).find((e) => e.nombre === nombre)?.url ?? '#'
const WHATSAPP = deComunidad('Grupo de WhatsApp')
const DISCORD = deComunidad('Discord')

/* Jugadores y mapa en este momento (cacheado un minuto: ver lib/estado.ts) */
async function EstadoServidor () {
  const e = await estadoServidor()
  if (!e.enLinea) {
    return <span className='estado-servidor fuera'><span className='punto' aria-hidden='true' /><strong>Server caído</strong></span>
  }
  const humanos = Math.max(0, e.jugadores - e.bots)
  /* La lista solo se pide si hay alguien: con el server vacio no tiene sentido */
  const jugadores = humanos > 0 ? await jugadoresEnLinea() : []
  return (
    <span className='estado-servidor'>
      <span className='punto' aria-hidden='true' />
      <strong className='en-linea'>En línea</strong>
      <span className='separador'>·</span>
      <JugadoresEnLinea jugadores={jugadores} humanos={humanos} maximo={e.maximo} mapa={e.mapa} />
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
            <div className='pie-columnas'>
              <nav className='pie-columna' aria-label='Secciones'>
                <h2>Secciones</h2>
                {SECCIONES.map((s) => <Link key={s.href} href={s.href}>{s.texto}</Link>)}
              </nav>

              <div className='pie-columna'>
                <h2>Sumate a la comunidad</h2>
                <a href={WHATSAPP} target='_blank' rel='noopener noreferrer' className='con-icono'>
                  <IconoWhatsApp className='icono' />Grupo de WhatsApp
                </a>
                <a href={DISCORD} target='_blank' rel='noopener noreferrer' className='con-icono'>
                  <IconoDiscord className='icono' />Discord
                </a>
                <span className='pie-nota'>Avisale a alguien del server que pediste entrar al grupo.</span>
              </div>

              <div className='pie-columna'>
                <h2>El server</h2>
                <span className='numero'>{DIRECCION}</span>
                <span>DoD 1.3 :::aU::: Tributo</span>
                <a href={`https://www.gametracker.com/server_info/${DIRECCION}/`} target='_blank' rel='noopener noreferrer'>
                  GameTracker
                </a>
                {enlaceCafecito && (
                  <a href={enlaceCafecito} target='_blank' rel='noopener noreferrer' className='con-icono'>
                    <IconoCafecito className='icono' />Invitame un cafecito
                  </a>
                )}
              </div>
            </div>

            <div className='pie-abajo'>
              <span>Hecho por <strong className='firma'>Trevor</strong></span>
              <Suspense fallback={<span>&nbsp;</span>}>
                <UltimaActualizacion />
              </Suspense>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
