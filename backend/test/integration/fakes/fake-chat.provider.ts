import { AiProviderError, AiProviderErrorKind } from '../../../src/ai/ai-provider.error';
import { ChatProvider, ChatRequest } from '../../../src/ai/interfaces/chat-provider.interface';

/** ChatProvider de teste: resposta e falha configuráveis, e guarda o que recebeu. */
export class FakeChatProvider implements ChatProvider {
  readonly modelId = 'fake:chat';
  /** Cada prompt recebido, na ordem; permite conferir o contexto enviado à IA. */
  readonly requests: ChatRequest[] = [];
  private answer = 'Resposta de teste.';
  private failureKind: AiProviderErrorKind | null = null;

  respondWith(text: string): void {
    this.answer = text;
    this.failureKind = null;
  }

  failWith(kind: AiProviderErrorKind): void {
    this.failureKind = kind;
  }

  reset(): void {
    this.answer = 'Resposta de teste.';
    this.failureKind = null;
    this.requests.length = 0;
  }

  async generate(request: ChatRequest): Promise<{ text: string }> {
    this.requests.push(request);
    if (this.failureKind) {
      throw new AiProviderError(this.failureKind, 'Falha simulada do provedor de chat');
    }
    return { text: this.answer };
  }
}
