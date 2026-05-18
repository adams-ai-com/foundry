import type { FastifyInstance } from 'fastify'
import { createReadStream } from 'fs'
import { listFiles, uploadFile, deleteFile, getFile } from '../../storage/files.js'

export async function fileRoutes(app: FastifyInstance) {
  // List all files
  app.get<{ Querystring: { page?: string; search?: string } }>(
    '/files',
    async (req) => {
      const accountId = (req as any).accountId as string
      const page = Math.max(1, parseInt(req.query.page ?? '1'))
      return listFiles(accountId, {
        limit: 50,
        offset: (page - 1) * 50,
        search: req.query.search,
      })
    },
  )

  // Upload a file (multipart)
  app.post(
    '/files',
    async (req, reply) => {
      const accountId = (req as any).accountId as string

      const data = await (req as any).file()
      if (!data) return reply.code(400).send({ error: 'No file uploaded' })

      const buf = await data.toBuffer()
      const file = await uploadFile(accountId, {
        filename: data.filename || 'upload',
        contentType: data.mimetype || 'application/octet-stream',
        data: buf,
      })

      return reply.code(201).send(file)
    },
  )

  // Download a file (kept here; also served at /attachments/:id for backwards compat)
  app.get<{ Params: { id: string } }>(
    '/files/:id/download',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const file = await getFile(accountId, req.params.id)
      if (!file) return reply.code(404).send({ error: 'Not found' })

      reply.header('Content-Type', file.content_type)
      reply.header('Content-Disposition', `attachment; filename="${file.filename}"`)
      reply.header('Content-Length', file.size)
      return reply.send(createReadStream(file.storage_path))
    },
  )

  // Delete a file
  app.delete<{ Params: { id: string } }>(
    '/files/:id',
    async (req, reply) => {
      const accountId = (req as any).accountId as string
      const ok = await deleteFile(accountId, req.params.id)
      if (!ok) return reply.code(404).send({ error: 'Not found' })
      return reply.code(204).send()
    },
  )
}
