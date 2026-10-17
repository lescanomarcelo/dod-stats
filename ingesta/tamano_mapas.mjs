/*
 *  De que tamaño es cada mapa, para repartir las tres votaciones.
 *
 *  El tamaño sale del propio .bsp: la caja del mundo (el lump MODELS trae el mins y
 *  el maxs del modelo 0). El area es ancho x largo en unidades del mundo de HL1,
 *  expresada en millones para que los numeros sean manejables.
 *
 *  Dos caminos que NO sirven, por si a alguien se le ocurren de nuevo:
 *
 *    - Contar los spawns (info_player_allies / info_player_axis). Parece lo obvio y
 *      esta mal: au_3v3_ctf, que es de 3 contra 3 por su propio nombre, tiene 30.
 *      Los mapeadores los ponen de sobra.
 *    - El zoom del overview. Discrimina bien, pero solo 59 de los 83 mapas traen
 *      overview, y justo los au_*, los mas jugados, no tienen.
 *
 *  Los cortes en 10 y 25 dejan los tres grupos parejos (24 / 29 / 30 sobre los 83 de
 *  maps.ini) y caen en huecos naturales de la distribucion. Contrastado con lo que se
 *  juega: dod_orange_ctf (8,1, el mas jugado) queda chico y se juega con unas 11
 *  personas; au_gris_torres (10,7) mediano con 14; dod_clash_v3 (64) grande con 21.
 */

/** Hasta cuantos millones de unidades llega cada tamaño */
export const UMBRALES = { chico: 10, mediano: 25 }

export const TAMANOS = ['chico', 'mediano', 'grande']

/** Para cuanta gente va bien cada tamaño. Es lo que se muestra en cada votacion. */
export const JUGADORES = { chico: 10, mediano: 16, grande: 24 }

/**
 * El tamaño que le corresponde a un area (en millones de unidades).
 * Devuelve null si el area no es un numero valido: un mapa sin medir no se clasifica
 * solo, mejor que quede afuera a que caiga en el grupo equivocado.
 */
export function tamanoDe (area) {
  const n = Number(area)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n <= UMBRALES.chico) return 'chico'
  if (n <= UMBRALES.mediano) return 'mediano'
  return 'grande'
}
