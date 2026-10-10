import { FakeChatProvider } from '../integration/fakes/fake-chat.provider';
import { FakeEmbeddingProvider } from '../integration/fakes/fake-embedding.provider';

function cosineSimilarity(first: number[], second: number[]): number {
  return first.reduce((sum, value, index) => sum + value * second[index], 0);
}

describe('FakeEmbeddingProvider', () => {
  const provider = new FakeEmbeddingProvider(64);

  it('is deterministic and returns normalized vectors of the configured size', async () => {
    const [first] = await provider.embed(['escolta hospitalar']);
    const [second] = await provider.embed(['escolta hospitalar']);

    expect(first).toHaveLength(64);
    expect(first).toEqual(second);
    expect(cosineSimilarity(first, first)).toBeCloseTo(1, 5);
  });

  it('puts texts that share words closer than unrelated texts', async () => {
    const [question, related, unrelated] = await provider.embed([
      'passos escolta hospitalar',
      'escolta hospitalar exige comunicar a chefia',
      'receita de bolo de chocolate',
    ]);

    expect(cosineSimilarity(question, related)).toBeGreaterThan(
      cosineSimilarity(question, unrelated),
    );
  });

  it('fails with the requested kind until reset', async () => {
    provider.failWith('RATE_LIMIT');
    await expect(provider.embed(['a'])).rejects.toMatchObject({ kind: 'RATE_LIMIT' });

    provider.reset();
    await expect(provider.embed(['a'])).resolves.toHaveLength(1);
  });
});

describe('FakeChatProvider', () => {
  it('answers with the configured text and records the request', async () => {
    const provider = new FakeChatProvider();
    provider.respondWith('ok');

    await expect(provider.generate({ systemPrompt: 's', userPrompt: 'u' })).resolves.toEqual({
      text: 'ok',
    });
    expect(provider.requests).toEqual([{ systemPrompt: 's', userPrompt: 'u' }]);
  });

  it('fails with the requested kind', async () => {
    const provider = new FakeChatProvider();
    provider.failWith('QUOTA_OR_AUTH');

    await expect(provider.generate({ systemPrompt: 's', userPrompt: 'u' })).rejects.toMatchObject({
      kind: 'QUOTA_OR_AUTH',
    });
  });
});
