'use client'

import { useEffect, useRef, useState } from 'react'
import { IconoWhatsApp } from '@/components/Iconos'

type Props = { nombre: string, juego: string, host: string, puerto: number }

const ANCHO = 1080
const MARGEN = 64

/* Arma la tarjeta (banda + datos del server) en un canvas y la devuelve como JPG */
async function tarjeta (banda: HTMLImageElement, { nombre, juego, host, puerto }: Props): Promise<Blob | null> {
  const alto = Math.round(ANCHO * banda.naturalHeight / banda.naturalWidth)
  const filas: [string, string][] = [['Name', nombre], ['Game', juego], ['Address', host], ['Port', String(puerto)]]

  const lienzo = document.createElement('canvas')
  lienzo.width = ANCHO
  lienzo.height = alto + MARGEN + filas.length * 118 + 8
  const c = lienzo.getContext('2d')
  if (!c) return null

  const familia = getComputedStyle(document.body).fontFamily || 'sans-serif'
  await document.fonts.ready

  c.fillStyle = '#141712'
  c.fillRect(0, 0, ANCHO, lienzo.height)
  c.drawImage(banda, 0, 0, ANCHO, alto)

  let y = alto + MARGEN
  for (const [etiqueta, valor] of filas) {
    c.fillStyle = '#9a9c8c'
    c.font = `500 28px ${familia}`
    c.fillText(etiqueta.toUpperCase(), MARGEN, y)
    c.fillStyle = '#eeeadb'
    c.font = `600 44px ${familia}`
    c.fillText(valor, MARGEN, y + 52, ANCHO - MARGEN * 2)
    y += 118
  }

  return new Promise((resolver) => lienzo.toBlob(resolver, 'image/jpeg', 0.9))
}

export function CompartirServer (props: Props) {
  const banda = useRef<HTMLImageElement | null>(null)
  const [aviso, setAviso] = useState('')

  /* La imagen se baja de antemano: compartir tiene que arrancar apenas se toca el boton */
  useEffect(() => {
    const img = new Image()
    img.src = '/server/admines.webp'
    img.onload = () => { banda.current = img }
  }, [])

  async function compartir () {
    setAviso('')
    const img = banda.current
    if (!img) { setAviso('La imagen todavía se está cargando, probá de nuevo.'); return }

    const blob = await tarjeta(img, props)
    if (!blob) { setAviso('No se pudo armar la imagen.'); return }

    const archivo = new File([blob], 'tributo-server.jpg', { type: 'image/jpeg' })

    try {
      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ files: [archivo], text: `${props.nombre} · ${props.host}:${props.puerto}` })
        return
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }

    /* Sin compartir de archivos (compu): se baja la imagen para mandarla a mano */
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(blob)
    enlace.download = archivo.name
    enlace.click()
    URL.revokeObjectURL(enlace.href)
    setAviso('Se bajó la imagen: mandala por WhatsApp.')
  }

  return (
    <div className='compartir'>
      <button type='button' className='boton-whatsapp' onClick={compartir}>
        <IconoWhatsApp className='icono-boton' />
        Compartir por WhatsApp
      </button>
      {aviso && <span className='compartir-aviso'>{aviso}</span>}
    </div>
  )
}
