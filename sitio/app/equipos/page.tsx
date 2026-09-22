import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import {
  duelo, figurasPorBando, armasPorBando, balancePorMapa, mapasConActividad, marcadorDeBandos,
  puntosDeJugadoresPorBando, historial, type Bando, type Figura
} from '@/lib/consultas'
import { PERIODOS, rangoDe, ultimosPeriodos, veredicto, type Periodo, type Rango } from '@/lib/periodos'
import { kd, porcentaje, formatoKd, formatoPorcentaje, formatoNumero, nombreArma } from '@/lib/calculos'
import { Barras, EnlaceJugador, Cargando } from '@/components/Ui'
import { EscudoAliados, EscudoEje } from '@/components/Banderas'
import { SelectorMapa } from '@/components/SelectorMapa'
import { HistorialBandos } from '@/components/HistorialBandos'

export const metadata: Metadata = { title: 'Eje vs Aliados' }

type Busqueda = PageProps<'/equipos'>['searchParams']

const PESTANA: Record<Periodo, string> = { semana: 'Semana', mes: 'Mes', global: 'Global' }
const SEMANAS_HISTORIAL = 12
const MESES_HISTORIAL = 12

/* Enlace a /equipos conservando lo demas. Lo que es por defecto no va en la URL */
function enlace (p: { periodo: Periodo, fecha?: string | null, mapa: string | null }) {
  const q = new URLSearchParams()
  if (p.periodo !== 'global') q.set('periodo', p.periodo)
  if (p.fecha) q.set('fecha', p.fecha)
  if (p.mapa) q.set('mapa', p.mapa)
  const texto = q.toString()
  return texto ? `/equipos?${texto}` : '/equipos'
}

/* ------------------------------------------------------------------ */
/*  Piezas                                                             */
/* ------------------------------------------------------------------ */

function Cinchada ({ titulo, aliados, eje, unidad, detalle, principal }: {
  titulo: string
  aliados: number
  eje: number
  unidad: string
  detalle?: [string, string]
  principal?: boolean
}) {
  const total = aliados + eje
  const parteAliados = total ? (aliados / total) * 100 : 50
  const lider = aliados === eje ? 'Empate' : aliados > eje ? 'Ganan los Aliados' : 'Gana el Eje'
  return (
    <div className={`panel duelo${principal ? ' principal' : ''}`}>
      <h2>{titulo}</h2>
      <div className='duelo-lados'>
        <div className='duelo-lado aliados'>
          <EscudoAliados className={principal ? 'escudo-grande' : 'escudo-medio'} />
          <div>
            <div className='duelo-nombre'>Aliados</div>
            <div className='duelo-cifra numero'>{formatoNumero(aliados)}</div>
            {detalle && <div className='duelo-detalle'>{detalle[0]}</div>}
          </div>
        </div>
        <div className='duelo-vs'>{lider}</div>
        <div className='duelo-lado eje'>
          <div>
            <div className='duelo-nombre'>Eje</div>
            <div className='duelo-cifra numero'>{formatoNumero(eje)}</div>
            {detalle && <div className='duelo-detalle'>{detalle[1]}</div>}
          </div>
          <EscudoEje className={principal ? 'escudo-grande' : 'escudo-medio'} />
        </div>
      </div>
      <div className='tira' role='img' aria-label={`Aliados ${formatoPorcentaje(parteAliados)}, Eje ${formatoPorcentaje(100 - parteAliados)} de ${unidad}`}>
        <div className='tira-aliados' style={{ width: `${parteAliados}%` }} />
        <div className='tira-eje' />
      </div>
      <div className='tira-leyenda numero'>
        <span>{formatoPorcentaje(parteAliados)} de {unidad}</span>
        <span>{formatoPorcentaje(100 - parteAliados)}</span>
      </div>
    </div>
  )
}

function Figuras ({ titulo, filas }: { titulo: string, filas: Figura[] }) {
  return (
    <div className='panel'>
      <h2>{titulo}</h2>
      {filas.length === 0
        ? <p className='vacio'>Nadie sumó todavía.</p>
        : (
          <ul className='lista'>
            {filas.map((f) => (
              <li key={f.id}>
                <EnlaceJugador id={f.id} nick={f.nick} />
                <span className='cifra numero'>
                  {f.puntos > 0 && <><strong>{formatoNumero(f.puntos)}</strong> pts · </>}{formatoNumero(f.kills)} kills
                </span>
              </li>
            ))}
          </ul>
          )}
    </div>
  )
}

type FilaBalance = Awaited<ReturnType<typeof balancePorMapa>>[number]

function BalancePorMapa ({ filas, rango }: { filas: FilaBalance[], rango: Rango }) {
  return (
    <section className='seccion'>
      <h2>Mapa por mapa</h2>
      <div className='tabla-envoltorio'>
        <table>
          <thead>
            <tr>
              <th>Mapa</th>
              <th className='num'>Partidas</th>
              <th className='num'>Ganó Aliados</th>
              <th className='num'>Ganó Eje</th>
              <th className='num'>Puntos</th>
              <th className='num'>Kills</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((m) => {
              const v = veredicto(m)
              const parte = (v.margen + 1) * 50
              return (
                <tr key={m.mapa}>
                  <td><Link href={enlace({ periodo: rango.periodo, fecha: rango.clave, mapa: m.mapa })} className='jugador'>{m.mapa}</Link></td>
                  <td className='num'>{m.partidas || '—'}</td>
                  <td className={`num${m.ganadosAliados > m.ganadosEje ? ' gana-aliados' : ''}`}>{m.partidas ? m.ganadosAliados : '—'}</td>
                  <td className={`num${m.ganadosEje > m.ganadosAliados ? ' gana-eje' : ''}`}>{m.partidas ? m.ganadosEje : '—'}</td>
                  <td className='num'>{m.partidas ? `${formatoNumero(m.puntosAliados)} - ${formatoNumero(m.puntosEje)}` : '—'}</td>
                  <td className='num'>{formatoNumero(m.killsAliados)} - {formatoNumero(m.killsEje)}</td>
                  <td className='celda-tira'>
                    <div className={`tira chica${v.segun === 'kills' ? ' por-kills' : ''}`} aria-hidden='true'>
                      <div className='tira-aliados' style={{ width: `${parte}%` }} />
                      <div className='tira-eje' />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className='nota'>El balance sale de los mapas ganados; en los mapas sin marcadores registrados, de las kills (barra punteada).</p>
    </section>
  )
}

/* Filas de la tabla comparativa: como se calcula y si gana el que tiene mas o menos */
type Totales = {
  mapas: number
  puntos: number
  puntosJugadores: number
  bando: Bando
}

const FILAS: { etiqueta: string, valor: (t: Totales) => number, texto: (v: number) => string, ganaMenor?: boolean, clave?: boolean }[] = [
  { etiqueta: 'Mapas ganados', valor: (t) => t.mapas, texto: formatoNumero, clave: true },
  { etiqueta: 'Puntos del marcador', valor: (t) => t.puntos, texto: formatoNumero, clave: true },
  { etiqueta: 'Puntos de jugadores', valor: (t) => t.puntosJugadores, texto: formatoNumero },
  { etiqueta: 'Kills', valor: (t) => t.bando.kills, texto: formatoNumero },
  { etiqueta: 'Muertes', valor: (t) => t.bando.muertes, texto: formatoNumero, ganaMenor: true },
  { etiqueta: 'K/D', valor: (t) => kd(t.bando.kills, t.bando.muertes), texto: formatoKd },
  { etiqueta: 'Headshots %', valor: (t) => porcentaje(t.bando.headshots, t.bando.kills), texto: formatoPorcentaje },
  { etiqueta: 'Teamkills', valor: (t) => t.bando.teamkills, texto: formatoNumero, ganaMenor: true },
  { etiqueta: 'Suicidios', valor: (t) => t.bando.suicidios, texto: formatoNumero, ganaMenor: true }
]

/* ------------------------------------------------------------------ */
/*  Contenido                                                          */
/* ------------------------------------------------------------------ */

async function Contenido ({ busqueda }: { busqueda: Busqueda }) {
  const p = await busqueda
  const periodo: Periodo = PERIODOS.find((x) => x === p.periodo) ?? 'global'
  const rango = rangoDe(periodo, p.fecha)
  const ventana = { desde: rango.desde, hasta: rango.hasta }

  const mapas = await mapasConActividad(ventana)
  const pedido = typeof p.mapa === 'string' ? p.mapa.toLowerCase() : ''
  const mapa = mapas.some((m) => m.mapa === pedido) ? pedido : null

  const semanas = ultimosPeriodos('semana', SEMANAS_HISTORIAL)
  const meses = ultimosPeriodos('mes', MESES_HISTORIAL)

  const [marcador, puntosJugadores, resultado, figuras, armas, balance, porSemana, porMes] = await Promise.all([
    marcadorDeBandos(mapa, ventana),
    puntosDeJugadoresPorBando(mapa, ventana),
    duelo(mapa, ventana),
    figurasPorBando(mapa, ventana),
    armasPorBando(mapa, ventana),
    mapa ? null : balancePorMapa(ventana),
    historial('semana', mapa, rangoDe('semana', semanas[0]).desde!),
    historial('mes', mapa, rangoDe('mes', meses[0]).desde!)
  ])

  const hayKills = resultado.aliados.kills + resultado.eje.kills > 0
  const hayMarcadores = marcador.partidas > 0
  const totales = (bando: 'aliados' | 'eje'): Totales => ({
    mapas: bando === 'aliados' ? marcador.ganadosAliados : marcador.ganadosEje,
    puntos: bando === 'aliados' ? marcador.puntosAliados : marcador.puntosEje,
    puntosJugadores: puntosJugadores[bando],
    bando: resultado[bando]
  })
  const [ta, te] = [totales('aliados'), totales('eje')]

  return (
    <>
      <div className='controles-equipos'>
        <nav className='pestanas' aria-label='Período'>
          {PERIODOS.map((x) => (
            <Link key={x} href={enlace({ periodo: x, mapa })} scroll={false} className={x === periodo ? 'activa' : ''}>
              {PESTANA[x]}
            </Link>
          ))}
        </nav>
        {mapas.length > 0 && (
          <SelectorMapa
            etiqueta='Mapa'
            actual={mapa ?? ''}
            opciones={[
              { valor: '', etiqueta: 'Todos los mapas', href: enlace({ periodo, fecha: rango.clave, mapa: null }) },
              ...mapas.map((m) => ({
                valor: m.mapa,
                etiqueta: m.partidas ? `${m.mapa} (${m.partidas} partidas)` : `${m.mapa} (${m.muertes} muertes)`,
                href: enlace({ periodo, fecha: rango.clave, mapa: m.mapa })
              }))
            ]}
          />
        )}
      </div>

      <div className='navegador-periodo'>
        {rango.anterior
          ? <Link href={enlace({ periodo, fecha: rango.anterior, mapa })} scroll={false} aria-label='Período anterior'>‹</Link>
          : <span />}
        <strong>{rango.etiqueta}{rango.actual && periodo !== 'global' && <small> (en curso)</small>}</strong>
        {rango.siguiente
          ? <Link href={enlace({ periodo, fecha: rango.siguiente, mapa })} scroll={false} aria-label='Período siguiente'>›</Link>
          : <span />}
      </div>

      {!hayKills && !hayMarcadores
        ? <p className='vacio'>No hubo partidas en este período.</p>
        : (
          <>
            {hayMarcadores
              ? (
                <Cinchada
                  titulo='Resultado: mapas ganados' principal unidad='los mapas ganados'
                  aliados={marcador.ganadosAliados} eje={marcador.ganadosEje}
                  detalle={[`${formatoNumero(marcador.puntosAliados)} puntos`, `${formatoNumero(marcador.puntosEje)} puntos`]}
                />
                )
              : (
                <p className='aviso'>
                  Todavía no hay marcadores registrados en este período: se guardan desde la versión 0.3 del plugin.
                  Mientras tanto, el resultado sale de las kills.
                </p>
                )}
            {hayMarcadores && marcador.empates > 0 && (
              <p className='nota'>{marcador.empates} {marcador.empates === 1 ? 'mapa terminó empatado' : 'mapas terminaron empatados'} de {marcador.partidas}.</p>
            )}

            <Cinchada titulo='Kills' unidad='las kills' aliados={resultado.aliados.kills} eje={resultado.eje.kills} principal={!hayMarcadores} />

            <section className='seccion tabla-envoltorio'>
              <table>
                <thead>
                  <tr>
                    <th>{mapa ?? 'Todos los mapas'}</th>
                    <th className='num'>Aliados</th>
                    <th className='num'>Eje</th>
                  </tr>
                </thead>
                <tbody>
                  {FILAS.map((f) => {
                    const a = f.valor(ta)
                    const e = f.valor(te)
                    const ganaA = f.ganaMenor ? a < e : a > e
                    const ganaE = f.ganaMenor ? e < a : e > a
                    return (
                      <tr key={f.etiqueta} className={f.clave ? 'fila-clave' : ''}>
                        <td>{f.etiqueta}</td>
                        <td className={`num${ganaA ? ' gana-aliados' : ''}`}>{f.texto(a)}</td>
                        <td className={`num${ganaE ? ' gana-eje' : ''}`}>{f.texto(e)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          </>
          )}

      <section className='seccion'>
        <h2>Semana a semana{mapa && ` · ${mapa}`}</h2>
        <HistorialBandos
          tipo='semana' claves={semanas} datos={porSemana}
          elegida={periodo === 'semana' ? rango.clave : null}
          enlace={(clave) => enlace({ periodo: 'semana', fecha: clave, mapa })}
        />
      </section>

      <section className='seccion'>
        <h2>Mes a mes{mapa && ` · ${mapa}`}</h2>
        <HistorialBandos
          tipo='mes' claves={meses} datos={porMes}
          elegida={periodo === 'mes' ? rango.clave : null}
          enlace={(clave) => enlace({ periodo: 'mes', fecha: clave, mapa })}
        />
      </section>

      {(hayKills || hayMarcadores) && (
        <>
          <section className='seccion columnas'>
            <Figuras titulo='Figuras de los Aliados' filas={figuras.aliados} />
            <Figuras titulo='Figuras del Eje' filas={figuras.eje} />
          </section>

          <section className='seccion columnas'>
            <div className='panel'>
              <h2>Armas de los Aliados</h2>
              <Barras filas={armas.aliados.map((a) => ({ clave: a.arma, nombre: nombreArma(a.arma), valor: a.kills, texto: formatoNumero(a.kills) }))} />
            </div>
            <div className='panel'>
              <h2>Armas del Eje</h2>
              <Barras filas={armas.eje.map((a) => ({ clave: a.arma, nombre: nombreArma(a.arma), valor: a.kills, texto: formatoNumero(a.kills) }))} />
            </div>
          </section>

          {balance && balance.length > 0 && <BalancePorMapa filas={balance} rango={rango} />}
        </>
      )}
    </>
  )
}

export default function PaginaEquipos (props: PageProps<'/equipos'>) {
  return (
    <>
      <div className='encabezado-pagina'>
        <h1>Eje vs Aliados</h1>
        <p>
          Gana el bando que gana más mapas: en cada mapa, el que termina con más puntos en el marcador
          (banderas y objetivos). Las kills se muestran aparte y cuentan para el bando con el que se hicieron.
        </p>
      </div>
      <Suspense fallback={<Cargando />}>
        <Contenido busqueda={props.searchParams} />
      </Suspense>
    </>
  )
}
