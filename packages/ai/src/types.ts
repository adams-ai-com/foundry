export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  system?: string
}

export interface AIProvider {
  readonly providerName: string
  isAvailable(): boolean
  complete(messages: AIMessage[], options?: CompletionOptions): Promise<string>
  stream(messages: AIMessage[], options?: CompletionOptions): AsyncIterable<string>
}

export type AIProviderType = 'none' | 'anthropic' | 'openai' | 'ollama'

export interface AIConfig {
  provider: AIProviderType
  apiKey?: string
  baseUrl?: string
  model?: string
}
