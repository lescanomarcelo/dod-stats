import Link from 'next/link'
import type { Destacados as DatosDestacados, Destacado } from '@/lib/consultas'
import { formatoNumero } from '@/lib/calculos'

/* "1 bandera" / "3 banderas": el numero manda */
const plural = (v: number, uno: string, varios: string) => `${formatoNumero(v)} ${v === 1 ? uno : varios}`

/*
 *  Las cinco figuritas del ranking: una categoria con nombre propio, la imagen del
 *  tapir y el que va ganando en ese rubro, con su numero.
 *
 *  El nick y el dato van ENCIMA de la imagen (no dibujados en ella): cambian solos
 *  cuando cambia el que lidera, y se leen nitidos en cualquier pantalla.
 */

type Categoria = {
  clave: keyof DatosDestacados
  titulo: string
  subtitulo: string
  imagen: string
  /** Como se muestra el numero del que lidera */
  valor: (v: number) => string
  /** Mensaje cuando todavia no hay datos de ese rubro */
  vacio: string
}

const CATEGORIAS: Categoria[] = [
  {
    clave: 'camper',
    titulo: 'El más Kenny',
    subtitulo: 'Más tiempo acostado',
    imagen: '/destacados/kenny.webp',
    valor: (v) => `${v}% del tiempo`,
    vacio: 'Se registra desde la versión 0.4 del plugin.'
  },
  {
    clave: 'granadas',
    titulo: 'El Aero-Player',
    subtitulo: 'Más kills con granadas',
    imagen: '/destacados/granadas.webp',
    valor: (v) => plural(v, 'con una nade', 'con nades'),
    vacio: 'Todavía nadie mató con granadas.'
  },
  {
    clave: 'banderas',
    titulo: 'El dodero ejemplar',
    subtitulo: 'Más banderas tomadas',
    imagen: '/destacados/banderas.webp',
    valor: (v) => plural(v, 'bandera', 'banderas'),
    vacio: 'Se registra desde la versión 0.3 del plugin.'
  },
  {
    clave: 'teamkills',
    titulo: 'm_rawinput 1',
    subtitulo: 'Más teamkills',
    imagen: '/destacados/teamkills.webp',
    valor: (v) => plural(v, 'teamkill', 'teamkills'),
    vacio: 'Nadie mató a un compañero. Por ahora.'
  },
  {
    clave: 'headshots',
    titulo: 'El chiterazo',
    subtitulo: 'Mayor % de headshots',
    imagen: '/destacados/headshots.webp',
    valor: (v) => `${v}% a la cabeza`,
    vacio: 'Todavía nadie tiene kills suficientes.'
  }
]

function Tarjeta ({ categoria, quien }: { categoria: Categoria, quien: Destacado }) {
  const contenido = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen fija ya optimizada a webp */}
      <img src={categoria.imagen} alt='' width={700} height={700} loading='lazy' />
      <div className='destacado-texto'>
        <span className='destacado-titulo'>{categoria.titulo}</span>
        <span className='destacado-subtitulo'>{categoria.subtitulo}</span>
        {quien
          ? (
            <>
              <strong className='destacado-nick'>{quien.nick}</strong>
              <span className='destacado-valor numero'>{categoria.valor(quien.valor)}</span>
            </>
            )
          : <span className='destacado-vacio'>{categoria.vacio}</span>}
      </div>
    </>
  )

  return quien
    ? <Link href={`/jugador/${quien.id}`} className='destacado'>{contenido}</Link>
    : <div className='destacado sin-datos'>{contenido}</div>
}

export function Destacados ({ datos }: { datos: DatosDestacados }) {
  return (
    <div className='destacados'>
      {CATEGORIAS.map((c) => <Tarjeta key={c.clave} categoria={c} quien={datos[c.clave]} />)}
    </div>
  )
}
