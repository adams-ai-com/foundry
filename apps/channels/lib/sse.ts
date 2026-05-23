type SendFn = (data: object) => void

type SSEClient = {
  send: SendFn
  topicFilter?: string[]  // guests: only deliver events for their allowed topics
}

const clients = new Map<string, Set<SSEClient>>()

export function addSSEClient(orgId: string, send: SendFn, topicFilter?: string[]): () => void {
  if (!clients.has(orgId)) clients.set(orgId, new Set())
  const client: SSEClient = { send, topicFilter }
  clients.get(orgId)!.add(client)
  return () => {
    clients.get(orgId)?.delete(client)
    if (clients.get(orgId)?.size === 0) clients.delete(orgId)
  }
}

export function broadcastToOrg(orgId: string, data: object): void {
  const topicId = (data as Record<string, unknown>).topicId as string | undefined
  clients.get(orgId)?.forEach(client => {
    if (client.topicFilter && topicId && !client.topicFilter.includes(topicId)) return
    try { client.send(data) } catch {}
  })
}
