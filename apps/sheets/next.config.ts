import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@foundry/shared', '@foundry/ui'],
  // Pyodide requires these headers so SharedArrayBuffer works in the browser
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ]
  },
}

export default nextConfig
