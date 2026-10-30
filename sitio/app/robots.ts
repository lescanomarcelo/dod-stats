import type { MetadataRoute } from 'next'
import { SITIO } from '@/lib/enlaces'

/*
 *  Que pueden recorrer los buscadores.
 *
 *  El sitio tiene dos trampas para un crawler, y las dos salen caras porque cada
 *  URL distinta es una invocacion nueva en Vercel:
 *
 *  1. Las flechas de periodo van hacia atras sin limite (lib/periodos.ts). Un
 *     crawler que las sigue nunca llega al final: siempre hay un dia anterior.
 *  2. /comparar multiplica eso por cada par de jugadores. Con 330 doderos son
 *     decenas de miles de combinaciones, todas con su propio historico infinito.
 *
 *  Por eso se bloquea /comparar entero y, en el resto del sitio, cualquier URL
 *  con fecha. Las paginas que importan para buscar el sitio —el ranking, las
 *  armas, los mapas, el perfil de cada dodero— quedan abiertas en su version
 *  actual, que es la que alguien querria encontrar.
 */
export default function robots (): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/comparar',
        '/*?*fecha=',
        '/*?*periodo=',
        '/api/'
      ]
    },
    host: SITIO
  }
}
