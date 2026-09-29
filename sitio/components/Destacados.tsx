import Link from 'next/link'
import type { Destacados as DatosDestacados, Destacado } from '@/lib/consultas'
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

export function Destacados ({ datos, periodo, fecha }: { datos: DatosDestacados, periodo: Periodo, fecha: string | null }) {
  return (
    <div className='figuritas'>
      {CATEGORIAS_DESTACADO.map((c) => (
        <Tarjeta key={c.clave} categoria={c} quien={datos[c.clave]} periodo={periodo} fecha={fecha} />
      ))}
    </div>
  )
}
