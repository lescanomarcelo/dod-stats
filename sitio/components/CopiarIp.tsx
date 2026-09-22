'use client'

import { useState } from 'react'

/* La IP del server: un toque la copia para pegarla en la consola del juego (connect ...) */
export function CopiarIp ({ direccion }: { direccion: string }) {
  const [copiada, setCopiada] = useState(false)

  return (
    <button
      type='button'
      className='ip-servidor'
      title='Copiar la IP'
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(direccion)
          setCopiada(true)
          setTimeout(() => setCopiada(false), 1500)
        } catch {
          /* Sin permiso de portapapeles: la IP igual queda a la vista */
        }
      }}
    >
      <span className='numero'>{direccion}</span>
      <span className='ip-accion'>{copiada ? '¡Copiada!' : 'Copiar'}</span>
    </button>
  )
}
