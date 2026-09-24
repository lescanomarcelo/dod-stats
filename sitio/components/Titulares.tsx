import { connection } from 'next/server'
import { titulares } from '@/lib/titulares'
import { TitularesCarrusel } from '@/components/TitularesCarrusel'

/*
 *  Banda arriba del ranking: "Ayer", "Esta semana" y "Este mes" van pasando de
 *  a uno, con el resultado en mapas ganados y la figura del bando que gana. Si
 *  todavia no hay ninguna partida en ningun periodo, no se muestra nada.
 *
 *  Se marca dinamico con connection() porque "ayer", "esta semana" y "este mes"
 *  dependen de la hora actual: sin esto, el build con Cache Components intenta
 *  congelarlos en un momento fijo.
 */
export async function Titulares () {
  await connection()
  const slides = await titulares()
  if (slides.length === 0) return null

  return <TitularesCarrusel slides={slides} />
}
