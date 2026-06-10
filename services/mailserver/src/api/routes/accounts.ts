import type { FastifyInstance } from 'fastify'
import { sql, newId } from '../../db.js'
import { ensureSystemMailboxes } from '../../storage/mailboxes.js'

export async function accountRoutes(app: FastifyInstance) {
  // GET /user-accounts — account groups + accounts for the authenticated user
  app.get('/user-accounts', async (req, reply) => {
    const userId = (req as any).userId as string | undefined
    if (!userId) return reply.code(400).send({ error: 'X-User-Id required' })

    const grouped = await sql<{
      group_id: string; group_name: string; color: string | null; sort_order: number;
      account_id: string; domain: string; display_name: string; avatar_color: string | null;
      can_send: boolean; is_default: boolean; account_sort: number; unread_count: number;
    }[]>`
      SELECT
        g.id as group_id, g.name as group_name, g.color, g.sort_order,
        a.id as account_id, a.domain, a.display_name, a.avatar_color,
        maa.can_send, maa.is_default, maa.sort_order as account_sort,
        COALESCE((
          SELECT mb.unread_count FROM mailboxes mb
          WHERE mb.account_id = a.id AND mb.type = 'inbox' LIMIT 1
        ), 0) as unread_count
      FROM mail_account_groups g
      JOIN mail_account_access maa ON maa.group_id = g.id
      JOIN accounts a ON a.id = maa.account_id
      WHERE g.user_id = ${userId}
      ORDER BY g.sort_order ASC, maa.sort_order ASC
    `

    const ungrouped = await sql<{
      account_id: string; domain: string; display_name: string; avatar_color: string | null;
      can_send: boolean; is_default: boolean; account_sort: number; unread_count: number;
    }[]>`
      SELECT
        a.id as account_id, a.domain, a.display_name, a.avatar_color,
        maa.can_send, maa.is_default, maa.sort_order as account_sort,
        COALESCE((
          SELECT mb.unread_count FROM mailboxes mb
          WHERE mb.account_id = a.id AND mb.type = 'inbox' LIMIT 1
        ), 0) as unread_count
      FROM mail_account_access maa
      JOIN accounts a ON a.id = maa.account_id
      WHERE maa.user_id = ${userId} AND maa.group_id IS NULL
      ORDER BY maa.sort_order ASC
    `

    const groupMap = new Map<string, {
      id: string; name: string; color: string | null; sortOrder: number;
      accounts: { id: string; domain: string; displayName: string; avatarColor: string | null; canSend: boolean; isDefault: boolean; unreadCount: number }[]
    }>()

    for (const row of grouped) {
      if (!groupMap.has(row.group_id)) {
        groupMap.set(row.group_id, {
          id: row.group_id,
          name: row.group_name,
          color: row.color,
          sortOrder: row.sort_order,
          accounts: [],
        })
      }
      groupMap.get(row.group_id)!.accounts.push({
        id: row.account_id,
        domain: row.domain,
        displayName: row.display_name,
        avatarColor: row.avatar_color,
        canSend: row.can_send,
        isDefault: row.is_default,
        unreadCount: row.unread_count,
      })
    }

    return {
      groups: Array.from(groupMap.values()),
      ungrouped: ungrouped.map((r) => ({
        id: r.account_id, domain: r.domain, displayName: r.display_name,
        avatarColor: r.avatar_color, canSend: r.can_send, isDefault: r.is_default,
        unreadCount: r.unread_count,
      })),
    }
  })

  // GET /admin/accounts — all accounts with stats
  app.get('/admin/accounts', async () => {
    const rows = await sql<{
      id: string; domain: string; display_name: string; avatar_color: string | null;
      account_type: string; created_at: string; dkim_selector: string;
      inbox_unread: number; inbox_total: number; message_count: number;
    }[]>`
      SELECT a.id, a.domain, a.display_name, a.avatar_color, a.account_type,
             a.created_at, a.dkim_selector,
             COALESCE((SELECT mb.unread_count FROM mailboxes mb WHERE mb.account_id = a.id AND mb.type = 'inbox' LIMIT 1), 0) as inbox_unread,
             COALESCE((SELECT mb.total_count FROM mailboxes mb WHERE mb.account_id = a.id AND mb.type = 'inbox' LIMIT 1), 0) as inbox_total,
             (SELECT COUNT(*)::int FROM messages WHERE account_id = a.id) as message_count
      FROM accounts a
      ORDER BY a.created_at ASC
    `
    return rows.map((r) => ({
      id: r.id, domain: r.domain, displayName: r.display_name, avatarColor: r.avatar_color,
      accountType: r.account_type, createdAt: r.created_at, dkimSelector: r.dkim_selector,
      inboxUnread: r.inbox_unread, inboxTotal: r.inbox_total, messageCount: r.message_count,
    }))
  })

  // POST /admin/accounts — add a new hosted domain
  app.post<{
    Body: { domain: string; displayName?: string; avatarColor?: string; groupId?: string }
  }>('/admin/accounts', async (req, reply) => {
    const { domain, displayName, avatarColor, groupId } = req.body
    if (!domain) return reply.code(400).send({ error: 'domain is required' })

    const normalized = domain.toLowerCase().trim()
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(normalized)) {
      return reply.code(400).send({ error: 'Invalid domain format' })
    }

    const existing = await sql<{ id: string }[]>`SELECT id FROM accounts WHERE domain = ${normalized} LIMIT 1`
    if (existing.length) return reply.code(409).send({ error: 'Domain already exists' })

    const accountId = newId()
    await sql`
      INSERT INTO accounts (id, domain, display_name, account_type, avatar_color)
      VALUES (${accountId}, ${normalized}, ${displayName ?? normalized}, 'hosted', ${avatarColor ?? null})
    `
    await ensureSystemMailboxes(accountId)

    const userId = (req as any).userId as string | undefined
    if (userId) {
      const userExists = await sql<{ id: string }[]>`SELECT id FROM mail_users WHERE id = ${userId} LIMIT 1`
      if (userExists.length) {
        await sql`
          INSERT INTO mail_account_access (id, user_id, account_id, group_id, sort_order, can_send, is_default)
          VALUES (
            ${newId()}, ${userId}, ${accountId}, ${groupId ?? null},
            COALESCE((SELECT MAX(sort_order) + 1 FROM mail_account_access WHERE user_id = ${userId}), 0),
            true, false
          )
        `
      }
    }

    return {
      account: { id: accountId, domain: normalized, displayName: displayName ?? normalized },
      dnsRecords: {
        mx: { type: 'MX', name: normalized, value: 'mail.adams-ai.com.', priority: 10 },
        spf: { type: 'TXT', name: normalized, value: 'v=spf1 include:mailgun.org ~all' },
        dmarc: { type: 'TXT', name: `_dmarc.${normalized}`, value: 'v=DMARC1; p=none; rua=mailto:dmarc@adams-ai.com' },
        dkim: {
          type: 'TXT',
          name: `foundry._domainkey.${normalized}`,
          note: 'Copy the same DKIM public key already set for your primary domain at foundry._domainkey.adams-ai.com',
        },
      },
    }
  })
}
