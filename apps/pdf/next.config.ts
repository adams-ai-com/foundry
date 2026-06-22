import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: '/pdf',
  transpilePackages: ['@foundry/shared', '@foundry/ui', '@foundry/auth'],
}

export default nextConfig
