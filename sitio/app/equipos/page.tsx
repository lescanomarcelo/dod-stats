import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import {
  duelo, figurasPorBando, armasPorBando, balancePorMapa, mapasConMuertes, type Bando
} from '@/lib/consultas'
import { kd, porcentaje, formatoKd, formatoPorcentaje, formatoNumero, nombreArma } from '@/lib/calculos'
import { Barras, EnlaceJugador, Cargando } from '@/components/Ui'
import { BanderaAliados, BanderaEje } from '@/components/Banderas'

export const metadata: Metadata = { title: 'Eje vs Aliados' }

type Busqueda = PageProps<'/equipos'>['searchParams']

/* Cada fila: como se calcula y si gana el que tiene mas o el que tiene menos */
const FILAS: { etiqueta: string, valor: (b: Bando) => number, texto: (v: number) => string, ganaMenor?: boolean }[] = [
  { etiqueta: 'Kills', valor: (b) => b.kills, texto: formatoNumero },
  { etiqueta: 'Muertes', valor: (b) => b.muertes, texto: formatoNumero, ganaMenor: true },
  { etiqueta: 'K/D', valor: (b) => kd(b.kills, b.muertes), texto: formatoKd },
  { etiqueta: 'Headshots %', valor: (b) => porcentaje(b.headshots, b.kills), texto: formatoPorcentaje },
  { etiqueta: 'Teamkills', valor: (b) => b.teamkills, texto: formatoNumero, ganaMenor: true },
  { etiqueta: 'Suicidios', valor: (b) => b.suicidios, texto: formatoNumero, ganaMenor: true }
]

function Cinchada ({ aliados, eje }: { aliados: number, eje: number }) {
  const total = aliados + eje
  const parteAliados = total ? (aliados / total) * 100 : 50
  const lider = aliados === eje ? 'Empate' : aliados > eje ? 'Dominan los Aliados' : 'Domina el Eje'
  return (
    <div className='panel duelo'>
      <div className='duelo-lados'>
        <div className='duelo-lado aliados'>
          <BanderaAliados className='bandera-grande' />
          <div>
            <div className='duelo-nombre'>Aliados</div>
            <div className='duelo-cifra numero'>{formatoNumero(aliados)}</div>
          </div>
        </div>
        <div className='duelo-vs'>{lider}</div>
        <div className='duelo-lado eje'>
          <div>
            <div className='duelo-nombre'>Eje</div>
            <div className='duelo-cifra numero'>{formatoNumero(eje)}</div>
          </div>
          <BanderaEje className='bandera-grande' />
        </div>
      </div>
      <div className='tira' role='img' aria-label={`Aliados ${formatoPorcentaje(parteAliados)}, Eje ${formatoPorcentaje(100 - parteAliados)} de las kills`}>
        <div className='tira-aliados' style={{ width: `${parteAliados}%` }} />
        <div className='tira-eje' />
      </div>
      <div className='tira-leyenda numero'>
        <span>{formatoPorcentaje(parteAliados)} de las kills</span>
        <span>{formatoPorcentaje(100 - parteAliados)}</span>
      </div>
    </div>
  )
}

function Figuras ({ titulo, filas }: { titulo: string, filas: { id: number, nick: string, kills: number }[] }) {
  return (
    <div className='panel'>
      <h2>{titulo}</h2>
      {filas.length === 0
        ? <p className='vacio'>Sin kills todavía.</p>
        : (
          <ul className='lista'>
            {filas.map((f) => (
              <li key={f.id}>
                <EnlaceJugador id={f.id} nick={f.nick} />
                <span className='cifra numero'>{formatoNumero(f.kills)}</span>
              </li>
            ))}
          </ul>
          )}
    </div>
  )
}

function BalancePorMapa ({ filas }: { filas: { mapa: string, aliados: number, eje: number, veces: number }[] }) {
  return (
    <section className='seccion'>
      <h2>Mapa por mapa</h2>
      <div className='tabla-envoltorio'>
        <table>
          <thead>
            <tr>
              <th>Mapa</th>
              <th className='num'>Veces jugado</th>
              <th className='num'>Kills Aliados</th>
              <th className='num'>Kills Eje</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((m) => {
              const total = m.aliados + m.eje
              const parte = total ? (m.aliados / total) * 100 : 50
              return (
                <tr key={m.mapa}>
                  <td><Link href={`/equipos?mapa=${encodeURIComponent(m.mapa)}`} className='jugador'>{m.mapa}</Link></td>
                  <td className='num'>{m.veces}</td>
                  <td className={`num${m.aliados > m.eje ? ' gana-aliados' : ''}`}>{formatoNumero(m.aliados)}</td>
                  <td className={`num${m.eje > m.aliados ? ' gana-eje' : ''}`}>{formatoNumero(m.eje)}</td>
                  <td className='celda-tira'>
                    <div className='tira chica' aria-hidden='true'>
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
    </section>
  )
}

async function Contenido ({ busqueda }: { busqueda: Busqueda }) {
  const p = await busqueda
  const mapas = await mapasConMuertes()
  const pedido = typeof p.mapa === 'string' ? p.mapa.toLowerCase() : ''
  const mapa = mapas.some((m) => m.mapa === pedido) ? pedido : null

  const [resultado, figuras, armas, balance] = await Promise.all([
    duelo(mapa),
    figurasPorBando(mapa),
    armasPorBando(mapa),
    mapa ? null : balancePorMapa()
  ])

  if (resultado.aliados.kills + resultado.eje.kills === 0) {
    return <p className='vacio'>Todavía no hay muertes registradas.</p>
  }

  return (
    <>
      <nav className='pestanas' aria-label='Mapa'>
        <Link href='/equipos' className={mapa === null ? 'activa' : ''}>General</Link>
        {mapas.map((m) => (
          <Link key={m.mapa} href={`/equipos?mapa=${encodeURIComponent(m.mapa)}`} className={m.mapa === mapa ? 'activa' : ''}>
            {m.mapa}
          </Link>
        ))}
      </nav>

      <Cinchada aliados={resultado.aliados.kills} eje={resultado.eje.kills} />

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
              const a = f.valor(resultado.aliados)
              const e = f.valor(resultado.eje)
              const ganaA = f.ganaMenor ? a < e : a > e
              const ganaE = f.ganaMenor ? e < a : e > a
              return (
                <tr key={f.etiqueta}>
                  <td>{f.etiqueta}</td>
                  <td className={`num${ganaA ? ' gana-aliados' : ''}`}>{f.texto(a)}</td>
                  <td className={`num${ganaE ? ' gana-eje' : ''}`}>{f.texto(e)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

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

      {balance && <BalancePorMapa filas={balance} />}
    </>
  )
}

export default function PaginaEquipos (props: PageProps<'/equipos'>) {
  return (
    <>
      <div className='encabezado-pagina'>
        <h1>Eje vs Aliados</h1>
        <p>El mano a mano entre bandos. Cada kill cuenta para el bando con el que se hizo: un jugador puede sumar para los dos lados.</p>
      </div>
      <Suspense fallback={<Cargando />}>
        <Contenido busqueda={props.searchParams} />
      </Suspense>
    </>
  )
}
