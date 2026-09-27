import type { Metadata } from 'next'
import { Suspense } from 'react'
import { actividadDelServer, mapasMasJugados, sesionesDeVentana } from '@/lib/consultas'
import { estadoServidor, SERVIDOR } from '@/lib/estado'
import { formatoNumero, formatoTiempo } from '@/lib/calculos'
import { rangoDesdeBusqueda, type Periodo } from '@/lib/periodos'
import {
  cubos, escalaDe, jugadoresPorCubo, permanenciaPorCubo, permanenciaTotal, pico,
  NOMBRE_ESCALA, bordes, jugadoresUnicos
} from '@/lib/actividad'
import { ControlPeriodo } from '@/components/Periodo'
import { Columnas } from '@/components/Grafico'
import { Barras, Tarjeta, Cargando } from '@/components/Ui'

export const metadata: Metadata = { title: 'El Server' }

type Busqueda = PageProps<'/server'>['searchParams']

function enlace (periodo: Periodo, fecha: string | null) {
  const q = new URLSearchParams()
  if (periodo !== 'global') q.set('periodo', periodo)
  if (fecha) q.set('fecha', fecha)
  const texto = q.toString()
  return texto ? `/server?${texto}` : '/server'
}

/*
 *  La portada: los datos del server como los muestra cualquier buscador de
 *  servidores. El estado sale de la consulta A2S al propio server (cacheada un
 *  minuto), no de la base.
 */
async function Ficha () {
  const e = await estadoServidor()
  const humanos = e.enLinea ? Math.max(0, e.jugadores - e.bots) : 0

  return (
    <div className='panel ficha'>
      <dl>
        <div><dt>Name</dt><dd>{e.enLinea ? e.nombre : SERVIDOR.nombre}</dd></div>
        <div><dt>Game</dt><dd>Day of Defeat 1.3</dd></div>
        <div><dt>Address</dt><dd className='numero'>{SERVIDOR.host}</dd></div>
        <div><dt>Port</dt><dd className='numero'>{SERVIDOR.puerto}</dd></div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`estado-servidor${e.enLinea ? '' : ' fuera'}`}>
              <span className='punto' aria-hidden='true' />
              <strong className={e.enLinea ? 'en-linea' : undefined}>{e.enLinea ? 'Alive' : 'Caído'}</strong>
            </span>
          </dd>
        </div>
        {e.enLinea && (
          <>
            <div><dt>Mapa</dt><dd className='numero'>{e.mapa}</dd></div>
            <div><dt>Jugando</dt><dd className='numero'>{humanos} / {e.maximo}</dd></div>
          </>
        )}
      </dl>
    </div>
  )
}

async function Tablero ({ parametros }: { parametros: Busqueda }) {
  const rango = rangoDesdeBusqueda(await parametros)
  const ventana = { desde: rango.desde, hasta: rango.hasta }

  const [resumen, sesiones, mapas] = await Promise.all([
    actividadDelServer(ventana),
    sesionesDeVentana(ventana),
    mapasMasJugados(ventana)
  ])

  const [desde, hasta] = bordes(ventana, sesiones)
  const escala = escalaDe(rango.periodo)
  const lista = cubos(escala, desde, hasta)
  const cantidades = jugadoresPorCubo(sesiones, lista)
  const permanencia = permanenciaPorCubo(sesiones, lista)
  const total = permanenciaTotal(sesiones)
  const masGente = pico(lista, cantidades)

  return (
    <>
      <ControlPeriodo rango={rango} enlace={enlace} />

      <div className='tarjetas'>
        <Tarjeta etiqueta='Jugadores' valor={formatoNumero(jugadoresUnicos(sesiones))} destacada />
        <Tarjeta etiqueta='Tiempo jugado' valor={formatoTiempo(resumen.segundos)} />
        <Tarjeta etiqueta='Partidas' valor={formatoNumero(resumen.partidas)} />
        <Tarjeta etiqueta='Mapas' valor={formatoNumero(resumen.mapas)} />
        <Tarjeta etiqueta='Permanencia' valor={formatoTiempo(total.promedio)} />
        <Tarjeta etiqueta={masGente ? `Pico · ${masGente.etiqueta}` : 'Pico'} valor={masGente ? formatoNumero(masGente.jugadores) : '—'} />
      </div>

      <section className='seccion'>
        <div className='panel'>
          <h2>Jugadores por {NOMBRE_ESCALA[escala]}</h2>
          <Columnas
            columnas={lista.map((c, i) => ({ clave: c.clave, etiqueta: c.etiqueta, valor: cantidades[i] }))}
            formato={(v) => `${v} jugador${v === 1 ? '' : 'es'}`}
            vacio='Nadie se conectó en este período.'
          />
          <p className='nota'>Cuenta a cada jugador en cada {NOMBRE_ESCALA[escala]} que estuvo conectado. Sale de las conexiones registradas, así que a alguien que todavía está en el server se lo cuenta cuando se va.</p>
        </div>
      </section>

      <section className='seccion'>
        <div className='panel'>
          <h2>Cuánto se quedan</h2>
          <Columnas
            columnas={lista.map((c, i) => ({
              clave: c.clave,
              etiqueta: c.etiqueta,
              valor: permanencia[i].promedio,
              fondo: permanencia[i].maximo
            }))}
            formato={formatoTiempo}
            leyenda={{ valor: 'Promedio', fondo: 'Máximo' }}
            vacio='Todavía no hay conexiones completas en este período.'
          />
          <p className='nota'>De las conexiones que empezaron en cada {NOMBRE_ESCALA[escala]}. El máximo de todo el período fue {formatoTiempo(total.maximo)}.</p>
        </div>
      </section>

      <section className='seccion'>
        <div className='panel'>
          <h2>Mapas más jugados</h2>
          <Barras filas={mapas.map((m) => ({
            clave: m.mapa,
            nombre: m.mapa,
            valor: m.partidas,
            texto: formatoNumero(m.partidas)
          }))}
          />
        </div>
      </section>
    </>
  )
}

export default function PaginaServer (props: PageProps<'/server'>) {
  return (
    <>
      <div className='encabezado-pagina'>
        <h1>El Server</h1>
        <p>Cómo viene la actividad del server: cuánta gente hay, cuánto se queda y qué se juega.</p>
      </div>

      <Suspense fallback={<Cargando />}>
        <Ficha />
      </Suspense>

      <Suspense fallback={<Cargando texto='Cargando actividad…' />}>
        <Tablero parametros={props.searchParams} />
      </Suspense>
    </>
  )
}
