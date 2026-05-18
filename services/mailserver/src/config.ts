export const config = {
  db: process.env.DATABASE_URL ?? 'postgresql://foundry:foundry@localhost:5432/foundry_mail',
  apiPort: parseInt(process.env.API_PORT ?? '3002'),
  apiKey: process.env.API_KEY ?? 'dev-key',
  smtp: {
    port: parseInt(process.env.SMTP_PORT ?? '0'),
    submissionPort: parseInt(process.env.SMTP_SUBMISSION_PORT ?? '587'),
    host: process.env.SMTP_HOST ?? '0.0.0.0',
  },
  relay: {
    host: process.env.SMTP_RELAY_HOST ?? '',
    port: parseInt(process.env.SMTP_RELAY_PORT ?? '587'),
    user: process.env.SMTP_RELAY_USER ?? '',
    pass: process.env.SMTP_RELAY_PASS ?? '',
  },
  dkim: {
    privateKeyPath: process.env.DKIM_PRIVATE_KEY_PATH ?? '',
    selector: process.env.DKIM_SELECTOR ?? 'foundry',
  },
  attachmentsDir: process.env.ATTACHMENTS_DIR ?? '/tmp/foundry-mail-attachments',
  domain: process.env.MAIL_DOMAIN ?? 'localhost',
}
