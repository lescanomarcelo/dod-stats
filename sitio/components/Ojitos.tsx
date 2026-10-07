import { RUBROS, METALES, medallaDe, proximoEscalon, type TotalesDeMedallas } from '@/lib/medallas'
import { Ojito } from '@/components/Ojito'

/*
 *  Los ojitos de un dodero: los que ya tiene y lo que le falta para el que sigue.
 *
 *  Van los once rubros aunque esten en cero, como la vitrina de logros de Steam: ver
 *  los que faltan es la mitad de la gracia.
 */

const NOMBRE_METAL = { bronce: 'de bronce', plata: 'plateado', oro: 'dorado' } as const

export function Ojitos ({ totales }: { totales: Partial<TotalesDeMedallas> }) {
  const filas = RUBROS.map((rubro) => {
    const valor = totales[rubro.clave] ?? 0
    const metal = medallaDe(valor, rubro.escalones)
    const proximo = proximoEscalon(valor, rubro.escalones)
    /* Lo andado hacia la proxima marca, desde la que ya tiene */
    const desde = metal ? rubro.escalones.find((e) => e.metal === metal)!.marca : 0
    const avance = proximo ? Math.round(100 * (valor - desde) / (proximo.marca - desde)) : 100
    return { rubro, valor, metal, proximo, avance }
  })

  /* Primero los que tienen medalla, de la mas valiosa; despues los mas cerca de la proxima */
  filas.sort((a, b) => {
    const peso = (m: typeof a.metal) => (m ? METALES.indexOf(m) + 1 : 0)
    return peso(b.metal) - peso(a.metal) || b.avance - a.avance
  })

  const conseguidos = filas.filter((f) => f.metal).length

  return (
    <>
      <div className='ojitos-vitrina'>
        {filas.map(({ rubro, valor, metal, proximo, avance }) => (
          <div className={metal ? 'panel ojito-ficha' : 'panel ojito-ficha sin-ojito'} key={rubro.clave}>
            <div className='ojito-ficha-cabecera'>
              {metal
                ? <Ojito metal={metal} />
                : <span className='ojito-vacio' aria-hidden='true' />}
              <div>
                <strong className='ojito-ficha-nombre'>{rubro.nombre}</strong>
                <span className='ojito-ficha-valor numero'>{rubro.formato(valor)}</span>
              </div>
            </div>

            {proximo
              ? (
                <>
                  <div className='ojito-barra'><span style={{ width: `${Math.max(avance, 2)}%` }} /></div>
                  <span className='ojito-falta'>
                    Le falta {rubro.formato(proximo.falta)} para el {NOMBRE_METAL[proximo.metal]}
                  </span>
                </>
                )
              : <span className='ojito-falta completo'>No queda nada por ganar acá</span>}
          </div>
        ))}
      </div>

      <p className='nota'>
        {conseguidos === 0
          ? 'Todavía no llegó a ninguna marca. Los ojitos se cuentan sobre todo lo jugado, así que no hay apuro.'
          : `${conseguidos} de ${RUBROS.length} rubros con ojito. Se cuentan sobre todo lo jugado y no se pierden.`}
      </p>
    </>
  )
}
