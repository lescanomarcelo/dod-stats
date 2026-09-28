/*
 *  Grafico de columnas, sin librerias: divs con la altura en porcentaje.
 *
 *  Cada columna puede llevar dos valores: el principal (barra llena) y uno de fondo
 *  mas apagado detras, para poner el maximo atras del promedio en el mismo grafico.
 *
 *  Las etiquetas del eje se saltean cuando hay muchas columnas: con 30 dias no
 *  entran las 30 fechas en un celular.
 */

export type Columna = {
  clave: string
  etiqueta: string
  valor: number
  /** Valor de referencia que se dibuja detras (el maximo, por ejemplo) */
  fondo?: number
}

type Props = {
  columnas: Columna[]
  /** Como se escribe un valor en el globito: por defecto el numero tal cual */
  formato?: (valor: number) => string
  leyenda?: { valor: string, fondo?: string }
  vacio?: string
}

export function Columnas ({ columnas, formato = (v) => String(v), leyenda, vacio = 'Sin datos todavía.' }: Props) {
  const maximo = Math.max(...columnas.map((c) => Math.max(c.valor, c.fondo ?? 0)), 0)
  if (columnas.length === 0 || maximo === 0) return <p className='vacio'>{vacio}</p>

  /* Con pocas columnas se muestran todas las etiquetas; con muchas, una cada tantas */
  const paso = columnas.length <= 16 ? 1 : Math.ceil(columnas.length / 12)
  const alto = (valor: number) => `${(valor / maximo) * 100}%`

  return (
    <div className='grafico'>
      {leyenda && (
        <div className='grafico-leyenda'>
          <span className='marca valor' />{leyenda.valor}
          {leyenda.fondo && <><span className='marca fondo' />{leyenda.fondo}</>}
        </div>
      )}

      <div className='grafico-pista'>
        {columnas.map((c) => (
          <div
            className='grafico-columna'
            key={c.clave}
            title={c.fondo === undefined
              ? `${c.etiqueta}: ${formato(c.valor)}`
              : `${c.etiqueta}: ${formato(c.valor)} (máx. ${formato(c.fondo)})`}
          >
            {c.fondo !== undefined && <span className='grafico-barra fondo' style={{ height: alto(c.fondo) }} />}
            <span className='grafico-barra' style={{ height: alto(c.valor) }} />
          </div>
        ))}
      </div>

      <div className='grafico-eje' aria-hidden='true'>
        {columnas.map((c, i) => <span key={c.clave}>{i % paso === 0 ? c.etiqueta : ''}</span>)}
      </div>
    </div>
  )
}
