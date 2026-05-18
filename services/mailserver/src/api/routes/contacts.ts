import type { FastifyInstance } from 'fastify'
import { sql, newId } from '../../db.js'

export async function contactRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string } }>(
    '/contacts', async (req) => {
      const accountId = (req as any).accountId as string
      const q = req.query.q?.trim()

      if (q) {
        return sql`
          SELECT id, name, email, phone, org, last_contacted_at
          FROM contacts
          WHERE account_id = ${accountId}
            AND (search_vector @@ plainto_tsquery('english', ${q})
                 OR email ILIKE ${'%' + q + '%'}
                 OR name ILIKE ${'%' + q + '%'})
          ORDER BY last_contacted_at DESC NULLS LAST
          LIMIT 50
        `
      }

      return sql`
        SELECT id, name, email, phone, org, last_contacted_at
        FROM contacts WHERE account_id = ${accountId}
        ORDER BY last_contacted_at DESC NULLS LAST
        LIMIT 200
      `
    }
  )

  app.post<{ Body: { name?: string; email: string; phone?: string; org?: string; notes?: string } }>(
    '/contacts', async (req, reply) => {
      const accountId = (req as any).accountId as string
      const b = req.body
      if (!b.email) return reply.code(400).send({ error: 'email required' })

      const id = newId()
      await sql`
        INSERT INTO contacts (id, account_id, name, email, phone, org, notes)
        VALUES (${id}, ${accountId}, ${b.name ?? null}, ${b.email},
          ${b.phone ?? null}, ${b.org ?? null}, ${b.notes ?? null})
        ON CONFLICT (account_id, email) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, contacts.name),
          phone = COALESCE(EXCLUDED.phone, contacts.phone),
          org = COALESCE(EXCLUDED.org, contacts.org)
      `
      return { id }
    }
  )
}
