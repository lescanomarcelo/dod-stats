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

export type Permanencia = { promedio: number, maximo: number }

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

/** Promedio y maximo de duracion (en segundos) de las sesiones que empezaron en cada cubo */
export function permanenciaPorCubo (sesiones: Sesion[], lista: Cubo[]): Permanencia[] {
  return lista.map((cubo) => {
    let suma = 0
    let cuantas = 0
    let maximo = 0
    for (const s of sesiones) {
      if (s.inicio < cubo.desde || s.inicio >= cubo.hasta) continue
      const duracion = Math.max(0, s.fin - s.inicio) / 1000
      suma += duracion
      cuantas++
      if (duracion > maximo) maximo = duracion
    }
    return { promedio: cuantas ? Math.round(suma / cuantas) : 0, maximo: Math.round(maximo) }
  })
}

/** Cuanta gente distinta paso por el server */
export const jugadoresUnicos = (sesiones: Sesion[]) => new Set(sesiones.map((s) => s.jugadorId)).size

/** Promedio y maximo de todas las sesiones juntas */
export function permanenciaTotal (sesiones: Sesion[]): Permanencia {
  if (sesiones.length === 0) return { promedio: 0, maximo: 0 }
  let suma = 0
  let maximo = 0
  for (const s of sesiones) {
    const duracion = Math.max(0, s.fin - s.inicio) / 1000
    suma += duracion
    if (duracion > maximo) maximo = duracion
  }
  return { promedio: Math.round(suma / sesiones.length), maximo: Math.round(maximo) }
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
