import { OpenAiEmbeddingProvider } from '../../src/ai/providers/openai-embedding.provider';

const DIMENSIONS = 4;

function vectorOf(value: number): number[] {
  return Array.from({ length: DIMENSIONS }, () => value);
}

describe('OpenAiEmbeddingProvider', () => {
  const provider = new OpenAiEmbeddingProvider({
    apiKey: 'sk-test',
    baseUrl: 'https://openai.test',
    model: 'text-embedding-3-small',
    dimensions: DIMENSIONS,
    timeoutMs: 1000,
    batchSize: 16,
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes the model id and dimensions', () => {
    expect(provider.modelId).toBe('openai:text-embedding-3-small');
    expect(provider.dimensions).toBe(DIMENSIONS);
  });

  it('sends the key, the model and the dimensions, and returns the vectors', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { index: 0, embedding: vectorOf(0.1) },
            { index: 1, embedding: vectorOf(0.2) },
          ],
        }),
        { status: 200 },
      ),
    );

    const vectors = await provider.embed(['a', 'b']);

    expect(vectors).toEqual([vectorOf(0.1), vectorOf(0.2)]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openai.test/v1/embeddings');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init?.body as string)).toEqual({
      model: 'text-embedding-3-small',
      input: ['a', 'b'],
      dimensions: DIMENSIONS,
    });
  });

  it('puts the vectors back in input order when the API answers out of order', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { index: 1, embedding: vectorOf(0.2) },
            { index: 0, embedding: vectorOf(0.1) },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(provider.embed(['a', 'b'])).resolves.toEqual([vectorOf(0.1), vectorOf(0.2)]);
  });

  it('rejects a response without "data"', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

    await expect(provider.embed(['a'])).rejects.toMatchObject({ kind: 'INVALID_RESPONSE' });
  });

  it('maps HTTP 429 to RATE_LIMIT', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 429 }));

    await expect(provider.embed(['a'])).rejects.toMatchObject({ kind: 'RATE_LIMIT' });
  });
});
