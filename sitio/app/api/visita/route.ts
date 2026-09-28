import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { consultar } from '@/lib/db'

const ROBOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|vercel|lighthouse|curl|wget/i

/* Suma un visitante nuevo (una vez por navegador, con cookie de un año) y devuelve el total */
export async function POST (pedido: Request) {
  const jar = await cookies()
  const agente = pedido.headers.get('user-agent') ?? ''

  if (!jar.has('visitante') && agente && !ROBOTS.test(agente)) {
    await consultar('UPDATE {p}visitas SET total = total + 1 WHERE id = 1')
    jar.set('visitante', '1', { maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: 'lax', path: '/' })
  }

  const [fila] = await consultar<{ total: number }>('SELECT total FROM {p}visitas WHERE id = 1')
  return NextResponse.json({ total: fila?.total ?? 0 }, { headers: { 'Cache-Control': 'no-store' } })
}
