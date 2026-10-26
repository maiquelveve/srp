import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { CHAT_PROVIDER, EMBEDDING_PROVIDER } from '../../src/ai/ai.tokens';
import { FakeChatProvider } from './fakes/fake-chat.provider';
import { FakeEmbeddingProvider } from './fakes/fake-embedding.provider';

/**
 * Prova a "fiação" da camada de IA: o módulo sobe com provedores trocados por
 * tokens, e a checagem de boot derruba a aplicação quando a dimensão configurada
 * contradiz a coluna do banco (a coluna é vector(1024), migration AddKnowledgeBase).
 */
describe('Knowledge base AI wiring', () => {
  it('boots with fake providers injected through the tokens', async () => {
    const embeddingProvider = new FakeEmbeddingProvider(1024);
    const chatProvider = new FakeChatProvider();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMBEDDING_PROVIDER)
      .useValue(embeddingProvider)
      .overrideProvider(CHAT_PROVIDER)
      .useValue(chatProvider)
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    expect(app.get(EMBEDDING_PROVIDER)).toBe(embeddingProvider);
    expect(app.get(CHAT_PROVIDER)).toBe(chatProvider);

    await app.close();
  });

  it('boots with the real Ollama adapters chosen by the default configuration', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    expect(app.get(EMBEDDING_PROVIDER).modelId).toBe('ollama:bge-m3');
    expect(app.get(CHAT_PROVIDER).modelId).toBe('ollama:qwen2.5:7b-instruct');

    await app.close();
  });

  it('fails the boot when the embedding dimension does not match the database column', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMBEDDING_PROVIDER)
      .useValue(new FakeEmbeddingProvider(768))
      .compile();
    const app = moduleRef.createNestApplication();

    await expect(app.init()).rejects.toThrow(/EMBEDDING_DIMENSIONS \(768\).*vector\(1024\)/);

    await app.close();
  });
});
