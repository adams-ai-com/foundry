type SendFn = (data: object) => void

const clients = new Map<string, Set<SendFn>>()

export function addSSEClient(orgId: string, send: SendFn): () => void {
  if (!clients.has(orgId)) clients.set(orgId, new Set())
  clients.get(orgId)!.add(send)
  return () => {
    clients.get(orgId)?.delete(send)
    if (clients.get(orgId)?.size === 0) clients.delete(orgId)
  }
}

export function broadcastToOrg(orgId: string, data: object): void {
  clients.get(orgId)?.forEach(send => {
    try { send(data) } catch {}
  })
}
