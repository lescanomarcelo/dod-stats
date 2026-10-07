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

  return (
    <div className='ojitos-vitrina'>
        {filas.map(({ rubro, valor, metal, proximo, avance }) => (
          <div
            className={metal ? 'panel ojito-ficha' : 'panel ojito-ficha sin-ojito'}
            key={rubro.clave}
            title={proximo
              ? `Le falta ${rubro.formato(proximo.falta)} para el ojito ${NOMBRE_METAL[proximo.metal]}`
              : 'Ya tiene el último escalón de este rubro'}
          >
            <div className='ojito-ficha-cabecera'>
              {metal
                ? <Ojito metal={metal} chico />
                : <span className='ojito-vacio' aria-hidden='true' />}
              <strong className='ojito-ficha-nombre'>{rubro.nombre}</strong>
            </div>

            <span className='ojito-ficha-valor numero'>{rubro.formato(valor)}</span>

            {proximo
              ? (
                <>
                  <div className='ojito-barra'><span style={{ width: `${Math.max(avance, 2)}%` }} /></div>
                  {/* El metal que viene, apagado al final de la barra: se entiende sin leer */}
                  <span className='ojito-falta'>
                    faltan {rubro.formato(proximo.falta)}
                    <Ojito metal={proximo.metal} chico />
                  </span>
                </>
                )
              : <span className='ojito-falta completo'>completo</span>}
          </div>
        ))}
    </div>
  )
}
