/*
 *  Deteccion de las partidas de gungame.
 *
 *  En DoD 1.3 cada mapa le da a los aliados UN arsenal: el yanqui (BAR, Garand,
 *  Thompson...) o el britanico (Sten, Bren, Enfield, Webley). Nunca los dos. El
 *  gungame, en cambio, hace pasar a todos por la escalera completa de armas, asi
 *  que aparecen los dos arsenales en la misma partida: imposible en juego normal.
 *
 *  La regla es ese cruce. No usa la cantidad de armas distintas, que a primera
 *  vista parecia servir (las partidas de gg tienen 28-30 contra un promedio de
 *  16,4) pero tiene partidas normales en 22-23: el margen es demasiado flaco.
 *
 *  Los nombres son los que guarda la tabla de muertes, tal como los escribe el
 *  plugin. Si algun dia cambian ahi, hay que cambiarlos aca.
 */

/* Solo britanicas de verdad. OJO: el PIAT NO va, aunque sea britanico: los mapas
   au_gris_torres y au_gris_krafft se lo dan a los aliados en juego normal, asi que
   delataria partidas que no son gungame. */
export const ARSENAL_BRITANICO = [
  'Sten', 'Bren', 'Enfield', 'Enfield bayonet', 'scoped Enfield', 'Webley',
  'brit knife', 'mills bomb'
]

export const ARSENAL_YANQUI = [
  'BAR', 'Garand', 'Garand butt', 'Thompson', 'Greasegun', '.30 cal',
  'Springfield', 'Colt', 'M1 Carbine', 'Folding Carbine'
]

/* Las unicas armas que hace falta mirar: el resto no distingue nada */
export const ARMAS_DELATORAS = [...ARSENAL_BRITANICO, ...ARSENAL_YANQUI]

/*
 *  Cuantas muertes de cada arsenal hacen falta para dar el cruce por bueno. Las
 *  partidas de gungame del historial tienen entre 34 y 56 del arsenal britanico,
 *  asi que tres deja un margen enorme y al mismo tiempo evita que una sola muerte
 *  rara ensucie una partida normal.
 */
export const MINIMO = 3

/*
 *  Una sesion con pocas muertes no dice nada: puede ser un mapa que arranco y lo
 *  cambiaron enseguida. No alcanza para llamarla gungame ni para llamarla normal.
 *  Las de gungame del historial tienen entre 235 y 354 muertes, asi que treinta
 *  deja afuera solo los restos.
 */
export const MUERTES_PARA_JUZGAR = 30

/**
 * Decide si una partida es de gungame a partir de sus muertes por arma.
 * Recibe un objeto { 'Sten': 17, 'BAR': 40, ... } y devuelve true o false.
 */
export function esGungame (muertesPorArma) {
  let britanicas = 0
  let yanquis = 0

  for (const [arma, cantidad] of Object.entries(muertesPorArma ?? {})) {
    const n = Number(cantidad)
    if (!Number.isFinite(n) || n <= 0) continue
    if (ARSENAL_BRITANICO.includes(arma)) britanicas += n
    else if (ARSENAL_YANQUI.includes(arma)) yanquis += n
  }

  return britanicas >= MINIMO && yanquis >= MINIMO
}

/**
 * Separa las sesiones de mapa en las que son gungame y las que no.
 *
 * Recibe las sesiones con su total de muertes y sus muertes por arma:
 *   [{ id, mapa, muertes, armas: { 'Sten': 17, ... } }]
 * y devuelve los ids de las que son gungame, y los mapas que SOLO se jugaron en
 * gungame.
 *
 * Los mapas gg puros hacen falta para las tablas que suman por jugador y mapa
 * (impactos, acostado, jugado): ahi no hay una fila por evento que marcar, asi
 * que lo unico que se puede sacar con certeza es un mapa que nunca se jugo
 * normal. Hoy es el caso de dod_7quick.
 *
 * Para eso, una sesion corta no cuenta como normal: no desmarca el mapa. Si no,
 * un dod_7quick que arranca y lo cambian enseguida le sacaria la marca a todo el
 * historial del mapa.
 */
export function clasificarSesiones (sesiones) {
  const gg = []
  const porMapa = new Map()

  for (const s of sesiones) {
    const esGg = esGungame(s.armas)
    if (esGg) gg.push(s.id)

    const visto = porMapa.get(s.mapa) ?? { gg: 0, normal: 0 }
    if (esGg) visto.gg++
    else if (Number(s.muertes) >= MUERTES_PARA_JUZGAR) visto.normal++
    porMapa.set(s.mapa, visto)
  }

  const mapasPuros = [...porMapa]
    .filter(([, v]) => v.gg > 0 && v.normal === 0)
    .map(([mapa]) => mapa)

  return { gg, mapasPuros }
}
