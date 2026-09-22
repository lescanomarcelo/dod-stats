import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  jugador, armasDeJugador, hitboxesDeJugador, rivales, mapasDeJugador,
  mapasJugadosPor, puntosDeCalor, MAX_PUNTOS_CALOR, type TipoCalor
} from '@/lib/consultas'
import {
  kd, porcentaje, formatoKd, formatoPorcentaje, formatoNumero, formatoTiempo,
  nombreArma, nombreHitbox
} from '@/lib/calculos'
import { overviewDe, imagenDe } from '@/lib/mapas'
import { puntosAImagen } from '@/lib/overview'
import { Tarjeta, Barras, EnlaceJugador, Cargando } from '@/components/Ui'
import { Hace } from '@/components/Hace'
import { MapaDeCalor } from '@/components/MapaDeCalor'

/** El id llega por la URL: solo enteros positivos, cualquier otra cosa es 404 */
function leerId (crudo: string): number | null {
  const id = Number(crudo)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function generateMetadata (props: PageProps<'/jugador/[id]'>): Promise<Metadata> {
  const id = leerId((await props.params).id)
  const j = id ? await jugador(id) : null
  return { title: j ? j.nick : 'Jugador no encontrado' }
}

function ListaRivales ({ titulo, filas, vacio }: { titulo: string, filas: { id: number, nick: string, veces: number }[], vacio: string }) {
  return (
    <div className='panel'>
      <h2>{titulo}</h2>
      {filas.length === 0
        ? <p className='vacio'>{vacio}</p>
        : (
          <ul className='lista'>
            {filas.map((r) => (
              <li key={r.id}>
                <EnlaceJugador id={r.id} nick={r.nick} />
                <span className='cifra numero'>{r.veces}</span>
              </li>
            ))}
          </ul>
          )}
    </div>
  )
}

type Busqueda = PageProps<'/jugador/[id]'>['searchParams']

async function SeccionCalor ({ id, busqueda }: { id: number, busqueda: Busqueda }) {
  const p = await busqueda
  /* Solo los mapas que tienen overview: los mapas arena normalmente no traen imagen */
  const jugados = (await mapasJugadosPor(id)).filter((m) => overviewDe(m.mapa))

  if (jugados.length === 0) {
    return <p className='vacio'>Todavía no hay muertes en mapas con imagen disponible.</p>
  }

  const pedido = typeof p.mapa === 'string' ? p.mapa.toLowerCase() : ''
  const mapa = jugados.some((m) => m.mapa === pedido) ? pedido : jugados[0].mapa
  const tipo: TipoCalor = p.ver === 'muertes' ? 'muertes' : 'kills'
  const ov = overviewDe(mapa)!
  const crudos = await puntosDeCalor(id, mapa, tipo)
  const puntos = puntosAImagen(ov, crudos)
  const enlace = (m: string, t: TipoCalor) => `/jugador/${id}?mapa=${encodeURIComponent(m)}&ver=${t}`

  return (
    <>
      <div className='controles-calor'>
        <nav className='pestanas' aria-label='Qué mostrar'>
          <Link href={enlace(mapa, 'kills')} scroll={false} className={tipo === 'kills' ? 'activa' : ''}>Dónde mató</Link>
          <Link href={enlace(mapa, 'muertes')} scroll={false} className={tipo === 'muertes' ? 'activa' : ''}>Dónde murió</Link>
        </nav>
        <nav className='pestanas' aria-label='Mapa'>
          {jugados.map((m) => (
            <Link key={m.mapa} href={enlace(m.mapa, tipo)} scroll={false} className={m.mapa === mapa ? 'activa' : ''}>
              {m.mapa}
            </Link>
          ))}
        </nav>
      </div>

      <MapaDeCalor imagen={imagenDe(mapa)} nombre={mapa} ancho={ov.ancho} alto={ov.alto} puntos={puntos} />

      <div className='leyenda-calor'>
        <span>menos</span><span className='escala' /><span>más</span>
        <span className='cuenta numero'>
          {formatoNumero(puntos.length / 2)} {tipo === 'kills' ? 'kills' : 'muertes'} en {mapa}
          {crudos.length === MAX_PUNTOS_CALOR && ` (las ${formatoNumero(MAX_PUNTOS_CALOR)} más recientes)`}
        </span>
      </div>
    </>
  )
}

async function Perfil ({ parametros, busqueda }: { parametros: PageProps<'/jugador/[id]'>['params'], busqueda: Busqueda }) {
  const id = leerId((await parametros).id)
  if (!id) notFound()

  const j = await jugador(id)
  if (!j) notFound()

  const [armas, hitboxes, nemesis, victimas, mapas] = await Promise.all([
    armasDeJugador(id),
    hitboxesDeJugador(id),
    rivales(id, 'nemesis'),
    rivales(id, 'victimas'),
    mapasDeJugador(id)
  ])

  const totalImpactos = hitboxes.reduce((s, h) => s + h.veces, 0)

  return (
    <>
      <div className='perfil-cabecera'>
        <div>
          <h1>{j.nick}</h1>
          <div className='datos'>
            {j.steamid ?? 'Sin SteamID'}
            {j.primeraVez && <> · Primera vez <Hace fecha={j.primeraVez} /></>}
            {j.ultimaVez && <> · Última vez <Hace fecha={j.ultimaVez} /></>}
          </div>
        </div>
        <Link href={`/comparar?a=${j.id}`} className='boton'>Comparar con otro jugador</Link>
      </div>

      <div className='tarjetas'>
        <Tarjeta etiqueta='Kills' valor={formatoNumero(j.kills)} destacada />
        <Tarjeta etiqueta='Muertes' valor={formatoNumero(j.muertes)} />
        <Tarjeta etiqueta='K/D' valor={formatoKd(kd(j.kills, j.muertes))} />
        <Tarjeta etiqueta='Headshots' valor={formatoPorcentaje(porcentaje(j.headshots, j.kills))} />
        <Tarjeta etiqueta='Tiempo jugado' valor={formatoTiempo(j.segundos)} />
        <Tarjeta etiqueta='Teamkills' valor={j.teamkills} />
        <Tarjeta etiqueta='Suicidios' valor={j.suicidios} />
      </div>

      <section className='seccion columnas'>
        <div className='panel'>
          <h2>Armas favoritas</h2>
          <Barras filas={armas.map((a) => ({
            clave: a.arma,
            nombre: nombreArma(a.arma),
            valor: a.kills,
            texto: formatoNumero(a.kills)
          }))}
          />
        </div>

        <div className='panel'>
          <h2>Dónde pega</h2>
          <Barras filas={hitboxes.map((h) => ({
            clave: String(h.hitbox),
            nombre: nombreHitbox(h.hitbox),
            valor: h.veces,
            texto: formatoPorcentaje(porcentaje(h.veces, totalImpactos)),
            variante: h.hitbox === 1 ? 'cabeza' : undefined
          }))}
          />
        </div>
      </section>

      <section className='seccion' id='calor'>
        <h2>Mapa de calor</h2>
        <Suspense fallback={<Cargando texto='Cargando mapa de calor…' />}>
          <SeccionCalor id={id} busqueda={busqueda} />
        </Suspense>
      </section>

      <section className='seccion columnas'>
        <ListaRivales titulo='Su némesis' filas={nemesis} vacio='Nadie lo mató todavía.' />
        <ListaRivales titulo='Sus víctimas favoritas' filas={victimas} vacio='Todavía no mató a nadie.' />
      </section>

      <section className='seccion'>
        <h2>Por mapa</h2>
        <div className='tabla-envoltorio'>
          {mapas.length === 0
            ? <p className='vacio'>Sin datos todavía.</p>
            : (
              <table>
                <thead>
                  <tr>
                    <th>Mapa</th>
                    <th className='num'>Kills</th>
                    <th className='num'>Muertes</th>
                    <th className='num'>K/D</th>
                  </tr>
                </thead>
                <tbody>
                  {mapas.map((m) => (
                    <tr key={m.mapa}>
                      <td>{m.mapa}</td>
                      <td className='num'>{formatoNumero(m.kills)}</td>
                      <td className='num'>{formatoNumero(m.muertes)}</td>
                      <td className='num'>{formatoKd(kd(m.kills, m.muertes))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
        </div>
      </section>
    </>
  )
}

export default function PaginaJugador (props: PageProps<'/jugador/[id]'>) {
  return (
    <Suspense fallback={<Cargando texto='Cargando jugador…' />}>
      <Perfil parametros={props.params} busqueda={props.searchParams} />
    </Suspense>
  )
}
