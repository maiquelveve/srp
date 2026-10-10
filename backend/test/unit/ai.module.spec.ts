import { AppConfig } from '../../src/config/configuration';
import { createChatProvider, createEmbeddingProvider } from '../../src/ai/ai.module';
import { OllamaEmbeddingProvider } from '../../src/ai/providers/ollama-embedding.provider';
import { OpenAiEmbeddingProvider } from '../../src/ai/providers/openai-embedding.provider';
import { OllamaChatProvider } from '../../src/ai/providers/ollama-chat.provider';
import { OpenAiChatProvider } from '../../src/ai/providers/openai-chat.provider';
import { ClaudeChatProvider } from '../../src/ai/providers/claude-chat.provider';

function buildConfig(overrides: Partial<AppConfig['ai']> = {}): AppConfig {
  const ai: AppConfig['ai'] = {
    embeddingProvider: 'ollama',
    chatProvider: 'ollama',
    embeddingDimensions: 1024,
    embeddingTimeoutMs: 30_000,
    chatTimeoutMs: 60_000,
    embeddingBatchSize: 16,
    ollama: {
      baseUrl: 'http://localhost:11434',
      embeddingModel: 'bge-m3',
      chatModel: 'qwen2.5:7b-instruct',
      chatNumCtx: 8192,
    },
    openai: {
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com',
      embeddingModel: 'text-embedding-3-small',
      chatModel: 'gpt-4o-mini',
    },
    anthropic: {
      apiKey: 'sk-ant-test',
      baseUrl: 'https://api.anthropic.com',
      chatModel: 'claude-sonnet-5-5',
    },
    ...overrides,
  };
  return { ai } as AppConfig;
}

describe('createEmbeddingProvider', () => {
  it('builds the Ollama adapter with the configured model and dimensions', () => {
    const provider = createEmbeddingProvider(buildConfig());

    expect(provider).toBeInstanceOf(OllamaEmbeddingProvider);
    expect(provider.modelId).toBe('ollama:bge-m3');
    expect(provider.dimensions).toBe(1024);
  });

  it('builds the OpenAI adapter', () => {
    const provider = createEmbeddingProvider(buildConfig({ embeddingProvider: 'openai' }));

    expect(provider).toBeInstanceOf(OpenAiEmbeddingProvider);
    expect(provider.modelId).toBe('openai:text-embedding-3-small');
  });

  it('fails on an unknown provider, naming the accepted values', () => {
    expect(() => createEmbeddingProvider(buildConfig({ embeddingProvider: 'xyz' }))).toThrow(
      /EMBEDDING_PROVIDER inválido: "xyz".*ollama, openai/,
    );
  });

  it('fails when OpenAI is selected without an API key', () => {
    const config = buildConfig({ embeddingProvider: 'openai' });
    config.ai.openai.apiKey = '';

    expect(() => createEmbeddingProvider(config)).toThrow(/OPENAI_API_KEY/);
  });

  it('fails on an invalid dimension', () => {
    expect(() => createEmbeddingProvider(buildConfig({ embeddingDimensions: 0 }))).toThrow(
      /EMBEDDING_DIMENSIONS/,
    );
    expect(() => createEmbeddingProvider(buildConfig({ embeddingDimensions: NaN }))).toThrow(
      /EMBEDDING_DIMENSIONS/,
    );
  });
});

describe('createChatProvider', () => {
  it('builds the Ollama adapter', () => {
    const provider = createChatProvider(buildConfig());

    expect(provider).toBeInstanceOf(OllamaChatProvider);
    expect(provider.modelId).toBe('ollama:qwen2.5:7b-instruct');
  });

  it('builds the OpenAI adapter', () => {
    expect(createChatProvider(buildConfig({ chatProvider: 'openai' }))).toBeInstanceOf(
      OpenAiChatProvider,
    );
  });

  it('builds the Claude adapter', () => {
    expect(createChatProvider(buildConfig({ chatProvider: 'claude' }))).toBeInstanceOf(
      ClaudeChatProvider,
    );
  });

  it('fails on an unknown provider, naming the accepted values', () => {
    expect(() => createChatProvider(buildConfig({ chatProvider: 'xyz' }))).toThrow(
      /CHAT_PROVIDER inválido: "xyz".*ollama, openai, claude/,
    );
  });

  it('fails when Claude is selected without an API key', () => {
    const config = buildConfig({ chatProvider: 'claude' });
    config.ai.anthropic.apiKey = '';

    expect(() => createChatProvider(config)).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('allows embeddings and chat to use different providers', () => {
    const config = buildConfig({ embeddingProvider: 'ollama', chatProvider: 'claude' });

    expect(createEmbeddingProvider(config)).toBeInstanceOf(OllamaEmbeddingProvider);
    expect(createChatProvider(config)).toBeInstanceOf(ClaudeChatProvider);
  });
});
