/*
 *  Las páginas del sitio, en el orden en que se muestran.
 *
 *  Están acá y no en cada componente porque la lista la usan dos lugares: el menú de
 *  las tres rayitas y el pie. Cuando estaban duplicadas, el medallero entró en el pie
 *  y faltó en el menú.
 */
export const SECCIONES = [
  { href: '/', texto: 'Ranking' },
  { href: '/equipos', texto: 'Eje vs Aliados' },
  { href: '/armas', texto: 'Armas' },
  { href: '/comparar', texto: 'Comparar' },
  { href: '/medallas', texto: 'Medallero' },
  { href: '/server', texto: 'El Server' },
  { href: '/links', texto: 'Links' }
] as const
