import type { Metadata } from 'next'
import { Suspense } from 'react'
import { actividadDelServer, admines, mapasMasJugados, sesionesDeVentana, type Admin } from '@/lib/consultas'
import { estadoServidor, SERVIDOR } from '@/lib/estado'
import { formatoNumero, formatoTiempo, formatoPorcentaje } from '@/lib/calculos'
import { rangoDesdeBusqueda, type Periodo } from '@/lib/periodos'
import {
  cubos, escalaDe, jugadoresPorCubo, permanenciaPorCubo, permanenciaTotal, pico,
  NOMBRE_ESCALA, bordes, jugadoresUnicos, permanenciaConGente, proporcionFugaz, visitas, picoSimultaneo,
  SERVER_MOVIDO, SEGUNDOS_FUGAZ
} from '@/lib/actividad'
import { ControlPeriodo } from '@/components/Periodo'
import { NotaTiempo } from '@/components/NotaTiempo'
import { Columnas } from '@/components/Grafico'
import { Barras, Tarjeta, Cargando, EnlaceJugador } from '@/components/Ui'

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

const TOP_ADMINES = 10

/*
 *  El campeonato de admines: los del users.ini del server, ordenados por el tiempo
 *  que estuvieron. Y al lado, cuantos comandos amx_ ejecuto cada uno.
 *
 *  El que nunca aparecio queda al final, en cero: tambien es un dato.
 */
function Nombre ({ a }: { a: Admin }) {
  return a.id ? <EnlaceJugador id={a.id} nick={a.nick} /> : <span className='jugador apagado'>{a.nick}</span>
}

async function Admines ({ ventana }: { ventana: { desde: string | null, hasta: string | null } }) {
  const lista = await admines(ventana)
  if (lista.length === 0) return null

  /* Top 10 en las dos: la lista entera de admines es larga y casi toda en cero */
  const presentes = lista.filter((a) => a.conectado > 0)
  const porTiempo = presentes.slice(0, TOP_ADMINES)
  const porComandos = [...lista]
    .sort((a, b) => b.comandos - a.comandos || b.conectado - a.conectado)
    .filter((a) => a.comandos > 0)
    .slice(0, TOP_ADMINES)

  return (
    <div className='columnas'>
      <section className='seccion'>
        <div className='panel'>
          <h2>Campeonato de admines</h2>
          {porTiempo.length > 0
            ? (
          <div className='tabla-envoltorio'>
            <table>
              <thead>
                <tr><th>#</th><th>Admin</th><th className='num'>En el server</th><th className='num'>Jugando</th></tr>
              </thead>
              <tbody>
                {porTiempo.map((a, i) => (
                  <tr key={a.clave}>
                    <td className='posicion numero'>{i + 1}</td>
                    <td><Nombre a={a} /></td>
                    <td className='num destacado'>{a.conectado ? formatoTiempo(a.conectado) : '—'}</td>
                    <td className='num'>{a.jugado ? formatoTiempo(a.jugado) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
              )
            : <p className='vacio'>Ningún admin estuvo en el server en este período.</p>}
          <p className='nota'>
            Los diez admines que más tiempo estuvieron en el server, jugando o mirando. La lista de admines sale del
            propio server; acá van los que estuvieron en este período. Al que está anotado por nombre y no por su cuenta de Steam se
            lo reconoce por el nick: si se lo cambia, el tiempo nuevo le queda afuera.
          </p>
        </div>
      </section>

      <section className='seccion'>
        <div className='panel'>
          <h2>Comandos de admin</h2>
          {porComandos.length > 0
            ? (
              <div className='tabla-envoltorio'>
                <table>
                  <thead>
                    <tr><th>#</th><th>Admin</th><th className='num'>Comandos amx_</th></tr>
                  </thead>
                  <tbody>
                    {porComandos.map((a, i) => (
                      <tr key={a.clave}>
                        <td className='posicion numero'>{i + 1}</td>
                        <td><Nombre a={a} /></td>
                        <td className='num destacado'>{formatoNumero(a.comandos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )
            : <p className='vacio'>Todavía no hay comandos registrados.</p>}
          <p className='nota'>
            Cuántas veces cada admin usó un comando de administración: cambiar de mapa, echar a alguien, callarlo.
            Se empezó a anotar hace poco, así que arranca de cero.
          </p>
        </div>
      </section>
    </div>
  )
}

async function Tablero ({ parametros }: { parametros: Busqueda }) {
  const rango = rangoDesdeBusqueda(await parametros)
  const ventana = { desde: rango.desde, hasta: rango.hasta }

  const [resumen, crudas, mapas] = await Promise.all([
    actividadDelServer(ventana),
    sesionesDeVentana(ventana),
    mapasMasJugados(ventana)
  ])

  /* Una visita = todo el rato que estuvo, aunque haya cambiado el mapa tres veces */
  const sesiones = visitas(crudas)
  const [desde, hasta] = bordes(ventana, sesiones)
  const escala = escalaDe(rango.periodo)
  const lista = cubos(escala, desde, hasta)
  const cantidades = jugadoresPorCubo(sesiones, lista)
  const permanencia = permanenciaPorCubo(sesiones, lista)
  const total = permanenciaTotal(sesiones)
  const conGente = permanenciaConGente(sesiones)
  const fugaces = proporcionFugaz(sesiones)
  const masGente = pico(lista, cantidades)

  return (
    <>
      <ControlPeriodo rango={rango} enlace={enlace} />

      <div className='tarjetas'>
        <Tarjeta etiqueta='Jugadores' valor={formatoNumero(jugadoresUnicos(sesiones))} destacada />
        <Tarjeta etiqueta='Tiempo jugado' valor={formatoTiempo(resumen.segundos)} />
        <Tarjeta etiqueta='Partidas' valor={formatoNumero(resumen.partidas)} />
        <Tarjeta etiqueta='Se quedan' valor={formatoTiempo(total.mediana)} />
        <Tarjeta etiqueta='Máximo a la vez' valor={formatoNumero(picoSimultaneo(sesiones))} />
        <Tarjeta etiqueta={masGente ? `Más gente · ${masGente.etiqueta}` : 'Más gente'} valor={masGente ? formatoNumero(masGente.jugadores) : '—'} />
      </div>

      <NotaTiempo ventana={ventana} />

      <section className='seccion'>
        <div className='panel'>
          <h2>Jugadores por {NOMBRE_ESCALA[escala]}</h2>
          <Columnas
            columnas={lista.map((c, i) => ({ clave: c.clave, etiqueta: c.etiqueta, valor: cantidades[i] }))}
            formato={(v) => `${v} jugador${v === 1 ? '' : 'es'}`}
            vacio='Nadie se conectó en este período.'
          />
          <p className='nota'>
            Cuánta gente distinta pasó por el server en cada {NOMBRE_ESCALA[escala]}. Al que estuvo un rato largo se
            lo cuenta en cada {NOMBRE_ESCALA[escala]} que estuvo, y a los que están jugando ahora mismo se los suma
            cuando se van.
          </p>
        </div>
      </section>

      <section className='seccion'>
        <div className='panel'>
          <h2>Cuánto se quedan</h2>
          <Columnas
            columnas={lista.map((c, i) => ({
              clave: c.clave,
              etiqueta: c.etiqueta,
              valor: permanencia[i].mediana
            }))}
            formato={formatoTiempo}
            vacio='Todavía no hay conexiones completas en este período.'
          />
          <p className='nota'>
            Cuánto dura una visita: la mitad de la gente se queda más que eso y la otra mitad, menos. Se cuenta todo
            el rato que estuvo, aunque el mapa haya cambiado varias veces en el medio.
            El {formatoPorcentaje(fugaces * 100)} entra, mira y se va antes de los {SEGUNDOS_FUGAZ / 60} minutos, y
            algunos se quedan horas: el que más aguantó estuvo {formatoTiempo(total.maximo)}.
            {conGente.cuantas > 0 && ` Con el server movido, de ${SERVER_MOVIDO} jugadores para arriba, la visita es de ${formatoTiempo(conGente.mediana)}.`}
          </p>
        </div>
      </section>

      <Admines ventana={ventana} />

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
          <p className='nota'>Los mapas que más veces se jugaron en este período, y cuántas veces salió cada uno.</p>
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

      {/* eslint-disable-next-line @next/next/no-img-element -- imagen fija ya optimizada a webp */}
      <img src='/server/admines.webp' alt='' width={1600} height={906} className='banda-seccion' />

      <Suspense fallback={<Cargando />}>
        <Ficha />
      </Suspense>

      <Suspense fallback={<Cargando texto='Cargando actividad…' />}>
        <Tablero parametros={props.searchParams} />
      </Suspense>
    </>
  )
}
