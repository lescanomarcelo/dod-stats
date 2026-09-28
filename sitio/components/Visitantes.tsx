'use client'

import { useEffect, useState } from 'react'

export function Visitantes () {
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/visita', { method: 'POST' })
      .then((r) => r.json())
      .then((d: { total: number }) => setTotal(d.total))
      .catch(() => {})
  }, [])

  if (total === null) return null
  return <span className='visitas'>{total.toLocaleString('es-AR')} visitas</span>
}
