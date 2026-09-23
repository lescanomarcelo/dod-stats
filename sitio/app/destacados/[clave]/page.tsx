import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { esClaveDestacado, topDestacado } from '@/lib/consultas'
import { categoriaDeDestacado } from '@/lib/destacados'
import { rangoDesdeBusqueda } from '@/lib/periodos'
import { enlaceDeDestacado } from '@/lib/enlaces'
import { EnlaceJugador, Cargando } from '@/components/Ui'
import { ControlPeriodo } from '@/components/Periodo'

/*
 *  Detalle de una categoria destacada del ranking: la misma imagen de la tarjeta,
 *  repetida arriba, y debajo el top 10 completo. Cada jugador del top lleva a su
 *  propio perfil; el resto de la pagina se queda aca.
 */

const CANTIDAD_TOP = 10

export async function generateMetadata (props: PageProps<'/destacados/[clave]'>): Promise<Metadata> {
  const clave = (await props.params).clave
  if (!esClaveDestacado(clave)) return { title: 'Destacado' }
  return { title: categoriaDeDestacado(clave).titulo }
}

async function Contenido ({ parametros, busqueda }: {
  parametros: PageProps<'/destacados/[clave]'>['params']
  busqueda: PageProps<'/destacados/[clave]'>['searchParams']
}) {
  const clave = (await parametros).clave
  if (!esClaveDestacado(clave)) notFound()

  const categoria = categoriaDeDestacado(clave)
  const rango = rangoDesdeBusqueda(await busqueda)
  const ventana = { desde: rango.desde, hasta: rango.hasta }
  const top = await topDestacado(clave, ventana, CANTIDAD_TOP)

  return (
    <>
      <ControlPeriodo rango={rango} enlace={(periodo, fecha) => enlaceDeDestacado(clave, periodo, fecha)} />

      <div className='destacado-retrato'>
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen fija ya optimizada a webp */}
        <img src={categoria.imagen} alt='' width={700} height={700} />
        <div className='destacado-retrato-texto'>
          <h2>{categoria.titulo}</h2>
          <p>{categoria.subtitulo}</p>
        </div>
      </div>

      <section className='seccion tabla-envoltorio'>
        {top.length === 0
          ? <p className='vacio'>{categoria.vacio}</p>
          : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th className='num'>{categoria.subtitulo}</th>
                </tr>
              </thead>
              <tbody>
                {top.map((j, i) => (
                  <tr key={j.id}>
                    <td className='posicion numero'>{i + 1}</td>
                    <td><EnlaceJugador id={j.id} nick={j.nick} /></td>
                    <td className='num destacado'>{categoria.valor(j.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
      </section>
      <p className='nota'>Top {CANTIDAD_TOP} de este período.{clave === 'headshots' && ' Solo jugadores con kills suficientes.'}</p>
    </>
  )
}

/* El titulo sale de la URL, que es dato de la visita: va dentro del Suspense */
async function Titulo ({ parametros }: { parametros: PageProps<'/destacados/[clave]'>['params'] }) {
  const clave = (await parametros).clave
  return <h1>{esClaveDestacado(clave) ? categoriaDeDestacado(clave).titulo : 'Destacado'}</h1>
}

export default function PaginaDestacado (props: PageProps<'/destacados/[clave]'>) {
  return (
    <>
      <div className='encabezado-pagina'>
        <Link href='/' className='volver'>‹ Ranking</Link>
        <Suspense fallback={<h1>Destacado</h1>}>
          <Titulo parametros={props.params} />
        </Suspense>
      </div>

      <Suspense fallback={<Cargando />}>
        <Contenido parametros={props.params} busqueda={props.searchParams} />
      </Suspense>
    </>
  )
}
