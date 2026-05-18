import type { AIProvider, AIMessage, CompletionOptions } from '../types.js'

export class NoneProvider implements AIProvider {
  readonly providerName = 'none'

  isAvailable() {
    return false
  }

  async complete(_messages: AIMessage[], _options?: CompletionOptions): Promise<string> {
    throw new Error('AI is disabled. Set AI_PROVIDER in your environment to enable it.')
  }

  async *stream(_messages: AIMessage[], _options?: CompletionOptions): AsyncIterable<string> {
    throw new Error('AI is disabled. Set AI_PROVIDER in your environment to enable it.')
  }
}
