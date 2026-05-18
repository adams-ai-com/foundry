import 'dotenv/config'
import { mkdirSync } from 'fs'
import { config } from './config.js'
import { startApi } from './api/index.js'
import { startSmtpReceiver } from './smtp/receiver.js'

mkdirSync(config.attachmentsDir, { recursive: true })

console.log('Starting Foundry Mail Server...')

startApi().catch((err) => {
  console.error('API failed to start:', err)
  process.exit(1)
})

// Only start SMTP receiver if a port is configured and we're not in test mode
if (config.smtp.port && process.env.NODE_ENV !== 'test') {
  startSmtpReceiver()
}
