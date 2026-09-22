/*
 *  Dibujo de cada arma. Las imagenes salen de los sprites del juego
 *  (mapas/armas-imagenes.mjs) y viven en public/armas/<sprite>.webp.
 *
 *  El juego nombra las armas de dos maneras distintas: como llegan en la muerte
 *  ("scoped K98", ".30 cal") y como se llama su sprite ("scopedkar", "30cal").
 *  Esta tabla las relaciona. Lo que no esta en la tabla se muestra sin dibujo.
 */

const SPRITE_DE_ARMA: Record<string, string> = {
  /* Aliados */
  garand: 'garand',
  'garand butt': 'garand',
  thompson: 'thompson',
  bar: 'bar',
  springfield: 'spring',
  spring: 'spring',
  'scoped springfield': 'spring',
  greasegun: 'greasegun',
  'm1 carbine': 'm1carbine',
  m1carbine: 'm1carbine',
  '.30 cal': '30cal',
  '30cal': '30cal',
  colt: 'colt',
  knife: 'amerknife',
  amerknife: 'amerknife',
  bazooka: 'bazooka',
  handgrenade: 'handgrenade',

  /* Eje */
  k98: 'kar',
  kar: 'kar',
  'k98 bayonet': 'kar',
  'scoped k98': 'scopedkar',
  scopedkar: 'scopedkar',
  k43: 'k43',
  'k43 butt': 'k43',
  mp40: 'mp40',
  stg44: 'mp44',
  mp44: 'mp44',
  fg42: 'fg42',
  'scoped fg42': 'scopedfg42',
  mg42: 'mg42',
  mg34: 'mg42',
  luger: 'luger',
  spade: 'spade',
  gerknife: 'gerknife',
  pschreck: 'pschreck',
  panzerschreck: 'pschreck',
  stickgrenade: 'stickgrenade',

  /* De los dos lados */
  mortar: 'mortar'
}

/** Ruta de la imagen del arma, o null si no hay dibujo para ella */
export function imagenDeArma (arma: string): string | null {
  const sprite = SPRITE_DE_ARMA[arma.toLowerCase()]
  return sprite ? `/armas/${sprite}.webp` : null
}
