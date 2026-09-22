import type { Metadata } from 'next'
import { Suspense } from 'react'
import { armas } from '@/lib/consultas'
import { porcentaje, formatoPorcentaje, formatoNumero, nombreArma } from '@/lib/calculos'
import { Barras, Cargando } from '@/components/Ui'
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

async function TablaArmas ({ parametros }: { parametros: Busqueda }) {
  const rango = rangoDesdeBusqueda(await parametros)
  const filas = await armas({ desde: rango.desde, hasta: rango.hasta })
  const total = filas.reduce((s, a) => s + a.kills, 0)

  const control = <ControlPeriodo rango={rango} enlace={enlace} />

  if (filas.length === 0) {
    return <>{control}<p className='vacio'>No hay muertes registradas en este período.</p></>
  }

  return (
    <>
      {control}
      <section className='seccion'>
      <div className='panel'>
        <h2>Las más letales</h2>
        <Barras filas={filas.slice(0, 10).map((a) => ({
          clave: a.arma,
          nombre: nombreArma(a.arma),
          valor: a.kills,
          texto: formatoPorcentaje(porcentaje(a.kills, total))
        }))}
        />
      </div>
      </section>

      <section className='seccion tabla-envoltorio'>
        <table>
          <thead>
            <tr>
              <th>Arma</th>
              <th className='num'>Kills</th>
              <th className='num'>% del total</th>
              <th className='num'>Headshots %</th>
              <th className='num'>Jugadores</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((a) => (
              <tr key={a.arma}>
                <td>{nombreArma(a.arma)}</td>
                <td className='num'>{formatoNumero(a.kills)}</td>
                <td className='num'>{formatoPorcentaje(porcentaje(a.kills, total))}</td>
                <td className='num'>{formatoPorcentaje(porcentaje(a.headshots, a.kills))}</td>
                <td className='num'>{a.jugadores}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

export default function PaginaArmas (props: PageProps<'/armas'>) {
  return (
    <>
      <div className='encabezado-pagina'>
        <h1>Armas</h1>
        <p>Qué se usa en el server y qué tan efectivo es. Sin contar teamkills.</p>
      </div>
      <Suspense fallback={<Cargando />}>
        <TablaArmas parametros={props.searchParams} />
      </Suspense>
    </>
  )
}
