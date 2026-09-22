/*
 *  Lectura de BMP/TGA y escritura de PNG, sin dependencias.
 *
 *  Los overviews de HL1 son BMP de 8 bits con paleta (a veces TGA). Para el sitio
 *  se convierten a PNG indexado, que conserva la paleta y pesa mucho menos.
 *
 *  Una imagen en memoria es { ancho, alto, indices, paleta } si viene con paleta,
 *  o { ancho, alto, rgba } si es color directo.
 */

import { deflateSync } from 'node:zlib'

/* ------------------------------------------------------------------ */
/*  BMP                                                                */
/* ------------------------------------------------------------------ */

export function leerBmp (b) {
  if (b.toString('ascii', 0, 2) !== 'BM') throw new Error('no es un BMP')

  const inicioPixeles = b.readUInt32LE(10)
  const tamanoCabecera = b.readUInt32LE(14)
  const ancho = b.readInt32LE(18)
  const altoCrudo = b.readInt32LE(22)
  const bits = b.readUInt16LE(28)
  const compresion = b.readUInt32LE(30)
  if (compresion !== 0) throw new Error(`BMP comprimido (${compresion}) no soportado`)

  const alto = Math.abs(altoCrudo)
  const deAbajoHaciaArriba = altoCrudo > 0
  const largoFila = Math.ceil((ancho * bits) / 32) * 4
  const filaEnArchivo = (y) => inicioPixeles + (deAbajoHaciaArriba ? alto - 1 - y : y) * largoFila

  if (bits === 8) {
    const colores = b.readUInt32LE(46) || 256
    const paleta = new Uint8Array(256 * 3)
    for (let i = 0; i < colores; i++) {
      const p = 14 + tamanoCabecera + i * 4           /* BGRA en el archivo */
      paleta[i * 3] = b[p + 2]
      paleta[i * 3 + 1] = b[p + 1]
      paleta[i * 3 + 2] = b[p]
    }
    const indices = new Uint8Array(ancho * alto)
    for (let y = 0; y < alto; y++) {
      b.copy(indices, y * ancho, filaEnArchivo(y), filaEnArchivo(y) + ancho)
    }
    return { ancho, alto, indices, paleta }
  }

  if (bits === 24 || bits === 32) {
    const paso = bits / 8
    const rgba = new Uint8Array(ancho * alto * 4)
    for (let y = 0; y < alto; y++) {
      const fila = filaEnArchivo(y)
      for (let x = 0; x < ancho; x++) {
        const o = fila + x * paso
        const d = (y * ancho + x) * 4
        rgba[d] = b[o + 2]; rgba[d + 1] = b[o + 1]; rgba[d + 2] = b[o]; rgba[d + 3] = 255
      }
    }
    return { ancho, alto, rgba }
  }

  throw new Error(`BMP de ${bits} bits no soportado`)
}

/* ------------------------------------------------------------------ */
/*  TGA (sin comprimir o RLE, color directo)                           */
/* ------------------------------------------------------------------ */

export function leerTga (b) {
  const largoId = b[0]
  const tipo = b[2]
  const ancho = b.readUInt16LE(12)
  const alto = b.readUInt16LE(14)
  const bits = b[16]
  const arribaHaciaAbajo = (b[17] & 0x20) !== 0
  if (![2, 10].includes(tipo) || ![24, 32].includes(bits)) {
    throw new Error(`TGA tipo ${tipo} de ${bits} bits no soportado`)
  }

  const paso = bits / 8
  const pixeles = new Uint8Array(ancho * alto * paso)
  let origen = 18 + largoId

  if (tipo === 2) {
    b.copy(pixeles, 0, origen, origen + pixeles.length)
  } else {
    /* RLE: cada paquete es una cabecera y N pixeles, repetidos o literales */
    let escrito = 0
    while (escrito < pixeles.length) {
      const cabecera = b[origen++]
      const cantidad = (cabecera & 0x7f) + 1
      if (cabecera & 0x80) {
        for (let i = 0; i < cantidad; i++) b.copy(pixeles, escrito + i * paso, origen, origen + paso)
        origen += paso
      } else {
        b.copy(pixeles, escrito, origen, origen + cantidad * paso)
        origen += cantidad * paso
      }
      escrito += cantidad * paso
    }
  }

  const rgba = new Uint8Array(ancho * alto * 4)
  for (let y = 0; y < alto; y++) {
    const yOrigen = arribaHaciaAbajo ? y : alto - 1 - y
    for (let x = 0; x < ancho; x++) {
      const o = (yOrigen * ancho + x) * paso
      const d = (y * ancho + x) * 4
      rgba[d] = pixeles[o + 2]; rgba[d + 1] = pixeles[o + 1]; rgba[d + 2] = pixeles[o]
      rgba[d + 3] = paso === 4 ? pixeles[o + 3] : 255
    }
  }
  return { ancho, alto, rgba }
}

export function leerImagen (buffer, nombre) {
  return /\.tga$/i.test(nombre) ? leerTga(buffer) : leerBmp(buffer)
}

/** Color [r, g, b] de un pixel, venga la imagen con paleta o no */
export function colorEn (img, x, y) {
  const i = y * img.ancho + x
  if (img.indices) {
    const c = img.indices[i] * 3
    return [img.paleta[c], img.paleta[c + 1], img.paleta[c + 2]]
  }
  return [img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2]]
}

export function aRgba (img) {
  if (img.rgba) return img
  const rgba = new Uint8Array(img.ancho * img.alto * 4)
  for (let i = 0; i < img.ancho * img.alto; i++) {
    const c = img.indices[i] * 3
    rgba[i * 4] = img.paleta[c]; rgba[i * 4 + 1] = img.paleta[c + 1]
    rgba[i * 4 + 2] = img.paleta[c + 2]; rgba[i * 4 + 3] = 255
  }
  return { ancho: img.ancho, alto: img.alto, rgba }
}

/* ------------------------------------------------------------------ */
/*  PNG                                                                */
/* ------------------------------------------------------------------ */

const TABLA_CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32 (datos) {
  let c = 0xffffffff
  for (const byte of datos) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function bloque (tipo, datos) {
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length)
  const tipoYDatos = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tipoYDatos))
  return Buffer.concat([largo, tipoYDatos, crc])
}

/** PNG indexado (con paleta) si la imagen tiene paleta; si no, RGBA */
export function escribirPng (img) {
  const indexado = Boolean(img.indices)
  const bytesPorPixel = indexado ? 1 : 4
  const cabecera = Buffer.alloc(13)
  cabecera.writeUInt32BE(img.ancho, 0)
  cabecera.writeUInt32BE(img.alto, 4)
  cabecera[8] = 8                        /* bits por canal */
  cabecera[9] = indexado ? 3 : 6         /* 3 = paleta, 6 = RGBA */

  /* Cada fila lleva un byte de filtro adelante (0 = sin filtro) */
  const crudo = Buffer.alloc((img.ancho * bytesPorPixel + 1) * img.alto)
  const fuente = indexado ? img.indices : img.rgba
  for (let y = 0; y < img.alto; y++) {
    const destino = y * (img.ancho * bytesPorPixel + 1)
    crudo[destino] = 0
    crudo.set(fuente.subarray(y * img.ancho * bytesPorPixel, (y + 1) * img.ancho * bytesPorPixel), destino + 1)
  }

  const partes = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', cabecera)
  ]
  if (indexado) partes.push(bloque('PLTE', Buffer.from(img.paleta)))
  partes.push(bloque('IDAT', deflateSync(crudo, { level: 9 })), bloque('IEND', Buffer.alloc(0)))
  return Buffer.concat(partes)
}
