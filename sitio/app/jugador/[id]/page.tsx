import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  jugador, armasDeJugador, hitboxesDeJugador, rivales, mapasDeJugador,
  mapasJugadosPor, puntosDeCalor, impactosDeJugador, MAX_PUNTOS_CALOR, type TipoCalor
} from '@/lib/consultas'
import {
  kd, porcentaje, formatoKd, formatoPorcentaje, formatoNumero, formatoTiempo,
  nombreArma
} from '@/lib/calculos'
import { overviewDe, imagenDe } from '@/lib/mapas'
import { puntosAImagen } from '@/lib/overview'
import { Tarjeta, Barras, EnlaceJugador, Cargando } from '@/components/Ui'
import { Hace } from '@/components/Hace'
import { MapaDeCalor } from '@/components/MapaDeCalor'
import { Cuerpo, type Zonas } from '@/components/Cuerpo'
import { SelectorMapa } from '@/components/SelectorMapa'

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

/* hitplace del motor -> zona del muñeco. El 0 (generico: granadas, explosiones) no se dibuja */
const ZONA_DE_HITBOX: Record<number, keyof Zonas> = {
  1: 'cabeza', 2: 'pecho', 3: 'estomago', 4: 'brazo_izq', 5: 'brazo_der', 6: 'pierna_izq', 7: 'pierna_der'
}

/**
 * Datos para el muñeco. Lo ideal son todos los impactos (plugin 0.2 en adelante).
 * Si el jugador todavia no tiene, se usa el tiro que mato de cada muerte, que ya se
 * registraba desde el principio, y se aclara con una nota.
 */
function zonasParaElMuneco (
  impactos: Awaited<ReturnType<typeof impactosDeJugador>>,
  hitboxes: { hitbox: number, veces: number }[]
): { zonas: Zonas, precision: number | null, nota?: string } {
  const pegados = Object.values(impactos.zonas).reduce((s, v) => s + v, 0)
  if (pegados > 0) {
    const conGenerico = pegados + impactos.generico
    return {
      zonas: impactos.zonas,
      precision: impactos.disparos > 0 ? Math.min(1, conGenerico / impactos.disparos) : null,
      nota: `Sobre ${formatoNumero(pegados)} impactos, sin contar fuego amigo.`
    }
  }

  const zonas: Zonas = { cabeza: 0, pecho: 0, estomago: 0, brazo_izq: 0, brazo_der: 0, pierna_izq: 0, pierna_der: 0 }
  for (const h of hitboxes) {
    const zona = ZONA_DE_HITBOX[h.hitbox]
    if (zona) zonas[zona] += h.veces
  }
  return {
    zonas,
    precision: null,
    nota: 'Según el tiro que mató. Con la versión 0.2 del plugin se cuentan todos los impactos y la precisión.'
  }
}

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
        <SelectorMapa
          etiqueta='Mapa'
          actual={mapa}
          opciones={jugados.map((m) => ({ valor: m.mapa, etiqueta: `${m.mapa} (${m.eventos})`, href: enlace(m.mapa, tipo) }))}
        />
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

  const [armas, hitboxes, impactos, nemesis, victimas, mapas] = await Promise.all([
    armasDeJugador(id),
    hitboxesDeJugador(id),
    impactosDeJugador(id),
    rivales(id, 'nemesis'),
    rivales(id, 'victimas'),
    mapasDeJugador(id)
  ])

  const dondePega = zonasParaElMuneco(impactos, hitboxes)

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

      <section className='seccion panel'>
        <h2>Dónde pega</h2>
        <Cuerpo zonas={dondePega.zonas} precision={dondePega.precision} nota={dondePega.nota} />
      </section>

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
        <ListaRivales titulo='Su némesis' filas={nemesis} vacio='Nadie lo mató todavía.' />
        <ListaRivales titulo='Sus víctimas favoritas' filas={victimas} vacio='Todavía no mató a nadie.' />
      </section>

      <section className='seccion' id='calor'>
        <h2>Mapa de calor</h2>
        <Suspense fallback={<Cargando texto='Cargando mapa de calor…' />}>
          <SeccionCalor id={id} busqueda={busqueda} />
        </Suspense>
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
