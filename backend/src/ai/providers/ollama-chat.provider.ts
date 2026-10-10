import { AiProviderError } from '../ai-provider.error';
import { ChatProvider, ChatRequest } from '../interfaces/chat-provider.interface';
import { postJson } from './http-json';

export interface OllamaChatOptions {
  baseUrl: string;
  model: string;
  /** Janela de contexto; o padrão do Ollama é pequeno e cortaria os trechos em silêncio. */
  numCtx: number;
  timeoutMs: number;
}

interface OllamaChatResponse {
  message?: { content?: unknown };
}

/** Temperatura baixa: respostas factuais e estáveis, sem "criatividade". */
const TEMPERATURE = 0.1;

/** Chat pelo Ollama local: `POST {baseUrl}/api/chat`. */
export class OllamaChatProvider implements ChatProvider {
  readonly modelId: string;

  constructor(private readonly options: OllamaChatOptions) {
    this.modelId = `ollama:${options.model}`;
  }

  async generate(request: ChatRequest): Promise<{ text: string }> {
    const response = await postJson<OllamaChatResponse>({
      url: `${this.options.baseUrl}/api/chat`,
      body: {
        model: this.options.model,
        stream: false,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        options: { num_ctx: this.options.numCtx, temperature: TEMPERATURE },
      },
      timeoutMs: this.options.timeoutMs,
    });

    const text = response.message?.content;
    if (typeof text !== 'string' || text.trim() === '') {
      throw new AiProviderError('INVALID_RESPONSE', 'Resposta de chat do Ollama sem conteúdo');
    }
    return { text };
  }
}
