import type { Metadata } from 'next'
import { Suspense } from 'react'
import { jugadorEnPeriodo, listaJugadores, enfrentamiento, type JugadorDetalle } from '@/lib/consultas'
import { rangoDesdeBusqueda, type Periodo } from '@/lib/periodos'
import { ControlPeriodo } from '@/components/Periodo'
import {
  kd, porcentaje, formatoKd, formatoPorcentaje, formatoNumero, formatoTiempo
} from '@/lib/calculos'
import { EnlaceJugador, Cargando } from '@/components/Ui'

/* Enlace a /comparar conservando los jugadores elegidos */
function enlace (p: { periodo: Periodo, fecha?: string | null, a?: number | null, b?: number | null }) {
  const q = new URLSearchParams()
  if (p.periodo !== 'global') q.set('periodo', p.periodo)
  if (p.fecha) q.set('fecha', p.fecha)
  if (p.a) q.set('a', String(p.a))
  if (p.b) q.set('b', String(p.b))
  const texto = q.toString()
  return texto ? `/comparar?${texto}` : '/comparar'
}

export const metadata: Metadata = { title: 'Comparar jugadores' }

const leerId = (crudo: unknown): number | null => {
  const id = Number(crudo)
  return Number.isInteger(id) && id > 0 ? id : null
}

/* Cada fila: como calcular el valor y si gana el mayor o el menor */
const FILAS: { etiqueta: string, valor: (j: JugadorDetalle) => number, texto: (v: number) => string, ganaMenor?: boolean }[] = [
  { etiqueta: 'Puntos', valor: (j) => j.puntos, texto: formatoNumero },
  { etiqueta: 'Kills', valor: (j) => j.kills, texto: formatoNumero },
  { etiqueta: 'Muertes', valor: (j) => j.muertes, texto: formatoNumero, ganaMenor: true },
  { etiqueta: 'K/D', valor: (j) => kd(j.kills, j.muertes), texto: formatoKd },
  { etiqueta: 'Headshots %', valor: (j) => porcentaje(j.headshots, j.kills), texto: formatoPorcentaje },
  { etiqueta: 'Teamkills', valor: (j) => j.teamkills, texto: String, ganaMenor: true },
  { etiqueta: 'Tiempo jugado', valor: (j) => j.segundos, texto: formatoTiempo }
]

function Selector ({ nombre, elegido, jugadores }: { nombre: string, elegido: number | null, jugadores: { id: number, nick: string }[] }) {
  return (
    <select name={nombre} defaultValue={elegido ?? ''} aria-label={`Jugador ${nombre.toUpperCase()}`}>
      <option value='' disabled>Elegí un jugador</option>
      {jugadores.map((j) => <option key={j.id} value={j.id}>{j.nick}</option>)}
    </select>
  )
}

async function Comparacion ({ parametros }: { parametros: PageProps<'/comparar'>['searchParams'] }) {
  const p = await parametros
  const idA = leerId(p.a)
  const idB = leerId(p.b)

  const rango = rangoDesdeBusqueda(p)
  const ventana = { desde: rango.desde, hasta: rango.hasta }

  const [jugadores, a, b] = await Promise.all([
    listaJugadores(),
    idA ? jugadorEnPeriodo(idA, ventana) : null,
    idB ? jugadorEnPeriodo(idB, ventana) : null
  ])

  const control = (
    <ControlPeriodo rango={rango} enlace={(periodo, fecha) => enlace({ periodo, fecha, a: idA, b: idB })} />
  )

  const formulario = (
    <form className='formulario-comparar' method='get' action='/comparar'>
      {rango.periodo !== 'global' && <input type='hidden' name='periodo' value={rango.periodo} />}
      {rango.clave && <input type='hidden' name='fecha' value={rango.clave} />}
      <Selector nombre='a' elegido={a?.id ?? null} jugadores={jugadores} />
      <span className='vs'>VS</span>
      <Selector nombre='b' elegido={b?.id ?? null} jugadores={jugadores} />
      <button type='submit'>Comparar</button>
    </form>
  )

  if (!a || !b) {
    return (
      <>
        {control}
        {formulario}
        <p className='vacio'>Elegí dos jugadores para compararlos.</p>
      </>
    )
  }

  if (a.id === b.id) {
    return (
      <>
        {control}
        {formulario}
        <p className='vacio'>Elegiste el mismo jugador dos veces.</p>
      </>
    )
  }

  const duelo = await enfrentamiento(a.id, b.id, ventana)

  return (
    <>
      {control}
      {formulario}

      <div className='panel'>
        <h2>Cara a cara</h2>
        <div className='cara-a-cara'>
          <div className='lado'>
            <div className='valor numero'>{duelo.aSobreB}</div>
            <div className='etiqueta'>veces que <EnlaceJugador id={a.id} nick={a.nick} /> mató a {b.nick}</div>
          </div>
          <div className='medio'>VS</div>
          <div className='lado'>
            <div className='valor numero'>{duelo.bSobreA}</div>
            <div className='etiqueta'>veces que <EnlaceJugador id={b.id} nick={b.nick} /> mató a {a.nick}</div>
          </div>
        </div>
      </div>

      <section className='seccion tabla-envoltorio'>
        <table>
          <thead>
            <tr>
              <th />
              <th className='num'><EnlaceJugador id={a.id} nick={a.nick} /></th>
              <th className='num'><EnlaceJugador id={b.id} nick={b.nick} /></th>
            </tr>
          </thead>
          <tbody>
            {FILAS.map((f) => {
              const va = f.valor(a)
              const vb = f.valor(b)
              const ganaA = f.ganaMenor ? va < vb : va > vb
              const ganaB = f.ganaMenor ? vb < va : vb > va
              return (
                <tr key={f.etiqueta}>
                  <td>{f.etiqueta}</td>
                  <td className={`num${ganaA ? ' gana' : ''}`}>{f.texto(va)}</td>
                  <td className={`num${ganaB ? ' gana' : ''}`}>{f.texto(vb)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </>
  )
}

export default function PaginaComparar (props: PageProps<'/comparar'>) {
  return (
    <>
      <div className='encabezado-pagina'>
        <h1>Comparar</h1>
        <p>Dos jugadores lado a lado, y cuántas veces se mataron entre ellos.</p>
      </div>
      <Suspense fallback={<Cargando />}>
        <Comparacion parametros={props.searchParams} />
      </Suspense>
    </>
  )
}
