/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Required for server actions and route handlers using cookies
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        // CSP for email preview iframes — enforced at network layer
        // The sandboxed iframe itself uses srcdoc with sandbox='allow-same-origin'
        // This header adds a secondary network-layer restriction
        source: '/campaigns/:id*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "frame-src 'none'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig