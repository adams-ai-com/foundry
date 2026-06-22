import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: '/channels',
  transpilePackages: ['@foundry/auth', '@foundry/shared', '@foundry/ui'],
}

export default nextConfig
