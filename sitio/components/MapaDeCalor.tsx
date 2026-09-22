'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'

/*
 *  Mapa de calor sobre el overview de un mapa.
 *
 *  1. Cada punto estampa un circulo difuso en una capa invisible; donde se juntan
 *     muchos, la capa se vuelve mas opaca: eso es la densidad.
 *  2. Esa densidad se traduce a color con una escala (azul = poco, rojo = mucho).
 *
 *  Los puntos llegan como lista plana [u0, v0, u1, v1, ...] en fracciones de la
 *  imagen (0 a 1), ya convertidos en el servidor. El canvas trabaja a la resolucion
 *  original del overview y el CSS lo escala al ancho disponible.
 */

const RADIO_BASE = 22   /* radio del circulo de cada punto, en pixeles de una imagen de 1024 de ancho */

function crearSello (radio: number): HTMLCanvasElement {
  const sello = document.createElement('canvas')
  sello.width = sello.height = radio * 2
  const ctx = sello.getContext('2d')!
  const degradado = ctx.createRadialGradient(radio, radio, 0, radio, radio, radio)
  degradado.addColorStop(0, 'rgba(0,0,0,1)')
  degradado.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = degradado
  ctx.fillRect(0, 0, radio * 2, radio * 2)
  return sello
}

/* 256 colores: el indice es la densidad acumulada en ese pixel */
function crearPaleta (): Uint8ClampedArray {
  const lienzo = document.createElement('canvas')
  lienzo.width = 256
  lienzo.height = 1
  const ctx = lienzo.getContext('2d')!
  const degradado = ctx.createLinearGradient(0, 0, 256, 0)
  degradado.addColorStop(0.0, '#1e3a8a')
  degradado.addColorStop(0.25, '#2563eb')
  degradado.addColorStop(0.45, '#06b6d4')
  degradado.addColorStop(0.62, '#84cc16')
  degradado.addColorStop(0.8, '#facc15')
  degradado.addColorStop(1.0, '#dc2626')
  ctx.fillStyle = degradado
  ctx.fillRect(0, 0, 256, 1)
  return ctx.getImageData(0, 0, 256, 1).data
}

function dibujar (lienzo: HTMLCanvasElement, puntos: number[]) {
  const { width: ancho, height: alto } = lienzo
  const ctx = lienzo.getContext('2d')!
  ctx.clearRect(0, 0, ancho, alto)

  const cantidad = puntos.length / 2
  if (!cantidad) return

  /* Con pocos puntos cada uno pesa mas; con miles, cada uno aporta poco.
     Asi el mapa no queda ni vacio ni saturado de rojo. */
  const intensidad = Math.min(0.35, Math.max(0.03, 0.6 / Math.sqrt(cantidad)))
  const radio = Math.round((RADIO_BASE * ancho) / 1024)

  const densidad = document.createElement('canvas')
  densidad.width = ancho
  densidad.height = alto
  const d = densidad.getContext('2d', { willReadFrequently: true })!
  const sello = crearSello(radio)
  d.globalAlpha = intensidad
  for (let i = 0; i < puntos.length; i += 2) {
    d.drawImage(sello, puntos[i] * ancho - radio, puntos[i + 1] * alto - radio)
  }

  const imagen = d.getImageData(0, 0, ancho, alto)
  const px = imagen.data

  /* Se normaliza contra el punto mas denso: la zona mas caliente del mapa siempre
     llega al rojo y el resto queda en proporcion. Sin esto, un jugador con pocos
     datos veria todo azul casi transparente. */
  let maximo = 0
  for (let i = 3; i < px.length; i += 4) if (px[i] > maximo) maximo = px[i]
  if (!maximo) return

  const paleta = crearPaleta()
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3]
    if (!a) continue
    const nivel = Math.round((a / maximo) * 255)
    px[i] = paleta[nivel * 4]
    px[i + 1] = paleta[nivel * 4 + 1]
    px[i + 2] = paleta[nivel * 4 + 2]
    /* Los bordes se desvanecen; el nucleo queda firme pero deja ver el mapa */
    px[i + 3] = Math.round(Math.min(1, nivel / 90) * 200)
  }
  ctx.putImageData(imagen, 0, 0)
}

type Props = {
  imagen: string
  nombre: string
  ancho: number
  alto: number
  puntos: number[]
}

export function MapaDeCalor ({ imagen, nombre, ancho, alto, puntos }: Props) {
  const lienzo = useRef<HTMLCanvasElement>(null)

  /* Sincroniza el canvas (sistema externo a React) con los puntos recibidos */
  useEffect(() => {
    if (lienzo.current) dibujar(lienzo.current, puntos)
  }, [puntos])

  return (
    <div className='calor' style={{ aspectRatio: `${ancho} / ${alto}` }}>
      <Image src={imagen} alt={`Overview de ${nombre}`} fill unoptimized sizes='(max-width: 1120px) 100vw, 1080px' />
      <canvas ref={lienzo} width={ancho} height={alto} aria-hidden='true' />
    </div>
  )
}
