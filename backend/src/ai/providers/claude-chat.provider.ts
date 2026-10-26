import { AiProviderError } from '../ai-provider.error';
import { ChatProvider, ChatRequest } from '../interfaces/chat-provider.interface';
import { postJson } from './http-json';

export interface ClaudeChatOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

interface ClaudeMessagesResponse {
  content?: Array<{ type?: string; text?: unknown }>;
}

const TEMPERATURE = 0.1;
/** A API do Claude exige um teto de tokens na resposta. */
const MAX_OUTPUT_TOKENS = 1024;
const ANTHROPIC_VERSION = '2023-06-01';

/** Chat pelo Claude: `POST {baseUrl}/v1/messages`. */
export class ClaudeChatProvider implements ChatProvider {
  readonly modelId: string;

  constructor(private readonly options: ClaudeChatOptions) {
    this.modelId = `claude:${options.model}`;
  }

  async generate(request: ChatRequest): Promise<{ text: string }> {
    const response = await postJson<ClaudeMessagesResponse>({
      url: `${this.options.baseUrl}/v1/messages`,
      headers: { 'x-api-key': this.options.apiKey, 'anthropic-version': ANTHROPIC_VERSION },
      body: {
        model: this.options.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: TEMPERATURE,
        // No Claude, o prompt de sistema vai em campo próprio, fora de `messages`.
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userPrompt }],
      },
      timeoutMs: this.options.timeoutMs,
    });

    // A resposta é uma lista de blocos; só os de texto interessam.
    const text = (response.content ?? [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('');
    if (text.trim() === '') {
      throw new AiProviderError('INVALID_RESPONSE', 'Resposta de chat do Claude sem conteúdo');
    }
    return { text };
  }
}
