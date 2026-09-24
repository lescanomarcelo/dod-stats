import { Suspense } from 'react'
import { esOrden, ranking, destacados, type Orden } from '@/lib/consultas'
import { rangoDesdeBusqueda, type Periodo } from '@/lib/periodos'
import {
  kd, porcentaje, formatoKd, formatoPorcentaje, formatoNumero, formatoTiempo,
  MIN_KILLS_PORCENTAJES, MIN_SEGUNDOS_CAMPER, camper
} from '@/lib/calculos'
import { EnlaceJugador, Cargando } from '@/components/Ui'
import { ControlPeriodo } from '@/components/Periodo'
import { Desplegable } from '@/components/Desplegable'
import { Destacados } from '@/components/Destacados'

const PESTANAS: { orden: Orden, texto: string }[] = [
  { orden: 'puntos', texto: 'Puntos' },
  { orden: 'kills', texto: 'Kills' },
  { orden: 'kd', texto: 'K/D' },
  { orden: 'hs', texto: 'Headshots %' },
  { orden: 'tiempo', texto: 'Tiempo jugado' },
  { orden: 'camper', texto: 'Camper' }
]

type Busqueda = PageProps<'/'>['searchParams']

/* Enlace al ranking conservando lo que no cambia */
function enlace (p: { orden: Orden, periodo: Periodo, fecha?: string | null }) {
  const q = new URLSearchParams()
  if (p.orden !== 'puntos') q.set('orden', p.orden)
  if (p.periodo !== 'global') q.set('periodo', p.periodo)
  if (p.fecha) q.set('fecha', p.fecha)
  const texto = q.toString()
  return texto ? `/?${texto}` : '/'
}

async function Contenido ({ parametros }: { parametros: Busqueda }) {
  const p = await parametros
  const orden: Orden = esOrden(p.orden) ? p.orden : 'puntos'
  const rango = rangoDesdeBusqueda(p)
  const ventana = { desde: rango.desde, hasta: rango.hasta }

  const [filas, figuras] = await Promise.all([ranking(orden, ventana), destacados(ventana)])

  return (
    <>
      <ControlPeriodo rango={rango} enlace={(periodo, fecha) => enlace({ orden, periodo, fecha })}>
        <Desplegable
          etiqueta='Ordenar por'
          actual={orden}
          opciones={PESTANAS.map((x) => ({
            valor: x.orden,
            etiqueta: x.texto,
            href: enlace({ orden: x.orden, periodo: rango.periodo, fecha: rango.clave })
          }))}
        />
      </ControlPeriodo>

      {/*
        Prueba: la lista completa va plegada arriba de todo, apenas debajo de
        "Ordenar por". Al abrirla las figuritas quedan abajo. Es un <details>, o
        sea que abre y cierra sin JavaScript.
      */}
      <details className='seccion lista-plegable'>
        <summary>
          Ranking completo
          <span className='cuantos numero'>{filas.length}</span>
        </summary>

        <div className='tabla-envoltorio'>
          {filas.length === 0
            ? (
              <p className='vacio'>
                {orden === 'camper'
                  ? 'Todavía no hay tiempo acostado registrado: se guarda desde la versión 0.4 del plugin.'
                  : 'No hay partidas registradas en este período.'}
              </p>
              )
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
                      <td className='num'>{formatoTiempo(j.segundosEnJuego)}</td>
                      {orden === 'camper' && <td className='num'>{formatoTiempo(j.segundosAcostado)}</td>}
                      {orden === 'camper' && <td className='num destacado'>{formatoPorcentaje(camper(j.segundosAcostado, j.segundosEnJuego))}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
        </div>

        {orden === 'camper' && (
          <p className='nota'>Camper = porcentaje del tiempo jugado que pasó acostado. Solo jugadores con al menos {MIN_SEGUNDOS_CAMPER / 60} minutos jugados.</p>
        )}

        <p className='nota'>El tiempo es el que estuvo en un bando, sin contar el rato de espectador ni eligiendo clase. Se registra desde el 22/9/2026.</p>

        {(orden === 'kd' || orden === 'hs') && (
          <p className='nota'>Solo jugadores con al menos {MIN_KILLS_PORCENTAJES} kills, para que el porcentaje sea representativo.</p>
        )}
      </details>

      <section className='seccion'>
        <Destacados datos={figuras} periodo={rango.periodo} fecha={rango.clave} />
      </section>
    </>
  )
}

export default function PaginaRanking (props: PageProps<'/'>) {
  return (
    <>
      <div className='encabezado-pagina'>
        <h1>Ranking</h1>
      </div>

      <Suspense fallback={<Cargando texto='Cargando ranking…' />}>
        <Contenido parametros={props.searchParams} />
      </Suspense>
    </>
  )
}
