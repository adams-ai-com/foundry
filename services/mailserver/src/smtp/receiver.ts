import { SMTPServer } from 'smtp-server'
import { parseMail } from '../parser/mime.js'
import { storeInboundMessage } from '../storage/messages.js'
import { sql } from '../db.js'
import { config } from '../config.js'

// Resolve the accountId for a recipient address
async function resolveAccount(address: string): Promise<string | null> {
  const domain = address.split('@')[1]?.toLowerCase()
  if (!domain) return null
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM accounts WHERE domain = ${domain} LIMIT 1
  `
  return rows[0]?.id ?? null
}

// Basic spam signals — reject obvious junk before parsing
function looksLikeSpam(session: { remoteAddress: string }): boolean {
  // Localhost/private ranges always allowed
  const ip = session.remoteAddress
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.')) {
    return false
  }
  // Extend with RBL checks, SPF verification etc. in production
  return false
}

export function createSmtpReceiver(): SMTPServer {
  const server = new SMTPServer({
    // Accept mail without AUTH for inbound (MX delivery from other mail servers)
    // For submission (587), AUTH is required — set in a separate instance if needed
    authOptional: true,
    allowInsecureAuth: true,
    disabledCommands: ['STARTTLS'], // TLS termination at nginx in production

    onConnect(session, callback) {
      if (looksLikeSpam(session)) {
        return callback(new Error('Connection rejected'))
      }
      callback()
    },

    async onRcptTo(address, session, callback) {
      const accountId = await resolveAccount(address.address)
      if (!accountId) {
        const err = Object.assign(new Error('Unknown recipient'), { responseCode: 550 })
        return callback(err)
      }
      callback()
    },

    async onData(stream, session, callback) {
      try {
        // Collect stream into buffer
        const chunks: Buffer[] = []
        for await (const chunk of stream) chunks.push(chunk as Buffer)
        const raw = Buffer.concat(chunks)

        const parsed = await parseMail(raw)

        // Store for each addressed account we handle
        const recipients = [
          ...(session.envelope.rcptTo ?? []).map((a) => a.address),
        ]

        for (const recipient of recipients) {
          const accountId = await resolveAccount(recipient)
          if (accountId) {
            await storeInboundMessage(accountId, parsed)
          }
        }

        callback()
      } catch (err) {
        console.error('SMTP ingest error:', err)
        callback(new Error('Message processing failed'))
      }
    },
  })

  return server
}

export function startSmtpReceiver(): SMTPServer {
  const server = createSmtpReceiver()
  server.listen(config.smtp.port, config.smtp.host, () => {
    console.log(`SMTP receiver listening on ${config.smtp.host}:${config.smtp.port}`)
  })
  server.on('error', (err) => console.error('SMTP server error:', err))
  return server
}
