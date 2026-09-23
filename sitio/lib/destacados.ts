import type { ClaveDestacado } from './consultas'
import { formatoNumero, formatoTiempo } from './calculos'

/* "1 bandera" / "3 banderas": el numero manda */
const plural = (v: number, uno: string, varios: string) => `${formatoNumero(v)} ${v === 1 ? uno : varios}`

/*
 *  Las siete categorias destacadas del ranking. Un solo lugar con el titulo, la
 *  imagen y como se muestra el numero: lo usan tanto la tarjeta chica de la
 *  portada como la pagina de detalle con el top 10.
 */
export type CategoriaDestacado = {
  clave: ClaveDestacado
  titulo: string
  subtitulo: string
  imagen: string
  /** Como se muestra el numero del que lidera */
  valor: (v: number) => string
  /** Mensaje cuando todavia no hay datos de ese rubro */
  vacio: string
}

export const CATEGORIAS_DESTACADO: CategoriaDestacado[] = [
  {
    clave: 'fiel',
    titulo: 'El dodero fiel',
    subtitulo: 'Más horas jugadas',
    imagen: '/destacados/fiel.webp',
    valor: (v) => formatoTiempo(v),
    vacio: 'Todavía nadie jugó en este período.'
  },
  {
    clave: 'melee',
    titulo: 'La vieja más pelada',
    subtitulo: 'Más kills con pala o cuchillo',
    imagen: '/destacados/melee.webp',
    valor: (v) => `${formatoNumero(v)} cuerpo a cuerpo`,
    vacio: 'Todavía nadie mató cuerpo a cuerpo.'
  },
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

export const categoriaDeDestacado = (clave: ClaveDestacado): CategoriaDestacado =>
  CATEGORIAS_DESTACADO.find((c) => c.clave === clave)!
