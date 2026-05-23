export function procUrl(path: string): string {
  const base = process.env.FOUNDRY_PDF_PROC_URL ?? 'http://127.0.0.1:3200'
  return `${base}${path}`
}

export function procHeaders(): Record<string, string> {
  return { 'X-Proc-Secret': process.env.FOUNDRY_PDF_PROC_SECRET ?? '' }
}

export async function fetchProc(path: string, init?: RequestInit): Promise<Response> {
  return fetch(procUrl(path), {
    ...init,
    headers: { ...procHeaders(), ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
}
