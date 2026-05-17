import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@foundry/shared', '@foundry/ui'],
  // imapflow and tsdav are Node-only — keep them server-side
  serverExternalPackages: ['imapflow', 'tsdav', 'nodemailer'],
}

export default nextConfig
