'use client'

import { useSyncExternalStore } from 'react'
import { tiempoRelativo } from '@/lib/calculos'

/*
 *  Muestra "hace 5 minutos" calculado en el navegador.
 *
 *  Si lo calculara el servidor, la hora actual quedaria congelada dentro de la
 *  pagina cacheada. En el servidor (y durante la hidratacion) se muestra la fecha
 *  absoluta; en el navegador pasa a relativa y se actualiza cada minuto.
 *
 *  El "reloj" se modela como un store externo con granularidad de un minuto: el
 *  valor solo cambia una vez por minuto, asi React no re-renderiza de mas.
 */

const absoluta = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires'
})

const UN_MINUTO = 60_000

function suscribirAlReloj (avisar: () => void) {
  const intervalo = setInterval(avisar, UN_MINUTO)
  return () => clearInterval(intervalo)
}

const minutoActual = () => Math.floor(Date.now() / UN_MINUTO) * UN_MINUTO
const sinReloj = () => null

export function Hace ({ fecha }: { fecha: string }) {
  const ahora = useSyncExternalStore(suscribirAlReloj, minutoActual, sinReloj)
  const momento = new Date(fecha)

  return (
    <time dateTime={fecha} title={absoluta.format(momento)}>
      {ahora === null ? absoluta.format(momento) : tiempoRelativo(momento, new Date(ahora))}
    </time>
  )
}
