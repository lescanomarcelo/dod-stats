import { imagenDeArma } from '@/lib/armas'
import { nombreArma } from '@/lib/calculos'

/*
 *  El dibujo del arma, tal como se ve en el juego. Si no hay dibujo para esa arma,
 *  no se muestra nada: el nombre alcanza.
 */

export function ImagenArma ({ arma, grande = false }: { arma: string, grande?: boolean }) {
  const imagen = imagenDeArma(arma)
  if (!imagen) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element -- imagen fija ya optimizada a webp
    <img
      src={imagen}
      alt={grande ? nombreArma(arma) : ''}
      className={grande ? 'arma-dibujo grande' : 'arma-dibujo'}
      loading='lazy'
      width={grande ? 320 : 90}
      height={grande ? 90 : 26}
    />
  )
}
