import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: '/wiki',
  transpilePackages: ['@owl/shared', '@owl/ui', '@owl/auth'],
}

export default nextConfig
