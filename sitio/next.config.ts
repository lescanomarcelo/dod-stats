import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* Modelo de cache de Next 16: las consultas usan 'use cache' + cacheLife */
  cacheComponents: true
}

export default nextConfig
