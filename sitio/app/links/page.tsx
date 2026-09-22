import type { Metadata } from 'next'
import { GRUPOS, type EnlaceComunidad } from '@/lib/links'

export const metadata: Metadata = { title: 'Links' }

const esExterno = (url: string) => url.startsWith('http')

function afuera (url: string) {
  return esExterno(url) ? { target: '_blank', rel: 'noopener noreferrer' } : {}
}

function Tarjeta ({ e }: { e: EnlaceComunidad }) {
  const cuerpo = (
    <>
      <strong>{e.nombre}</strong>
      <span>{e.descripcion}</span>
      {e.aviso && <span className='enlace-aviso'>{e.aviso}</span>}
    </>
  )

  if (!e.url) {
    return (
      <div className='panel enlace pendiente' aria-disabled='true'>
        {cuerpo}
        <span className='enlace-ir'>Próximamente</span>
      </div>
    )
  }

  /* Con dos archivos la tarjeta no puede ser un solo enlace: van los dos abajo */
  if (e.extra) {
    return (
      <div className='panel enlace'>
        {cuerpo}
        <span className='enlace-ir'>
          <a href={e.url} {...afuera(e.url)}>Parte 1 ↗</a>
          {' · '}
          <a href={e.extra.url} {...afuera(e.extra.url)}>{e.extra.texto} ↗</a>
        </span>
      </div>
    )
  }

  return (
    <a href={e.url} className='panel enlace' {...afuera(e.url)}>
      {cuerpo}
      <span className='enlace-ir'>{esExterno(e.url) ? 'Abrir ↗' : 'Abrir'}</span>
    </a>
  )
}

export default function PaginaLinks () {
  return (
    <>
      <div className='encabezado-pagina'>
        <h1>Links</h1>
      </div>

      {GRUPOS.map((grupo) => (
        <section key={grupo.titulo} className='seccion'>
          <h2>{grupo.titulo}</h2>
          <div className='enlaces'>
            {grupo.enlaces.map((e) => <Tarjeta key={e.nombre} e={e} />)}
          </div>
        </section>
      ))}
    </>
  )
}
