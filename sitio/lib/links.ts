/*
 *  Links de la comunidad. Para agregar uno: completar url (o sumar un item nuevo).
 *  Los que tienen url: null se muestran como "Próximamente".
 */

export type EnlaceComunidad = {
  nombre: string
  descripcion: string
  url: string | null
  /** Segundo enlace, cuando la descarga viene partida en dos archivos */
  extra?: { texto: string, url: string }
  /** Aclaracion al pie de la tarjeta */
  aviso?: string
}

export type GrupoEnlaces = { titulo: string, enlaces: EnlaceComunidad[] }

export const GRUPOS: GrupoEnlaces[] = [
  {
    titulo: 'Comunidad',
    enlaces: [
      {
        nombre: 'Discord',
        descripcion: 'Para charlar, armar partidas y avisos del server.',
        url: 'https://discord.gg/zSwGqF3'
      },
      {
        nombre: 'Grupo de WhatsApp',
        descripcion: 'El grupo de los que juegan en el server.',
        url: 'https://chat.whatsapp.com/F9FF4Kv7Myj8IO5lVq9Pae',
        aviso: 'Avisale a alguien del server que pediste entrar, así el administrador te acepta la solicitud.'
      }
    ]
  },
  {
    titulo: 'Descargas',
    enlaces: [
      {
        nombre: 'Pack de miras',
        descripcion: 'Miras para el juego.',
        url: 'https://drive.google.com/file/d/1-C7vsBajETziCesJtAVFmtFQA6m3m5Mq/view'
      },
      {
        nombre: 'Pack de mapas',
        descripcion: 'Los mapas del server, para no tener que bajarlos al entrar. Son dos archivos.',
        url: 'https://drive.google.com/file/d/1jBENYPM31YUqcpN_E1INRhJRnPWc0ltx/view?usp=sharing',
        extra: { texto: 'Parte 2', url: 'https://drive.google.com/file/d/1CTzjpRbDBLc33ll-5a_8gEGdBbzO51-j/view?usp=sharing' }
      }
    ]
  },
  {
    titulo: 'El server',
    enlaces: [
      {
        nombre: 'GameTracker',
        descripcion: 'Historial de jugadores y mapas del server.',
        url: 'https://www.gametracker.com/server_info/45.235.98.67:27017/'
      }
    ]
  }
]
