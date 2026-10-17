/*
 *  Las quincenas de la votación de mapas.
 *
 *  Del 1 al 15 y del 16 a fin de mes. Es la forma más fácil de explicarla ("se
 *  renueva el 1 y el 16") y no depende de cuándo arrancó nada.
 *
 *  Todo se mide en hora de Argentina, que es UTC-3 todo el año: si no, una votación
 *  cerraría a las nueve de la noche del día anterior.
 *
 *  A una quincena la identifica el día en que empieza, como texto 'AAAA-MM-DD'. Eso
 *  es lo que se guarda en la base y lo que ordena bien al compararlo.
 */

import { HORAS_ARGENTINA } from './periodos.ts'

/** El desfase de Argentina en milisegundos (negativo: va atrás de UTC) */
const MS_ARGENTINA = HORAS_ARGENTINA * 3600 * 1000

export type Quincena = {
  /** 'AAAA-MM-DD' del primer día */
  clave: string
  /** Instante UTC en que arranca */
  desde: Date
  /** Instante UTC en que arranca la siguiente */
  hasta: Date
  /** Para mostrar: '1 al 15 de octubre' */
  nombre: string
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

const dosDigitos = (n: number) => String(n).padStart(2, '0')

/** El año, mes (1-12) y día que son en Argentina en ese instante */
function enArgentina (momento: Date) {
  const corrido = new Date(momento.getTime() + MS_ARGENTINA)
  return {
    anio: corrido.getUTCFullYear(),
    mes: corrido.getUTCMonth() + 1,
    dia: corrido.getUTCDate()
  }
}

/** La medianoche argentina de ese día, como instante UTC */
function medianoche (anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes - 1, dia) - MS_ARGENTINA)
}

/** Cuántos días tiene ese mes */
export function diasDelMes (anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

/** La quincena en la que cae ese instante */
export function quincenaDe (momento: Date = new Date()): Quincena {
  const { anio, mes, dia } = enArgentina(momento)
  const primeraMitad = dia <= 15

  const desdeDia = primeraMitad ? 1 : 16
  const desde = medianoche(anio, mes, desdeDia)

  /* La siguiente arranca el 16, o el 1 del mes que viene */
  const hasta = primeraMitad
    ? medianoche(anio, mes, 16)
    : medianoche(mes === 12 ? anio + 1 : anio, mes === 12 ? 1 : mes + 1, 1)

  const ultimoDia = primeraMitad ? 15 : diasDelMes(anio, mes)

  return {
    clave: `${anio}-${dosDigitos(mes)}-${dosDigitos(desdeDia)}`,
    desde,
    hasta,
    nombre: `${desdeDia} al ${ultimoDia} de ${MESES[mes - 1]}`
  }
}

/** La quincena anterior a la de ese instante */
export function quincenaAnterior (momento: Date = new Date()): Quincena {
  const actual = quincenaDe(momento)
  /* Un segundo antes de que arrancara la actual cae en la anterior */
  return quincenaDe(new Date(actual.desde.getTime() - 1000))
}

/** El día argentino de ese instante, como 'AAAA-MM-DD'. Es la unidad del "una vez por día". */
export function diaArgentino (momento: Date = new Date()): string {
  const { anio, mes, dia } = enArgentina(momento)
  return `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`
}

/** Cuánto falta para que cierre la quincena, en texto corto */
export function faltaPara (hasta: Date, ahora: Date = new Date()): string {
  const ms = hasta.getTime() - ahora.getTime()
  if (ms <= 0) return 'cierra en instantes'

  const horas = Math.floor(ms / 3600000)
  if (horas >= 48) return `faltan ${Math.floor(horas / 24)} días`
  if (horas >= 24) return 'falta un día'
  if (horas >= 2) return `faltan ${horas} horas`
  if (horas === 1) return 'falta una hora'
  return `faltan ${Math.max(1, Math.floor(ms / 60000))} minutos`
}
