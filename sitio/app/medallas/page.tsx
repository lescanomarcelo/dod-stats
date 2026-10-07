import type { Metadata } from 'next'
import { Suspense } from 'react'
import { totalesDeMedallas } from '@/lib/consultas'
import { METALES, RUBROS, medallasDe, contarMedallas, compararCuentas, type Cuenta } from '@/lib/medallas'
import { formatoNumero } from '@/lib/calculos'
import { EnlaceJugador, Cargando } from '@/components/Ui'
import { IconoWhatsApp } from '@/components/Iconos'
import { compartirPorWhatsApp } from '@/lib/enlaces'
import { Ojito } from '@/components/Ojito'

const TITULO = 'Medallero Dodero'
const BAJADA = 'Medallero de ojitos: se ganan y no se pierden'

export const metadata: Metadata = {
  title: TITULO,
  description: BAJADA,
  openGraph: {
    title: `${TITULO} · Tributo Dod Stats!`,
    description: BAJADA,
    siteName: 'Tributo Dod Stats!',
    type: 'website',
    locale: 'es_AR',
    images: [{ url: '/medallas/og.jpg', width: 1200, height: 630 }]
  }
}

/* Los metales se muestran del mas valioso al menos, al reves que en el catalogo */
const DE_MAYOR_A_MENOR = [...METALES].reverse()

function Cuentita ({ cuenta }: { cuenta: Cuenta }) {
  return (
    <span className='ojitos-cuenta'>
      {DE_MAYOR_A_MENOR.filter((m) => cuenta[m] > 0).map((m) => (
        <span key={m} className='ojitos-par'>
          <Ojito metal={m} chico />
          <strong className='numero'>{cuenta[m]}</strong>
        </span>
      ))}
    </span>
  )
}

async function Contenido () {
  const doderos = await totalesDeMedallas()

  const conMedallas = doderos
    .map((d) => ({ ...d, ganadas: medallasDe(d.totales) }))
    .filter((d) => d.ganadas.length > 0)
    .map((d) => ({ ...d, cuenta: contarMedallas(d.ganadas) }))
    .sort((a, b) => compararCuentas(a.cuenta, b.cuenta) || b.ganadas.length - a.ganadas.length)

  /* Cuanta gente llego a cada marca, para que se vea lo que cuesta cada una */
  const cuantosLlegaron = (clave: string, marca: number) =>
    doderos.filter((d) => (d.totales[clave as keyof typeof d.totales] ?? 0) >= marca).length

  return (
    <>
      <div className='banda-compartible'>
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen fija ya optimizada */}
        <img src='/medallas/og.jpg' alt='' width={1200} height={630} className='banda-seccion banda-ancha' />
        <a
          className='boton-whatsapp'
          href={compartirPorWhatsApp('/medallas', `${TITULO} · ${BAJADA}`)}
          target='_blank' rel='noopener noreferrer'
          aria-label='Compartir el medallero por WhatsApp' title='Compartir por WhatsApp'
        >
          <IconoWhatsApp className='icono-boton' />
        </a>
      </div>

      <section className='seccion'>
        <div className='panel'>
          <h2>Los más condecorados</h2>
          {conMedallas.length === 0
            ? <p className='vacio'>Todavía nadie llegó a ninguna marca.</p>
            : (
              <ol className='medallero-lista'>
                {conMedallas.map((d, i) => (
                  <li key={d.id}>
                    <span className='posicion numero'>{i + 1}</span>
                    <EnlaceJugador id={d.id} nick={d.nick} />
                    <Cuentita cuenta={d.cuenta} />
                  </li>
                ))}
              </ol>
              )}
        </div>
      </section>

      <section className='seccion'>
        <h2 className='titulo-seccion'>¿Cómo ganar ojitos?</h2>
        <div className='rubros'>
          {RUBROS.map((rubro) => (
            <div className='panel rubro' key={rubro.clave}>
              <strong className='rubro-nombre'>{rubro.nombre}</strong>
              <span className='rubro-detalle'>{rubro.detalle}</span>
              <ul className='rubro-marcas'>
                {[...rubro.escalones].reverse().map((escalon) => (
                  <li key={escalon.metal}>
                    <Ojito metal={escalon.metal} chico />
                    <span className='numero'>{rubro.formato(escalon.marca)}</span>
                    <span className='rubro-cuantos'>
                      {formatoNumero(cuantosLlegaron(rubro.clave, escalon.marca))}
                      {cuantosLlegaron(rubro.clave, escalon.marca) === 1 ? ' dodero' : ' doderos'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className='nota'>
          Las marcas son de toda la historia y no se reinician. Cuando los dorados se empiecen a
          repartir, se suma un escalón más difícil.
        </p>
      </section>
    </>
  )
}

export default function PaginaMedallas () {
  return (
    <>
      <div className='encabezado-pagina'>
        <h1>{TITULO}</h1>
        <p>{BAJADA}.</p>
      </div>

      <Suspense fallback={<Cargando texto='Contando ojitos…' />}>
        <Contenido />
      </Suspense>
    </>
  )
}
