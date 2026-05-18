import type { AIProvider, AIMessage, CompletionOptions } from '../types.js'

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-4-6'

export class AnthropicProvider implements AIProvider {
  readonly providerName = 'anthropic'

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel = DEFAULT_MODEL,
  ) {}

  isAvailable() {
    return !!this.apiKey
  }

  async complete(messages: AIMessage[], options?: CompletionOptions): Promise<string> {
    const { system, filtered } = extractSystem(messages, options)

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model ?? this.defaultModel,
        max_tokens: options?.maxTokens ?? 1024,
        ...(system ? { system } : {}),
        messages: filtered,
      }),
    })

    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
    const data = await res.json() as { content: { text: string }[] }
    return data.content[0].text
  }

  async *stream(messages: AIMessage[], options?: CompletionOptions): AsyncIterable<string> {
    const { system, filtered } = extractSystem(messages, options)

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model ?? this.defaultModel,
        max_tokens: options?.maxTokens ?? 1024,
        stream: true,
        ...(system ? { system } : {}),
        messages: filtered,
      }),
    })

    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)

    yield* parseSSE(res, (event) => {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as Record<string, unknown> | undefined
        return (delta?.text as string | undefined) ?? null
      }
      return null
    })
  }
}

function extractSystem(messages: AIMessage[], options?: CompletionOptions) {
  const system = options?.system ?? messages.find((m) => m.role === 'system')?.content
  const filtered = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))
  return { system, filtered }
}

async function* parseSSE(
  res: Response,
  extract: (event: Record<string, unknown>) => string | null,
): AsyncIterable<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6)
      if (raw === '[DONE]') return
      try {
        const text = extract(JSON.parse(raw) as Record<string, unknown>)
        if (text) yield text
      } catch {
        // malformed chunk — skip
      }
    }
  }
}
