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

export function BanderaAliados ({ className, titulo = 'Aliados' }: Props) {
  return (
    <svg viewBox='0 0 30 20' className={className} role='img' aria-label={titulo}>
      <rect width='30' height='20' fill='#4f6130' />
      <circle cx='15' cy='10' r='7' fill='none' stroke='#f2efe2' strokeWidth='1.2' />
      <polygon points={estrella(15, 10.4, 6)} fill='#f2efe2' />
    </svg>
  )
}

/* Cruz centrada en (15, 10): brazos de ancho "ancho" y largo total "largo" */
const cruz = (ancho: number, largo: number) => {
  const a = ancho / 2; const l = largo / 2
  return `M${15 - a} ${10 - l}h${ancho}v${l - a}h${l - a}v${ancho}h${a - l}v${l - a}h${-ancho}v${a - l}h${a - l}v${-ancho}h${l - a}z`
}

/* Balkenkreuz: la cruz negra con borde blanco que usa DoD para el Eje. En dos
   capas (blanca ancha abajo, negra fina arriba): con un solo trazo, a tamaño chico
   el borde blanco se comia el negro. */
export function BanderaEje ({ className, titulo = 'Eje' }: Props) {
  return (
    <svg viewBox='0 0 30 20' className={className} role='img' aria-label={titulo}>
      <rect width='30' height='20' fill='#5c5a52' />
      <path d={cruz(6, 15)} fill='#f2efe2' />
      <path d={cruz(3.4, 12.6)} fill='#111' />
    </svg>
  )
}
