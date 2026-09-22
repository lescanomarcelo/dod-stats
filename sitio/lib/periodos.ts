/*
 *  Periodos de calendario para Eje vs Aliados: semana (de lunes a domingo), mes o
 *  todo. Siempre en hora de Argentina (UTC-3, sin horario de verano): la semana
 *  empieza el lunes a las 00:00 de aca, no de Londres.
 *
 *  En la base los momentos estan en UTC. Un rango se expresa como [desde, hasta)
 *  en ISO UTC, listo para pasarlo como parametro al SQL.
 *
 *  Sin dependencias del servidor: se usa en paginas y en tests.
 */

export const PERIODOS = ['dia', 'semana', 'mes', 'global'] as const
export type Periodo = typeof PERIODOS[number]

export type Ventana = { desde: string | null, hasta: string | null }

export type Rango = Ventana & {
  periodo: Periodo
  /** Semana: fecha del lunes (2026-09-14). Mes: 2026-09. Global: null */
  clave: string | null
  etiqueta: string
  /** Clave del periodo anterior y del siguiente. null si no hay (futuro o global) */
  anterior: string | null
  siguiente: string | null
  actual: boolean
}

/* Argentina: UTC-3 todo el año. En SQL es el mismo corrimiento (INTERVAL 3 HOUR) */
export const HORAS_ARGENTINA = -3
const DESFASE = HORAS_ARGENTINA * 3600 * 1000
const DIA = 86400 * 1000

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre']

/* Un Date "corrido" a hora argentina: sus getUTC* dan el calendario de aca */
const aLocal = (d: Date) => new Date(d.getTime() + DESFASE)
/* Medianoche argentina de un dia de calendario, como instante UTC */
const medianoche = (anio: number, mes: number, dia: number) => new Date(Date.UTC(anio, mes, dia) - DESFASE)

const dosCifras = (n: number) => String(n).padStart(2, '0')
const claveDia = (anio: number, mes: number, dia: number) => {
  const d = new Date(Date.UTC(anio, mes, dia))
  return `${d.getUTCFullYear()}-${dosCifras(d.getUTCMonth() + 1)}-${dosCifras(d.getUTCDate())}`
}
const claveMes = (anio: number, mes: number) => {
  const d = new Date(Date.UTC(anio, mes, 1))
  return `${d.getUTCFullYear()}-${dosCifras(d.getUTCMonth() + 1)}`
}

/** Lunes (dia de calendario argentino) de la semana que contiene al instante */
function lunesDe (instante: Date): [number, number, number] {
  const l = aLocal(instante)
  const desdeLunes = (l.getUTCDay() + 6) % 7
  const lunes = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() - desdeLunes))
  return [lunes.getUTCFullYear(), lunes.getUTCMonth(), lunes.getUTCDate()]
}

/** Lee "2026-09-14" o "2026-09" de la URL. Cualquier otra cosa: null */
function leerFecha (texto: unknown): [number, number, number] | null {
  if (typeof texto !== 'string') return null
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(texto)
  if (!m) return null
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 1]
  const d = new Date(Date.UTC(anio, mes, dia))
  /* Rechaza 2026-02-31 y similares en vez de correrlos al mes siguiente */
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes || d.getUTCDate() !== dia) return null
  return [anio, mes, dia]
}

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function etiquetaDia (instante: Date) {
  const d = aLocal(instante)
  return `${DIAS_SEMANA[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
}

function etiquetaSemana (lunes: Date) {
  const domingo = new Date(lunes.getTime() + 6 * DIA)
  const [a, b] = [aLocal(lunes), aLocal(domingo)]
  return a.getUTCMonth() === b.getUTCMonth()
    ? `Semana del ${a.getUTCDate()} al ${b.getUTCDate()} de ${MESES[b.getUTCMonth()]}`
    : `Semana del ${a.getUTCDate()} de ${MESES[a.getUTCMonth()]} al ${b.getUTCDate()} de ${MESES[b.getUTCMonth()]}`
}

/**
 * Rango de un periodo. referencia = la clave de la URL; si falta, es invalida o cae
 * en el futuro, se usa el periodo actual.
 */
export function rangoDe (periodo: Periodo, referencia?: unknown, ahora: Date = new Date()): Rango {
  if (periodo === 'global') {
    return { periodo, desde: null, hasta: null, clave: null, etiqueta: 'Desde el principio', anterior: null, siguiente: null, actual: true }
  }

  const pedida = leerFecha(referencia)

  /*
   *  Dia: por defecto ayer, que es el ultimo dia completo. Con las flechas se llega
   *  hasta hoy (en curso) y hacia atras sin limite.
   */
  if (periodo === 'dia') {
    const l = aLocal(ahora)
    const hoy: [number, number, number] = [l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()]
    const ayer: [number, number, number] = [hoy[0], hoy[1], hoy[2] - 1]
    let [anio, mes, dia] = pedida ?? ayer
    if (medianoche(anio, mes, dia) > medianoche(...hoy)) [anio, mes, dia] = hoy
    const desde = medianoche(anio, mes, dia)
    const esHoy = desde.getTime() === medianoche(...hoy).getTime()
    const esAyer = desde.getTime() === medianoche(...ayer).getTime()
    return {
      periodo,
      desde: desde.toISOString(),
      hasta: medianoche(anio, mes, dia + 1).toISOString(),
      clave: claveDia(anio, mes, dia),
      etiqueta: esHoy ? 'Hoy' : esAyer ? 'Ayer' : etiquetaDia(desde),
      anterior: claveDia(anio, mes, dia - 1),
      siguiente: esHoy ? null : claveDia(anio, mes, dia + 1),
      actual: esHoy
    }
  }

  if (periodo === 'semana') {
    const actual = lunesDe(ahora)
    let [anio, mes, dia] = pedida ? lunesDe(medianoche(...pedida)) : actual
    if (medianoche(anio, mes, dia) > medianoche(...actual)) [anio, mes, dia] = actual
    const desde = medianoche(anio, mes, dia)
    const esActual = desde.getTime() === medianoche(...actual).getTime()
    return {
      periodo,
      desde: desde.toISOString(),
      hasta: medianoche(anio, mes, dia + 7).toISOString(),
      clave: claveDia(anio, mes, dia),
      etiqueta: etiquetaSemana(desde),
      anterior: claveDia(anio, mes, dia - 7),
      siguiente: esActual ? null : claveDia(anio, mes, dia + 7),
      actual: esActual
    }
  }

  const l = aLocal(ahora)
  const actual: [number, number] = [l.getUTCFullYear(), l.getUTCMonth()]
  let [anio, mes] = pedida ? [pedida[0], pedida[1]] : actual
  if (anio * 12 + mes > actual[0] * 12 + actual[1]) [anio, mes] = actual
  const esActual = anio === actual[0] && mes === actual[1]
  const nombre = MESES[mes]
  return {
    periodo,
    desde: medianoche(anio, mes, 1).toISOString(),
    hasta: medianoche(anio, mes + 1, 1).toISOString(),
    clave: claveMes(anio, mes),
    etiqueta: `${nombre[0].toUpperCase()}${nombre.slice(1)} de ${anio}`,
    anterior: claveMes(anio, mes - 1),
    siguiente: esActual ? null : claveMes(anio, mes + 1),
    actual: esActual
  }
}

/** Periodo que pide la URL: ?periodo=dia|semana|mes|global y ?fecha=2026-09-21 */
export function rangoDesdeBusqueda (busqueda: Record<string, string | string[] | undefined>): Rango {
  const periodo = PERIODOS.find((x) => x === busqueda.periodo) ?? 'global'
  return rangoDe(periodo, busqueda.fecha)
}

/** Claves de las ultimas n semanas o meses, de la mas vieja a la actual */
export function ultimosPeriodos (tipo: 'semana' | 'mes', cantidad: number, ahora: Date = new Date()): string[] {
  if (tipo === 'semana') {
    const [anio, mes, dia] = lunesDe(ahora)
    return Array.from({ length: cantidad }, (_, i) => claveDia(anio, mes, dia - 7 * (cantidad - 1 - i)))
  }
  const l = aLocal(ahora)
  return Array.from({ length: cantidad }, (_, i) => claveMes(l.getUTCFullYear(), l.getUTCMonth() - (cantidad - 1 - i)))
}

/** Etiqueta corta para el eje de un grafico: "14/9" o "sep" (con el año en enero) */
export function etiquetaCorta (tipo: 'semana' | 'mes', clave: string): string {
  const [anio, mes, dia] = clave.split('-').map(Number)
  if (tipo === 'semana') return `${dia}/${mes}`
  const nombre = MESES[mes - 1].slice(0, 3)
  return mes === 1 ? `${nombre} ${String(anio).slice(2)}` : nombre
}

/** Nombre largo de una semana o mes a partir de su clave */
export function nombrePeriodo (tipo: 'semana' | 'mes', clave: string): string {
  const [anio, mes, dia] = clave.split('-').map(Number)
  if (tipo === 'semana') return etiquetaSemana(medianoche(anio, mes - 1, dia))
  return `${MESES[mes - 1]} de ${anio}`
}

/* ------------------------------------------------------------------ */
/*  Quien gano                                                         */
/* ------------------------------------------------------------------ */

export type Balance = {
  partidas: number
  ganadosAliados: number
  ganadosEje: number
  puntosAliados: number
  puntosEje: number
  killsAliados: number
  killsEje: number
}

export type Veredicto = {
  /** 1 aliados, 2 eje, 0 empate, null sin datos */
  ganador: 1 | 2 | 0 | null
  /** Por que se decidio: mapas ganados (con el marcador) o kills si no hay marcadores */
  segun: 'mapas' | 'puntos' | 'kills' | null
  /** -1 (todo Eje) a 1 (todo Aliados): la ventaja, para la altura de la barra */
  margen: number
}

const signo = (a: number, b: number): 1 | 2 | 0 => (a > b ? 1 : b > a ? 2 : 0)
const proporcion = (a: number, b: number) => (a + b > 0 ? (a - b) / (a + b) : 0)

/**
 * Gana el bando que gano mas mapas; si empatan en mapas, el que sumo mas puntos en
 * el marcador. Las kills solo deciden cuando todavia no hay marcadores registrados
 * (antes de la version 0.3 del plugin).
 */
export function veredicto (b: Balance): Veredicto {
  if (b.partidas > 0) {
    const porMapas = signo(b.ganadosAliados, b.ganadosEje)
    if (porMapas !== 0) return { ganador: porMapas, segun: 'mapas', margen: proporcion(b.ganadosAliados, b.ganadosEje) }
    return { ganador: signo(b.puntosAliados, b.puntosEje), segun: 'puntos', margen: proporcion(b.puntosAliados, b.puntosEje) }
  }
  if (b.killsAliados + b.killsEje > 0) {
    return { ganador: signo(b.killsAliados, b.killsEje), segun: 'kills', margen: proporcion(b.killsAliados, b.killsEje) }
  }
  return { ganador: null, segun: null, margen: 0 }
}
