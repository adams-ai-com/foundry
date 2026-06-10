// In-memory stand-in for panel's /api/webhooks/pdf-signing endpoint.
// Records every payload so tests can assert on what WOULD have been emailed.
import http from 'http'

const events = []

http
  .createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/webhook') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        try {
          events.push(JSON.parse(body))
        } catch {
          events.push({ raw: body })
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{"ok":true}')
      })
    } else if (req.method === 'GET' && req.url === '/events') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(events))
    } else if (req.method === 'DELETE' && req.url === '/events') {
      events.length = 0
      res.writeHead(200)
      res.end('ok')
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  .listen(3940, '127.0.0.1')
