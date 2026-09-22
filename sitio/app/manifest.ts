import type { MetadataRoute } from 'next'

/*
 *  Manifiesto de la web app: con esto el celular la instala como aplicacion (icono
 *  propio, pantalla completa, sin la barra del navegador) en vez de un acceso directo.
 *  Los iconos salen de mapas/iconos.mjs.
 */
export default function manifest (): MetadataRoute.Manifest {
  return {
    name: 'Tributo Server — Estadísticas',
    short_name: 'Tributo Stats',
    description: 'Ranking y estadísticas del server DoD 1.3 :::aU::: Tributo.',
    lang: 'es-AR',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#13150f',
    theme_color: '#13150f',
    icons: [
      { src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }
}
