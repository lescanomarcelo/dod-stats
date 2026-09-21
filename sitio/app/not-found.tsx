import Link from 'next/link'

export default function NoEncontrado () {
  return (
    <div className='encabezado-pagina'>
      <h1>No encontrado</h1>
      <p>Ese jugador o esa página no existe. <Link href='/' className='jugador'>Volver al ranking</Link></p>
    </div>
  )
}
