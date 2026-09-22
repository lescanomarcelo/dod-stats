import type { Metadata } from 'next'
import { GRUPOS } from '@/lib/links'

export const metadata: Metadata = { title: 'Links' }

export default function PaginaLinks () {
  return (
    <>
      <div className='encabezado-pagina'>
        <h1>Links</h1>
        <p>Comunidad, descargas y todo lo del server en un solo lugar.</p>
      </div>

      {GRUPOS.map((grupo) => (
        <section key={grupo.titulo} className='seccion'>
          <h2>{grupo.titulo}</h2>
          <div className='enlaces'>
            {grupo.enlaces.map((e) => {
              const externo = e.url?.startsWith('http')
              return e.url
                ? (
                  <a
                    key={e.nombre} href={e.url} className='panel enlace'
                    {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    <strong>{e.nombre}</strong>
                    <span>{e.descripcion}</span>
                    <span className='enlace-ir'>{externo ? 'Abrir ↗' : 'Abrir'}</span>
                  </a>
                  )
                : (
                  <div key={e.nombre} className='panel enlace pendiente' aria-disabled='true'>
                    <strong>{e.nombre}</strong>
                    <span>{e.descripcion}</span>
                    <span className='enlace-ir'>Próximamente</span>
                  </div>
                  )
            })}
          </div>
        </section>
      ))}
    </>
  )
}
