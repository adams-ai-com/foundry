import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@foundry/auth', '@foundry/shared', '@foundry/ui'],
}

export default nextConfig
