import { authenticator } from 'otplib'
import QRCode from 'qrcode'

authenticator.options = { window: 1 }

export function generateSecret(): string {
  return authenticator.generateSecret()
}

export function verifyCode(secret: string, code: string): boolean {
  try {
    return authenticator.verify({ token: code.replace(/\s/g, ''), secret })
  } catch {
    return false
  }
}

export async function generateQRDataURL(email: string, secret: string): Promise<string> {
  const uri = authenticator.keyuri(email, 'OpenWork Loft', secret)
  return QRCode.toDataURL(uri)
}
