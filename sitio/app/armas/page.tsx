import type { Metadata } from 'next'
import { Suspense } from 'react'
import { armas } from '@/lib/consultas'
import { porcentaje, formatoPorcentaje, formatoNumero, nombreArma } from '@/lib/calculos'
import { Barras, Cargando } from '@/components/Ui'

export const metadata: Metadata = { title: 'Armas' }

async function TablaArmas () {
  const filas = await armas()
  const total = filas.reduce((s, a) => s + a.kills, 0)

  if (filas.length === 0) {
    return <p className='vacio'>Todavía no hay muertes registradas.</p>
  }

  return (
    <>
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

export default function PaginaArmas () {
  return (
    <>
      <div className='encabezado-pagina'>
        <h1>Armas</h1>
        <p>Qué se usa en el server y qué tan efectivo es. Sin contar teamkills.</p>
      </div>
      <Suspense fallback={<Cargando />}>
        <TablaArmas />
      </Suspense>
    </>
  )
}
