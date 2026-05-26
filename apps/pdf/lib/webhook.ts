export interface SigningBranding {
  display_name: string
  logo_url: string
  brand_color: string
}

export interface SigningWebhookPayload {
  event: 'signing_invitation' | 'signing_complete'
  recipient_email: string
  recipient_name: string
  document_title: string
  creator_name?: string
  signing_url?: string
  envelope_id?: string
  branding?: SigningBranding
}

export function fireSigningWebhook(payload: SigningWebhookPayload): void {
  const url = process.env.SIGNING_EMAIL_WEBHOOK_URL
  const secret = process.env.PDF_SIGNING_WEBHOOK_SECRET
  if (!url || !secret) return
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-PDF-Signing-Secret': secret },
    body: JSON.stringify(payload),
  }).catch(err => console.error('signing webhook fire failed:', err))
}
