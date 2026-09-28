import { desdeCuandoHayTiempoEnJuego } from '@/lib/consultas'
import type { Ventana } from '@/lib/periodos'

/*
 *  La aclaracion del tiempo jugado, en todos los lugares donde se muestra.
 *
 *  El tiempo en un bando lo empezo a registrar la version 0.5 del plugin: antes de
 *  esa fecha hay partidas y kills, pero no hay tiempo. Por eso en "Global" -o en
 *  cualquier periodo que arranque antes- el tiempo de los primeros dias falta, y
 *  hay que decirlo. Si el periodo entero cae despues, la aclaracion no aparece.
 *
 *  La fecha sale de la base, no esta escrita a mano: si algun dia se recarga todo
 *  desde cero, la nota se corrige sola.
 */

const FORMATO = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires'
})

const TEXTO = 'El tiempo jugado es el que estuvo en un bando, sin contar el rato de espectador ni eligiendo clase.'

export async function NotaTiempo ({ ventana, extra }: { ventana: Ventana, extra?: string }) {
  const desde = await desdeCuandoHayTiempoEnJuego()
  const cubierto = desde && ventana.desde && Date.parse(ventana.desde) >= Date.parse(desde)

  return (
    <p className='nota'>
      {TEXTO}
      {extra ? ` ${extra}` : ''}
      {desde
        ? (!cubierto && ` Se registra desde el ${FORMATO.format(new Date(desde))}: lo de antes no suma.`)
        : ' Todavía no hay tiempo registrado.'}
    </p>
  )
}
