import { AiProviderError } from '../ai-provider.error';
import { ChatProvider, ChatRequest } from '../interfaces/chat-provider.interface';
import { postJson } from './http-json';

export interface OpenAiChatOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
}

const TEMPERATURE = 0.1;

/** Chat pela OpenAI: `POST {baseUrl}/v1/chat/completions`. */
export class OpenAiChatProvider implements ChatProvider {
  readonly modelId: string;

  constructor(private readonly options: OpenAiChatOptions) {
    this.modelId = `openai:${options.model}`;
  }

  async generate(request: ChatRequest): Promise<{ text: string }> {
    const response = await postJson<OpenAiChatResponse>({
      url: `${this.options.baseUrl}/v1/chat/completions`,
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
      body: {
        model: this.options.model,
        temperature: TEMPERATURE,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
      },
      timeoutMs: this.options.timeoutMs,
    });

    const text = response.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.trim() === '') {
      throw new AiProviderError('INVALID_RESPONSE', 'Resposta de chat da OpenAI sem conteúdo');
    }
    return { text };
  }
}
