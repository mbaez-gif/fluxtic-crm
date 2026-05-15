/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'storage-salud.fluxtic.com' },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['admin-salud.fluxtic.com', 'portal-salud.fluxtic.com', 'localhost:3000'],
    },
  },
  async redirects() {
    return [
      // Compatibilidad con enlaces ya compartidos
      { source: '/public/turnos', destination: '/reservar', permanent: true },
      { source: '/public/turnos/:path*', destination: '/reservar', permanent: true },
    ]
  },
}

module.exports = nextConfig
