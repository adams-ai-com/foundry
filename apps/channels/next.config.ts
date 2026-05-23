import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@foundry/auth', '@foundry/shared', '@foundry/ui'],
}

export default nextConfig
