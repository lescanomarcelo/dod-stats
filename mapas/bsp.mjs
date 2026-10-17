/*
 *  Lectura de las entidades de un mapa GoldSrc (.bsp version 30).
 *
 *  El .bsp arranca con la version y una tabla de 15 "lumps" (offset, largo). El
 *  lump 0 es texto plano con todas las entidades del mapa:
 *
 *    { "classname" "info_player_allies" "origin" "-1024 512 64" }
 *
 *  Sirve para validar la conversion de coordenadas: los spawns y las banderas
 *  tienen posiciones reales del mapa, y deben caer sobre zonas dibujadas del overview.
 */

export function leerEntidades (buffer) {
  const version = buffer.readInt32LE(0)
  if (version !== 30) throw new Error(`BSP version ${version}: solo se soporta la 30 (GoldSrc)`)

  const inicio = buffer.readInt32LE(4)
  const largo = buffer.readInt32LE(8)
  const texto = buffer.toString('latin1', inicio, inicio + largo)

  const entidades = []
  for (const bloque of texto.matchAll(/\{([^}]*)\}/g)) {
    const entidad = {}
    for (const [, clave, valor] of bloque[1].matchAll(/"([^"]*)"\s*"([^"]*)"/g)) entidad[clave] = valor
    entidades.push(entidad)
  }
  return entidades
}

/** Entidades con posicion (origin), con las coordenadas ya como numeros */
export function puntosDe (entidades, clases) {
  return entidades
    .filter((e) => clases.includes(e.classname) && e.origin)
    .map((e) => {
      const [x, y, z] = e.origin.trim().split(/\s+/).map(Number)
      return { clase: e.classname, x, y, z }
    })
}

/*
 *  La caja del mundo, para saber de que tamaño es un mapa.
 *
 *  Despues de la version vienen 15 lumps de 8 bytes (offset y largo). El lump 14 es
 *  MODELS, y el modelo 0 es el mundo: arranca con mins[3] y maxs[3], seis floats.
 *
 *  Se lee aparte de leerEntidades() a proposito: asi se puede bajar del server la
 *  cabecera y esos 24 bytes en vez del .bsp entero, que son varios MB por mapa.
 */
export const LARGO_CABECERA = 124
const LUMP_MODELS = 14

/** Donde esta un lump dentro del .bsp, a partir de sus primeros 124 bytes */
export function lumpDe (cabecera, indice) {
  const version = cabecera.readInt32LE(0)
  if (version !== 30) throw new Error(`BSP version ${version}: solo se soporta la 30 (GoldSrc)`)
  return {
    inicio: cabecera.readInt32LE(4 + indice * 8),
    largo: cabecera.readInt32LE(4 + indice * 8 + 4)
  }
}

export const lumpDeModelos = (cabecera) => lumpDe(cabecera, LUMP_MODELS)

/** Ancho, largo y alto del mundo, a partir de los primeros 24 bytes del lump MODELS */
export function cajaDelMundo (modelo) {
  const v = (i) => modelo.readFloatLE(i * 4)
  return {
    ancho: v(3) - v(0),
    largo: v(4) - v(1),
    alto: v(5) - v(2)
  }
}

/** El area del mapa en millones de unidades, que es como se mide su tamaño */
export function areaDelMundo (modelo) {
  const { ancho, largo } = cajaDelMundo(modelo)
  return Math.round((ancho * largo) / 1e6 * 10) / 10
}
