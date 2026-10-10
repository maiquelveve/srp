import { Logger, Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/app-config.module';
import { AppConfig } from '../config/configuration';
import { CHAT_PROVIDER, EMBEDDING_PROVIDER } from './ai.tokens';
import { ChatProvider } from './interfaces/chat-provider.interface';
import { EmbeddingProvider } from './interfaces/embedding-provider.interface';
import { ClaudeChatProvider } from './providers/claude-chat.provider';
import { OllamaChatProvider } from './providers/ollama-chat.provider';
import { OllamaEmbeddingProvider } from './providers/ollama-embedding.provider';
import { OpenAiChatProvider } from './providers/openai-chat.provider';
import { OpenAiEmbeddingProvider } from './providers/openai-embedding.provider';

const logger = new Logger('AiModule');

function warnExternalProvider(role: string, providerName: string): void {
  logger.warn(
    `${role} configurado para "${providerName}": perguntas e trechos de documentos serão enviados a um serviço externo`,
  );
}

function requireApiKey(apiKey: string, variableName: string, usage: string): void {
  if (!apiKey) {
    throw new Error(`${variableName} é obrigatória quando ${usage}`);
  }
}

/**
 * Escolhe o EmbeddingProvider pela variável EMBEDDING_PROVIDER. Valor
 * desconhecido ou chave ausente lançam erro, o que impede o backend de subir
 * com configuração inválida (FR-030).
 */
export function createEmbeddingProvider(config: AppConfig): EmbeddingProvider {
  const { ai } = config;
  if (!Number.isInteger(ai.embeddingDimensions) || ai.embeddingDimensions <= 0) {
    throw new Error('EMBEDDING_DIMENSIONS deve ser um número inteiro positivo');
  }

  switch (ai.embeddingProvider) {
    case 'ollama':
      return new OllamaEmbeddingProvider({
        baseUrl: ai.ollama.baseUrl,
        model: ai.ollama.embeddingModel,
        dimensions: ai.embeddingDimensions,
        timeoutMs: ai.embeddingTimeoutMs,
        batchSize: ai.embeddingBatchSize,
      });
    case 'openai':
      requireApiKey(ai.openai.apiKey, 'OPENAI_API_KEY', 'EMBEDDING_PROVIDER=openai');
      warnExternalProvider('EMBEDDING_PROVIDER', 'openai');
      return new OpenAiEmbeddingProvider({
        apiKey: ai.openai.apiKey,
        baseUrl: ai.openai.baseUrl,
        model: ai.openai.embeddingModel,
        dimensions: ai.embeddingDimensions,
        timeoutMs: ai.embeddingTimeoutMs,
        batchSize: ai.embeddingBatchSize,
      });
    default:
      throw new Error(
        `EMBEDDING_PROVIDER inválido: "${ai.embeddingProvider}". Valores aceitos: ollama, openai`,
      );
  }
}

/** Escolhe o ChatProvider pela variável CHAT_PROVIDER, com a mesma validação. */
export function createChatProvider(config: AppConfig): ChatProvider {
  const { ai } = config;

  switch (ai.chatProvider) {
    case 'ollama':
      return new OllamaChatProvider({
        baseUrl: ai.ollama.baseUrl,
        model: ai.ollama.chatModel,
        numCtx: ai.ollama.chatNumCtx,
        timeoutMs: ai.chatTimeoutMs,
      });
    case 'openai':
      requireApiKey(ai.openai.apiKey, 'OPENAI_API_KEY', 'CHAT_PROVIDER=openai');
      warnExternalProvider('CHAT_PROVIDER', 'openai');
      return new OpenAiChatProvider({
        apiKey: ai.openai.apiKey,
        baseUrl: ai.openai.baseUrl,
        model: ai.openai.chatModel,
        timeoutMs: ai.chatTimeoutMs,
      });
    case 'claude':
      requireApiKey(ai.anthropic.apiKey, 'ANTHROPIC_API_KEY', 'CHAT_PROVIDER=claude');
      warnExternalProvider('CHAT_PROVIDER', 'claude');
      return new ClaudeChatProvider({
        apiKey: ai.anthropic.apiKey,
        baseUrl: ai.anthropic.baseUrl,
        model: ai.anthropic.chatModel,
        timeoutMs: ai.chatTimeoutMs,
      });
    default:
      throw new Error(
        `CHAT_PROVIDER inválido: "${ai.chatProvider}". Valores aceitos: ollama, openai, claude`,
      );
  }
}

/**
 * Camada de provedores de IA. Quem precisa de IA injeta pelo token
 * (`@Inject(EMBEDDING_PROVIDER)` / `@Inject(CHAT_PROVIDER)`) e nunca sabe
 * qual fornecedor está por trás.
 */
@Module({
  providers: [
    { provide: EMBEDDING_PROVIDER, inject: [APP_CONFIG], useFactory: createEmbeddingProvider },
    { provide: CHAT_PROVIDER, inject: [APP_CONFIG], useFactory: createChatProvider },
  ],
  exports: [EMBEDDING_PROVIDER, CHAT_PROVIDER],
})
export class AiModule {}
