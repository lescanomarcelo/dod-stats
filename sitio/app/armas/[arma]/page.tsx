import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { armas, rankingDeArma, resumenDeArma } from '@/lib/consultas'
import { rangoDesdeBusqueda, type Periodo } from '@/lib/periodos'
import { porcentaje, formatoPorcentaje, formatoNumero, nombreArma } from '@/lib/calculos'
import { Tarjeta, EnlaceJugador, Cargando } from '@/components/Ui'
import { ControlPeriodo } from '@/components/Periodo'

/* El codigo del arma viene de la URL: solo letras, numeros y guion bajo */
function leerArma (crudo: string): string | null {
  const arma = decodeURIComponent(crudo).toLowerCase()
  return /^[a-z0-9_]{1,32}$/.test(arma) ? arma : null
}

export async function generateMetadata (props: PageProps<'/armas/[arma]'>): Promise<Metadata> {
  const arma = leerArma((await props.params).arma)
  return { title: arma ? nombreArma(arma) : 'Arma' }
}

function enlace (arma: string, periodo: Periodo, fecha: string | null) {
  const q = new URLSearchParams()
  if (periodo !== 'global') q.set('periodo', periodo)
  if (fecha) q.set('fecha', fecha)
  const texto = q.toString()
  return texto ? `/armas/${arma}?${texto}` : `/armas/${arma}`
}

async function Contenido ({ parametros, busqueda }: {
  parametros: PageProps<'/armas/[arma]'>['params']
  busqueda: PageProps<'/armas/[arma]'>['searchParams']
}) {
  const arma = leerArma((await parametros).arma)
  if (!arma) notFound()

  /* Que el arma exista de verdad: si nadie mató nunca con ella, es 404 */
  const todas = await armas()
  if (!todas.some((a) => a.arma === arma)) notFound()

  const rango = rangoDesdeBusqueda(await busqueda)
  const ventana = { desde: rango.desde, hasta: rango.hasta }
  const [mejores, resumen] = await Promise.all([rankingDeArma(arma, ventana), resumenDeArma(arma, ventana)])

  return (
    <>
      <ControlPeriodo rango={rango} enlace={(periodo, fecha) => enlace(arma, periodo, fecha)} />

      <div className='tarjetas'>
        <Tarjeta etiqueta='Kills' valor={formatoNumero(resumen.kills)} destacada />
        <Tarjeta etiqueta='Headshots' valor={formatoPorcentaje(porcentaje(resumen.headshots, resumen.kills))} />
        <Tarjeta etiqueta='La usaron' valor={`${formatoNumero(resumen.jugadores)} jugadores`} />
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
  const arma = leerArma((await parametros).arma)
  return <h1>{arma ? nombreArma(arma) : 'Arma'}</h1>
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
