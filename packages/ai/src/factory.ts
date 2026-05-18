import type { AIConfig, AIProvider } from './types.js'
import { NoneProvider } from './providers/none.js'
import { AnthropicProvider } from './providers/anthropic.js'
import { OpenAICompatibleProvider } from './providers/openai.js'

export function createProvider(config: AIConfig): AIProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config.apiKey ?? '', config.model)

    case 'openai':
      return new OpenAICompatibleProvider(
        config.apiKey ?? '',
        config.baseUrl ?? 'https://api.openai.com',
        config.model ?? 'gpt-4o',
      )

    case 'ollama':
      // Ollama exposes an OpenAI-compatible API; no key required
      return new OpenAICompatibleProvider(
        '',
        config.baseUrl ?? 'http://localhost:11434',
        config.model ?? 'llama3.1',
        'ollama',
      )

    case 'none':
    default:
      return new NoneProvider()
  }
}

// Reads AI_PROVIDER, AI_API_KEY, AI_BASE_URL, AI_MODEL from environment
export function createProviderFromEnv(): AIProvider {
  return createProvider({
    provider: (process.env.AI_PROVIDER ?? 'none') as AIConfig['provider'],
    apiKey: process.env.AI_API_KEY,
    baseUrl: process.env.AI_BASE_URL,
    model: process.env.AI_MODEL,
  })
}
