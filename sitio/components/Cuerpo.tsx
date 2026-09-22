import soldado from '@/lib/soldado.json'
import { ZONAS_SOLDADO, ANCLAS_SOLDADO, type NombreZona } from '@/lib/zonasSoldado'

/*
 *  "Donde pega": el soldado con cada zona del cuerpo teñida segun la proporcion de
 *  impactos, al estilo del viejo PsychoStats, mas un blanco con la precision.
 *
 *  Como se arma (SVG del servidor, sin JavaScript en el navegador):
 *    1. la imagen del soldado, con fondo transparente
 *    2. encima, los poligonos de cada zona con su color de calor, recortados con la
 *       silueta de la figura (mascara por transparencia) y fusionados en modo
 *       "color": toman el tono del calor y conservan la luz y la textura del render
 *
 *  La figura mira hacia el que la ve: su brazo DERECHO queda a la IZQUIERDA.
 */

export type Zonas = Record<NombreZona, number>

type Props = {
  zonas: Zonas
  /** Impactos sobre disparos, 0 a 1. null si no hay datos de disparos. */
  precision: number | null
  nota?: string
}

/* Misma escala que el mapa de calor */
const ESCALA = ['#1e3a8a', '#2563eb', '#06b6d4', '#84cc16', '#facc15', '#dc2626']

export function colorPara (fraccion: number): string {
  const t = Math.min(1, Math.max(0, fraccion)) * (ESCALA.length - 1)
  const i = Math.min(ESCALA.length - 2, Math.floor(t))
  const f = t - i
  const a = ESCALA[i].match(/\w\w/g)!.map((h) => parseInt(h, 16))
  const b = ESCALA[i + 1].match(/\w\w/g)!.map((h) => parseInt(h, 16))
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`
}

const IMAGEN = '/soldado.webp'
const MARGEN = 235   /* espacio a cada lado de la figura para las etiquetas */

/* Lado de cada etiqueta y altura del texto, en coordenadas de la imagen original */
const ETIQUETAS: { zona: NombreZona, texto: string, lado: 'izq' | 'der', y: number }[] = [
  { zona: 'cabeza', texto: 'Cabeza', lado: 'izq', y: 150 },
  { zona: 'brazo_der', texto: 'Brazo der.', lado: 'izq', y: 300 },
  { zona: 'pierna_der', texto: 'Pierna der.', lado: 'izq', y: 700 },
  /* Del lado derecho el orden sigue la altura de cada zona, asi las lineas no se
     cruzan: el brazo a la altura de la manga, y el estomago lo bastante abajo para
     que su linea pase por debajo de la Thompson */
  { zona: 'pecho', texto: 'Pecho', lado: 'der', y: 250 },
  { zona: 'brazo_izq', texto: 'Brazo izq.', lado: 'der', y: 340 },
  { zona: 'estomago', texto: 'Estómago', lado: 'der', y: 560 },
  { zona: 'pierna_izq', texto: 'Pierna izq.', lado: 'der', y: 770 }
]

/* Blanco chico para acompañar la precision, fuera del dibujo principal */
function Blanco () {
  return (
    <svg viewBox='-32 -32 64 64' className='blanco' aria-hidden='true'>
      <circle r='30' fill='#e8e4d4' stroke='#13150f' strokeWidth='2' />
      <circle r='21' fill='#b9b5a4' />
      <circle r='12' fill='#13150f' />
      <circle r='5' fill='#dc2626' />
      <line x1='-30' y1='0' x2='30' y2='0' stroke='#13150f' strokeWidth='1.5' />
      <line x1='0' y1='-30' x2='0' y2='30' stroke='#13150f' strokeWidth='1.5' />
    </svg>
  )
}

export function Cuerpo ({ zonas, precision, nota }: Props) {
  const total = Object.values(zonas).reduce((s, v) => s + v, 0)
  if (total === 0) return <p className='vacio'>Todavía no hay impactos registrados.</p>

  const maximo = Math.max(...Object.values(zonas))
  const porcentaje = (v: number) => `${Math.round((v / total) * 100)}%`

  const izquierda = soldado.x - MARGEN
  const derecha = soldado.x + soldado.ancho + MARGEN
  const caja = `${izquierda} ${soldado.y - 10} ${derecha - izquierda} ${soldado.alto + 20}`

  return (
    <figure className='cuerpo'>
      <svg viewBox={caja} role='img' aria-label='Proporción de impactos por zona del cuerpo'>
        <defs>
          {/* Solo se tiñe donde la figura es opaca: la mascara usa su transparencia */}
          <mask id='silueta-soldado' maskUnits='userSpaceOnUse' style={{ maskType: 'alpha' }}>
            <image href={IMAGEN} x={soldado.x} y={soldado.y} width={soldado.ancho} height={soldado.alto} />
          </mask>
        </defs>

        <image href={IMAGEN} x={soldado.x} y={soldado.y} width={soldado.ancho} height={soldado.alto} />

        {/* El grupo recortado se fusiona con la imagen de abajo: la fusion va en el grupo,
            no en cada poligono, porque la mascara aisla lo que tiene adentro */}
        <g mask='url(#silueta-soldado)' style={{ mixBlendMode: 'color' }}>
          {(Object.keys(ZONAS_SOLDADO) as NombreZona[]).map((zona) => (
            <polygon key={zona} points={ZONAS_SOLDADO[zona].map((p) => p.join(',')).join(' ')} fill={colorPara(zonas[zona] / maximo)}>
              <title>{`${zona.replace('_', ' ')}: ${porcentaje(zonas[zona])}`}</title>
            </polygon>
          ))}
        </g>

        {ETIQUETAS.map(({ zona, texto, lado, y }) => {
          const x = lado === 'izq' ? izquierda + 10 : derecha - 10
          const finLinea = lado === 'izq' ? izquierda + 190 : derecha - 190
          const [ax, ay] = ANCLAS_SOLDADO[zona]
          return (
            <g key={zona}>
              <polyline points={`${finLinea},${y + 14} ${ax},${ay}`} fill='none' stroke='#c9c5b0' strokeWidth='2' strokeDasharray='6 6' />
              <circle cx={ax} cy={ay} r='6' fill='#e8e4d4' />
              <text x={x} y={y} textAnchor={lado === 'izq' ? 'start' : 'end'} className='soldado-etiqueta'>{texto}</text>
              <text x={x} y={y + 42} textAnchor={lado === 'izq' ? 'start' : 'end'} className='soldado-valor'>{porcentaje(zonas[zona])}</text>
            </g>
          )
        })}

      </svg>
      <figcaption className='pie-cuerpo'>
        {precision !== null && (
          <span className='precision'>
            <Blanco />
            <span><strong className='numero'>{(precision * 100).toFixed(0)}%</strong> de precisión</span>
          </span>
        )}
        {nota && <span className='nota'>{nota}</span>}
      </figcaption>
    </figure>
  )
}
