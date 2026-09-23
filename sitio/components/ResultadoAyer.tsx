import Link from 'next/link'
import { connection } from 'next/server'
import { marcadorDeBandos } from '@/lib/consultas'
import { rangoDe } from '@/lib/periodos'
import { formatoNumero } from '@/lib/calculos'
import { EscudoAliados, EscudoEje } from '@/components/Banderas'

/*
 *  Banda chica arriba del ranking: quien gano ayer, solo en mapas ganados (no
 *  kills). Un resumen de una linea que lleva a Eje vs Aliados con "ayer" ya
 *  elegido. Si ayer no se jugo nada, no se muestra nada.
 *
 *  "Ayer" depende de la hora actual, asi que hay que marcar el componente como
 *  dinamico (connection()): si no, el build intenta congelarlo en un momento
 *  fijo, que quedaria mal apenas pase la medianoche.
 */

export async function ResultadoAyer () {
  await connection()
  const ayer = rangoDe('dia')
  const marcador = await marcadorDeBandos(null, { desde: ayer.desde, hasta: ayer.hasta })

  if (marcador.partidas === 0) return null

  return (
    <Link href='/equipos?periodo=dia' className='resultado-ayer'>
      <span className='resultado-ayer-titulo'>Resultado de ayer</span>
      <span className='resultado-ayer-marcador'>
        <EscudoAliados className='escudo-chico' />
        <strong className='numero'>{formatoNumero(marcador.ganadosAliados)}</strong>
        <span className='resultado-ayer-vs'>vs</span>
        <strong className='numero'>{formatoNumero(marcador.ganadosEje)}</strong>
        <EscudoEje className='escudo-chico' />
      </span>
    </Link>
  )
}
