import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: '/docs',
  transpilePackages: ['@foundry/shared', '@foundry/ui', '@foundry/auth'],
}

export default nextConfig
