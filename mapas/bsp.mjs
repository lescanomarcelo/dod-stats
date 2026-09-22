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
