/*
 *  Iconos de los links de la comunidad, dibujados en SVG para que no haya que
 *  bajar imagenes ni depender de un servicio de iconos. Toman el color del texto.
 */

type Props = { className?: string }

export function IconoWhatsApp ({ className }: Props) {
  return (
    <svg viewBox='0 0 24 24' className={className} aria-hidden='true' fill='currentColor'>
      <path d='M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.82c2.16 0 4.19.84 5.72 2.37a8.02 8.02 0 0 1 2.37 5.72c0 4.46-3.63 8.09-8.09 8.09a8.1 8.1 0 0 1-4.12-1.13l-.3-.18-3.06.8.82-2.99-.19-.31a8.03 8.03 0 0 1-1.23-4.29c0-4.46 3.63-8.08 8.08-8.08Z' />
      <path d='M8.9 7.32c-.18-.4-.36-.41-.53-.42h-.45c-.16 0-.4.06-.61.29-.21.23-.8.78-.8 1.9s.82 2.2.94 2.36c.12.15 1.59 2.55 3.93 3.47 1.94.77 2.34.62 2.76.58.42-.04 1.36-.55 1.55-1.09.19-.54.19-1 .13-1.1-.06-.09-.21-.15-.45-.27-.23-.12-1.36-.67-1.57-.75-.21-.08-.36-.11-.52.12-.15.23-.59.75-.73.9-.13.16-.27.18-.5.06-.23-.12-.98-.36-1.87-1.15-.69-.62-1.16-1.38-1.29-1.61-.14-.23-.02-.36.1-.47.1-.1.23-.27.35-.4.11-.14.15-.23.23-.39.08-.15.04-.29-.02-.4-.06-.12-.51-1.25-.71-1.7Z' />
    </svg>
  )
}

/* Taza de café humeante: el link de Cafecito */
export function IconoCafecito ({ className }: Props) {
  return (
    <svg viewBox='0 0 24 24' className={className} aria-hidden='true' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z' />
      <path d='M16 10h2.5a2.5 2.5 0 0 1 0 5H16' />
      <path d='M7 6c0-1 1-1.2 1-2.2M11 6c0-1 1-1.2 1-2.2' />
      <path d='M3 21h14' />
    </svg>
  )
}

export function IconoDiscord ({ className }: Props) {
  return (
    <svg viewBox='0 0 24 24' className={className} aria-hidden='true' fill='currentColor'>
      <path d='M19.3 5.56A16.7 16.7 0 0 0 15.1 4.3l-.2.4c1.4.35 2.6.9 3.7 1.6a13.9 13.9 0 0 0-12.9-.4c.4-.2.9-.4 1.4-.6.5-.2 1-.35 1.5-.46l-.2-.4c-1.5.26-2.9.68-4.2 1.26C1.7 9.4.9 13.1 1.2 16.8a16.9 16.9 0 0 0 5.1 2.6l1-1.7c-.6-.2-1.1-.5-1.6-.8l.4-.3c3.2 1.5 6.7 1.5 9.9 0l.4.3c-.5.3-1 .6-1.6.8l1 1.7c1.8-.55 3.5-1.43 5.1-2.6.36-4.3-.9-8-2.6-11.24ZM8.5 14.8c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z' />
    </svg>
  )
}
