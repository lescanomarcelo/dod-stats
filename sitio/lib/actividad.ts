import { HORAS_ARGENTINA, type Periodo } from './periodos.ts'

/*
 *  Actividad del server a lo largo del tiempo, para los graficos de "El Server".
 *
 *  Todo se parte en "cubos": una hora, un dia o un mes de calendario argentino,
 *  segun el periodo que se este mirando. Un dia se mira hora por hora; una semana o
 *  un mes, dia por dia; todo el historico, mes por mes.
 *
 *  De cada sesion (una conexion completa: cuando se fue y cuanto duro) salen dos
 *  cosas distintas:
 *
 *    - cuanta gente hubo en cada cubo: cuenta a cada jugador cuya sesion PISA ese
 *      cubo, asi el que entro a las 21:40 y se fue a las 23:10 aparece en las tres
 *      horas y no solo en una.
 *    - cuanto se quedaron: el promedio y el maximo de las sesiones que EMPEZARON en
 *      ese cubo (una sesion dura lo que dura; repartirla entre cubos no significaria
 *      nada).
 *
 *  Sin dependencias del servidor ni de la base: funciones puras, faciles de testear.
 */

export type Escala = 'hora' | 'dia' | 'mes'

/** Una conexion completa. inicio y fin en milisegundos (epoch). */
export type Sesion = { jugadorId: number, inicio: number, fin: number }

export type Cubo = { clave: string, etiqueta: string, desde: number, hasta: number }

/*
 *  Cuanto se queda la gente. El promedio solo miente: hay muchisimas conexiones de
 *  un minuto -entra, ve que esta vacio o no le gusta el mapa y se va- que lo tiran
 *  abajo. La MEDIANA aguanta eso: es lo que dura la conexion del medio, asi que
 *  cien pasadas fugaces no la mueven.
 */
export type Permanencia = { mediana: number, promedio: number, maximo: number, cuantas: number }

/* A partir de cuantos jugadores a la vez consideramos que el server esta movido */
export const SERVER_MOVIDO = 8

/* Una conexion mas corta que esto es una pasada, no una visita */
export const SEGUNDOS_FUGAZ = 5 * 60

const DESFASE = HORAS_ARGENTINA * 3600 * 1000
const HORA = 3600 * 1000

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/* Tope de columnas: un grafico con mil barras no se lee y ademas seria lento */
export const MAX_CUBOS = 400

/** Con que escala se mira cada periodo */
export function escalaDe (periodo: Periodo): Escala {
  if (periodo === 'dia') return 'hora'
  if (periodo === 'global') return 'mes'
  return 'dia'
}

export const NOMBRE_ESCALA: Record<Escala, string> = { hora: 'hora', dia: 'día', mes: 'mes' }

/* Los getUTC* de este Date dan el calendario argentino */
const aLocal = (ms: number) => new Date(ms + DESFASE)
const dosCifras = (n: number) => String(n).padStart(2, '0')

/** Comienzo del cubo que contiene al instante, como epoch en ms */
function comienzoDe (escala: Escala, ms: number): number {
  if (escala === 'hora') return Math.floor(ms / HORA) * HORA
  const l = aLocal(ms)
  return escala === 'dia'
    ? Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - DESFASE
    : Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - DESFASE
}

/** Comienzo del cubo siguiente */
function siguienteDe (escala: Escala, ms: number): number {
  if (escala === 'hora') return ms + HORA
  const l = aLocal(ms)
  return escala === 'dia'
    ? Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() + 1) - DESFASE
    : Date.UTC(l.getUTCFullYear(), l.getUTCMonth() + 1, 1) - DESFASE
}

function etiquetaDe (escala: Escala, ms: number): string {
  const l = aLocal(ms)
  if (escala === 'hora') return `${dosCifras(l.getUTCHours())}h`
  if (escala === 'dia') return `${l.getUTCDate()}/${l.getUTCMonth() + 1}`
  const nombre = MESES_CORTOS[l.getUTCMonth()]
  return l.getUTCMonth() === 0 ? `${nombre} ${String(l.getUTCFullYear()).slice(2)}` : nombre
}

function claveDe (escala: Escala, ms: number): string {
  const l = aLocal(ms)
  const dia = `${l.getUTCFullYear()}-${dosCifras(l.getUTCMonth() + 1)}-${dosCifras(l.getUTCDate())}`
  if (escala === 'hora') return `${dia} ${dosCifras(l.getUTCHours())}`
  if (escala === 'dia') return dia
  return `${l.getUTCFullYear()}-${dosCifras(l.getUTCMonth() + 1)}`
}

/**
 * Los cubos que cubren [desde, hasta). Si el rango es mas largo de lo que aguanta
 * la escala, se corta en MAX_CUBOS: mejor un grafico incompleto que uno ilegible.
 */
export function cubos (escala: Escala, desde: number, hasta: number): Cubo[] {
  const lista: Cubo[] = []
  let inicio = comienzoDe(escala, desde)
  while (inicio < hasta && lista.length < MAX_CUBOS) {
    const fin = siguienteDe(escala, inicio)
    lista.push({ clave: claveDe(escala, inicio), etiqueta: etiquetaDe(escala, inicio), desde: inicio, hasta: fin })
    inicio = fin
  }
  return lista
}

/** Cuantos jugadores distintos estuvieron conectados en cada cubo */
export function jugadoresPorCubo (sesiones: Sesion[], lista: Cubo[]): number[] {
  return lista.map((cubo) => {
    const vistos = new Set<number>()
    for (const s of sesiones) {
      if (s.inicio < cubo.hasta && s.fin > cubo.desde) vistos.add(s.jugadorId)
    }
    return vistos.size
  })
}

/*
 *  De sesiones a VISITAS.
 *
 *  Al cambiar de mapa, Half-Life desconecta y reconecta a todos: el plugin ve el
 *  corte y escribe una sesion por mapa. Medir "cuanto se queda la gente" con eso
 *  daba la duracion de un mapa (unos 8 minutos), no la de la visita.
 *
 *  Por eso se pegan las sesiones seguidas del mismo jugador: si volvio dentro de
 *  HUECO_MISMA_VISITA, es el mismo rato. En los datos reales el 81% de los huecos
 *  entre sesiones de un jugador son de menos de 30 segundos -la reconexion del
 *  cambio de mapa-, y el resto salta a horas: no hay zona gris.
 */
export const HUECO_MISMA_VISITA = 2 * 60 * 1000

export function visitas (sesiones: Sesion[], hueco = HUECO_MISMA_VISITA): Sesion[] {
  const porJugador = new Map<number, Sesion[]>()
  for (const s of sesiones) {
    const suyas = porJugador.get(s.jugadorId)
    if (suyas) suyas.push(s)
    else porJugador.set(s.jugadorId, [s])
  }

  const salida: Sesion[] = []
  for (const [jugadorId, suyas] of porJugador) {
    let actual: Sesion | null = null
    for (const s of [...suyas].sort((a, b) => a.inicio - b.inicio)) {
      if (actual && s.inicio - actual.fin <= hueco) {
        actual.fin = Math.max(actual.fin, s.fin)
        continue
      }
      if (actual) salida.push(actual)
      actual = { jugadorId, inicio: s.inicio, fin: s.fin }
    }
    if (actual) salida.push(actual)
  }
  return salida.sort((a, b) => a.inicio - b.inicio)
}

/** Duracion de una sesion, en segundos */
const duracionDe = (s: Sesion) => Math.max(0, s.fin - s.inicio) / 1000

/** El valor del medio. Con cantidad par, el promedio de los dos del medio. */
export function mediana (valores: number[]): number {
  if (valores.length === 0) return 0
  const orden = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(orden.length / 2)
  return Math.round(orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2)
}

/** Mediana, promedio y maximo de una lista de duraciones */
function resumirDuraciones (duraciones: number[]): Permanencia {
  if (duraciones.length === 0) return { mediana: 0, promedio: 0, maximo: 0, cuantas: 0 }
  const suma = duraciones.reduce((a, b) => a + b, 0)
  return {
    mediana: mediana(duraciones),
    promedio: Math.round(suma / duraciones.length),
    maximo: Math.round(Math.max(...duraciones)),
    cuantas: duraciones.length
  }
}

/** Cuanto se quedaron los que EMPEZARON en cada cubo */
export function permanenciaPorCubo (sesiones: Sesion[], lista: Cubo[]): Permanencia[] {
  return lista.map((cubo) => resumirDuraciones(
    sesiones.filter((s) => s.inicio >= cubo.desde && s.inicio < cubo.hasta).map(duracionDe)))
}

/**
 * Cuanta gente habia en el server justo cuando empezo cada sesion (contandola a
 * ella). Se recorre la linea de tiempo una sola vez, asi que aguanta miles de
 * sesiones sin ponerse lento.
 */
export function concurrenciaAlEmpezar (sesiones: Sesion[]): number[] {
  const eventos: { ms: number, tipo: 1 | -1, i: number }[] = []
  sesiones.forEach((s, i) => {
    eventos.push({ ms: s.inicio, tipo: 1, i })
    eventos.push({ ms: s.fin, tipo: -1, i: -1 })
  })
  /* En el mismo instante, primero los que se van: el que entra justo cuando otro sale no se cruza con el */
  eventos.sort((a, b) => a.ms - b.ms || a.tipo - b.tipo)

  const salida = new Array(sesiones.length).fill(0)
  let activos = 0
  for (const e of eventos) {
    activos += e.tipo
    if (e.tipo === 1) salida[e.i] = activos
  }
  return salida
}

/** Cuanta gente llego a haber a la vez en el server */
export function picoSimultaneo (sesiones: Sesion[]): number {
  return Math.max(0, ...concurrenciaAlEmpezar(sesiones))
}

/** Cuanto se quedan los que entran con el server movido (SERVER_MOVIDO jugadores o mas) */
export function permanenciaConGente (sesiones: Sesion[], umbral = SERVER_MOVIDO): Permanencia {
  const gente = concurrenciaAlEmpezar(sesiones)
  return resumirDuraciones(sesiones.filter((_, i) => gente[i] >= umbral).map(duracionDe))
}

/** Que parte de las conexiones son pasadas de menos de SEGUNDOS_FUGAZ (0 a 1) */
export function proporcionFugaz (sesiones: Sesion[], corte = SEGUNDOS_FUGAZ): number {
  if (sesiones.length === 0) return 0
  return sesiones.filter((s) => duracionDe(s) < corte).length / sesiones.length
}

/** Cuanta gente distinta paso por el server */
export const jugadoresUnicos = (sesiones: Sesion[]) => new Set(sesiones.map((s) => s.jugadorId)).size

/** Mediana, promedio y maximo de todas las sesiones juntas */
export function permanenciaTotal (sesiones: Sesion[]): Permanencia {
  return resumirDuraciones(sesiones.map(duracionDe))
}

/** El cubo con mas jugadores: "la hora pico". null si no hubo nadie nunca. */
export function pico (lista: Cubo[], cantidades: number[]): { etiqueta: string, jugadores: number } | null {
  let mejor = -1
  for (let i = 0; i < lista.length; i++) {
    if (cantidades[i] > 0 && (mejor < 0 || cantidades[i] > cantidades[mejor])) mejor = i
  }
  return mejor < 0 ? null : { etiqueta: lista[mejor].etiqueta, jugadores: cantidades[mejor] }
}

/**
 * Los bordes del grafico. Un periodo de calendario ya los trae; "Global" no tiene
 * ninguno, asi que va desde la sesion mas vieja que haya hasta ahora.
 */
export function bordes (v: { desde: string | null, hasta: string | null }, sesiones: Sesion[], ahora = Date.now()): [number, number] {
  const desde = v.desde ? Date.parse(v.desde) : Math.min(...sesiones.map((s) => s.inicio), ahora)
  const hasta = v.hasta ? Date.parse(v.hasta) : ahora
  return [desde, hasta]
}
