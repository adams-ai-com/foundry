import type { FastifyInstance } from 'fastify'
import { createReadStream } from 'fs'
import { getFile } from '../../storage/files.js'

export async function attachmentRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    '/attachments/:id', async (req, reply) => {
      const accountId = (req as any).accountId as string
      const file = await getFile(accountId, req.params.id)
      if (!file) return reply.code(404).send({ error: 'Not found' })

      reply.header('Content-Type', file.content_type)
      reply.header('Content-Disposition', `attachment; filename="${file.filename}"`)
      reply.header('Content-Length', file.size)
      return reply.send(createReadStream(file.storage_path))
    }
  )
}
