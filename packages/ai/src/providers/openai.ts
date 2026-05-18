import type { AIProvider, AIMessage, CompletionOptions } from '../types.js'

// Handles OpenAI and any OpenAI-compatible endpoint (Ollama, local models, etc.)
export class OpenAICompatibleProvider implements AIProvider {
  readonly providerName: string
  private readonly baseUrl: string

  constructor(
    private readonly apiKey: string,
    baseUrl: string,
    private readonly defaultModel: string,
    providerName = 'openai',
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.providerName = providerName
  }

  isAvailable() {
    return true
  }

  async complete(messages: AIMessage[], options?: CompletionOptions): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model ?? this.defaultModel,
        ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
        ...(options?.temperature != null ? { temperature: options.temperature } : {}),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    })

    if (!res.ok) throw new Error(`${this.providerName} ${res.status}: ${await res.text()}`)
    const data = await res.json() as { choices: { message: { content: string } }[] }
    return data.choices[0].message.content
  }

  async *stream(messages: AIMessage[], options?: CompletionOptions): AsyncIterable<string> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model ?? this.defaultModel,
        ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
        ...(options?.temperature != null ? { temperature: options.temperature } : {}),
        stream: true,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    })

    if (!res.ok) throw new Error(`${this.providerName} ${res.status}: ${await res.text()}`)

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
          const event = JSON.parse(raw) as { choices: { delta: { content?: string } }[] }
          const text = event.choices?.[0]?.delta?.content
          if (text) yield text
        } catch {
          // malformed chunk — skip
        }
      }
    }
  }
}
