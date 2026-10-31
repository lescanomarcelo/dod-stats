import { formatoNumero, formatoTiempo } from './calculos.ts'

/*
 *  El medallero dodero: ojitos por lo acumulado de toda la historia, al estilo de los
 *  logros de Steam. Cada rubro tiene sus marcas y el que las alcanza se lleva el ojito
 *  del metal que corresponda. No hay plazo: una vez conseguido, no se pierde.
 *
 *  Los metales son una LISTA y no tres campos fijos a proposito: cuando el oro se
 *  empiece a repartir se va a sumar otro escalon mas duro (titanio, y lo que venga),
 *  y eso tiene que ser una linea aca y una imagen mas, nada de rehacer las consultas.
 */

/** Del mas facil al mas dificil. Sumar un metal nuevo es agregarlo al final. */
export const METALES = ['bronce', 'plata', 'oro'] as const

export type Metal = typeof METALES[number]

/** Cuanto hay que juntar para ganarse ese metal en un rubro */
export type Escalon = { metal: Metal, marca: number }

export type ClaveRubro =
  | 'kills' | 'muertes' | 'banderas' | 'headshots' | 'melee'
  | 'granadas' | 'sniper' | 'cohete' | 'teamkills' | 'horas' | 'acostado'

export type RubroMedalla = {
  clave: ClaveRubro
  nombre: string
  /** Que se cuenta, dicho para el que lo lee en el sitio */
  detalle: string
  /** Como se muestra el numero: a secas o como tiempo */
  formato: (v: number) => string
  /** De menor a mayor. Siempre ordenados: de eso dependen medallaDe() y proximoEscalon() */
  escalones: Escalon[]
}

const marcas = (bronce: number, plata: number, oro: number): Escalon[] => [
  { metal: 'bronce', marca: bronce },
  { metal: 'plata', marca: plata },
  { metal: 'oro', marca: oro }
]

const HORA = 3600

/*
 *  Las marcas se calibraron contra los datos del 22/9 al 6/10 de 2026 y se revisaron
 *  el 31/10 con 40 dias cargados. Como los totales solo crecen, con los meses se van
 *  aflojando solas: el bronce ya paso de dos-a-ocho doderos por rubro a ocho-a-25, y
 *  esta bien que asi sea. No se suben: subir una marca le saca la medalla a alguien
 *  que ya la tiene, que es peor que un bronce generoso.
 *
 *  En esa revision el oro seguia en cero en los once rubros, pero no porque fuera
 *  inalcanzable: al ritmo de cada lider van cayendo escalonados a lo largo de unos
 *  ocho meses, de a uno, que es justo lo que se quiere.
 *
 *  Ojo con compararlas con los numeros de antes del 25/10: desde entonces lo jugado
 *  en gungame no cuenta, asi que todos los totales bajaron un poco. Las banderas son
 *  las mas afectadas (un 11% menos), o sea que el Abanderado quedo de hecho algo mas
 *  dificil de lo que se penso al calibrarlo.
 */
export const RUBROS: RubroMedalla[] = [
  {
    clave: 'kills',
    nombre: 'Matador',
    detalle: 'Kills, sin contar los teamkills',
    formato: formatoNumero,
    escalones: marcas(1500, 5000, 10000)
  },
  {
    clave: 'muertes',
    nombre: 'Carne de cañón',
    detalle: 'Veces que te mataron',
    formato: formatoNumero,
    escalones: marcas(1500, 5000, 10000)
  },
  {
    clave: 'banderas',
    nombre: 'Abanderado',
    detalle: 'Banderas tomadas',
    formato: formatoNumero,
    escalones: marcas(300, 1000, 5000)
  },
  {
    clave: 'headshots',
    nombre: 'A la cabeza',
    detalle: 'Kills de un tiro a la cabeza',
    formato: formatoNumero,
    escalones: marcas(250, 1000, 5000)
  },
  {
    clave: 'melee',
    nombre: 'Cuerpo a cuerpo',
    detalle: 'Kills con pala, cuchillo, bayoneta o culatazo',
    formato: formatoNumero,
    escalones: marcas(50, 300, 1000)
  },
  {
    clave: 'granadas',
    nombre: 'Granadero',
    detalle: 'Kills con granadas',
    formato: formatoNumero,
    escalones: marcas(250, 1500, 5000)
  },
  {
    clave: 'sniper',
    nombre: 'Con mira',
    detalle: 'Kills con Springfield, K98 con mira o Enfield con mira',
    formato: formatoNumero,
    escalones: marcas(150, 1000, 3000)
  },
  {
    clave: 'cohete',
    nombre: 'Cohetero',
    detalle: 'Kills con bazooka, Panzerschreck o PIAT',
    formato: formatoNumero,
    escalones: marcas(10, 100, 500)
  },
  {
    clave: 'teamkills',
    nombre: 'Fuego amigo',
    detalle: 'Compañeros que te llevaste puestos',
    formato: formatoNumero,
    escalones: marcas(100, 300, 1000)
  },
  {
    clave: 'horas',
    nombre: 'Veterano',
    detalle: 'Tiempo en un bando, jugando de verdad',
    formato: formatoTiempo,
    escalones: marcas(15 * HORA, 50 * HORA, 250 * HORA)
  },
  {
    clave: 'acostado',
    nombre: 'Kenny',
    detalle: 'Tiempo acostado',
    formato: formatoTiempo,
    /*
     *  El oro bajo de 50h a 25h en la revision del 31/10. Con el lider en 7,3h en 40
     *  dias, 50h eran unos ocho meses: mas del doble que el Veterano, que es el
     *  segundo mas largo. En proporcion al ritmo real era el doble de duro que
     *  cualquier otro rubro. Bajarlo no le saco la medalla a nadie, porque no la
     *  tenia nadie.
     */
    escalones: marcas(1 * HORA, 10 * HORA, 25 * HORA)
  }
]

export const rubroDeMedalla = (clave: ClaveRubro): RubroMedalla =>
  RUBROS.find((r) => r.clave === clave)!

/** Lo acumulado de un dodero en cada rubro */
export type TotalesDeMedallas = Record<ClaveRubro, number>

/** El metal mas alto que alcanzo ese numero, o null si no llego ni al primero */
export function medallaDe (valor: number, escalones: Escalon[]): Metal | null {
  let ganada: Metal | null = null
  for (const escalon of escalones) {
    if (valor >= escalon.marca) ganada = escalon.metal
  }
  return ganada
}

/** El escalon que sigue, con lo que falta. null si ya tiene el ultimo */
export function proximoEscalon (valor: number, escalones: Escalon[]): (Escalon & { falta: number }) | null {
  const siguiente = escalones.find((e) => valor < e.marca)
  return siguiente ? { ...siguiente, falta: siguiente.marca - valor } : null
}

export type MedallaGanada = { clave: ClaveRubro, metal: Metal, valor: number }

/** Las medallas de un dodero, de la mas valiosa a la menos */
export function medallasDe (totales: Partial<TotalesDeMedallas>): MedallaGanada[] {
  const ganadas: MedallaGanada[] = []

  for (const rubro of RUBROS) {
    const valor = totales[rubro.clave] ?? 0
    const metal = medallaDe(valor, rubro.escalones)
    if (metal) ganadas.push({ clave: rubro.clave, metal, valor })
  }

  return ganadas.sort((a, b) => METALES.indexOf(b.metal) - METALES.indexOf(a.metal))
}

export type Cuenta = Record<Metal, number>

export function contarMedallas (ganadas: MedallaGanada[]): Cuenta {
  const cuenta = Object.fromEntries(METALES.map((m) => [m, 0])) as Cuenta
  for (const g of ganadas) cuenta[g.metal]++
  return cuenta
}

/**
 * Para ordenar el medallero: primero el que tiene mas del metal mas valioso, y si
 * empatan se mira el que sigue. Dos oros le ganan a un oro y diez bronces.
 */
export function compararCuentas (a: Cuenta, b: Cuenta): number {
  for (const metal of [...METALES].reverse()) {
    if (b[metal] !== a[metal]) return b[metal] - a[metal]
  }
  return 0
}
