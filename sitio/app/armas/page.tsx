import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { armas, rankingDeArma } from '@/lib/consultas'
import { porcentaje, formatoPorcentaje, formatoNumero } from '@/lib/calculos'
import { CATALOGO, armaDe, nombreDeArma, esCuerpoACuerpo, NOMBRE_BANDO, type Arma } from '@/lib/armas'
import { Barras, EnlaceJugador, Cargando } from '@/components/Ui'
import { enlaceDeArma } from '@/lib/enlaces'
import { ImagenArma } from '@/components/ImagenArma'
import { ControlPeriodo } from '@/components/Periodo'
import { rangoDesdeBusqueda, type Periodo } from '@/lib/periodos'

type Busqueda = PageProps<'/armas'>['searchParams']

function enlace (periodo: Periodo, fecha: string | null) {
  const q = new URLSearchParams()
  if (periodo !== 'global') q.set('periodo', periodo)
  if (fecha) q.set('fecha', fecha)
  const texto = q.toString()
  return texto ? `/armas?${texto}` : '/armas'
}

export const metadata: Metadata = { title: 'Armas' }

type Fila = { arma: string, nombre: string, bando: string, kills: number, headshots: number, jugadores: number }

/*
 *  La lista tiene TODAS las armas del juego, no solo las que mataron a alguien:
 *  la bazooka o el Panzerschreck aparecen igual, en cero. Las variantes de la misma
 *  arma que la base guarda por separado (el culatazo del Garand, la bayoneta) se
 *  suman a su arma, asi la lista es la del juego y no la de los nombres internos.
 */
function armadoDeFilas (crudas: Awaited<ReturnType<typeof armas>>): Fila[] {
  const porNombre = new Map<string, Fila>()

  const asegurar = (arma: Arma | undefined, nombreCrudo: string): Fila => {
    const nombre = arma?.nombre ?? nombreCrudo
    if (!porNombre.has(nombre)) {
      porNombre.set(nombre, {
        arma: arma?.alias[0] ?? nombreCrudo,
        nombre,
        bando: NOMBRE_BANDO[arma?.bando ?? 'ambos'],
        kills: 0,
        headshots: 0,
        jugadores: 0
      })
    }
    return porNombre.get(nombre)!
  }

  /* Primero el catalogo, para que esten todas aunque no hayan matado a nadie */
  for (const arma of CATALOGO) {
    if (arma.nombre === 'Caída / mapa') continue          /* no es un arma */
    asegurar(arma, arma.nombre)
  }

  for (const cruda of crudas) {
    const arma = armaDe(cruda.arma)
    if (arma?.nombre === 'Caída / mapa') continue
    const fila = asegurar(arma, cruda.arma)
    fila.kills += cruda.kills
    fila.headshots += cruda.headshots
    /* Los jugadores de dos variantes se pisan; queda el mayor, que es lo mas cercano */
    fila.jugadores = Math.max(fila.jugadores, cruda.jugadores)
    /* Para el enlace vale el nombre real de la base: es el que tiene las muertes */
    if (cruda.kills > 0) fila.arma = cruda.arma
  }

  return [...porNombre.values()].sort((a, b) => b.kills - a.kills || a.nombre.localeCompare(b.nombre))
}

/*
 *  Cuerpo a cuerpo: pala, cuchillo, bayoneta y culatazo, todo junto. Lleva el
 *  dibujo del despeinado, que es el icono que el juego muestra cuando te matan
 *  de un culatazo.
 */
function CuerpoACuerpo ({ kills, mejores }: { kills: number, mejores: { id: number, nick: string, kills: number }[] }) {
  return (
    <section className='seccion'>
      <div className='panel'>
        <div className='melee-cabecera'>
          {/* eslint-disable-next-line @next/next/no-img-element -- icono del juego ya optimizado */}
          <img src='/armas/golpes/garandbutt.webp' alt='' width={120} height={60} className='melee-dibujo' />
          <div>
            <h2>Cuerpo a cuerpo</h2>
            <p className='nota'>Pala, cuchillo, bayoneta y culatazo, todo junto: {formatoNumero(kills)} kills.</p>
          </div>
        </div>
        {mejores.length === 0
          ? <p className='vacio'>Nadie mató de cerca en este período.</p>
          : (
            <ul className='lista'>
              {mejores.map((j) => (
                <li key={j.id}>
                  <EnlaceJugador id={j.id} nick={j.nick} />
                  <span className='cifra numero'>{formatoNumero(j.kills)}</span>
                </li>
              ))}
            </ul>
            )}
      </div>
    </section>
  )
}

async function TablaArmas ({ parametros }: { parametros: Busqueda }) {
  const rango = rangoDesdeBusqueda(await parametros)
  const ventana = { desde: rango.desde, hasta: rango.hasta }
  const crudas = await armas(ventana)
  const filas = armadoDeFilas(crudas)
  const total = filas.reduce((s, a) => s + a.kills, 0)
  const conKills = filas.filter((a) => a.kills > 0)

  /* Los nombres que usa la base para las armas de cerca, para sumarlas todas */
  const nombresMelee = crudas.map((a) => a.arma).filter(esCuerpoACuerpo)
  const killsMelee = crudas.filter((a) => esCuerpoACuerpo(a.arma)).reduce((s, a) => s + a.kills, 0)
  const mejoresMelee = await rankingDeArma(nombresMelee, ventana, 5)

  return (
    <>
      <ControlPeriodo rango={rango} enlace={enlace} />

      {conKills.length === 0
        ? <p className='vacio'>No hay muertes registradas en este período.</p>
        : (
          <section className='seccion'>
            <div className='panel'>
              <h2>Las más letales</h2>
              <Barras filas={conKills.slice(0, 10).map((a) => ({
                clave: a.nombre,
                nombre: a.nombre,
                valor: a.kills,
                texto: formatoPorcentaje(porcentaje(a.kills, total))
              }))}
              />
            </div>
          </section>
          )}

      <CuerpoACuerpo kills={killsMelee} mejores={mejoresMelee} />

      <section className='seccion tabla-envoltorio'>
        <table>
          <thead>
            <tr>
              <th>Arma</th>
              <th>Bando</th>
              <th className='num'>Kills</th>
              <th className='num'>% del total</th>
              <th className='num'>Headshots %</th>
              <th className='num'>Jugadores</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((a) => (
              <tr key={a.nombre} className={a.kills === 0 ? 'sin-uso' : ''}>
                <td>
                  <Link href={enlaceDeArma(a.arma, rango.periodo, rango.clave)} className='jugador con-dibujo'>
                    <ImagenArma arma={a.arma} />
                    {nombreDeArma(a.arma)}
                  </Link>
                </td>
                <td>{a.bando}</td>
                <td className='num'>{formatoNumero(a.kills)}</td>
                <td className='num'>{a.kills > 0 ? formatoPorcentaje(porcentaje(a.kills, total)) : '—'}</td>
                <td className='num'>{a.kills > 0 ? formatoPorcentaje(porcentaje(a.headshots, a.kills)) : '—'}</td>
                <td className='num'>{a.jugadores || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className='nota'>Están todas las armas del juego: las que figuran en cero todavía no mataron a nadie en este período.</p>
    </>
  )
}

export default function PaginaArmas (props: PageProps<'/armas'>) {
  return (
    <>
      <div className='encabezado-pagina'>
        <h1>Armas</h1>
      </div>
      <Suspense fallback={<Cargando />}>
        <TablaArmas parametros={props.searchParams} />
      </Suspense>
    </>
  )
}
