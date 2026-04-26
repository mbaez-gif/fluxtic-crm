/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force all pages/routes to be dynamic — prevents Firebase SDK
  // from being initialized at build time (no env vars available then)
  experimental: {
    // This ensures API routes are never statically analyzed
  },

  // Prevent googleapis and Firebase from bundling in client
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs:            false,
        net:           false,
        tls:           false,
        child_process: false,
      }
    }
    return config
  },

  // Headers to allow CORS for public API routes
  async headers() {
    return [
      {
        source:  '/api/leads/webhook',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
      {
        source:  '/api/captacion/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
