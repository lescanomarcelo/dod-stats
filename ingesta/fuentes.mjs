/*
 *  De donde se leen los archivos de eventos.
 *
 *  Las dos fuentes tienen la misma interfaz, asi el ingestor no sabe ni le importa
 *  si esta leyendo del server real por FTP o de una carpeta local en un test:
 *
 *    listar()              -> [{ nombre, tamano }]
 *    leer(nombre, desde)   -> Buffer con los bytes desde "desde" hasta el final
 *    cerrar()
 */

import { readdir, stat, open } from 'node:fs/promises'
import { join } from 'node:path'
import { Writable } from 'node:stream'
import { createHash } from 'node:crypto'
import { Client } from 'basic-ftp'
import SftpClient from 'ssh2-sftp-client'

export const PATRON_ARCHIVO = /^eventos_\d{8}\.tsv$/

/* ------------------------------------------------------------------ */
/*  Carpeta local (tests)                                              */
/* ------------------------------------------------------------------ */

export function crearFuenteLocal (carpeta) {
  return {
    async listar () {
      const nombres = (await readdir(carpeta)).filter((n) => PATRON_ARCHIVO.test(n))
      return Promise.all(nombres.map(async (nombre) =>
        ({ nombre, tamano: (await stat(join(carpeta, nombre))).size })))
    },

    async leer (nombre, desde) {
      const archivo = await open(join(carpeta, nombre), 'r')
      try {
        const { size } = await archivo.stat()
        const largo = Math.max(0, size - desde)
        const buffer = Buffer.alloc(largo)
        if (largo) await archivo.read(buffer, 0, largo, desde)
        return buffer
      } finally {
        await archivo.close()
      }
    },

    async cerrar () {}
  }
}

/* ------------------------------------------------------------------ */
/*  SFTP del server de juego (produccion)                              */
/* ------------------------------------------------------------------ */

/* La cuenta de TCAdmin tiene una carpeta por servicio en la raiz */
const CARPETA_POR_DEFECTO = '45.235.98.67_27017/dod/addons/amxmodx/data/stats'

export function configSftpDesdeEntorno () {
  return {
    host: process.env.SFTP_HOST,
    port: Number(process.env.SFTP_PORT || 8822),
    user: process.env.SFTP_USER,
    password: process.env.SFTP_PASS,
    carpeta: process.env.SFTP_CARPETA || CARPETA_POR_DEFECTO,
    huella: process.env.SFTP_HUELLA || ''
  }
}

const huellaDe = (clave) => 'SHA256:' + createHash('sha256').update(clave).digest('base64').replace(/=+$/, '')

/**
 * SFTP va cifrado: la contrasena del panel no viaja en texto plano.
 *
 * huella: si se define (SFTP_HUELLA), se verifica que el server sea el mismo de
 * siempre y se rechaza la conexion si cambio. Sin ella se acepta el server y la
 * huella queda en fuente.huellaVista para poder fijarla despues.
 */
export async function crearFuenteSftp ({ host, port, user, password, carpeta, huella }) {
  const cliente = new SftpClient()
  let huellaVista = null

  await cliente.connect({
    host,
    port,
    username: user,
    password,
    readyTimeout: 30000,
    hostVerifier: (clave) => {
      huellaVista = huellaDe(clave)
      return !huella || huella === huellaVista
    }
  })

  return {
    get huellaVista () { return huellaVista },

    async listar () {
      const lista = await cliente.list(carpeta)
      return lista
        .filter((f) => f.type === '-' && PATRON_ARCHIVO.test(f.name))
        .map((f) => ({ nombre: f.name, tamano: f.size }))
    },

    /* Lee solo desde "desde": no bajamos el archivo entero en cada pasada */
    async leer (nombre, desde) {
      const partes = []
      const flujo = cliente.createReadStream(`${carpeta}/${nombre}`, { start: desde })
      for await (const trozo of flujo) partes.push(trozo)
      return Buffer.concat(partes)
    },

    async cerrar () { await cliente.end() }
  }
}

/* ------------------------------------------------------------------ */
/*  FTP comun (alternativa, sin cifrar)                                */
/* ------------------------------------------------------------------ */

export function configFtpDesdeEntorno () {
  return {
    host: process.env.FTP_HOST,
    port: Number(process.env.FTP_PORT || 21),
    user: process.env.FTP_USER,
    password: process.env.FTP_PASS,
    carpeta: process.env.FTP_CARPETA || CARPETA_POR_DEFECTO
  }
}

export async function crearFuenteFtp ({ host, port, user, password, carpeta }) {
  const cliente = new Client(30000)
  await cliente.access({ host, port, user, password, secure: false })

  return {
    async listar () {
      const lista = await cliente.list(carpeta)
      return lista
        .filter((f) => f.isFile && PATRON_ARCHIVO.test(f.name))
        .map((f) => ({ nombre: f.name, tamano: f.size }))
    },

    /* Descarga solo lo nuevo: el FTP retoma desde "desde" (comando REST),
       asi no bajamos el archivo entero en cada pasada. */
    async leer (nombre, desde) {
      const partes = []
      const destino = new Writable({
        write (trozo, _codificacion, listo) { partes.push(trozo); listo() }
      })
      await cliente.downloadTo(destino, `${carpeta}/${nombre}`, desde)
      return Buffer.concat(partes)
    },

    async cerrar () { cliente.close() }
  }
}
