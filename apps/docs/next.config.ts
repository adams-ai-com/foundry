import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: '/docs',
  transpilePackages: ['@owl/shared', '@owl/ui', '@owl/auth'],
}

export default nextConfig
