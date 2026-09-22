/*
 *  Links de la comunidad. Para agregar uno: completar url (o sumar un item nuevo).
 *  Los que tienen url: null se muestran como "Próximamente".
 */

export type EnlaceComunidad = {
  nombre: string
  descripcion: string
  url: string | null
}

export type GrupoEnlaces = { titulo: string, enlaces: EnlaceComunidad[] }

export const GRUPOS: GrupoEnlaces[] = [
  {
    titulo: 'Comunidad',
    enlaces: [
      { nombre: 'Discord', descripcion: 'Para charlar, armar partidas y avisos del server.', url: null },
      { nombre: 'Grupo de WhatsApp', descripcion: 'El grupo de los que juegan en el server.', url: null }
    ]
  },
  {
    titulo: 'Descargas',
    enlaces: [
      { nombre: 'Day of Defeat 1.3', descripcion: 'El juego, listo para jugar en el server.', url: null },
      { nombre: 'Pack de mapas', descripcion: 'Los mapas del server, para no tener que bajarlos al entrar.', url: null }
    ]
  },
  {
    titulo: 'El server',
    enlaces: [
      { nombre: 'Entrar al server', descripcion: 'Abre el juego y conecta directo (necesita Steam).', url: 'steam://connect/45.235.98.67:27017' },
      { nombre: 'GameTracker', descripcion: 'Historial de jugadores y mapas del server.', url: 'https://www.gametracker.com/server_info/45.235.98.67:27017/' }
    ]
  }
]
