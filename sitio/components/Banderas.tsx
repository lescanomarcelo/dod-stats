/*
 *  Banderas en SVG: la argentina y las de los dos bandos de Day of Defeat.
 *  Proporcion 3:2. El tamaño se controla con CSS (alto).
 */

type Props = { className?: string, titulo?: string }

/* Sol de Mayo simplificado: 16 rayos alternando rectos y ondulados como trazos cortos */
function SolDeMayo ({ cx, cy, r }: { cx: number, cy: number, r: number }) {
  const rayos = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI) / 8
    const largo = i % 2 === 0 ? r * 1.9 : r * 1.55
    return (
      <line
        key={i}
        x1={cx + Math.cos(a) * r * 1.05} y1={cy + Math.sin(a) * r * 1.05}
        x2={cx + Math.cos(a) * largo} y2={cy + Math.sin(a) * largo}
        stroke='#f6b40e' strokeWidth={r * 0.28} strokeLinecap='round'
      />
    )
  })
  return (
    <g>
      {rayos}
      <circle cx={cx} cy={cy} r={r} fill='#f6b40e' stroke='#85340a' strokeWidth={r * 0.12} />
    </g>
  )
}

export function BanderaArgentina ({ className, titulo = 'Argentina' }: Props) {
  return (
    <svg viewBox='0 0 30 20' className={className} role='img' aria-label={titulo}>
      <rect width='30' height='20' fill='#74acdf' />
      <rect y='6.67' width='30' height='6.67' fill='#ffffff' />
      <SolDeMayo cx={15} cy={10} r={1.55} />
    </svg>
  )
}

/* Estrella de cinco puntas centrada en (cx, cy) */
function estrella (cx: number, cy: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const radio = i % 2 === 0 ? r : r * 0.4
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    return `${(cx + Math.cos(a) * radio).toFixed(2)},${(cy + Math.sin(a) * radio).toFixed(2)}`
  }).join(' ')
}

/*
 *  Escudos de los bandos, con el estilo y los colores del icono de Day of Defeat
 *  (public/dod.png): verde con estrella para los Aliados, rojo con cruz para el Eje.
 */

export const VERDE_DOD = '#4b7242'
export const ROJO_DOD = '#c2151c'

export function EscudoAliados ({ className, titulo = 'Aliados' }: Props) {
  return (
    <svg viewBox='0 0 20 20' className={className} role='img' aria-label={titulo}>
      <rect width='20' height='20' rx='2.5' fill={VERDE_DOD} />
      <polygon points={estrella(10, 10.6, 7.6)} fill='#ffffff' />
    </svg>
  )
}

/* Cruz de brazos ensanchados hacia afuera, como la del icono de DoD: un brazo
   trapezoidal repetido cuatro veces, girado de a 90 grados */
export function EscudoEje ({ className, titulo = 'Eje' }: Props) {
  const brazo = 'M8.9 10 L6.6 2.4 L13.4 2.4 L11.1 10 Z'
  return (
    <svg viewBox='0 0 20 20' className={className} role='img' aria-label={titulo}>
      <rect width='20' height='20' rx='2.5' fill={ROJO_DOD} />
      {[0, 90, 180, 270].map((giro) => (
        <path key={giro} d={brazo} fill='#ffffff' transform={`rotate(${giro} 10 10)`} />
      ))}
    </svg>
  )
}
