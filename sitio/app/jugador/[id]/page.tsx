import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  jugador, armasDeJugador, hitboxesDeJugador, rivales, mapasDeJugador
} from '@/lib/consultas'
import {
  kd, porcentaje, formatoKd, formatoPorcentaje, formatoNumero, formatoTiempo,
  nombreArma, nombreHitbox
} from '@/lib/calculos'
import { Tarjeta, Barras, EnlaceJugador, Cargando } from '@/components/Ui'
import { Hace } from '@/components/Hace'

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

async function Perfil ({ parametros }: { parametros: PageProps<'/jugador/[id]'>['params'] }) {
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
      <Perfil parametros={props.params} />
    </Suspense>
  )
}
