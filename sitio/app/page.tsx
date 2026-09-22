import Link from 'next/link'
import { Suspense } from 'react'
import { esOrden, ranking, resumenGeneral, type Orden } from '@/lib/consultas'
import {
  kd, porcentaje, formatoKd, formatoPorcentaje, formatoNumero, formatoTiempo,
  MIN_KILLS_PORCENTAJES, MIN_SEGUNDOS_CAMPER, camper
} from '@/lib/calculos'
import { Tarjeta, EnlaceJugador, Cargando } from '@/components/Ui'

const PESTANAS: { orden: Orden, texto: string }[] = [
  { orden: 'puntos', texto: 'Puntos' },
  { orden: 'kills', texto: 'Kills' },
  { orden: 'kd', texto: 'K/D' },
  { orden: 'hs', texto: 'Headshots %' },
  { orden: 'tiempo', texto: 'Tiempo jugado' },
  { orden: 'camper', texto: 'Camper' }
]

async function Resumen () {
  const r = await resumenGeneral()
  return (
    <div className='tarjetas'>
      <Tarjeta etiqueta='Jugadores' valor={formatoNumero(r.jugadores)} />
      <Tarjeta etiqueta='Muertes registradas' valor={formatoNumero(r.muertes)} destacada />
      <Tarjeta etiqueta='Headshots' valor={formatoPorcentaje(porcentaje(r.headshots, r.kills))} />
      <Tarjeta etiqueta='Mapas jugados' valor={formatoNumero(r.mapas)} />
    </div>
  )
}

async function TablaRanking ({ parametros }: { parametros: PageProps<'/'>['searchParams'] }) {
  const { orden: crudo } = await parametros
  const orden: Orden = esOrden(crudo) ? crudo : 'puntos'
  const filas = await ranking(orden)

  return (
    <>
      <nav className='pestanas' aria-label='Ordenar ranking'>
        {PESTANAS.map((p) => (
          <Link
            key={p.orden}
            href={p.orden === 'puntos' ? '/' : `/?orden=${p.orden}`}
            className={p.orden === orden ? 'activa' : ''}
            aria-current={p.orden === orden ? 'page' : undefined}
          >
            {p.texto}
          </Link>
        ))}
      </nav>

      <div className='tabla-envoltorio'>
        {filas.length === 0
          ? <p className='vacio'>Todavía no hay muertes registradas. Aparecen en cuanto se juegue.</p>
          : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th className='num'>Puntos</th>
                  <th className='num'>Kills</th>
                  <th className='num'>Muertes</th>
                  <th className='num'>K/D</th>
                  <th className='num'>HS %</th>
                  <th className='num'>TK</th>
                  <th className='num'>Tiempo</th>
                  {orden === 'camper' && <th className='num'>Acostado</th>}
                  {orden === 'camper' && <th className='num'>Camper</th>}
                </tr>
              </thead>
              <tbody>
                {filas.map((j, i) => (
                  <tr key={j.id}>
                    <td className='posicion numero'>{i + 1}</td>
                    <td><EnlaceJugador id={j.id} nick={j.nick} /></td>
                    <td className='num destacado'>{formatoNumero(j.puntos)}</td>
                    <td className='num'>{formatoNumero(j.kills)}</td>
                    <td className='num'>{formatoNumero(j.muertes)}</td>
                    <td className='num'>{formatoKd(kd(j.kills, j.muertes))}</td>
                    <td className='num'>{formatoPorcentaje(porcentaje(j.headshots, j.kills))}</td>
                    <td className='num'>{j.teamkills}</td>
                    <td className='num'>{formatoTiempo(j.segundos)}</td>
                    {orden === 'camper' && <td className='num'>{formatoTiempo(j.segundosAcostado)}</td>}
                    {orden === 'camper' && <td className='num destacado'>{formatoPorcentaje(camper(j.segundosAcostado, j.segundos))}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            )}
      </div>

      {orden === 'camper' && (
        <p className='nota'>Camper = porcentaje del tiempo jugado que pasó acostado. Solo jugadores con al menos {MIN_SEGUNDOS_CAMPER / 60} minutos jugados.</p>
      )}

      {(orden === 'kd' || orden === 'hs') && (
        <p className='nota'>Solo jugadores con al menos {MIN_KILLS_PORCENTAJES} kills, para que el porcentaje sea representativo.</p>
      )}
    </>
  )
}

export default function PaginaRanking (props: PageProps<'/'>) {
  return (
    <>
      <div className='encabezado-pagina'>
        <h1>Ranking</h1>
        <p>Los puntos se ganan tomando banderas y objetivos. Los teamkills no suman como kill. Los suicidios cuentan como muerte. Las partidas contra bots no se registran.</p>
      </div>

      <Suspense fallback={<Cargando />}>
        <Resumen />
      </Suspense>

      <section className='seccion'>
        <Suspense fallback={<Cargando texto='Cargando ranking…' />}>
          <TablaRanking parametros={props.searchParams} />
        </Suspense>
      </section>
    </>
  )
}
