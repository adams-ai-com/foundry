import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@foundry/shared', '@foundry/ui'],
}

export default nextConfig
