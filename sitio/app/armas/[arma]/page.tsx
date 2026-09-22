import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { armas, rankingDeArma, resumenDeArma } from '@/lib/consultas'
import { rangoDesdeBusqueda } from '@/lib/periodos'
import { enlaceDeArma } from '@/lib/enlaces'
import { porcentaje, formatoPorcentaje, formatoNumero } from '@/lib/calculos'
import { armaDe, nombreDeArma, NOMBRE_BANDO } from '@/lib/armas'
import { Tarjeta, EnlaceJugador, Cargando } from '@/components/Ui'
import { ControlPeriodo } from '@/components/Periodo'
import { ImagenArma } from '@/components/ImagenArma'

/*
 *  El arma viene de la URL. El juego las nombra con mayusculas y espacios
 *  ("BAR", "scoped K98"), asi que no se puede validar con un patron: lo unico
 *  que vale es que exista en la base, y eso se chequea contra la lista.
 */
function leerArma (crudo: string): string {
  return decodeURIComponent(crudo).slice(0, 32)
}

export async function generateMetadata (props: PageProps<'/armas/[arma]'>): Promise<Metadata> {
  const arma = leerArma((await props.params).arma)
  return { title: nombreDeArma(arma) }
}

async function Contenido ({ parametros, busqueda }: {
  parametros: PageProps<'/armas/[arma]'>['params']
  busqueda: PageProps<'/armas/[arma]'>['searchParams']
}) {
  const pedida = leerArma((await parametros).arma)
  const delCatalogo = armaDe(pedida)

  /*
   *  Vale cualquier arma del catalogo (aunque nadie haya matado con ella) y
   *  cualquiera que aparezca en la base. Lo que no es ninguna de las dos, es 404.
   */
  const todas = await armas()
  const enLaBase = todas
    .map((a) => a.arma)
    .filter((nombre) => delCatalogo
      ? armaDe(nombre)?.nombre === delCatalogo.nombre
      : nombre.toLowerCase() === pedida.toLowerCase())
  if (!delCatalogo && enLaBase.length === 0) notFound()

  const arma = delCatalogo?.alias[0] ?? enLaBase[0]
  const rango = rangoDesdeBusqueda(await busqueda)
  const ventana = { desde: rango.desde, hasta: rango.hasta }
  const [mejores, resumen] = await Promise.all([
    rankingDeArma(enLaBase, ventana),
    resumenDeArma(enLaBase, ventana)
  ])

  return (
    <>
      <ControlPeriodo rango={rango} enlace={(periodo, fecha) => enlaceDeArma(arma, periodo, fecha)} />

      <div className='arma-retrato'>
        <ImagenArma arma={arma} grande />
      </div>

      <div className='tarjetas'>
        <Tarjeta etiqueta='Kills' valor={formatoNumero(resumen.kills)} destacada />
        <Tarjeta etiqueta='Headshots' valor={formatoPorcentaje(porcentaje(resumen.headshots, resumen.kills))} />
        <Tarjeta etiqueta='La usaron' valor={`${formatoNumero(resumen.jugadores)} jugadores`} />
        {delCatalogo && <Tarjeta etiqueta='Bando' valor={NOMBRE_BANDO[delCatalogo.bando]} />}
      </div>

      <section className='seccion'>
        <h2>Los mejores con esta arma</h2>
        <div className='tabla-envoltorio'>
          {mejores.length === 0
            ? <p className='vacio'>Nadie mató con esta arma en este período.</p>
            : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Jugador</th>
                    <th className='num'>Kills</th>
                    <th className='num'>Headshots</th>
                    <th className='num'>HS %</th>
                  </tr>
                </thead>
                <tbody>
                  {mejores.map((j, i) => (
                    <tr key={j.id}>
                      <td className='posicion numero'>{i + 1}</td>
                      <td><EnlaceJugador id={j.id} nick={j.nick} /></td>
                      <td className='num destacado'>{formatoNumero(j.kills)}</td>
                      <td className='num'>{formatoNumero(j.headshots)}</td>
                      <td className='num'>{formatoPorcentaje(porcentaje(j.headshots, j.kills))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
        </div>
        <p className='nota'>Top 10 por kills con el arma. Sin contar teamkills.</p>
      </section>
    </>
  )
}

/* El nombre del arma sale de la URL, que es dato de la visita: va dentro del Suspense */
async function Titulo ({ parametros }: { parametros: PageProps<'/armas/[arma]'>['params'] }) {
  return <h1>{nombreDeArma(leerArma((await parametros).arma))}</h1>
}

export default function PaginaArma (props: PageProps<'/armas/[arma]'>) {
  return (
    <>
      <div className='encabezado-pagina'>
        <Link href='/armas' className='volver'>‹ Armas</Link>
        <Suspense fallback={<h1>Arma</h1>}>
          <Titulo parametros={props.params} />
        </Suspense>
      </div>

      <Suspense fallback={<Cargando />}>
        <Contenido parametros={props.params} busqueda={props.searchParams} />
      </Suspense>
    </>
  )
}
