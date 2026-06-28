import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@owl/auth', '@owl/shared', '@owl/ui'],
}

export default nextConfig
