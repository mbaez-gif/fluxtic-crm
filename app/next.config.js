/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'storage-delfina.fluxtic.com' },
      { protocol: 'https', hostname: 'd2r9epyceweg5n.cloudfront.net' },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['admin-delfina.fluxtic.com', 'delfinapaz.fluxtic.com', 'localhost:3000'],
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
