'use client'

import { useRouter } from 'next/navigation'

/*
 *  Desplegable de mapas. Reemplaza a la fila de botones, que con decenas de mapas
 *  ocupaba media pantalla.
 *
 *  Cada opcion trae su enlace ya armado desde el servidor (con los demas parametros
 *  de la URL), asi el componente solo navega: no sabe nada de la pagina.
 *
 *  No controlado a proposito (defaultValue + key): si fuera controlado, entre que
 *  elegis y que carga la pagina nueva, volveria a mostrar el mapa anterior.
 */

export type OpcionMapa = { valor: string, etiqueta: string, href: string }

type Props = {
  opciones: OpcionMapa[]
  actual: string
  etiqueta: string
}

export function SelectorMapa ({ opciones, actual, etiqueta }: Props) {
  const router = useRouter()

  return (
    <label className='selector-mapa'>
      <span>{etiqueta}</span>
      <select
        key={actual}
        defaultValue={actual}
        onChange={(evento) => {
          const elegida = opciones.find((o) => o.valor === evento.target.value)
          if (elegida) router.push(elegida.href, { scroll: false })
        }}
      >
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
      </select>
    </label>
  )
}
