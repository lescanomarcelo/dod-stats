import Link from 'next/link'
import type { Destacados as DatosDestacados, Destacado, Figura } from '@/lib/consultas'
import { CATEGORIAS_DESTACADO, type CategoriaDestacado } from '@/lib/destacados'
import { enlaceDeDestacado, compartirPorWhatsApp } from '@/lib/enlaces'
import { IconoWhatsApp } from '@/components/Iconos'
import type { Periodo } from '@/lib/periodos'

/*
 *  Las siete figuritas del ranking: una categoria con nombre propio, la imagen del
 *  tapir y el que va ganando en ese rubro, con su numero.
 *
 *  El nick y el dato van ENCIMA de la imagen (no dibujados en ella): cambian solos
 *  cuando cambia el que lidera, y se leen nitidos en cualquier pantalla.
 *
 *  La tarjeta lleva al detalle de la categoria (su top 10), no directo al perfil:
 *  desde ahi, cada jugador del top si lleva a su perfil.
 */

function Tarjeta ({ categoria, quien, periodo, fecha }: {
  categoria: CategoriaDestacado
  quien: Destacado
  periodo: Periodo
  fecha: string | null
}) {
  return (
    <article className={quien ? 'figurita' : 'figurita sin-datos'}>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen fija ya optimizada a webp */}
      <img src={categoria.imagen} alt='' width={700} height={700} loading='lazy' />
      <a
        className='compartir-figurita'
        href={compartirPorWhatsApp(`/destacados/${categoria.clave}`, `${categoria.titulo} · ${categoria.subtitulo}`)}
        target='_blank' rel='noopener noreferrer'
        aria-label={`Compartir ${categoria.titulo} por WhatsApp`} title='Compartir por WhatsApp'
      >
        <IconoWhatsApp className='icono-boton' />
      </a>
      <div className='figurita-texto'>
        <Link href={enlaceDeDestacado(categoria.clave, periodo, fecha)} className='figurita-titulo'>{categoria.titulo}</Link>
        <span className='figurita-subtitulo'>{categoria.subtitulo}</span>
        {quien
          ? (
            <>
              <strong className='figurita-nick'>{quien.nick}</strong>
              <span className='figurita-valor numero'>{categoria.valor(quien.valor)}</span>
            </>
            )
          : <span className='figurita-vacio'>{categoria.vacio}</span>}
      </div>
    </article>
  )
}

export type Figuras = { aliados: Figura[], eje: Figura[] }

/*
 *  La figurita del Versus no lleva al detalle de una categoria: pone cara a cara a
 *  la figura de cada bando y lleva a Comparar con los dos ya elegidos.
 */
function TarjetaVersus ({ figuras, periodo, fecha }: { figuras: Figuras, periodo: Periodo, fecha: string | null }) {
  const aliado = figuras.aliados[0] ?? null
  const eje = figuras.eje[0] ?? null
  const hay = aliado && eje

  const q = new URLSearchParams()
  if (periodo !== 'global') q.set('periodo', periodo)
  if (fecha) q.set('fecha', fecha)
  if (hay) { q.set('a', String(aliado.id)); q.set('b', String(eje.id)) }
  const href = `/comparar?${q.toString()}`

  return (
    <article className={hay ? 'figurita' : 'figurita sin-datos'}>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen fija ya optimizada a webp */}
      <img src='/destacados/versus.webp' alt='' width={700} height={700} loading='lazy' />
      <a
        className='compartir-figurita'
        href={compartirPorWhatsApp(href, 'Versus · La figura de cada bando, cara a cara')}
        target='_blank' rel='noopener noreferrer'
        aria-label='Compartir el Versus por WhatsApp' title='Compartir por WhatsApp'
      >
        <IconoWhatsApp className='icono-boton' />
      </a>
      <div className='figurita-texto'>
        <Link href={href} className='figurita-titulo'>Versus</Link>
        <span className='figurita-subtitulo'>La figura de cada bando</span>
        {hay
          ? (
            <>
              <strong className='figurita-nick aliados'>{aliado.nick}</strong>
              <strong className='figurita-nick eje'>{eje.nick}</strong>
            </>
            )
          : <span className='figurita-vacio'>Todavía no hay figuras en los dos bandos.</span>}
      </div>
    </article>
  )
}

export function Destacados ({ datos, figuras, periodo, fecha }: {
  datos: DatosDestacados, figuras: Figuras, periodo: Periodo, fecha: string | null
}) {
  return (
    <div className='figuritas'>
      {CATEGORIAS_DESTACADO.map((c) => (
        <Tarjeta key={c.clave} categoria={c} quien={datos[c.clave]} periodo={periodo} fecha={fecha} />
      ))}
      <TarjetaVersus figuras={figuras} periodo={periodo} fecha={fecha} />
    </div>
  )
}
