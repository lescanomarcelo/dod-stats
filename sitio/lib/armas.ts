/*
 *  Catalogo de armas de Day of Defeat 1.3.
 *
 *  El juego nombra a la misma arma de varias maneras: como llega en la muerte
 *  ("K98", "scoped K98", ".30 cal"), como se llamaba en los logs viejos ("kar",
 *  "scopedkar", "30cal") y como se llama su sprite. Cada entrada junta todos esos
 *  nombres, el nombre lindo para mostrar, el bando y el dibujo.
 *
 *  Sirve para dos cosas: traducir cualquier nombre que venga de la base, y listar
 *  TODAS las armas del juego aunque todavia nadie haya matado con alguna (la
 *  bazooka o el Panzerschreck aparecen igual, con sus kills en cero).
 *
 *  Los dibujos salen de los sprites del juego (mapas/armas-imagenes.mjs).
 */

export type Bando = 'aliados' | 'eje' | 'ambos'

export type Arma = {
  /** Nombre para mostrar */
  nombre: string
  /** El dibujo en public/armas/<sprite>.webp, o null si no hay */
  sprite: string | null
  bando: Bando
  /** Todos los nombres con los que puede llegar de la base, en minuscula */
  alias: string[]
}

export const CATALOGO: Arma[] = [
  /* Aliados */
  { nombre: 'M1 Garand', sprite: 'garand', bando: 'aliados', alias: ['garand', 'm1 garand'] },
  { nombre: 'Culatazo M1 Garand', sprite: 'garand', bando: 'aliados', alias: ['garand butt', 'garandbutt'] },
  { nombre: 'M1 Carbine', sprite: 'm1carbine', bando: 'aliados', alias: ['m1 carbine', 'm1carbine', 'carbine'] },
  { nombre: 'Thompson', sprite: 'thompson', bando: 'aliados', alias: ['thompson'] },
  { nombre: 'M3 Grease Gun', sprite: 'greasegun', bando: 'aliados', alias: ['greasegun', 'grease gun', 'm3'] },
  { nombre: 'BAR', sprite: 'bar', bando: 'aliados', alias: ['bar'] },
  { nombre: 'Springfield', sprite: 'spring', bando: 'aliados', alias: ['springfield', 'spring', 'scoped springfield'] },
  { nombre: '.30 cal', sprite: '30cal', bando: 'aliados', alias: ['.30 cal', '30cal', '30 cal'] },
  { nombre: 'Bazooka', sprite: 'bazooka', bando: 'aliados', alias: ['bazooka'] },
  { nombre: 'Colt .45', sprite: 'colt', bando: 'aliados', alias: ['colt', 'colt .45'] },
  { nombre: 'Cuchillo', sprite: 'amerknife', bando: 'aliados', alias: ['knife', 'amerknife', 'cuchillo'] },
  { nombre: 'Granada', sprite: 'handgrenade', bando: 'aliados', alias: ['handgrenade', 'handgrenade_ex', 'grenade'] },

  /* Eje */
  { nombre: 'Kar98k', sprite: 'kar', bando: 'eje', alias: ['k98', 'kar', 'kar98k'] },
  { nombre: 'Bayoneta Kar98k', sprite: 'kar', bando: 'eje', alias: ['k98 bayonet', 'bayonet', 'kar bayonet'] },
  { nombre: 'Kar98k con mira', sprite: 'scopedkar', bando: 'eje', alias: ['scoped k98', 'scopedkar', 'scoped kar'] },
  { nombre: 'Gewehr 43', sprite: 'k43', bando: 'eje', alias: ['k43', 'gewehr 43'] },
  { nombre: 'Culatazo Gewehr 43', sprite: 'k43', bando: 'eje', alias: ['k43 butt', 'k43butt'] },
  { nombre: 'MP40', sprite: 'mp40', bando: 'eje', alias: ['mp40'] },
  { nombre: 'StG 44', sprite: 'mp44', bando: 'eje', alias: ['stg44', 'mp44', 'stg 44'] },
  { nombre: 'FG 42', sprite: 'fg42', bando: 'eje', alias: ['fg42', 'fg 42'] },
  { nombre: 'FG 42 con mira', sprite: 'scopedfg42', bando: 'eje', alias: ['scoped fg42', 'scopedfg42'] },
  { nombre: 'MG 42', sprite: 'mg42', bando: 'eje', alias: ['mg42', 'mg 42'] },
  { nombre: 'MG 34', sprite: 'mg42', bando: 'eje', alias: ['mg34', 'mg 34'] },
  { nombre: 'Panzerschreck', sprite: 'pschreck', bando: 'eje', alias: ['pschreck', 'panzerschreck'] },
  { nombre: 'Luger P08', sprite: 'luger', bando: 'eje', alias: ['luger', 'luger p08'] },
  { nombre: 'Pala', sprite: 'spade', bando: 'eje', alias: ['spade', 'pala'] },
  { nombre: 'Granada de palo', sprite: 'stickgrenade', bando: 'eje', alias: ['stickgrenade', 'stickgrenade_ex'] },

  /* De los dos lados */
  { nombre: 'Mortero', sprite: 'mortar', bando: 'ambos', alias: ['mortar', 'mortero', 'getmortar'] },
  { nombre: 'Caída / mapa', sprite: null, bando: 'ambos', alias: ['world'] }
]

const POR_ALIAS = new Map<string, Arma>()
for (const arma of CATALOGO) {
  for (const alias of arma.alias) POR_ALIAS.set(alias, arma)
}

/** Busca el arma del catalogo que corresponde a un nombre venido de la base */
export function armaDe (nombre: string): Arma | undefined {
  return POR_ALIAS.get(nombre.trim().toLowerCase())
}

/** Nombre lindo. Si el arma no esta en el catalogo, se muestra tal cual vino */
export function nombreDeArma (nombre: string): string {
  return armaDe(nombre)?.nombre ?? nombre
}

/** Ruta de la imagen del arma, o null si no hay dibujo para ella */
export function imagenDeArma (nombre: string): string | null {
  const sprite = armaDe(nombre)?.sprite
  return sprite ? `/armas/${sprite}.webp` : null
}

export const NOMBRE_BANDO: Record<Bando, string> = {
  aliados: 'Aliados',
  eje: 'Eje',
  ambos: 'Los dos'
}
