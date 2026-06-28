import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: '/mail',
  transpilePackages: ['@owl/shared', '@owl/ui', '@owl/auth'],
}

export default nextConfig
