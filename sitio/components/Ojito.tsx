import type { Metal } from '@/lib/medallas'

const NOMBRE_METAL: Record<Metal, string> = {
  bronce: 'de bronce',
  plata: 'de plata',
  oro: 'dorado'
}

/* La moneda con el ojo, el premio del medallero. Siempre el mismo dibujo, cambia el metal */
export function Ojito ({ metal, chico = false }: { metal: Metal, chico?: boolean }) {
  const nombre = `Ojito ${NOMBRE_METAL[metal]}`
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- imagen fija ya optimizada a webp */
    <img
      src={`/medallas/${metal}.webp`} alt={nombre} title={nombre}
      width={256} height={256} className={chico ? 'ojito chico' : 'ojito'}
    />
  )
}
